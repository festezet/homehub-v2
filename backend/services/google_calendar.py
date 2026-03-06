"""
Google Calendar Service - OAuth 2.0 integration with Google Calendar API
Handles authentication, token management, and event fetching
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from pathlib import Path

# Google API imports (to be installed)
try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    from google.auth.transport.requests import Request
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False
    print("Warning: Google API libraries not installed. Run: pip install google-auth-oauthlib google-api-python-client")

# Configuration
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'credentials', 'google_oauth.json')
DB_PATH = '/data/projects/infrastructure/data/calendar.db'
REDIRECT_URI = 'http://localhost:5000/api/calendar/google/callback'


class GoogleCalendarService:
    """Service for Google Calendar API integration"""

    def __init__(self):
        self.credentials = None
        self.service = None
        self._init_db()

    def _init_db(self) -> None:
        """Initialize SQLite database for token storage"""
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS google_tokens (
                id INTEGER PRIMARY KEY,
                user_email TEXT NOT NULL UNIQUE,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                token_expiry TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()

    def is_available(self) -> bool:
        """Check if Google API libraries are installed"""
        return GOOGLE_API_AVAILABLE

    def get_auth_url(self) -> Optional[str]:
        """
        Generate Google OAuth authorization URL

        Returns:
            Authorization URL to redirect user to, or None if not available
        """
        if not GOOGLE_API_AVAILABLE:
            return None

        if not os.path.exists(CREDENTIALS_PATH):
            raise FileNotFoundError(
                f"Google OAuth credentials not found at {CREDENTIALS_PATH}. "
                "Please download from Google Cloud Console."
            )

        flow = Flow.from_client_secrets_file(
            CREDENTIALS_PATH,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )

        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )

        return auth_url

    def handle_callback(self, authorization_code: str) -> Dict:
        """
        Handle OAuth callback and exchange code for tokens

        Args:
            authorization_code: Code received from Google OAuth callback

        Returns:
            Dict with user email and success status
        """
        if not GOOGLE_API_AVAILABLE:
            return {'success': False, 'error': 'Google API not available'}

        flow = Flow.from_client_secrets_file(
            CREDENTIALS_PATH,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI
        )

        flow.fetch_token(code=authorization_code)
        credentials = flow.credentials

        # Build service to get user email
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().get(calendarId='primary').execute()
        user_email = calendar_list.get('id', 'unknown')

        # Store tokens
        self._store_tokens(
            user_email=user_email,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            expiry=credentials.expiry.isoformat() if credentials.expiry else None
        )

        return {
            'success': True,
            'email': user_email
        }

    def _store_tokens(self, user_email: str, access_token: str,
                      refresh_token: str, expiry: Optional[str]) -> None:
        """Store OAuth tokens in database"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO google_tokens
            (user_email, access_token, refresh_token, token_expiry, updated_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_email, access_token, refresh_token, expiry, datetime.now().isoformat()))

        conn.commit()
        conn.close()

    def _get_tokens(self, user_email: str) -> Optional[Dict]:
        """Retrieve stored tokens for user"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT access_token, refresh_token, token_expiry
            FROM google_tokens WHERE user_email = ?
        ''', (user_email,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                'access_token': row[0],
                'refresh_token': row[1],
                'expiry': row[2]
            }
        return None

    def _get_credentials(self, user_email: str) -> Optional[Credentials]:
        """Get valid credentials for user, refreshing if necessary"""
        if not GOOGLE_API_AVAILABLE:
            return None

        tokens = self._get_tokens(user_email)
        if not tokens:
            return None

        credentials = Credentials(
            token=tokens['access_token'],
            refresh_token=tokens['refresh_token'],
            token_uri='https://oauth2.googleapis.com/token',
            client_id=self._get_client_id(),
            client_secret=self._get_client_secret()
        )

        # Refresh if expired
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                # Update stored tokens
                self._store_tokens(
                    user_email=user_email,
                    access_token=credentials.token,
                    refresh_token=credentials.refresh_token,
                    expiry=credentials.expiry.isoformat() if credentials.expiry else None
                )
            except Exception as e:
                print(f"Error refreshing token: {e}")
                return None

        return credentials

    def _get_client_id(self) -> Optional[str]:
        """Get client ID from credentials file"""
        try:
            with open(CREDENTIALS_PATH, 'r') as f:
                data = json.load(f)
                return data.get('web', {}).get('client_id')
        except:
            return None

    def _get_client_secret(self) -> Optional[str]:
        """Get client secret from credentials file"""
        try:
            with open(CREDENTIALS_PATH, 'r') as f:
                data = json.load(f)
                return data.get('web', {}).get('client_secret')
        except:
            return None

    def is_authenticated(self, user_email: str) -> bool:
        """Check if user has valid authentication"""
        tokens = self._get_tokens(user_email)
        return tokens is not None and tokens.get('refresh_token') is not None

    def get_events(self, user_email: str, start_date: datetime,
                   end_date: datetime) -> List[Dict]:
        """
        Fetch calendar events for date range

        Args:
            user_email: User's Google email
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of calendar events
        """
        if not GOOGLE_API_AVAILABLE:
            return []

        credentials = self._get_credentials(user_email)
        if not credentials:
            return []

        try:
            service = build('calendar', 'v3', credentials=credentials)

            events_result = service.events().list(
                calendarId='primary',
                timeMin=start_date.isoformat() + 'Z',
                timeMax=end_date.isoformat() + 'Z',
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])

            # Simplify event format
            simplified = []
            for event in events:
                simplified.append({
                    'id': event.get('id'),
                    'summary': event.get('summary', 'Sans titre'),
                    'start': event.get('start'),
                    'end': event.get('end'),
                    'location': event.get('location'),
                    'description': event.get('description'),
                    'status': event.get('status'),
                    'htmlLink': event.get('htmlLink')
                })

            return simplified

        except Exception as e:
            print(f"Error fetching events: {e}")
            return []

    def get_week_events(self, user_email: str, week_start: datetime) -> Dict[str, List[Dict]]:
        """
        Fetch events for a full week, organized by day

        Args:
            user_email: User's Google email
            week_start: Monday of the week

        Returns:
            Dict with day names as keys and event lists as values
        """
        week_end = week_start + timedelta(days=7)
        events = self.get_events(user_email, week_start, week_end)

        # Organize by day
        days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
        by_day = {day: [] for day in days}

        for event in events:
            event_start = event.get('start', {})

            if 'dateTime' in event_start:
                event_date = datetime.fromisoformat(event_start['dateTime'].replace('Z', '+00:00'))
            elif 'date' in event_start:
                event_date = datetime.strptime(event_start['date'], '%Y-%m-%d')
            else:
                continue

            day_index = event_date.weekday()
            if 0 <= day_index < 7:
                by_day[days[day_index]].append(event)

        return by_day

    def disconnect(self, user_email: str) -> bool:
        """Remove stored tokens for user (disconnect)"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('DELETE FROM google_tokens WHERE user_email = ?', (user_email,))

        conn.commit()
        conn.close()

        return True


# Singleton instance
google_calendar_service = GoogleCalendarService()
