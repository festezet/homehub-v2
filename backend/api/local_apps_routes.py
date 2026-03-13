"""
Local Apps API Routes
"""

from flask import Blueprint, jsonify, request
import subprocess
import os
import logging

local_apps_service = None
logger = logging.getLogger(__name__)

local_apps_bp = Blueprint('local_apps', __name__, url_prefix='/api/local-apps')


def init_local_apps_routes(service):
    """Initialize routes with local apps service"""
    global local_apps_service
    local_apps_service = service


def _get_x11_env():
    """Import get_x11_env from app module"""
    import sys
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from app import get_x11_env
    return get_x11_env()


@local_apps_bp.route('/apps', methods=['GET'])
def get_apps():
    """Get all apps grouped by category (frequent-use first)"""
    try:
        categories = local_apps_service.get_all_apps()
        total = sum(len(c['apps']) for c in categories)
        return jsonify({
            'status': 'ok',
            'categories': categories,
            'total_apps': total
        })
    except Exception as e:
        logger.error(f"Error getting apps: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@local_apps_bp.route('/apps', methods=['POST'])
def create_app():
    """Create a new app entry.

    JSON body:
        name (str): Display name (required)
        category (str): Category slug (required)
        description (str): Optional description
        icon (str): Optional icon/emoji
        app_type (str): project|docker|system (default: project)
        project_id (str): Optional PRJ-XXX or APP-XXX
        launcher_path (str): Optional path to launcher script
        launcher_type (str): Optional launcher type
        web_url (str): Optional web URL
        docker_stack (str): Optional docker stack name
        position (int): Optional sort order
    """
    try:
        data = request.get_json()

        if not data.get('name') or not data.get('category'):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: name and category'
            }), 400

        category = data['category']

        # Auto-create category if it doesn't exist
        existing_cats = [c['slug'] for c in local_apps_service.get_categories()]
        if category not in existing_cats:
            local_apps_service.create_category(
                slug=category,
                name=category.replace('-', ' ').title(),
                position=len(existing_cats)
            )

        app_id = local_apps_service.create_app(
            name=data['name'],
            category_slug=category,
            description=data.get('description', ''),
            icon=data.get('icon', ''),
            app_type=data.get('app_type', 'project'),
            project_id=data.get('project_id', ''),
            launcher_path=data.get('launcher_path', ''),
            launcher_type=data.get('launcher_type', ''),
            web_url=data.get('web_url', ''),
            docker_stack=data.get('docker_stack', ''),
            position=data.get('position', 0)
        )

        return jsonify({
            'status': 'ok',
            'message': f"App '{data['name']}' created successfully",
            'id': app_id
        }), 201

    except Exception as e:
        logger.error(f"Error creating app: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@local_apps_bp.route('/apps/<int:app_id>', methods=['PUT'])
def update_app(app_id):
    """Update an app entry"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400

        # Remap 'category' to 'category_slug' if present
        if 'category' in data:
            data['category_slug'] = data.pop('category')

        local_apps_service.update_app(app_id, **data)
        return jsonify({
            'status': 'ok',
            'message': f'App {app_id} updated successfully'
        })

    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating app {app_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@local_apps_bp.route('/apps/<int:app_id>', methods=['DELETE'])
def delete_app(app_id):
    """Delete an app entry"""
    try:
        local_apps_service.delete_app(app_id)
        return jsonify({
            'status': 'ok',
            'message': f'App {app_id} deleted successfully'
        })
    except Exception as e:
        logger.error(f"Error deleting app {app_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@local_apps_bp.route('/apps/<int:app_id>/launch', methods=['POST'])
def launch_app(app_id):
    """Launch an app: increment counter + subprocess launch"""
    try:
        app = local_apps_service.record_launch(app_id)

        app_type = app.get('app_type', 'project')
        launcher_path = app.get('launcher_path', '')
        docker_stack = app.get('docker_stack', '')

        # Docker apps are handled by existing docker API, just record the launch
        if app_type == 'docker':
            return jsonify({
                'status': 'ok',
                'message': f"{app['name']} launch recorded",
                'app': app,
                'action': 'docker'
            })

        # System apps (direct command)
        if app_type == 'system':
            if not launcher_path:
                return jsonify({
                    'status': 'error',
                    'message': f"No launcher configured for {app['name']}"
                }), 400

            env = _get_x11_env()
            subprocess.Popen(
                ['setsid', '-f', launcher_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=env,
                close_fds=True
            )

            return jsonify({
                'status': 'ok',
                'message': f"{app['name']} launched successfully",
                'app': app
            })

        # Project apps (bash launcher with logging)
        if not launcher_path or not os.path.exists(launcher_path):
            return jsonify({
                'status': 'error',
                'message': f"Launcher not found for {app['name']}: {launcher_path}"
            }), 404

        env = _get_x11_env()
        project_id = app.get('project_id', f'app-{app_id}')
        log_stdout = f"/tmp/homehub_{project_id}_stdout.log"
        log_stderr = f"/tmp/homehub_{project_id}_stderr.log"

        cwd = os.path.dirname(launcher_path)

        with open(log_stdout, 'w') as out, open(log_stderr, 'w') as err:
            subprocess.Popen(
                ['bash', launcher_path],
                stdout=out,
                stderr=err,
                stdin=subprocess.DEVNULL,
                start_new_session=True,
                cwd=cwd,
                env=env,
                close_fds=True
            )

        logger.info(f"Launched {app['name']}, logs: {log_stdout}")

        return jsonify({
            'status': 'ok',
            'message': f"{app['name']} launched successfully",
            'app': app
        })

    except Exception as e:
        logger.error(f"Error launching app {app_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@local_apps_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all categories"""
    try:
        cats = local_apps_service.get_categories()
        return jsonify({
            'status': 'ok',
            'categories': cats,
            'count': len(cats)
        })
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@local_apps_bp.route('/health', methods=['GET'])
def health():
    """Health check"""
    count = local_apps_service.get_app_count()
    cats = local_apps_service.get_categories()
    return jsonify({
        'status': 'ok',
        'service': 'Local Apps API',
        'apps_count': count,
        'categories_count': len(cats)
    })
