"""
Google Calendar Service - CRUD operations.
Auth delegue a shared_lib.google_auth.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional

try:
    from shared_lib.google_auth import get_credentials, get_calendar_service, check_auth_status
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False
    print("Warning: shared_lib not installed. Run: cd /data/projects/shared-lib && pip install -e .")

TIMEZONE = 'Europe/Paris'


class GoogleCalendarService:
    """Google Calendar API service with CRUD."""

    def __init__(self):
        self._service = None

    def is_available(self) -> bool:
        return GOOGLE_API_AVAILABLE

    def _get_service(self):
        if self._service:
            return self._service
        if not GOOGLE_API_AVAILABLE:
            return None
        self._service = get_calendar_service()
        return self._service

    def is_authenticated(self) -> bool:
        if not GOOGLE_API_AVAILABLE:
            return False
        status = check_auth_status("calendar")
        return status.get("authenticated", False)

    def get_status(self) -> Dict:
        if not GOOGLE_API_AVAILABLE:
            return {'connected': False, 'reason': 'libraries_missing'}
        status = check_auth_status("calendar")
        if not status.get("authenticated"):
            return {'connected': False, 'reason': status.get('reason', 'unknown')}
        return {'connected': True, 'email': 'fabrice.estezet@gmail.com'}

    # ---- READ ----

    def get_events(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        service = self._get_service()
        if not service:
            return []

        try:
            time_min = start_date.isoformat() + '+01:00' if start_date.tzinfo is None else start_date.isoformat()
            time_max = end_date.isoformat() + '+01:00' if end_date.tzinfo is None else end_date.isoformat()

            events_result = service.events().list(
                calendarId='primary',
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy='startTime',
                timeZone=TIMEZONE
            ).execute()

            return [self._simplify_event(e) for e in events_result.get('items', [])]

        except Exception as e:
            print(f"Error fetching events: {e}")
            return []

    def get_week_events(self, week_start: datetime) -> Dict[str, List[Dict]]:
        week_end = week_start + timedelta(days=7)
        events = self.get_events(week_start, week_end)

        days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
        by_day = {day: [] for day in days}

        for event in events:
            start = event.get('start', {})
            if 'dateTime' in start:
                event_date = datetime.fromisoformat(start['dateTime'])
            elif 'date' in start:
                event_date = datetime.strptime(start['date'], '%Y-%m-%d')
            else:
                continue

            day_index = event_date.weekday()
            if 0 <= day_index < 7:
                by_day[days[day_index]].append(event)

        return by_day

    # ---- CREATE ----

    def create_event(self, summary: str, start_datetime: str, end_datetime: str,
                     description: str = '', location: str = '',
                     all_day: bool = False) -> Optional[Dict]:
        service = self._get_service()
        if not service:
            return None

        if all_day:
            body = {
                'summary': summary,
                'start': {'date': start_datetime[:10]},
                'end': {'date': end_datetime[:10]},
            }
        else:
            body = {
                'summary': summary,
                'start': {'dateTime': start_datetime, 'timeZone': TIMEZONE},
                'end': {'dateTime': end_datetime, 'timeZone': TIMEZONE},
            }

        if description:
            body['description'] = description
        if location:
            body['location'] = location

        try:
            event = service.events().insert(calendarId='primary', body=body).execute()
            return self._simplify_event(event)
        except Exception as e:
            print(f"Error creating event: {e}")
            return None

    # ---- UPDATE ----

    def update_event(self, event_id: str, **kwargs) -> Optional[Dict]:
        service = self._get_service()
        if not service:
            return None

        try:
            event = service.events().get(calendarId='primary', eventId=event_id).execute()

            if 'summary' in kwargs:
                event['summary'] = kwargs['summary']
            if 'description' in kwargs:
                event['description'] = kwargs['description']
            if 'location' in kwargs:
                event['location'] = kwargs['location']
            if 'start_datetime' in kwargs:
                event['start'] = {'dateTime': kwargs['start_datetime'], 'timeZone': TIMEZONE}
            if 'end_datetime' in kwargs:
                event['end'] = {'dateTime': kwargs['end_datetime'], 'timeZone': TIMEZONE}

            updated = service.events().update(
                calendarId='primary', eventId=event_id, body=event
            ).execute()
            return self._simplify_event(updated)

        except Exception as e:
            print(f"Error updating event: {e}")
            return None

    # ---- DELETE ----

    def delete_event(self, event_id: str) -> bool:
        service = self._get_service()
        if not service:
            return False

        try:
            service.events().delete(calendarId='primary', eventId=event_id).execute()
            return True
        except Exception as e:
            print(f"Error deleting event: {e}")
            return False

    # ---- HELPERS ----

    def _simplify_event(self, event: Dict) -> Dict:
        return {
            'id': event.get('id'),
            'summary': event.get('summary', 'Sans titre'),
            'start': event.get('start'),
            'end': event.get('end'),
            'location': event.get('location', ''),
            'description': event.get('description', ''),
            'status': event.get('status'),
            'htmlLink': event.get('htmlLink'),
        }


google_calendar_service = GoogleCalendarService()
