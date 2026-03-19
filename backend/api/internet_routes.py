"""
Internet Links API Routes
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

internet_service = None
logger = logging.getLogger(__name__)

internet_bp = Blueprint('internet', __name__, url_prefix='/api/internet')


def init_internet_routes(service):
    """Initialize routes with internet service"""
    global internet_service
    internet_service = service


@internet_bp.route('/links', methods=['GET'])
def get_links():
    """Get all links grouped by category"""
    try:
        categories = internet_service.get_all_links()
        total = sum(len(c['links']) for c in categories)
        return success(categories=categories, total_links=total)
    except Exception as e:
        logger.error(f"Error getting links: {e}")
        return api_error(500, str(e))


@internet_bp.route('/links', methods=['POST'])
def create_link():
    """Create a new internet link.

    JSON body:
        name (str): Display name (required)
        url (str): Full URL (required)
        category (str): Category slug (required) - e.g. "tools", "ai", "crypto"
        description (str): Optional description
        favicon_alt (str): Optional fallback text for favicon
        position (int): Optional sort order (default 0)
    """
    try:
        data = request.get_json()

        if not data.get('name') or not data.get('url'):
            return api_error(400, 'Missing required fields: name and url')

        category = data.get('category', 'tools')

        # Auto-create category if it doesn't exist
        existing_cats = [c['slug'] for c in internet_service.get_categories()]
        if category not in existing_cats:
            internet_service.create_category(
                slug=category,
                name=category.replace('-', ' ').title(),
                position=len(existing_cats)
            )

        link_id = internet_service.create_link({
            'name': data['name'],
            'url': data['url'],
            'category_slug': category,
            'favicon_alt': data.get('favicon_alt', ''),
            'description': data.get('description', ''),
            'position': data.get('position', 0),
        })

        return success(
            message=f"Link '{data['name']}' created successfully",
            id=link_id,
            link={
                'id': link_id,
                'name': data['name'],
                'url': data['url'],
                'category': category
            },
            status_code=201
        )

    except Exception as e:
        logger.error(f"Error creating link: {e}")
        return api_error(500, str(e))


@internet_bp.route('/links/<int:link_id>', methods=['PUT'])
def update_link(link_id):
    """Update an internet link"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No data provided')

        internet_service.update_link(link_id, **data)
        return success(message=f'Link {link_id} updated successfully')

    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error updating link {link_id}: {e}")
        return api_error(500, str(e))


@internet_bp.route('/links/<int:link_id>', methods=['DELETE'])
def delete_link(link_id):
    """Delete an internet link"""
    try:
        internet_service.delete_link(link_id)
        return success(message=f'Link {link_id} deleted successfully')
    except Exception as e:
        logger.error(f"Error deleting link {link_id}: {e}")
        return api_error(500, str(e))


@internet_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all categories"""
    try:
        cats = internet_service.get_categories()
        return success(categories=cats, count=len(cats))
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        return api_error(500, str(e))


@internet_bp.route('/categories', methods=['POST'])
def create_category():
    """Create a new category"""
    try:
        data = request.get_json()
        if not data.get('slug') or not data.get('name'):
            return api_error(400, 'Missing required fields: slug and name')

        cat_id = internet_service.create_category(
            slug=data['slug'],
            name=data['name'],
            icon=data.get('icon', ''),
            position=data.get('position', 0)
        )

        return success(
            message=f"Category '{data['name']}' created",
            id=cat_id,
            status_code=201
        )

    except Exception as e:
        logger.error(f"Error creating category: {e}")
        return api_error(500, str(e))


@internet_bp.route('/health', methods=['GET'])
def health():
    """Health check"""
    count = internet_service.get_link_count()
    cats = internet_service.get_categories()
    return success(
        service='Internet Links API',
        links_count=count,
        categories_count=len(cats)
    )
