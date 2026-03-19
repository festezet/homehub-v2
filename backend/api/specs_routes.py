"""
Specs API Routes
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

specs_service = None

logger = logging.getLogger(__name__)

specs_bp = Blueprint('specs', __name__, url_prefix='/api/specs')


def init_specs_routes(service):
    """Initialize routes with specs service"""
    global specs_service
    specs_service = service


@specs_bp.route('', methods=['GET'])
def get_all_specs():
    """Get all projects with spec status"""
    try:
        specs = specs_service.get_all_specs()
        return success(specs=specs, count=len(specs))
    except Exception as e:
        logger.error(f"Error getting specs: {e}")
        return api_error(500, str(e))


@specs_bp.route('/<int:project_id>', methods=['PUT'])
def update_spec(project_id):
    """Update a spec field for a project"""
    try:
        data = request.get_json()

        if not data.get('field') or 'value' not in data:
            return api_error(400, 'Missing required fields: field and value')

        specs_service.update_spec(
            project_id=project_id,
            field=data['field'],
            value=data['value']
        )

        return success(message='Spec updated successfully')

    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error updating spec {project_id}: {e}")
        return api_error(500, str(e))


@specs_bp.route('/scan', methods=['POST'])
def scan_specs():
    """Scan filesystem for SPEC.md files"""
    try:
        results = specs_service.scan_specs()
        return success(message='Scan complete', results=results)
    except Exception as e:
        logger.error(f"Error scanning specs: {e}")
        return api_error(500, str(e))


@specs_bp.route('/health-scan', methods=['POST'])
def scan_health():
    """Scan all projects for health metrics"""
    try:
        results = specs_service.scan_health()
        return success(message='Health scan complete', results=results)
    except Exception as e:
        logger.error(f"Error scanning health: {e}")
        return api_error(500, str(e))


@specs_bp.route('/security-scan', methods=['POST'])
def scan_security():
    """Run security audit on all active projects"""
    try:
        results = specs_service.scan_security_scores()
        return success(message='Security scan complete', results=results)
    except Exception as e:
        logger.error(f"Error scanning security: {e}")
        return api_error(500, str(e))
