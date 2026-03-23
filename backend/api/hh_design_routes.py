"""
HH Design API Routes - Architecture introspection + feature wishlist CRUD
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

hh_design_bp = Blueprint('hh_design', __name__, url_prefix='/api/hh-design')

_service = None


def init_hh_design_routes(service):
    global _service
    _service = service


@hh_design_bp.route('/architecture')
def get_architecture():
    """Scan HomeHub codebase and return architecture overview"""
    try:
        data = _service.get_architecture()
        return success(**data)
    except Exception as e:
        logger.error(f"Error scanning architecture: {e}")
        return api_error(500, str(e))


@hh_design_bp.route('/features')
def list_features():
    """List features with optional status/category filters"""
    try:
        status = request.args.get('status')
        category = request.args.get('category')
        features = _service.get_features(status=status, category=category)
        return success(features=features, count=len(features))
    except Exception as e:
        logger.error(f"Error listing features: {e}")
        return api_error(500, str(e))


@hh_design_bp.route('/features', methods=['POST'])
def create_feature():
    """Create a new feature"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        result = _service.create_feature(data)
        return success(id=result['id'], message='Feature created', status_code=201)
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error creating feature: {e}")
        return api_error(500, str(e))


@hh_design_bp.route('/features/<int:feature_id>', methods=['PUT'])
def update_feature(feature_id):
    """Update a feature"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        updated = _service.update_feature(feature_id, data)
        if not updated:
            return api_error(404, f'Feature {feature_id} not found')
        return success(message='Feature updated')
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error updating feature: {e}")
        return api_error(500, str(e))


@hh_design_bp.route('/features/<int:feature_id>', methods=['DELETE'])
def delete_feature(feature_id):
    """Delete a feature"""
    try:
        deleted = _service.delete_feature(feature_id)
        if not deleted:
            return api_error(404, f'Feature {feature_id} not found')
        return success(message='Feature deleted')
    except Exception as e:
        logger.error(f"Error deleting feature: {e}")
        return api_error(500, str(e))
