"""
Formation API Routes - Plan d'action DeepSignal V1
"""

import json
import os
from flask import Blueprint, request, send_from_directory
from shared_lib.flask_helpers import success, error as api_error

formation_bp = Blueprint('formation', __name__, url_prefix='/api/formation')

formation_service = None
FORMATION_JSON_PATH = '/data/media/skool-formation/data/formation.json'
TRANSCRIPTIONS_DIR = '/data/media/skool-formation/transcriptions'
GENERATED_MEDIA_DIR = '/data/media/skool-formation/generated'


def init_formation_routes(service):
    global formation_service
    formation_service = service


@formation_bp.route('/actions', methods=['GET'])
def get_actions():
    """Get all actions with children"""
    try:
        actions = formation_service.get_all()
        stats = formation_service.get_stats()
        return success(actions=actions, stats=stats)
    except Exception as e:
        return api_error(500, str(e))


@formation_bp.route('/actions/<int:action_id>/toggle', methods=['POST'])
def toggle_action(action_id):
    """Toggle action status (pending -> in_progress -> done -> pending)"""
    try:
        new_status = formation_service.toggle_status(action_id)
        if new_status is None:
            return api_error(404, 'Action not found')
        stats = formation_service.get_stats()
        return success(new_status=new_status, stats=stats)
    except Exception as e:
        return api_error(500, str(e))


@formation_bp.route('/actions/<int:action_id>/status', methods=['PUT'])
def set_status(action_id):
    """Set specific status for an action"""
    try:
        data = request.get_json()
        if not data or "status" not in data:
            return api_error(400, 'Missing status field')
        status_val = data.get("status")
        if status_val not in ("pending", "in_progress", "done"):
            return api_error(400, 'Invalid status value')
        result = formation_service.update_status(action_id, status_val)
        if result is None:
            return api_error(400, 'Invalid action or status')
        stats = formation_service.get_stats()
        return success(new_status=result, stats=stats)
    except Exception as e:
        return api_error(500, str(e))


@formation_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get completion statistics"""
    try:
        stats = formation_service.get_stats()
        return success(stats=stats)
    except Exception as e:
        return api_error(500, str(e))


@formation_bp.route('/content', methods=['GET'])
def get_content():
    """Get Skool formation content (weeks + videos) from formation.json"""
    try:
        if not os.path.exists(FORMATION_JSON_PATH):
            return api_error(404, 'formation.json not found')
        with open(FORMATION_JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return success(
            formation=data.get("formation", {}),
            weeks=data.get("weeks", [])
        )
    except Exception as e:
        return api_error(500, str(e))


@formation_bp.route('/transcript/<int:week>/<int:video>', methods=['GET'])
def get_transcript(week, video):
    """Get transcript text for a specific video"""
    try:
        prefix = f'S{week}_{video:02d}_'
        for fname in os.listdir(TRANSCRIPTIONS_DIR):
            if fname.startswith(prefix) and fname.endswith('.txt'):
                fpath = os.path.join(TRANSCRIPTIONS_DIR, fname)
                with open(fpath, 'r', encoding='utf-8') as f:
                    text = f.read()
                return success(transcript=text, filename=fname)
        return api_error(404, f'No transcript found for S{week} V{video}')
    except Exception as e:
        return api_error(500, str(e))


@formation_bp.route('/media/<path:filepath>', methods=['GET'])
def serve_media(filepath):
    """Serve generated media files (avatar videos, images)"""
    try:
        full_path = os.path.join(GENERATED_MEDIA_DIR, filepath)
        if not os.path.isfile(full_path):
            return api_error(404, 'Media file not found')
        directory = os.path.dirname(full_path)
        filename = os.path.basename(full_path)
        return send_from_directory(directory, filename)
    except Exception as e:
        return api_error(500, str(e))
