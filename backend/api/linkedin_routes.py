"""
LinkedIn Posts Review API Routes
Endpoints for listing, viewing, and reviewing LinkedIn posts before publication.
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error

linkedin_bp = Blueprint('linkedin', __name__, url_prefix='/api/linkedin')

linkedin_service = None


def init_linkedin_routes(service):
    global linkedin_service
    linkedin_service = service


@linkedin_bp.route('/posts', methods=['GET'])
def get_posts():
    """Get all posts with optional filters (type, status, serie)"""
    try:
        all_posts = linkedin_service.get_all_posts()

        # Optional filters
        post_type = request.args.get('type')
        status = request.args.get('status')
        serie = request.args.get('serie')

        if post_type:
            all_posts = [p for p in all_posts if p['type'] == post_type]
        if status:
            all_posts = [p for p in all_posts if p['review_status'] == status]
        if serie:
            all_posts = [p for p in all_posts if p.get('serie') == serie]

        return success(posts=all_posts, count=len(all_posts))
    except Exception as e:
        return api_error(500, str(e))


@linkedin_bp.route('/posts/<path:post_id>', methods=['GET'])
def get_post(post_id):
    """Get a single post by ID"""
    try:
        post = linkedin_service.get_post(post_id)
        if not post:
            return api_error(404, f'Post {post_id} not found')
        return success(post=post)
    except Exception as e:
        return api_error(500, str(e))


@linkedin_bp.route('/posts/<path:post_id>/review', methods=['PUT'])
def update_review(post_id):
    """Update review status and/or notes for a post"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'Missing JSON body')

        status = data.get('status')
        notes = data.get('notes')

        if status is None and notes is None:
            return api_error(400, 'Provide status and/or notes')

        result = linkedin_service.update_review(post_id, status=status, notes=notes)
        if result is None:
            return api_error(400, f'Invalid status. Valid: draft, ready, review, published, archived')

        post = linkedin_service.get_post(post_id)
        return success(post=post)
    except Exception as e:
        return api_error(500, str(e))


@linkedin_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get counts by status, type, and serie"""
    try:
        stats = linkedin_service.get_stats()
        return success(stats=stats)
    except Exception as e:
        return api_error(500, str(e))


@linkedin_bp.route('/sync', methods=['POST'])
def sync_posts():
    """Force sync: re-read all source files and create missing DB entries"""
    try:
        result = linkedin_service.sync_posts()
        return success(**result)
    except Exception as e:
        return api_error(500, str(e))
