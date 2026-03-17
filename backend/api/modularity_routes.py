"""
Modularity Audit API Routes
"""

from flask import Blueprint, jsonify
import logging

modularity_service = None

logger = logging.getLogger(__name__)

modularity_bp = Blueprint('modularity', __name__, url_prefix='/api/modularity')


def init_modularity_routes(service):
    """Initialize routes with modularity service"""
    global modularity_service
    modularity_service = service


@modularity_bp.route('/audit', methods=['GET'])
def get_audit():
    """Get cached modularity audit results"""
    try:
        results = modularity_service.get_results()
        return jsonify({
            'status': 'ok',
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        logger.error(f"Error getting audit results: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@modularity_bp.route('/scan', methods=['POST'])
def run_scan():
    """Run modularity scan on all projects"""
    try:
        results = modularity_service.scan_all_projects()
        return jsonify({
            'status': 'ok',
            'message': 'Scan complete',
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        logger.error(f"Error running modularity scan: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
