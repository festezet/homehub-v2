"""
Claude Session Routes - Named session management, work queue, briefings
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

claude_session_bp = Blueprint('claude_sessions', __name__)

_service = None


def init_claude_session_routes(service):
    global _service
    _service = service


# ── Sessions ──

@claude_session_bp.route('/api/claude-sessions')
def list_sessions():
    """List all session names with status."""
    try:
        sessions = _service.get_all_sessions()
        return success(sessions=sessions, count=len(sessions))
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-sessions/names')
def available_names():
    """Get claimable names (idle/stale)."""
    try:
        names = _service.get_available_names()
        return success(names=names, count=len(names))
    except Exception as e:
        logger.error(f"Error getting names: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-sessions/claim', methods=['POST'])
def claim_session():
    """Claim a session name. Body: {name, work_type?, project_id?, force?}"""
    try:
        data = request.get_json()
        if not data or not data.get('name'):
            return api_error(400, 'name is required')

        name = data['name']
        force = data.get('force', False)

        if force:
            session = _service.force_claim(
                name, data.get('work_type'), data.get('project_id'))
        else:
            session = _service.claim(
                name, data.get('work_type'), data.get('project_id'))

        return success(session=session, message=f'{name} claimed')
    except ValueError as e:
        return api_error(409, str(e))
    except Exception as e:
        logger.error(f"Error claiming session: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-sessions/release', methods=['POST'])
def release_session():
    """Release a session name. Body: {name}"""
    try:
        data = request.get_json()
        if not data or not data.get('name'):
            return api_error(400, 'name is required')
        result = _service.release(data['name'])
        return success(**result, message=f"{data['name']} released")
    except Exception as e:
        logger.error(f"Error releasing session: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-sessions/heartbeat', methods=['POST'])
def session_heartbeat():
    """Update heartbeat. Body: {name, activity?}"""
    try:
        data = request.get_json()
        if not data or not data.get('name'):
            return api_error(400, 'name is required')
        updated = _service.heartbeat(data['name'], data.get('activity'))
        if not updated:
            return api_error(404, f"{data['name']} is not active")
        return success(message='heartbeat updated')
    except Exception as e:
        logger.error(f"Error updating heartbeat: {e}")
        return api_error(500, str(e))


# ── Work queue ──

@claude_session_bp.route('/api/claude-work/batch', methods=['POST'])
def create_batch():
    """Create a work batch. Body: {batch_id, work_type, items[], project_id?, created_by?}"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        for field in ('batch_id', 'work_type', 'items'):
            if not data.get(field):
                return api_error(400, f'{field} is required')
        if not isinstance(data['items'], list):
            return api_error(400, 'items must be a list')

        result = _service.create_batch(
            data['batch_id'], data['work_type'], data['items'],
            data.get('project_id'), data.get('created_by'))
        return success(**result, status_code=201)
    except Exception as e:
        logger.error(f"Error creating batch: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-work/claim', methods=['POST'])
def claim_work():
    """Claim next work item. Body: {claimed_by, work_type?}"""
    try:
        data = request.get_json()
        if not data or not data.get('claimed_by'):
            return api_error(400, 'claimed_by is required')

        item = _service.claim_work(data['claimed_by'], data.get('work_type'))
        if not item:
            return success(item=None, message='No pending work available')
        return success(item=item)
    except Exception as e:
        logger.error(f"Error claiming work: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-work/complete', methods=['POST'])
def complete_work():
    """Complete a work item. Body: {work_id, output_data?, error_message?}"""
    try:
        data = request.get_json()
        if not data or not data.get('work_id'):
            return api_error(400, 'work_id is required')

        result = _service.complete_work(
            data['work_id'], data.get('output_data'), data.get('error_message'))
        return success(**result)
    except Exception as e:
        logger.error(f"Error completing work: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-work/batch/<batch_id>')
def batch_status(batch_id):
    """Get batch progress."""
    try:
        status = _service.get_batch_status(batch_id)
        return success(**status)
    except Exception as e:
        logger.error(f"Error getting batch status: {e}")
        return api_error(500, str(e))


# ── Briefings ──

@claude_session_bp.route('/api/claude-briefings')
def get_briefings():
    """Get briefings for a session. Query: session_name, unread_only=true"""
    try:
        session_name = request.args.get('session_name')
        if not session_name:
            return api_error(400, 'session_name query param is required')
        unread = request.args.get('unread_only', 'true').lower() == 'true'
        briefings = _service.get_briefings(session_name, unread_only=unread)
        return success(briefings=briefings, count=len(briefings))
    except Exception as e:
        logger.error(f"Error getting briefings: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-briefings', methods=['POST'])
def send_briefing():
    """Send a briefing. Body: {from_session, to_session?, type, title, content, metadata?}"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        for field in ('from_session', 'type', 'title', 'content'):
            if not data.get(field):
                return api_error(400, f'{field} is required')

        result = _service.send_briefing(
            data['from_session'], data.get('to_session'),
            data['type'], data['title'], data['content'],
            data.get('metadata'))
        return success(**result, status_code=201)
    except Exception as e:
        logger.error(f"Error sending briefing: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-briefings/<int:briefing_id>/read', methods=['POST'])
def mark_read(briefing_id):
    """Mark briefing as read."""
    try:
        ok = _service.mark_briefing_read(briefing_id)
        if not ok:
            return api_error(404, 'Briefing not found')
        return success(message='marked as read')
    except Exception as e:
        logger.error(f"Error marking briefing read: {e}")
        return api_error(500, str(e))


# ── Admin ──

@claude_session_bp.route('/api/claude-sessions/stats')
def session_stats():
    """Get overview stats."""
    try:
        stats = _service.get_stats()
        return success(**stats)
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return api_error(500, str(e))


@claude_session_bp.route('/api/claude-sessions/dashboard')
def session_dashboard():
    """Get rich dashboard with per-session activity and recent work."""
    try:
        data = _service.get_dashboard()
        return success(**data)
    except Exception as e:
        logger.error(f"Error getting dashboard: {e}")
        return api_error(500, str(e))
