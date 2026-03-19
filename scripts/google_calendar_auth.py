#!/usr/bin/env python3
"""
Google Calendar Auth - One-time CLI script to generate OAuth token.

Usage:
    python3 scripts/google_calendar_auth.py

Pre-requisite:
    - Enable Google Calendar API in Cloud Console (project gmailcleanup-482810)
    - Uses client_secret.json from gmail-cleaner (InstalledAppFlow / Desktop type)

Generates: credentials/google_calendar_token.json
"""

import os
import sys
import json
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/calendar']
CLIENT_SECRET_PATH = '/data/projects/gmail-cleaner/credentials/client_secret.json'
TOKEN_PATH = Path(__file__).parent.parent / 'credentials' / 'google_calendar_token.json'


def main():
    creds = None

    # Check existing token
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if creds and creds.valid:
        print(f"Token already valid: {TOKEN_PATH}")
        return

    if creds and creds.expired and creds.refresh_token:
        print("Token expired, refreshing...")
        creds.refresh(Request())
    else:
        if not os.path.exists(CLIENT_SECRET_PATH):
            print(f"ERROR: client_secret.json not found at {CLIENT_SECRET_PATH}")
            sys.exit(1)

        print("Opening browser for Google Calendar authorization...")
        print(f"Scopes: {SCOPES}")
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
        creds = flow.run_local_server(port=8090)

    # Save token
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(TOKEN_PATH, 'w') as f:
        f.write(creds.to_json())
    os.chmod(TOKEN_PATH, 0o600)

    print(f"Token saved: {TOKEN_PATH}")
    print("Google Calendar auth complete.")


if __name__ == '__main__':
    main()
