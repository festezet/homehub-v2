"""
Session Bookmarks API Routes - CRUD for Claude session bookmarks
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

session_bookmarks_bp = Blueprint('session_bookmarks', __name__)

_service = None


def init_session_bookmarks_routes(service):
    global _service
    _service = service


@session_bookmarks_bp.route('/api/session-bookmarks')
def list_bookmarks():
    """List session bookmarks with optional filters"""
    try:
        status = request.args.get('status')
        project_id = request.args.get('project_id')
        bookmarks = _service.list_bookmarks(status=status, project_id=project_id)
        return success(bookmarks=bookmarks, count=len(bookmarks))
    except Exception as e:
        logger.error(f"Error listing session bookmarks: {e}")
        return api_error(500, str(e))


@session_bookmarks_bp.route('/api/session-bookmarks', methods=['POST'])
def create_bookmark():
    """Create a new session bookmark"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        for field in ('date', 'subject'):
            if not data.get(field):
                return api_error(400, f'{field} is required')
        result = _service.create_bookmark(data)
        return success(id=result['id'], message='Session bookmark created', status_code=201)
    except Exception as e:
        logger.error(f"Error creating session bookmark: {e}")
        return api_error(500, str(e))


@session_bookmarks_bp.route('/api/session-bookmarks/stats')
def get_stats():
    """Get session bookmarks statistics"""
    try:
        stats = _service.get_stats()
        return success(stats=stats)
    except Exception as e:
        logger.error(f"Error getting bookmark stats: {e}")
        return api_error(500, str(e))


@session_bookmarks_bp.route('/api/session-bookmarks/<int:bookmark_id>')
def get_bookmark(bookmark_id):
    """Get a single session bookmark"""
    try:
        bookmark = _service.get_bookmark(bookmark_id)
        if not bookmark:
            return api_error(404, f'Bookmark {bookmark_id} not found')
        return success(bookmark=bookmark)
    except Exception as e:
        logger.error(f"Error getting session bookmark: {e}")
        return api_error(500, str(e))


@session_bookmarks_bp.route('/api/session-bookmarks/<int:bookmark_id>', methods=['PUT'])
def update_bookmark(bookmark_id):
    """Update a session bookmark"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')
        updated = _service.update_bookmark(bookmark_id, data)
        if not updated:
            return api_error(404, f'Bookmark {bookmark_id} not found')
        return success(message='Bookmark updated')
    except Exception as e:
        logger.error(f"Error updating session bookmark: {e}")
        return api_error(500, str(e))


@session_bookmarks_bp.route('/api/session-bookmarks/<int:bookmark_id>', methods=['DELETE'])
def delete_bookmark(bookmark_id):
    """Delete a session bookmark"""
    try:
        deleted = _service.delete_bookmark(bookmark_id)
        if not deleted:
            return api_error(404, f'Bookmark {bookmark_id} not found')
        return success(message='Bookmark deleted')
    except Exception as e:
        logger.error(f"Error deleting session bookmark: {e}")
        return api_error(500, str(e))
