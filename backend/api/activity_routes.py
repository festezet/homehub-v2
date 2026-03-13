"""
Activity API Routes - Project activity timeline and logging
"""

from flask import Blueprint, jsonify, request
import logging

logger = logging.getLogger(__name__)

activity_bp = Blueprint('activity', __name__)

# Service reference (set via init function)
_service = None


def init_activity_routes(service):
    global _service
    _service = service


@activity_bp.route('/api/activity/timeline')
def get_timeline():
    """Get activity timeline with optional filters"""
    try:
        limit = request.args.get('limit', 20, type=int)
        project_id = request.args.get('project_id')
        activity_type = request.args.get('type')

        timeline = _service.get_timeline(
            limit=limit,
            project_id=project_id,
            activity_type=activity_type
        )
        return jsonify({
            'status': 'ok',
            'timeline': timeline,
            'count': len(timeline)
        })
    except Exception as e:
        logger.error(f"Error getting timeline: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@activity_bp.route('/api/activity/log', methods=['POST'])
def log_activity():
    """Log a new activity entry"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No JSON body'}), 400

        project_id = data.get('project_id')
        activity_type = data.get('type', 'feature')
        title = data.get('title')

        if not project_id or not title:
            return jsonify({
                'status': 'error',
                'message': 'project_id and title are required'
            }), 400

        entry_id = _service.log_activity(
            project_id=project_id,
            activity_type=activity_type,
            title=title,
            description=data.get('description'),
            session_doc=data.get('session_doc'),
            date=data.get('date')
        )

        return jsonify({
            'status': 'ok',
            'id': entry_id,
            'message': 'Activity logged'
        }), 201

    except Exception as e:
        logger.error(f"Error logging activity: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@activity_bp.route('/api/activity/project/<project_id>')
def get_project_activity(project_id):
    """Get recent activity for a specific project"""
    try:
        limit = request.args.get('limit', 5, type=int)
        activities = _service.get_project_activity(project_id, limit=limit)
        return jsonify({
            'status': 'ok',
            'activities': activities,
            'count': len(activities)
        })
    except Exception as e:
        logger.error(f"Error getting project activity: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@activity_bp.route('/api/activity/stats')
def get_stats():
    """Get activity statistics"""
    try:
        stats = _service.get_activity_stats()
        return jsonify({
            'status': 'ok',
            'stats': stats
        })
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
