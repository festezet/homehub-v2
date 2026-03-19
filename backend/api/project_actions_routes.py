"""
Project Actions API Routes - CRUD for project-level action items
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

project_actions_bp = Blueprint('project_actions', __name__)

_service = None


def init_project_actions_routes(service):
    global _service
    _service = service


@project_actions_bp.route('/api/project-actions')
def list_actions():
    """List project actions with optional filters"""
    try:
        project_id = request.args.get('project_id')
        action_status = request.args.get('status')
        actions = _service.get_actions(project_id=project_id, status=action_status)
        return success(actions=actions, count=len(actions))
    except Exception as e:
        logger.error(f"Error listing actions: {e}")
        return api_error(500, str(e))


@project_actions_bp.route('/api/project-actions', methods=['POST'])
def create_action():
    """Create a new project action"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')

        for field in ('project_id', 'title'):
            if not data.get(field):
                return api_error(400, f'{field} is required')

        action_id = _service.create_action(data)
        return success(id=action_id, message='Action created', status_code=201)

    except ValueError as e:
        return api_error(404, str(e))
    except Exception as e:
        logger.error(f"Error creating action: {e}")
        return api_error(500, str(e))


@project_actions_bp.route('/api/project-actions/<int:action_id>', methods=['PUT'])
def update_action(action_id):
    """Update an existing action"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')

        updated = _service.update_action(action_id, data)
        if not updated:
            return api_error(404, 'Action not found')

        return success(message='Action updated')

    except Exception as e:
        logger.error(f"Error updating action: {e}")
        return api_error(500, str(e))


@project_actions_bp.route('/api/project-actions/<int:action_id>', methods=['DELETE'])
def delete_action(action_id):
    """Delete an action"""
    try:
        deleted = _service.delete_action(action_id)
        if not deleted:
            return api_error(404, 'Action not found')
        return success(message='Action deleted')
    except Exception as e:
        logger.error(f"Error deleting action: {e}")
        return api_error(500, str(e))


@project_actions_bp.route('/api/project-actions/stats')
def get_action_stats():
    """Get action statistics by status and project"""
    try:
        stats = _service.get_stats()
        return success(stats=stats)
    except Exception as e:
        logger.error(f"Error getting action stats: {e}")
        return api_error(500, str(e))
