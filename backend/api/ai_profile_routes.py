"""
AI Profile Routes - Proxy to standalone service (port 5100)
All requests are forwarded with Bearer token authentication.
"""
import urllib.request
import urllib.error
import json

from flask import Blueprint, jsonify, request

ai_profile_bp = Blueprint('ai_profile', __name__, url_prefix='/api/ai-profile')

BACKEND_URL = "http://127.0.0.1:5100/api"
API_SECRET = "YgZV5IzG5nfNZAjfb1LQ8EGDee3uqeBJTiRse9izoNeSgjaA2CVcM57nIrctLKli"


def _proxy(path, method="GET", data=None, timeout=60):
    """Forward request to ai-profile backend with Bearer auth."""
    url = f"{BACKEND_URL}/{path}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_SECRET}",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result = json.loads(resp.read())
            return jsonify(result), resp.status
    except urllib.error.HTTPError as e:
        result = json.loads(e.read())
        return jsonify(result), e.code
    except urllib.error.URLError:
        return jsonify({"ok": False, "error": "AI Profile service unavailable (port 5100)"}), 503


# --- Draft Generation ---

@ai_profile_bp.route('/drafts/contacts')
def drafts_contacts():
    return _proxy("drafts/contacts")


@ai_profile_bp.route('/drafts/contacts/<contact_id>/context')
def drafts_contact_context(contact_id):
    return _proxy(f"drafts/contacts/{contact_id}/context")


@ai_profile_bp.route('/drafts/generate', methods=['POST'])
def drafts_generate():
    return _proxy("drafts/generate", method="POST", data=request.get_json(silent=True))


# --- Notifications ---

@ai_profile_bp.route('/notifications')
def notifications_list():
    params = request.query_string.decode()
    path = f"notifications?{params}" if params else "notifications"
    return _proxy(path)


@ai_profile_bp.route('/notifications/stats')
def notifications_stats():
    return _proxy("notifications/stats")


@ai_profile_bp.route('/notifications/<int:notif_id>', methods=['PATCH'])
def notifications_update(notif_id):
    return _proxy(f"notifications/{notif_id}", method="PATCH", data=request.get_json(silent=True))


@ai_profile_bp.route('/notifications/contacts')
def notifications_contacts():
    return _proxy("notifications/contacts")


@ai_profile_bp.route('/notifications/scan', methods=['POST'])
def notifications_scan():
    return _proxy("notifications/scan", method="POST")


# --- Health ---

@ai_profile_bp.route('/health')
def health():
    return _proxy("health")
