"""
Signal Proxy Service - signal-cli-rest-api proxy for Thread Digest
Handles communication with signal-cli REST API and local message storage.
signal-cli does NOT persist message history, so we poll and store locally.
"""

import logging
import os
import sqlite3
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

SIGNAL_API_URL = os.environ.get('SIGNAL_API_URL', 'http://localhost:8083')
SIGNAL_PHONE_NUMBER = os.environ.get('SIGNAL_PHONE_NUMBER', '+33608741306')
REQUEST_TIMEOUT = 10

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data', 'thread_digests.db'
)


class SignalProxyService:
    """Proxy to signal-cli REST API with local message storage"""

    def __init__(self):
        self._init_tables()

    def _get_conn(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_tables(self):
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS signal_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                sender_number TEXT,
                sender_name TEXT,
                body TEXT,
                timestamp INTEGER NOT NULL,
                message_id TEXT UNIQUE,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_signal_group
                ON signal_messages(group_id);
            CREATE INDEX IF NOT EXISTS idx_signal_timestamp
                ON signal_messages(timestamp);
        """)
        conn.commit()
        conn.close()
        logger.info("Signal messages table initialized")

    def find_chats(self):
        """Fetch Signal groups via signal-cli REST API"""
        try:
            number = SIGNAL_PHONE_NUMBER.replace('+', '%2B')
            resp = requests.get(
                f'{SIGNAL_API_URL}/v1/groups/{number}',
                timeout=REQUEST_TIMEOUT
            )
            if resp.status_code != 200:
                logger.warning(
                    f"Signal API groups returned {resp.status_code}")
                return []

            groups = resp.json()
            if not isinstance(groups, list):
                return []

            return [
                {
                    'id': g.get('id', ''),
                    'name': g.get('name', 'Sans nom'),
                    'size': len(g.get('members', [])),
                }
                for g in groups
                if g.get('id')
            ]

        except requests.ConnectionError:
            logger.warning("Signal API not reachable (port 8083)")
            return []
        except Exception as e:
            logger.error(f"Error fetching Signal groups: {e}")
            return []

    def poll_messages(self):
        """Poll signal-cli for new messages and store them locally.
        Returns number of new messages stored.
        /v1/receive marks messages as read, so we must store them.
        """
        try:
            number = SIGNAL_PHONE_NUMBER.replace('+', '%2B')
            resp = requests.get(
                f'{SIGNAL_API_URL}/v1/receive/{number}',
                timeout=REQUEST_TIMEOUT
            )
            if resp.status_code != 200:
                logger.warning(
                    f"Signal receive returned {resp.status_code}")
                return 0

            envelopes = resp.json()
            if not isinstance(envelopes, list):
                return 0

            stored = 0
            conn = self._get_conn()
            for env in envelopes:
                msg = self._parse_envelope(env)
                if msg and msg['group_id']:
                    try:
                        conn.execute(
                            """INSERT OR IGNORE INTO signal_messages
                               (group_id, sender_number, sender_name,
                                body, timestamp, message_id)
                               VALUES (?, ?, ?, ?, ?, ?)""",
                            (msg['group_id'], msg['sender_number'],
                             msg['sender_name'], msg['body'],
                             msg['timestamp'], msg['message_id'])
                        )
                        stored += 1
                    except sqlite3.IntegrityError:
                        pass

            conn.commit()
            conn.close()
            logger.info(f"Signal poll: stored {stored} new messages")
            return stored

        except requests.ConnectionError:
            logger.warning("Signal API not reachable for polling")
            return 0
        except Exception as e:
            logger.error(f"Error polling Signal messages: {e}")
            return 0

    def find_messages(self, group_id, limit=50, since=None):
        """Fetch messages from local storage for a Signal group"""
        conn = self._get_conn()
        query = "SELECT * FROM signal_messages WHERE group_id = ?"
        params = [group_id]

        if since:
            try:
                since_dt = datetime.fromisoformat(since)
                since_ts = int(since_dt.timestamp() * 1000)
                query += " AND timestamp > ?"
                params.append(since_ts)
            except (ValueError, TypeError):
                pass

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()
        conn.close()

        return [
            {
                'author': r['sender_name'] or r['sender_number'] or 'Unknown',
                'author_jid': r['sender_number'] or '',
                'text': r['body'] or '',
                'timestamp': r['timestamp'],
                'from_me': (r['sender_number'] == SIGNAL_PHONE_NUMBER),
                'message_id': r['message_id'] or ''
            }
            for r in rows
        ]

    def get_message_count(self, group_id):
        """Get total message count for a Signal group from local storage"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM signal_messages WHERE group_id = ?",
            (group_id,)
        ).fetchone()
        conn.close()
        return row['cnt'] if row else 0

    def _parse_envelope(self, envelope):
        """Parse a signal-cli envelope into a storable message"""
        data_msg = envelope.get('envelope', {}).get('dataMessage')
        if not data_msg:
            return None

        group_info = data_msg.get('groupInfo', {})
        group_id = group_info.get('groupId', '')

        body = data_msg.get('message', '')
        if not body:
            # Check for attachments
            attachments = data_msg.get('attachments', [])
            if attachments:
                body = f"[attachment: {attachments[0].get('contentType', 'file')}]"
            else:
                return None

        source = envelope.get('envelope', {})
        timestamp = data_msg.get('timestamp', source.get('timestamp', 0))

        return {
            'group_id': group_id,
            'sender_number': source.get('sourceNumber', ''),
            'sender_name': source.get('sourceName', ''),
            'body': body,
            'timestamp': timestamp,
            'message_id': f"sig_{timestamp}_{source.get('sourceNumber', '')}"
        }


signal_proxy_service = SignalProxyService()
