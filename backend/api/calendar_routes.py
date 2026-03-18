"""
Calendar API Routes - Flask blueprint for calendar endpoints.
Handles weekly template, Google Calendar CRUD, and scheduling.
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta

from services.calendar_service import calendar_service
from services.google_calendar import google_calendar_service
from services.schedule_service import schedule_service

calendar_bp = Blueprint('calendar', __name__, url_prefix='/api/calendar')


# ============== Weekly Template Routes ==============

@calendar_bp.route('/template', methods=['GET'])
def get_template():
    """Get the current weekly template"""
    template = calendar_service.get_template()
    return jsonify({'status': 'ok', 'template': template})


@calendar_bp.route('/template', methods=['PUT'])
def update_template():
    """Update the weekly template"""
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'No data provided'}), 400
    updated = calendar_service.update_template(data)
    return jsonify({'status': 'ok', 'template': updated})


@calendar_bp.route('/template/week', methods=['GET'])
def get_week_schedule():
    """Get week schedule with resolved activities for each day"""
    date_str = request.args.get('start')
    if date_str:
        try:
            start_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid date format'}), 400
    else:
        today = datetime.now()
        start_date = today - timedelta(days=today.weekday())

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
    return jsonify({'status': 'ok', 'categories': categories})


# ============== Google Calendar Routes ==============

@calendar_bp.route('/google/status', methods=['GET'])
def google_status():
    """Check Google Calendar connection status"""
    status = google_calendar_service.get_status()
    return jsonify({'status': 'ok', **status})


@calendar_bp.route('/events', methods=['GET'])
def get_events():
    """Get Google Calendar events for date range"""
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
        end_date = start_date + timedelta(days=7)
    else:
        try:
            end_date = datetime.strptime(end_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'status': 'error', 'message': 'Invalid end date'}), 400

    if not google_calendar_service.is_authenticated():
        return jsonify({
            'status': 'ok',
            'connected': False,
            'events': [],
            'message': 'Not connected to Google Calendar'
        })

    events = google_calendar_service.get_events(start_date, end_date)
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

    if not google_calendar_service.is_authenticated():
        return jsonify({
            'status': 'ok',
            'connected': False,
            'events': {},
            'message': 'Not connected to Google Calendar'
        })

    events = google_calendar_service.get_week_events(start_date)
    return jsonify({
        'status': 'ok',
        'connected': True,
        'events': events,
        'week_start': start_date.strftime('%Y-%m-%d')
    })


@calendar_bp.route('/google/events', methods=['POST'])
def create_event():
    """Create a Google Calendar event"""
    if not google_calendar_service.is_authenticated():
        return jsonify({'status': 'error', 'message': 'Not connected'}), 401

    data = request.get_json()
    if not data or not data.get('summary') or not data.get('start'):
        return jsonify({'status': 'error', 'message': 'summary and start required'}), 400

    event = google_calendar_service.create_event({
        'summary': data['summary'],
        'start_datetime': data['start'],
        'end_datetime': data.get('end', ''),
        'description': data.get('description', ''),
        'location': data.get('location', ''),
        'all_day': data.get('all_day', False),
    })

    if event:
        return jsonify({'status': 'ok', 'event': event})
    return jsonify({'status': 'error', 'message': 'Failed to create event'}), 500


@calendar_bp.route('/google/events/<event_id>', methods=['PUT'])
def update_event(event_id):
    """Update a Google Calendar event"""
    if not google_calendar_service.is_authenticated():
        return jsonify({'status': 'error', 'message': 'Not connected'}), 401

    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'No data provided'}), 400

    kwargs = {}
    if 'summary' in data:
        kwargs['summary'] = data['summary']
    if 'description' in data:
        kwargs['description'] = data['description']
    if 'location' in data:
        kwargs['location'] = data['location']
    if 'start' in data:
        kwargs['start_datetime'] = data['start']
    if 'end' in data:
        kwargs['end_datetime'] = data['end']

    event = google_calendar_service.update_event(event_id, **kwargs)
    if event:
        return jsonify({'status': 'ok', 'event': event})
    return jsonify({'status': 'error', 'message': 'Failed to update event'}), 500


@calendar_bp.route('/google/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    """Delete a Google Calendar event"""
    if not google_calendar_service.is_authenticated():
        return jsonify({'status': 'error', 'message': 'Not connected'}), 401

    success = google_calendar_service.delete_event(event_id)
    if success:
        return jsonify({'status': 'ok', 'message': 'Event deleted'})
    return jsonify({'status': 'error', 'message': 'Failed to delete event'}), 500


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

    user_email = 'fabrice.estezet@gmail.com'
    result = schedule_service.propose_schedule(user_email, start_date)
    return jsonify({'status': 'ok', **result})


@calendar_bp.route('/schedule/apply', methods=['POST'])
def apply_schedule():
    """Apply validated scheduling proposals"""
    data = request.get_json()
    if not data or 'proposals' not in data:
        return jsonify({'status': 'error', 'message': 'No proposals provided'}), 400
    result = schedule_service.apply_schedule(data['proposals'])
    return jsonify({'status': 'ok', **result})


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
        end_date = start_date + timedelta(days=14)
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
    return jsonify({'status': 'ok', 'cancelled': result})


@calendar_bp.route('/schedule/todos', methods=['GET'])
def get_schedulable_todos():
    """Get TODOs that are candidates for scheduling"""
    limit = request.args.get('limit', 20, type=int)
    todos = schedule_service.get_schedulable_todos(limit)
    return jsonify({'status': 'ok', 'todos': todos, 'count': len(todos)})


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

    template_schedule = calendar_service.get_week_schedule(start_date)

    google_events = {}
    google_connected = google_calendar_service.is_authenticated()
    if google_connected:
        google_events = google_calendar_service.get_week_events(start_date)

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
