"""
Posture History API Routes — surface project-auditor's posture history.
"""

import logging

from flask import Blueprint, request

from shared_lib.flask_helpers import success, error as api_error

logger = logging.getLogger(__name__)

posture_history_service = None

posture_history_bp = Blueprint('posture_history', __name__, url_prefix='/api/posture-history')


def init_posture_history_routes(service):
    global posture_history_service
    posture_history_service = service


def _parse_limit(default=10, maximum=100):
    raw = request.args.get('limit', default)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, "'limit' must be an integer"
    if value <= 0 or value > maximum:
        return None, f"'limit' must be between 1 and {maximum}"
    return value, None


@posture_history_bp.route('/runs', methods=['GET'])
def get_runs():
    """List most recent posture audit runs."""
    limit, err = _parse_limit()
    if err:
        return api_error(400, err)
    try:
        runs = posture_history_service.get_runs(limit=limit)
        return success(runs=runs, count=len(runs))
    except Exception as e:
        logger.error(f"posture_history.get_runs failed: {e}")
        return api_error(500, str(e))


@posture_history_bp.route('/latest', methods=['GET'])
def get_latest():
    """Return per-project snapshots from the latest run."""
    try:
        snapshots = posture_history_service.get_latest_snapshots()
        return success(snapshots=snapshots, count=len(snapshots))
    except Exception as e:
        logger.error(f"posture_history.get_latest_snapshots failed: {e}")
        return api_error(500, str(e))


@posture_history_bp.route('/trends', methods=['GET'])
def get_trends():
    """Return delta comparison between the two most recent runs."""
    try:
        trends = posture_history_service.get_trends()
        return success(trends=trends)
    except Exception as e:
        logger.error(f"posture_history.get_trends failed: {e}")
        return api_error(500, str(e))


@posture_history_bp.route('/project/<project_id>', methods=['GET'])
def get_project(project_id):
    """Return posture score history for a single project."""
    limit, err = _parse_limit()
    if err:
        return api_error(400, err)
    try:
        history = posture_history_service.get_project_history(project_id, limit=limit)
        return success(project_id=project_id, history=history, count=len(history))
    except Exception as e:
        logger.error(f"posture_history.get_project_history failed: {e}")
        return api_error(500, str(e))
