"""
Modularity Audit API Routes
"""

from flask import Blueprint
from shared_lib.flask_helpers import success, error as api_error
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
        return success(results=results, count=len(results))
    except Exception as e:
        logger.error(f"Error getting audit results: {e}")
        return api_error(500, str(e))


@modularity_bp.route('/scan', methods=['POST'])
def run_scan():
    """Run modularity scan on all projects"""
    try:
        results = modularity_service.scan_all_projects()
        return success(
            message='Scan complete',
            results=results,
            count=len(results)
        )
    except Exception as e:
        logger.error(f"Error running modularity scan: {e}")
        return api_error(500, str(e))
