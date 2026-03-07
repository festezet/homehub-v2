"""
Formation API Routes - Plan d'action DeepSignal V1
"""

import json
import os
from flask import Blueprint, jsonify, request

formation_bp = Blueprint('formation', __name__, url_prefix='/api/formation')

formation_service = None
FORMATION_JSON_PATH = '/data/media/skool-formation/data/formation.json'


def init_formation_routes(service):
    global formation_service
    formation_service = service


@formation_bp.route('/actions', methods=['GET'])
def get_actions():
    """Get all actions with children"""
    try:
        actions = formation_service.get_all()
        stats = formation_service.get_stats()
        return jsonify({"status": "ok", "actions": actions, "stats": stats})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@formation_bp.route('/actions/<int:action_id>/toggle', methods=['POST'])
def toggle_action(action_id):
    """Toggle action status (pending -> in_progress -> done -> pending)"""
    try:
        new_status = formation_service.toggle_status(action_id)
        if new_status is None:
            return jsonify({"status": "error", "message": "Action not found"}), 404
        stats = formation_service.get_stats()
        return jsonify({"status": "ok", "new_status": new_status, "stats": stats})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@formation_bp.route('/actions/<int:action_id>/status', methods=['PUT'])
def set_status(action_id):
    """Set specific status for an action"""
    try:
        data = request.get_json()
        if not data or "status" not in data:
            return jsonify({"status": "error", "message": "Missing status field"}), 400
        status = data.get("status")
        if status not in ("pending", "in_progress", "done"):
            return jsonify({"status": "error", "message": "Invalid status value"}), 400
        result = formation_service.update_status(action_id, status)
        if result is None:
            return jsonify({"status": "error", "message": "Invalid action or status"}), 400
        stats = formation_service.get_stats()
        return jsonify({"status": "ok", "new_status": result, "stats": stats})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@formation_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get completion statistics"""
    try:
        stats = formation_service.get_stats()
        return jsonify({"status": "ok", "stats": stats})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@formation_bp.route('/content', methods=['GET'])
def get_content():
    """Get Skool formation content (weeks + videos) from formation.json"""
    try:
        if not os.path.exists(FORMATION_JSON_PATH):
            return jsonify({"status": "error", "message": "formation.json not found"}), 404
        with open(FORMATION_JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify({"status": "ok", "formation": data.get("formation", {}), "weeks": data.get("weeks", [])})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
