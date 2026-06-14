"""
Dynamic Pages API Routes - Create and serve on-the-fly HTML pages
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

dynamic_pages_service = None
logger = logging.getLogger(__name__)

dynamic_pages_bp = Blueprint('dynamic_pages', __name__, url_prefix='/api/dynamic-pages')


def init_dynamic_pages_routes(service):
    """Initialize routes with dynamic pages service"""
    global dynamic_pages_service
    dynamic_pages_service = service


@dynamic_pages_bp.route('', methods=['POST'])
def create_page():
    """Create a dynamic page.

    JSON body:
        title (str): Page title (required)
        html_content (str): HTML content (required)
        icon (str): Emoji icon (default '')
        subtitle (str): Page subtitle (default '')
        css_content (str): Optional CSS
        ttl_hours (int): Time to live in hours (default 24, null for permanent)
        section (str): Sidebar section name (default 'Claude')
        pinned (bool): If true, never expires (default false)
    """
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')

        title = data.get('title')
        html_content = data.get('html_content')
        if not title or not html_content:
            return api_error(400, 'Missing required fields: title and html_content')

        page_id = dynamic_pages_service.create_page(
            title=title,
            html_content=html_content,
            icon=data.get('icon', ''),
            subtitle=data.get('subtitle', ''),
            css_content=data.get('css_content', ''),
            ttl_hours=data.get('ttl_hours'),
            section=data.get('section', 'Claude'),
            pinned=data.get('pinned', False),
        )

        return success(
            message=f"Dynamic page '{title}' created",
            id=page_id,
            url=f"/#{page_id}",
            status_code=201,
        )

    except Exception as e:
        logger.error(f"Error creating dynamic page: {e}")
        return api_error(500, str(e))


@dynamic_pages_bp.route('', methods=['GET'])
def list_pages():
    """List active dynamic pages (metadata only)"""
    try:
        pages = dynamic_pages_service.list_pages()
        return success(pages=pages, count=len(pages))
    except Exception as e:
        logger.error(f"Error listing dynamic pages: {e}")
        return api_error(500, str(e))


@dynamic_pages_bp.route('/<page_id>', methods=['GET'])
def get_page(page_id):
    """Get a dynamic page by id (full content)"""
    try:
        page = dynamic_pages_service.get_page(page_id)
        if not page:
            return api_error(404, f'Page {page_id} not found')
        return success(page=page)
    except Exception as e:
        logger.error(f"Error getting dynamic page {page_id}: {e}")
        return api_error(500, str(e))


@dynamic_pages_bp.route('/<page_id>/pin', methods=['POST'])
def pin_page(page_id):
    """Pin a dynamic page (keep permanently)"""
    try:
        dynamic_pages_service.pin_page(page_id)
        return success(message=f'Page {page_id} pinned')
    except ValueError as e:
        return api_error(404, str(e))
    except Exception as e:
        logger.error(f"Error pinning dynamic page {page_id}: {e}")
        return api_error(500, str(e))


@dynamic_pages_bp.route('/<page_id>', methods=['DELETE'])
def delete_page(page_id):
    """Delete a dynamic page"""
    try:
        dynamic_pages_service.delete_page(page_id)
        return success(message=f'Page {page_id} deleted')
    except ValueError as e:
        return api_error(404, str(e))
    except Exception as e:
        logger.error(f"Error deleting dynamic page {page_id}: {e}")
        return api_error(500, str(e))
