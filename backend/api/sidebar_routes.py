"""
Sidebar API Routes - Manage sidebar layout
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

sidebar_service = None
logger = logging.getLogger(__name__)

sidebar_bp = Blueprint('sidebar', __name__, url_prefix='/api/sidebar')


def init_sidebar_routes(service):
    """Initialize routes with sidebar service"""
    global sidebar_service
    sidebar_service = service


@sidebar_bp.route('/layout', methods=['GET'])
def get_layout():
    """Get full sidebar layout (sections + tabs)"""
    try:
        layout = sidebar_service.get_layout()
        return success(layout=layout)
    except Exception as e:
        logger.error(f"Error getting sidebar layout: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/sections', methods=['POST'])
def create_section():
    """Create a new sidebar section. Body: {"name": "Section Name"}"""
    try:
        data = request.get_json()
        name = data.get('name') if data else None
        if not name:
            return api_error(400, 'name is required')
        section_id = sidebar_service.create_section(name)
        layout = sidebar_service.get_layout()
        return success(message=f'Section "{name}" created', id=section_id, layout=layout)
    except Exception as e:
        logger.error(f"Error creating section: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/sections/<int:section_id>', methods=['DELETE'])
def delete_section(section_id):
    """Delete a sidebar section and all its tabs"""
    try:
        sidebar_service.delete_section(section_id)
        layout = sidebar_service.get_layout()
        return success(message=f'Section {section_id} deleted', layout=layout)
    except ValueError as e:
        return api_error(404, str(e))
    except Exception as e:
        logger.error(f"Error deleting section {section_id}: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/sections/<int:section_id>', methods=['PUT'])
def update_section(section_id):
    """Update a sidebar section (name, position)"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No data provided')
        sidebar_service.update_section(section_id, **data)
        return success(message=f'Section {section_id} updated')
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error updating section {section_id}: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/tabs/<int:tab_id>', methods=['PUT'])
def update_tab(tab_id):
    """Update a sidebar tab (label, icon, title, subtitle, section_id, position)"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No data provided')
        sidebar_service.update_tab(tab_id, **data)
        return success(message=f'Tab {tab_id} updated')
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error updating tab {tab_id}: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/tabs/<int:tab_id>/reassign', methods=['POST'])
def reassign_tab(tab_id):
    """Move a tab to another section. Body: {"section_id": int, "position": int (optional)}"""
    try:
        data = request.get_json()
        target_section_id = data.get('section_id') if data else None
        if target_section_id is None:
            return api_error(400, 'section_id is required')
        position = data.get('position')
        sidebar_service.reassign_tab(tab_id, target_section_id, position)
        layout = sidebar_service.get_layout()
        return success(message=f'Tab {tab_id} reassigned', layout=layout)
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error reassigning tab {tab_id}: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/sections/<int:section_id>/move', methods=['POST'])
def move_section(section_id):
    """Move a section up or down. Body: {"direction": "up"|"down"}"""
    try:
        data = request.get_json()
        direction = data.get('direction') if data else None
        if direction not in ('up', 'down'):
            return api_error(400, 'direction must be "up" or "down"')
        sidebar_service.move_section(section_id, direction)
        layout = sidebar_service.get_layout()
        return success(message=f'Section {section_id} moved {direction}', layout=layout)
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error moving section {section_id}: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/tabs/<int:tab_id>/move', methods=['POST'])
def move_tab(tab_id):
    """Move a tab up or down within its section. Body: {"direction": "up"|"down"}"""
    try:
        data = request.get_json()
        direction = data.get('direction') if data else None
        if direction not in ('up', 'down'):
            return api_error(400, 'direction must be "up" or "down"')
        sidebar_service.move_tab(tab_id, direction)
        layout = sidebar_service.get_layout()
        return success(message=f'Tab {tab_id} moved {direction}', layout=layout)
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error moving tab {tab_id}: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/tabs', methods=['GET'])
def get_all_tabs():
    """Get all unique tabs (for picker: which tabs can be added to a section)"""
    try:
        tabs = sidebar_service.get_all_tabs()
        return success(tabs=tabs)
    except Exception as e:
        logger.error(f"Error getting all tabs: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/sections/<int:section_id>/add-tab', methods=['POST'])
def add_tab_to_section(section_id):
    """Add an existing tab (shortcut) to a section. Body: {"page_key": "internet"}"""
    try:
        data = request.get_json()
        page_key = data.get('page_key') if data else None
        if not page_key:
            return api_error(400, 'page_key is required')
        tab_id = sidebar_service.add_tab_to_section(section_id, page_key)
        layout = sidebar_service.get_layout()
        return success(message=f'Tab "{page_key}" added to section {section_id}', id=tab_id, layout=layout)
    except ValueError as e:
        return api_error(400, str(e))
    except Exception as e:
        logger.error(f"Error adding tab to section {section_id}: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/tabs/<int:tab_id>', methods=['DELETE'])
def delete_tab(tab_id):
    """Delete a single tab (shortcut)"""
    try:
        sidebar_service.delete_tab(tab_id)
        layout = sidebar_service.get_layout()
        return success(message=f'Tab {tab_id} deleted', layout=layout)
    except ValueError as e:
        return api_error(404, str(e))
    except Exception as e:
        logger.error(f"Error deleting tab {tab_id}: {e}")
        return api_error(500, str(e))


@sidebar_bp.route('/reset', methods=['POST'])
def reset_layout():
    """Reset sidebar to default layout"""
    try:
        sidebar_service.reset_to_defaults()
        layout = sidebar_service.get_layout()
        return success(message='Sidebar reset to defaults', layout=layout)
    except Exception as e:
        logger.error(f"Error resetting sidebar: {e}")
        return api_error(500, str(e))
