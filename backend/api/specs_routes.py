"""
Specs API Routes
"""

from flask import Blueprint, jsonify, request
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
        return jsonify({
            'status': 'ok',
            'specs': specs,
            'count': len(specs)
        })
    except Exception as e:
        logger.error(f"Error getting specs: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@specs_bp.route('/<int:project_id>', methods=['PUT'])
def update_spec(project_id):
    """Update a spec field for a project"""
    try:
        data = request.get_json()

        if not data.get('field') or 'value' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: field and value'
            }), 400

        specs_service.update_spec(
            project_id=project_id,
            field=data['field'],
            value=data['value']
        )

        return jsonify({
            'status': 'ok',
            'message': 'Spec updated successfully'
        })

    except ValueError as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error updating spec {project_id}: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@specs_bp.route('/scan', methods=['POST'])
def scan_specs():
    """Scan filesystem for SPEC.md files"""
    try:
        results = specs_service.scan_specs()
        return jsonify({
            'status': 'ok',
            'message': 'Scan complete',
            'results': results
        })
    except Exception as e:
        logger.error(f"Error scanning specs: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@specs_bp.route('/health-scan', methods=['POST'])
def scan_health():
    """Scan all projects for health metrics"""
    try:
        results = specs_service.scan_health()
        return jsonify({
            'status': 'ok',
            'message': 'Health scan complete',
            'results': results
        })
    except Exception as e:
        logger.error(f"Error scanning health: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@specs_bp.route('/security-scan', methods=['POST'])
def scan_security():
    """Run security audit on all active projects"""
    try:
        results = specs_service.scan_security_scores()
        return jsonify({
            'status': 'ok',
            'message': 'Security scan complete',
            'results': results
        })
    except Exception as e:
        logger.error(f"Error scanning security: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
