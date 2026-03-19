"""
Project Actions API Routes - CRUD for project-level action items
"""

from flask import Blueprint, jsonify, request
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
        status = request.args.get('status')
        actions = _service.get_actions(project_id=project_id, status=status)
        return jsonify({
            'status': 'ok',
            'actions': actions,
            'count': len(actions)
        })
    except Exception as e:
        logger.error(f"Error listing actions: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@project_actions_bp.route('/api/project-actions', methods=['POST'])
def create_action():
    """Create a new project action"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No JSON body'}), 400

        for field in ('project_id', 'title'):
            if not data.get(field):
                return jsonify({
                    'status': 'error',
                    'message': f'{field} is required'
                }), 400

        action_id = _service.create_action(data)
        return jsonify({
            'status': 'ok',
            'id': action_id,
            'message': 'Action created'
        }), 201

    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 404
    except Exception as e:
        logger.error(f"Error creating action: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@project_actions_bp.route('/api/project-actions/<int:action_id>', methods=['PUT'])
def update_action(action_id):
    """Update an existing action"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No JSON body'}), 400

        updated = _service.update_action(action_id, data)
        if not updated:
            return jsonify({'status': 'error', 'message': 'Action not found'}), 404

        return jsonify({'status': 'ok', 'message': 'Action updated'})

    except Exception as e:
        logger.error(f"Error updating action: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@project_actions_bp.route('/api/project-actions/<int:action_id>', methods=['DELETE'])
def delete_action(action_id):
    """Delete an action"""
    try:
        deleted = _service.delete_action(action_id)
        if not deleted:
            return jsonify({'status': 'error', 'message': 'Action not found'}), 404
        return jsonify({'status': 'ok', 'message': 'Action deleted'})
    except Exception as e:
        logger.error(f"Error deleting action: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@project_actions_bp.route('/api/project-actions/stats')
def get_action_stats():
    """Get action statistics by status and project"""
    try:
        stats = _service.get_stats()
        return jsonify({'status': 'ok', 'stats': stats})
    except Exception as e:
        logger.error(f"Error getting action stats: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
