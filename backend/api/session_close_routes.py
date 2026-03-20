"""
Session Close API Routes - Structured end-of-session records
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

session_close_bp = Blueprint('session_close', __name__)

_service = None


def init_session_close_routes(service):
    global _service
    _service = service


@session_close_bp.route('/api/session-close', methods=['POST'])
def create_session_close():
    """Create a session close record"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')

        for field in ('project_id', 'session_date', 'summary'):
            if not data.get(field):
                return api_error(400, f'{field} is required')

        close_id = _service.create(data)
        return success(
            id=close_id,
            message='Session close recorded',
            status_code=201
        )

    except Exception as e:
        logger.error(f"Error creating session close: {e}")
        return api_error(500, str(e))


@session_close_bp.route('/api/session-close')
def list_session_closes():
    """List session closes with optional project filter"""
    try:
        project_id = request.args.get('project_id')
        limit = request.args.get('limit', 20, type=int)
        closes = _service.get_closes(project_id=project_id, limit=limit)
        return success(closes=closes, count=len(closes))
    except Exception as e:
        logger.error(f"Error listing session closes: {e}")
        return api_error(500, str(e))


@session_close_bp.route('/api/session-close/latest/<project_id>')
def get_latest_close(project_id):
    """Get the most recent session close for a project"""
    try:
        close = _service.get_latest_by_project(project_id)
        if not close:
            return success(close=None, message='No session close found')
        return success(close=close)
    except Exception as e:
        logger.error(f"Error getting latest close: {e}")
        return api_error(500, str(e))


@session_close_bp.route('/api/session-close/search')
def search_session_closes():
    """Full-text search in session closes using FTS5"""
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return api_error(400, 'q parameter is required')

        project_id = request.args.get('project_id')
        category = request.args.get('category')
        limit = request.args.get('limit', 20, type=int)

        results = _service.search(query, project_id=project_id,
                                  category=category, limit=limit)
        return success(results=results, count=len(results), query=query)
    except Exception as e:
        logger.error(f"Error searching session closes: {e}")
        return api_error(500, str(e))


@session_close_bp.route('/api/session-close/recent')
def get_recent_closes():
    """Get session closes from the last N days"""
    try:
        days = request.args.get('days', 7, type=int)
        closes = _service.get_recent(days=days)
        return success(closes=closes, count=len(closes))
    except Exception as e:
        logger.error(f"Error getting recent closes: {e}")
        return api_error(500, str(e))
