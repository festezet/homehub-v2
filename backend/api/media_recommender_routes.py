"""
Media Recommender Routes - Proxy to standalone service (port 5056)
All requests are forwarded to the media-recommender project.
"""
import urllib.request
import urllib.error
import json

from flask import Blueprint, jsonify, request

media_reco_bp = Blueprint('media_reco', __name__, url_prefix='/api/media-reco')

BACKEND_URL = "http://127.0.0.1:5056/api"


def _proxy(path, method="GET", data=None):
    """Forward request to media-recommender backend."""
    url = f"{BACKEND_URL}/{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return jsonify(result), resp.status
    except urllib.error.HTTPError as e:
        result = json.loads(e.read())
        return jsonify(result), e.code
    except urllib.error.URLError:
        return jsonify({"status": "error", "message": "Media recommender service unavailable (port 5056)"}), 503


@media_reco_bp.route('/library')
def get_library():
    params = request.query_string.decode()
    path = f"library?{params}" if params else "library"
    return _proxy(path)


@media_reco_bp.route('/recommendations')
def get_recommendations():
    params = request.query_string.decode()
    path = f"recommendations?{params}" if params else "recommendations"
    return _proxy(path)


@media_reco_bp.route('/recommendations/generate', methods=['POST'])
def generate_recommendations():
    return _proxy("recommendations/generate", method="POST", data=request.get_json(silent=True))


@media_reco_bp.route('/recommendations/<int:rec_id>/resolve', methods=['POST'])
def resolve_recommendation(rec_id):
    return _proxy(f"recommendations/{rec_id}/resolve", method="POST", data=request.get_json(silent=True))


@media_reco_bp.route('/preferences')
def get_preferences():
    return _proxy("preferences")


@media_reco_bp.route('/preferences', methods=['POST'])
def update_preference():
    return _proxy("preferences", method="POST", data=request.get_json(silent=True))


@media_reco_bp.route('/interactions', methods=['GET', 'POST'])
def interactions():
    if request.method == "POST":
        return _proxy("interactions", method="POST", data=request.get_json(silent=True))
    params = request.query_string.decode()
    path = f"interactions?{params}" if params else "interactions"
    return _proxy(path)


@media_reco_bp.route('/taste')
def get_taste():
    return _proxy("taste")


@media_reco_bp.route('/taste/recompute', methods=['POST'])
def recompute_taste():
    return _proxy("taste/recompute", method="POST")


@media_reco_bp.route('/sync', methods=['POST'])
def sync():
    return _proxy("sync", method="POST")


@media_reco_bp.route('/add', methods=['POST'])
def add_title():
    return _proxy("add", method="POST", data=request.get_json(silent=True))


@media_reco_bp.route('/stats')
def get_stats():
    return _proxy("stats")


@media_reco_bp.route('/health')
def health():
    return _proxy("health")
