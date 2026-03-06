"""
Calendar API Routes - Flask blueprint for calendar endpoints
Handles weekly template, Google Calendar, and scheduling
"""

from flask import Blueprint, jsonify, request, redirect
from datetime import datetime, timedelta

from services.calendar_service import calendar_service
from services.google_calendar import google_calendar_service
from services.schedule_service import schedule_service

# Create blueprint
calendar_bp = Blueprint('calendar', __name__, url_prefix='/api/calendar')

# Default user email (single user mode)
DEFAULT_USER_EMAIL = 'fabrice.estezet@gmail.com'


# ============== Weekly Template Routes ==============

@calendar_bp.route('/template', methods=['GET'])
def get_template():
    """Get the current weekly template"""
    template = calendar_service.get_template()
    return jsonify({
        'status': 'ok',
        'template': template
    })


@calendar_bp.route('/template', methods=['PUT'])
def update_template():
    """Update the weekly template"""
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'No data provided'}), 400

    updated = calendar_service.update_template(data)
    return jsonify({
        'status': 'ok',
        'template': updated
    })


@calendar_bp.route('/template/week', methods=['GET'])
def get_week_schedule():
    """Get week schedule with resolved activities for each day"""
    # Get start date (default: current Monday)
    date_str = request.args.get('start')
    if date_str:
        try:
            start_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid date format'}), 400
    else:
        today = datetime.now()
        start_date = today - timedelta(days=today.weekday())  # Monday

    schedule = calendar_service.get_week_schedule(start_date)
    return jsonify({
        'status': 'ok',
        'week_start': start_date.strftime('%Y-%m-%d'),
        'schedule': schedule
    })


@calendar_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get category definitions"""
    categories = calendar_service.get_categories()
    return jsonify({
        'status': 'ok',
        'categories': categories
    })


# ============== Google Calendar Routes ==============

@calendar_bp.route('/google/status', methods=['GET'])
def google_status():
    """Check Google Calendar connection status"""
    if not google_calendar_service.is_available():
        return jsonify({
            'status': 'unavailable',
            'message': 'Google API libraries not installed'
        })

    is_connected = google_calendar_service.is_authenticated(DEFAULT_USER_EMAIL)
    return jsonify({
        'status': 'ok',
        'connected': is_connected,
        'email': DEFAULT_USER_EMAIL if is_connected else None
    })


@calendar_bp.route('/google/auth', methods=['GET'])
def google_auth():
    """Initiate Google OAuth flow"""
    try:
        auth_url = google_calendar_service.get_auth_url()
        if auth_url:
            return redirect(auth_url)
        else:
            return jsonify({
                'status': 'error',
                'message': 'Google API not available'
            }), 500
    except FileNotFoundError as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@calendar_bp.route('/google/callback', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback"""
    code = request.args.get('code')
    error = request.args.get('error')

    if error:
        return jsonify({
            'status': 'error',
            'message': f'OAuth error: {error}'
        }), 400

    if not code:
        return jsonify({
            'status': 'error',
            'message': 'No authorization code received'
        }), 400

    result = google_calendar_service.handle_callback(code)

    if result.get('success'):
        # Redirect back to HomeHub calendar page
        return redirect('http://localhost:5000/?tab=calendar&google=connected')
    else:
        return jsonify({
            'status': 'error',
            'message': result.get('error', 'Unknown error')
        }), 500


@calendar_bp.route('/google/disconnect', methods=['POST'])
def google_disconnect():
    """Disconnect Google Calendar"""
    google_calendar_service.disconnect(DEFAULT_USER_EMAIL)
    return jsonify({
        'status': 'ok',
        'message': 'Disconnected'
    })


@calendar_bp.route('/events', methods=['GET'])
def get_events():
    """Get Google Calendar events for date range"""
    # Parse dates
    start_str = request.args.get('start')
    end_str = request.args.get('end')

    if not start_str:
        # Default: current week
        today = datetime.now()
        start_date = today - timedelta(days=today.weekday())
    else:
        try:
            start_date = datetime.strptime(start_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid start date'}), 400

    if not end_str:
        end_date = start_date + timedelta(days=7)
    else:
        try:
            end_date = datetime.strptime(end_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid end date'}), 400

    # Check authentication
    if not google_calendar_service.is_authenticated(DEFAULT_USER_EMAIL):
        return jsonify({
            'status': 'ok',
            'connected': False,
            'events': [],
            'message': 'Not connected to Google Calendar'
        })

    events = google_calendar_service.get_events(DEFAULT_USER_EMAIL, start_date, end_date)
    return jsonify({
        'status': 'ok',
        'connected': True,
        'events': events,
        'start': start_date.strftime('%Y-%m-%d'),
        'end': end_date.strftime('%Y-%m-%d')
    })


@calendar_bp.route('/events/week', methods=['GET'])
def get_week_events():
    """Get Google Calendar events organized by day for a week"""
    start_str = request.args.get('start')

    if start_str:
        try:
            start_date = datetime.strptime(start_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid date'}), 400
    else:
        today = datetime.now()
        start_date = today - timedelta(days=today.weekday())

    if not google_calendar_service.is_authenticated(DEFAULT_USER_EMAIL):
        return jsonify({
            'status': 'ok',
            'connected': False,
            'events': {},
            'message': 'Not connected to Google Calendar'
        })

    events = google_calendar_service.get_week_events(DEFAULT_USER_EMAIL, start_date)
    return jsonify({
        'status': 'ok',
        'connected': True,
        'events': events,
        'week_start': start_date.strftime('%Y-%m-%d')
    })


# ============== Scheduling Routes ==============

@calendar_bp.route('/schedule/propose', methods=['GET'])
def propose_schedule():
    """Generate scheduling proposal for TODOs"""
    start_str = request.args.get('start')

    if start_str:
        try:
            start_date = datetime.strptime(start_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid date'}), 400
    else:
        today = datetime.now()
        start_date = today - timedelta(days=today.weekday())

    result = schedule_service.propose_schedule(DEFAULT_USER_EMAIL, start_date)
    return jsonify({
        'status': 'ok',
        **result
    })


@calendar_bp.route('/schedule/apply', methods=['POST'])
def apply_schedule():
    """Apply validated scheduling proposals"""
    data = request.get_json()
    if not data or 'proposals' not in data:
        return jsonify({'status': 'error', 'message': 'No proposals provided'}), 400

    result = schedule_service.apply_schedule(data['proposals'])
    return jsonify({
        'status': 'ok',
        **result
    })


@calendar_bp.route('/schedule', methods=['GET'])
def get_scheduled():
    """Get scheduled TODOs for date range"""
    start_str = request.args.get('start')
    end_str = request.args.get('end')

    if not start_str:
        today = datetime.now()
        start_date = today - timedelta(days=today.weekday())
    else:
        try:
            start_date = datetime.strptime(start_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid start date'}), 400

    if not end_str:
        end_date = start_date + timedelta(days=14)  # 2 weeks
    else:
        try:
            end_date = datetime.strptime(end_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid end date'}), 400

    scheduled = schedule_service.get_scheduled_todos(start_date, end_date)
    return jsonify({
        'status': 'ok',
        'scheduled': scheduled,
        'start': start_date.strftime('%Y-%m-%d'),
        'end': end_date.strftime('%Y-%m-%d')
    })


@calendar_bp.route('/schedule/<int:scheduled_id>', methods=['DELETE'])
def cancel_scheduled(scheduled_id):
    """Cancel a scheduled TODO"""
    result = schedule_service.cancel_scheduled_todo(scheduled_id)
    return jsonify({
        'status': 'ok',
        'cancelled': result
    })


@calendar_bp.route('/schedule/todos', methods=['GET'])
def get_schedulable_todos():
    """Get TODOs that are candidates for scheduling"""
    limit = request.args.get('limit', 20, type=int)
    todos = schedule_service.get_schedulable_todos(limit)
    return jsonify({
        'status': 'ok',
        'todos': todos,
        'count': len(todos)
    })


# ============== Combined View ==============

@calendar_bp.route('/combined', methods=['GET'])
def get_combined_view():
    """Get combined view: template + Google events + scheduled TODOs"""
    start_str = request.args.get('start')

    if start_str:
        try:
            start_date = datetime.strptime(start_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid date'}), 400
    else:
        today = datetime.now()
        start_date = today - timedelta(days=today.weekday())

    end_date = start_date + timedelta(days=7)

    # Get template schedule
    template_schedule = calendar_service.get_week_schedule(start_date)

    # Get Google events if connected
    google_events = {}
    google_connected = google_calendar_service.is_authenticated(DEFAULT_USER_EMAIL)
    if google_connected:
        google_events = google_calendar_service.get_week_events(DEFAULT_USER_EMAIL, start_date)

    # Get scheduled TODOs
    scheduled_todos = schedule_service.get_scheduled_todos(start_date, end_date)

    return jsonify({
        'status': 'ok',
        'week_start': start_date.strftime('%Y-%m-%d'),
        'template': template_schedule,
        'google': {
            'connected': google_connected,
            'events': google_events
        },
        'scheduled_todos': scheduled_todos,
        'categories': calendar_service.get_categories()
    })


def init_calendar_routes(app):
    """Initialize calendar routes"""
    app.register_blueprint(calendar_bp)
