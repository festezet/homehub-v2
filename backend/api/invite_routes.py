"""
Invite Routes - Send calendar invitations (.ics) via HomeHub UI
"""

import json
import os
import logging
from datetime import timedelta
from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
from shared_lib.email import (
    send_invite_hostinger, send_invite_gmail,
    generate_ics, local_to_utc, _load_smtp_creds,
)

logger = logging.getLogger(__name__)

invite_bp = Blueprint('invites', __name__)

TONE_PROFILES_PATH = '/data/projects/ai-profile/data/private/email_tone_profiles.json'
EMAIL_CONTEXT_DB = '/data/projects/ai-profile/data/private/email_context.db'


@invite_bp.route('/api/invites/send', methods=['POST'])
def send_invite():
    """Send a calendar invitation (.ics)"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')

        for field in ('to_email', 'to_name', 'subject', 'date', 'time'):
            if not data.get(field):
                return api_error(400, f'{field} is required')

        duration = int(data.get('duration', 60))
        dt_str = f"{data['date']} {data['time']}"
        dtstart = local_to_utc(dt_str)
        dtend = dtstart + timedelta(minutes=duration)

        account = data.get('account', 'hostinger')
        location = data.get('location', '')
        description = data.get('description', '')
        meet_link = None

        # Generate Google Meet link if requested
        if data.get('with_meet'):
            meet_link = _create_meet_link(data, duration)
            if meet_link:
                location = meet_link
                if description:
                    description += f'\n\nGoogle Meet: {meet_link}'
                else:
                    description = f'Google Meet: {meet_link}'

        kwargs = dict(
            to_email=data['to_email'], to_name=data['to_name'],
            summary=data['subject'], dtstart_utc=dtstart, dtend_utc=dtend,
            location=location, description=description,
        )

        if account == 'gmail':
            result = send_invite_gmail(**kwargs)
        else:
            result = send_invite_hostinger(**kwargs)

        if meet_link:
            result['meet_link'] = meet_link

        return success(**result)
    except Exception as e:
        logger.error(f"Error sending invite: {e}")
        return api_error(500, str(e))


def _create_meet_link(data, duration):
    """Create a Google Calendar event with Meet and return the Meet link."""
    try:
        from services.google_calendar import google_calendar_service
        event_data = {
            'summary': data['subject'],
            'start_datetime': f"{data['date']}T{data['time']}:00",
            'end_datetime': None,  # computed below
            'description': data.get('description', ''),
            'with_meet': True,
        }
        # Compute end time
        from datetime import datetime, timedelta as td
        start = datetime.strptime(f"{data['date']} {data['time']}", '%Y-%m-%d %H:%M')
        end = start + td(minutes=duration)
        event_data['end_datetime'] = end.strftime('%Y-%m-%dT%H:%M:%S')

        result = google_calendar_service.create_event(event_data)
        if result and result.get('meet_link'):
            logger.info(f"Meet link created: {result['meet_link']}")
            return result['meet_link']
        logger.warning("Calendar event created but no Meet link returned")
        return None
    except Exception as e:
        logger.error(f"Failed to create Meet link: {e}")
        return None


@invite_bp.route('/api/invites/preview', methods=['POST'])
def preview_invite():
    """Dry-run: generate the .ics without sending"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'No JSON body')

        for field in ('to_email', 'to_name', 'subject', 'date', 'time'):
            if not data.get(field):
                return api_error(400, f'{field} is required')

        duration = int(data.get('duration', 60))
        dt_str = f"{data['date']} {data['time']}"
        dtstart = local_to_utc(dt_str)
        dtend = dtstart + timedelta(minutes=duration)

        account = data.get('account', 'hostinger')
        if account == 'gmail':
            organizer_email = 'fabrice.estezet@gmail.com'
        else:
            creds = _load_smtp_creds()
            organizer_email = creds['email']

        ics_content = generate_ics(
            summary=data['subject'], dtstart_utc=dtstart, dtend_utc=dtend,
            organizer_email=organizer_email, organizer_name='Fabrice Estezet',
            attendee_email=data['to_email'], attendee_name=data['to_name'],
            location=data.get('location', ''), description=data.get('description', ''),
        )

        recap = (
            f"De: Fabrice Estezet ({organizer_email})\n"
            f"A: {data['to_name']} <{data['to_email']}>\n"
            f"Objet: {data['subject']}\n"
            f"Date: {data['date']} a {data['time']} ({duration} min)\n"
            f"Lieu: {data.get('location', '-')}\n"
            f"Compte: {account}"
        )

        return success(ics_content=ics_content, recap=recap)
    except Exception as e:
        logger.error(f"Error previewing invite: {e}")
        return api_error(500, str(e))


@invite_bp.route('/api/invites/search-contact', methods=['POST'])
def search_contact():
    """Search contacts by name in tone profiles and email history"""
    try:
        data = request.get_json()
        query = (data or {}).get('query', '').lower().strip()
        if not query:
            return api_error(400, 'query is required')

        contacts = []
        seen = set()

        # Source 1: email_tone_profiles.json
        if os.path.exists(TONE_PROFILES_PATH):
            with open(TONE_PROFILES_PATH) as f:
                profiles = json.load(f)
            for name, profile in profiles.items():
                if query in name.lower():
                    email = profile.get('email', '')
                    if email and email not in seen:
                        seen.add(email)
                        contacts.append({
                            'name': name,
                            'email': email,
                            'company': profile.get('company', ''),
                        })

        # Source 2: email_context.db
        if os.path.exists(EMAIL_CONTEXT_DB):
            from shared_lib.db import get_connection
            conn = get_connection(EMAIL_CONTEXT_DB)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT DISTINCT from_name, from_email FROM emails "
                "WHERE LOWER(from_name) LIKE ? LIMIT 10",
                (f'%{query}%',)
            )
            for row in cursor.fetchall():
                email = row['from_email']
                if email and email not in seen:
                    seen.add(email)
                    contacts.append({
                        'name': row['from_name'],
                        'email': email,
                        'company': '',
                    })
            conn.close()

        return success(contacts=contacts)
    except Exception as e:
        logger.error(f"Error searching contacts: {e}")
        return api_error(500, str(e))
