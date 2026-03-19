"""
SMS Proxy Service - XML import and local storage for Thread Digest
Imports SMS from Android backup XML (SMS Backup & Restore format)
and provides the same interface as WhatsApp/Signal proxy services.
"""

import logging
import os
import sqlite3
import xml.etree.ElementTree as ET
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data', 'thread_digests.db'
)


class SmsProxyService:
    """SMS proxy with XML import and SQLite local storage"""

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
            CREATE TABLE IF NOT EXISTS sms_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                address TEXT NOT NULL,
                contact_name TEXT,
                body TEXT,
                timestamp INTEGER NOT NULL,
                is_sent INTEGER DEFAULT 0,
                message_id TEXT UNIQUE,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_sms_address
                ON sms_messages(address);
            CREATE INDEX IF NOT EXISTS idx_sms_timestamp
                ON sms_messages(timestamp);
        """)
        conn.commit()
        conn.close()
        logger.info("SMS messages table initialized")

    def import_backup(self, xml_path):
        """Import SMS from Android XML backup (SMS Backup & Restore format).

        Args:
            xml_path: Path to the XML backup file
        Returns:
            (imported_count, error)
        """
        if not os.path.exists(xml_path):
            return 0, f"File not found: {xml_path}"

        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
        except ET.ParseError as e:
            return 0, f"XML parse error: {e}"

        conn = self._get_conn()
        imported = 0

        for sms in root.iter('sms'):
            address = sms.get('address', '').strip()
            body = sms.get('body', '')
            date_str = sms.get('date', '0')
            msg_type = sms.get('type', '1')  # 1=received, 2=sent
            contact_name = sms.get('contact_name', '')

            if not address or not body:
                continue

            timestamp = int(date_str) if date_str.isdigit() else 0
            is_sent = 1 if msg_type == '2' else 0
            message_id = f"sms_{timestamp}_{address}"

            try:
                conn.execute(
                    """INSERT OR IGNORE INTO sms_messages
                       (address, contact_name, body, timestamp,
                        is_sent, message_id)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (address, contact_name, body, timestamp,
                     is_sent, message_id)
                )
                imported += 1
            except sqlite3.IntegrityError:
                pass

        conn.commit()
        conn.close()
        logger.info(f"SMS import: {imported} messages from {xml_path}")
        return imported, None

    def find_chats(self):
        """List SMS threads grouped by phone number"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT address,
                   MAX(contact_name) as contact_name,
                   COUNT(*) as message_count,
                   MAX(timestamp) as last_message
            FROM sms_messages
            GROUP BY address
            ORDER BY last_message DESC
        """).fetchall()
        conn.close()

        return [
            {
                'id': r['address'],
                'name': r['contact_name'] or r['address'],
                'size': r['message_count'],
            }
            for r in rows
        ]

    def find_messages(self, address, limit=50, since=None):
        """Fetch SMS messages for a phone number from local storage"""
        conn = self._get_conn()
        query = "SELECT * FROM sms_messages WHERE address = ?"
        params = [address]

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
                'author': r['contact_name'] or r['address'],
                'author_jid': r['address'],
                'text': r['body'] or '',
                'timestamp': r['timestamp'],
                'from_me': bool(r['is_sent']),
                'message_id': r['message_id'] or ''
            }
            for r in rows
        ]

    def get_message_count(self, address):
        """Get total message count for an SMS thread"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM sms_messages WHERE address = ?",
            (address,)
        ).fetchone()
        conn.close()
        return row['cnt'] if row else 0


sms_proxy_service = SmsProxyService()
