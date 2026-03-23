"""
Claude Instructions API Routes - Browse .claude/ files and cross-reference graph
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

claude_instructions_bp = Blueprint('claude_instructions', __name__, url_prefix='/api/claude-instructions')

_service = None


def init_claude_instructions_routes(service):
    global _service
    _service = service


@claude_instructions_bp.route('/tree')
def get_tree():
    """Get full tree of .claude/ files across all projects"""
    try:
        data = _service.get_tree()
        return success(**data)
    except Exception as e:
        logger.error(f"Error getting claude instructions tree: {e}")
        return api_error(500, str(e))


@claude_instructions_bp.route('/file')
def get_file():
    """Read a specific .claude/ file (secured: .md only, under /data/projects/)"""
    try:
        path = request.args.get('path')
        data, err = _service.get_file(path)
        if err:
            return api_error(400, err)
        return success(**data)
    except Exception as e:
        logger.error(f"Error reading claude instruction file: {e}")
        return api_error(500, str(e))


@claude_instructions_bp.route('/graph')
def get_graph():
    """Get cross-reference graph of .claude/ files"""
    try:
        data = _service.get_graph()
        return success(**data)
    except Exception as e:
        logger.error(f"Error building claude instructions graph: {e}")
        return api_error(500, str(e))
