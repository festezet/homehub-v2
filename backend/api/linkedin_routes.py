"""
LinkedIn Posts Review API Routes
Endpoints for listing, viewing, and reviewing LinkedIn posts before publication.
"""

import os
from flask import Blueprint, request, send_file
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
        stage = data.get('stage')
        scheduled_at = data.get('scheduled_at')
        published_at = data.get('published_at')

        if all(v is None for v in (status, notes, stage, scheduled_at, published_at)):
            return api_error(400, 'Provide status, notes, stage, scheduled_at and/or published_at')

        result = linkedin_service.update_review(
            post_id, status=status, notes=notes, stage=stage,
            scheduled_at=scheduled_at, published_at=published_at,
        )
        if result is None:
            return api_error(400, 'Invalid status (draft|ready|review|published|archived) or stage (idea|in_progress)')

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


@linkedin_bp.route('/posts/<path:post_id>/image', methods=['GET'])
def get_post_image(post_id):
    """Serve the image associated with a post (if any)."""
    try:
        post = linkedin_service.get_post(post_id)
        if not post or not post.get('image_path'):
            return api_error(404, 'No image for this post')
        img_path = post['image_path']
        if not os.path.isfile(img_path):
            return api_error(404, 'Image file not found on disk')
        # Restrict to expected base dirs to prevent path traversal
        allowed_roots = [
            '/data/projects/ai-video-studio/data/output/posts',
            '/data/projects/ai-profile/data/media',
        ]
        real_img = os.path.realpath(img_path)
        if not any(real_img.startswith(os.path.realpath(r)) for r in allowed_roots):
            return api_error(403, 'Image path outside allowed directory')
        return send_file(img_path)
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
