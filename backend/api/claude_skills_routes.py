"""
Claude Skills API Routes
"""

from flask import Blueprint, jsonify
import logging

claude_skills_service = None

logger = logging.getLogger(__name__)

claude_skills_bp = Blueprint('claude_skills', __name__, url_prefix='/api/claude')


def init_claude_skills_routes(service):
    """Initialize routes with claude skills service"""
    global claude_skills_service
    claude_skills_service = service


@claude_skills_bp.route('/skills', methods=['GET'])
def get_skills():
    """Get all Claude Code skills and commands (live filesystem scan)"""
    try:
        data = claude_skills_service.scan_all()
        return jsonify({
            'status': 'ok',
            **data
        })
    except Exception as e:
        logger.error(f"Error scanning Claude skills: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
