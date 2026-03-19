"""
Docker API Routes
"""

from flask import Blueprint, jsonify, request
from shared_lib.flask_helpers import success, error as api_error
import logging

# Import will be done in app.py to avoid circular imports
docker_service = None

logger = logging.getLogger(__name__)

# Create Blueprint
docker_bp = Blueprint('docker', __name__, url_prefix='/api/docker')

def init_docker_routes(service):
    """Initialize routes with docker service"""
    global docker_service
    docker_service = service

@docker_bp.route('/containers', methods=['GET'])
def get_containers():
    """Get list of all containers"""
    try:
        containers = docker_service.get_containers()
        return success(containers=containers, count=len(containers))
    except Exception as e:
        logger.error(f"Error getting containers: {e}")
        return api_error(500, str(e))

@docker_bp.route('/control', methods=['POST'])
def control_container():
    """Control a container (start/stop/restart)"""
    try:
        data = request.get_json()
        name = data.get('name')
        action = data.get('action')

        if not name or not action:
            return api_error(400, 'Missing name or action')

        if action not in ['start', 'stop', 'restart']:
            return api_error(400, 'Invalid action. Must be start, stop, or restart')

        # Execute action
        if action == 'start':
            docker_service.start_container(name)
        elif action == 'stop':
            docker_service.stop_container(name)
        elif action == 'restart':
            docker_service.restart_container(name)

        return success(message=f'Container {name} {action}ed successfully')

    except Exception as e:
        logger.error(f"Error controlling container: {e}")
        return api_error(500, str(e))

@docker_bp.route('/health', methods=['GET'])
def health():
    """Docker service health check"""
    return success(
        docker_available=docker_service.available if docker_service else False
    )

@docker_bp.route('/llm/start', methods=['POST'])
def start_llm():
    """Start LLM stack (Ollama + Open WebUI)"""
    try:
        result = docker_service.start_llm_stack()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error starting LLM stack: {e}")
        return api_error(500, str(e))

@docker_bp.route('/llm/stop', methods=['POST'])
def stop_llm():
    """Stop LLM stack (Ollama + Open WebUI)"""
    try:
        result = docker_service.stop_llm_stack()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error stopping LLM stack: {e}")
        return api_error(500, str(e))

@docker_bp.route('/llm/status', methods=['GET'])
def get_llm_status():
    """Get LLM stack status"""
    try:
        ollama_status = docker_service.get_container_status('ollama')
        webui_status = docker_service.get_container_status('open-webui')

        return success(**{
            'ollama': ollama_status,
            'open-webui': webui_status,
            'running': ollama_status == 'running' and webui_status == 'running'
        })
    except Exception as e:
        logger.error(f"Error getting LLM status: {e}")
        return api_error(500, str(e))

@docker_bp.route('/stable-diffusion/start', methods=['POST'])
def start_stable_diffusion():
    """Start Stable Diffusion Web UI"""
    try:
        result = docker_service.start_stable_diffusion()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error starting Stable Diffusion: {e}")
        return api_error(500, str(e))

@docker_bp.route('/stable-diffusion/stop', methods=['POST'])
def stop_stable_diffusion():
    """Stop Stable Diffusion Web UI"""
    try:
        result = docker_service.stop_stable_diffusion()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error stopping Stable Diffusion: {e}")
        return api_error(500, str(e))

@docker_bp.route('/stable-diffusion/status', methods=['GET'])
def get_stable_diffusion_status():
    """Get Stable Diffusion status"""
    try:
        sd_status = docker_service.get_container_status('stable-diffusion')
        return success(
            container_status=sd_status,
            running=sd_status == 'running'
        )
    except Exception as e:
        logger.error(f"Error getting Stable Diffusion status: {e}")
        return api_error(500, str(e))
