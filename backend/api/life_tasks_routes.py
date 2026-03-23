"""
Life Tasks API Routes - CRUD for ephemeral life tasks
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

life_tasks_bp = Blueprint('life_tasks', __name__)

_service = None


def init_life_tasks_routes(service):
    global _service
    _service = service


@life_tasks_bp.route('/api/life-tasks')
def list_tasks():
    """List life tasks with optional filters"""
    try:
        status = request.args.get('status')
        category = request.args.get('category')
        tasks = _service.get_tasks(status=status, category=category)
        return success(tasks=tasks, count=len(tasks))
    except Exception as e:
        logger.error(f"Error listing life tasks: {e}")
        return api_error(500, str(e))


@life_tasks_bp.route('/api/life-tasks', methods=['POST'])
def create_task():
    """Create a new life task"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        for field in ('title', 'category'):
            if not data.get(field):
                return api_error(400, f'{field} is required')
        result = _service.create_task(data)
        return success(id=result['id'], unique_id=result['unique_id'], message='Life task created', status_code=201)
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error creating life task: {e}")
        return api_error(500, str(e))


@life_tasks_bp.route('/api/life-tasks/templates')
def get_templates():
    """Get available category templates"""
    try:
        templates = _service.get_templates()
        return success(templates=templates)
    except Exception as e:
        logger.error(f"Error getting templates: {e}")
        return api_error(500, str(e))


@life_tasks_bp.route('/api/life-tasks/stats')
def get_stats():
    """Get life tasks statistics"""
    try:
        stats = _service.get_stats()
        return success(stats=stats)
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return api_error(500, str(e))


@life_tasks_bp.route('/api/life-tasks/<task_id>')
def get_task(task_id):
    """Get a single life task"""
    try:
        task = _service.get_task(task_id)
        if not task:
            return api_error(404, f'Task {task_id} not found')
        return success(task=task)
    except Exception as e:
        logger.error(f"Error getting life task: {e}")
        return api_error(500, str(e))


@life_tasks_bp.route('/api/life-tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    """Update a life task"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        updated = _service.update_task(task_id, data)
        if not updated:
            return api_error(404, f'Task {task_id} not found')
        return success(message='Task updated')
    except Exception as e:
        logger.error(f"Error updating life task: {e}")
        return api_error(500, str(e))


@life_tasks_bp.route('/api/life-tasks/<task_id>/steps', methods=['PUT'])
def update_steps(task_id):
    """Update task checklist steps"""
    try:
        data = request.get_json()
        if not data or 'steps' not in data:
            return api_error(400, 'steps array is required')
        updated = _service.update_steps(task_id, data['steps'])
        if not updated:
            return api_error(404, f'Task {task_id} not found')
        return success(message='Steps updated')
    except Exception as e:
        logger.error(f"Error updating steps: {e}")
        return api_error(500, str(e))


@life_tasks_bp.route('/api/life-tasks/<task_id>/resolve', methods=['POST'])
def resolve_task(task_id):
    """Resolve/complete a life task"""
    try:
        data = request.get_json() or {}
        resolved = _service.resolve_task(task_id, data.get('resolution'))
        if not resolved:
            return api_error(404, f'Task {task_id} not found')
        return success(message='Task resolved')
    except Exception as e:
        logger.error(f"Error resolving life task: {e}")
        return api_error(500, str(e))


@life_tasks_bp.route('/api/life-tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a life task"""
    try:
        deleted = _service.delete_task(task_id)
        if not deleted:
            return api_error(404, f'Task {task_id} not found')
        return success(message='Task deleted')
    except Exception as e:
        logger.error(f"Error deleting life task: {e}")
        return api_error(500, str(e))
