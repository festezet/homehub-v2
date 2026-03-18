"""
TODO API Routes
"""

from flask import Blueprint, jsonify, request
import logging

# Import will be done in app.py to avoid circular imports
todo_service = None

logger = logging.getLogger(__name__)

# Create Blueprint
todo_bp = Blueprint('todos', __name__, url_prefix='/api/todos')

def init_todo_routes(service):
    """Initialize routes with todo service"""
    global todo_service
    todo_service = service

@todo_bp.route('', methods=['GET'])
def get_all_todos():
    """Get all TODO items"""
    try:
        todos = todo_service.get_all_todos()
        return jsonify({
            'status': 'ok',
            'todos': todos,
            'count': len(todos)
        })
    except Exception as e:
        logger.error(f"Error getting todos: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@todo_bp.route('', methods=['POST'])
def create_todo():
    """Create a new TODO item"""
    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('action'):
            return jsonify({
                'status': 'error',
                'message': 'Missing required field: action'
            }), 400

        # Build todo object with defaults
        todo_data = {
            'action': data['action'],
            'status': data.get('status', 'To Do'),
            'priority': data.get('priority', 'P3-Normal'),
            'deadline': data.get('deadline'),
            'blocking': data.get('blocking', 'Non'),
            'category': data.get('category', 'Admin'),
            'notes': data.get('notes', ''),
            'objective': data.get('objective', ''),
            'withClaude': data.get('withClaude', 'Non'),
            'time': data.get('time', 30)
        }

        # Create todo with all supported fields
        todo_id = todo_service.create_todo(todo_data)

        # Return created todo object for frontend
        todo_data['id'] = todo_id
        return jsonify({
            'status': 'ok',
            'message': 'TODO created successfully',
            'id': todo_id,
            'todo': todo_data
        }), 201

    except Exception as e:
        logger.error(f"Error creating todo: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@todo_bp.route('/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    """Update a TODO item"""
    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('field') or 'value' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: field and value'
            }), 400

        # Update todo
        todo_service.update_todo(
            todo_id=todo_id,
            field=data['field'],
            value=data['value']
        )

        return jsonify({
            'status': 'ok',
            'message': 'TODO updated successfully'
        })

    except ValueError as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error updating todo {todo_id}: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@todo_bp.route('/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    """Delete a TODO item"""
    try:
        todo_service.delete_todo(todo_id)

        return jsonify({
            'status': 'ok',
            'message': 'TODO deleted successfully'
        })

    except Exception as e:
        logger.error(f"Error deleting todo {todo_id}: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@todo_bp.route('/health', methods=['GET'])
def health():
    """TODO service health check"""
    return jsonify({
        'status': 'ok',
        'service': 'TODO API',
        'database': todo_service.db_path,
        'db_exists': True  # We could check if file exists
    })
