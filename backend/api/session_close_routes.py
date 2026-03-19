"""
Session Close API Routes - Structured end-of-session records
"""

from flask import Blueprint, jsonify, request
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
            return jsonify({'status': 'error', 'message': 'No JSON body'}), 400

        for field in ('project_id', 'session_date', 'summary'):
            if not data.get(field):
                return jsonify({
                    'status': 'error',
                    'message': f'{field} is required'
                }), 400

        close_id = _service.create(data)
        return jsonify({
            'status': 'ok',
            'id': close_id,
            'message': 'Session close recorded'
        }), 201

    except Exception as e:
        logger.error(f"Error creating session close: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@session_close_bp.route('/api/session-close')
def list_session_closes():
    """List session closes with optional project filter"""
    try:
        project_id = request.args.get('project_id')
        limit = request.args.get('limit', 20, type=int)
        closes = _service.get_closes(project_id=project_id, limit=limit)
        return jsonify({
            'status': 'ok',
            'closes': closes,
            'count': len(closes)
        })
    except Exception as e:
        logger.error(f"Error listing session closes: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@session_close_bp.route('/api/session-close/latest/<project_id>')
def get_latest_close(project_id):
    """Get the most recent session close for a project"""
    try:
        close = _service.get_latest_by_project(project_id)
        if not close:
            return jsonify({
                'status': 'ok',
                'close': None,
                'message': 'No session close found'
            })
        return jsonify({'status': 'ok', 'close': close})
    except Exception as e:
        logger.error(f"Error getting latest close: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@session_close_bp.route('/api/session-close/recent')
def get_recent_closes():
    """Get session closes from the last N days"""
    try:
        days = request.args.get('days', 7, type=int)
        closes = _service.get_recent(days=days)
        return jsonify({
            'status': 'ok',
            'closes': closes,
            'count': len(closes)
        })
    except Exception as e:
        logger.error(f"Error getting recent closes: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
