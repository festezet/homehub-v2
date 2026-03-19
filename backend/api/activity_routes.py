"""
Activity API Routes - Project activity timeline and logging
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
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
        return success(timeline=timeline, count=len(timeline))
    except Exception as e:
        logger.error(f"Error getting timeline: {e}")
        return api_error(500, str(e))


@activity_bp.route('/api/activity/log', methods=['POST'])
def log_activity():
    """Log a new activity entry"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')

        project_id = data.get('project_id')
        activity_type = data.get('type', 'feature')
        title = data.get('title')

        if not project_id or not title:
            return api_error(400, 'project_id and title are required')

        entry_id = _service.log_activity({
            'project_id': project_id,
            'type': activity_type,
            'title': title,
            'description': data.get('description'),
            'session_doc': data.get('session_doc'),
            'date': data.get('date')
        })

        return success(id=entry_id, message='Activity logged', status_code=201)

    except Exception as e:
        logger.error(f"Error logging activity: {e}")
        return api_error(500, str(e))


@activity_bp.route('/api/activity/project/<project_id>')
def get_project_activity(project_id):
    """Get recent activity for a specific project"""
    try:
        limit = request.args.get('limit', 5, type=int)
        activities = _service.get_project_activity(project_id, limit=limit)
        return success(activities=activities, count=len(activities))
    except Exception as e:
        logger.error(f"Error getting project activity: {e}")
        return api_error(500, str(e))


@activity_bp.route('/api/projects/recent-sessions')
def get_recent_sessions():
    """Get projects with most recent activity and last milestone"""
    try:
        limit = request.args.get('limit', 10, type=int)
        sessions = _service.get_recent_sessions(limit=limit)
        return success(sessions=sessions, count=len(sessions))
    except Exception as e:
        logger.error(f"Error getting recent sessions: {e}")
        return api_error(500, str(e))


@activity_bp.route('/api/activity/top-projects')
def get_top_projects():
    """Get most active projects ranked by frequency * recency"""
    try:
        limit = request.args.get('limit', 10, type=int)
        projects = _service.get_top_projects(limit=limit)
        return success(projects=projects, count=len(projects))
    except Exception as e:
        logger.error(f"Error getting top projects: {e}")
        return api_error(500, str(e))


@activity_bp.route('/api/projects/ranking')
def get_ranking():
    """Get strategic project ranking (composite score)"""
    try:
        limit = request.args.get('limit', 15, type=int)
        projects = _service.get_strategic_ranking(limit=limit)
        return success(projects=projects, count=len(projects))
    except Exception as e:
        logger.error(f"Error getting ranking: {e}")
        return api_error(500, str(e))


@activity_bp.route('/api/activity/stats')
def get_stats():
    """Get activity statistics"""
    try:
        stats = _service.get_activity_stats()
        return success(stats=stats)
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return api_error(500, str(e))
