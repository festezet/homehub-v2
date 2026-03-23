"""
Thread Digest Service - DB management, CRUD, status calculation
Stores thread configs, digests, and analysis logs in a dedicated SQLite DB
"""

import json
import logging
import os
import sqlite3
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data', 'thread_digests.db'
)


class ThreadDigestService:
    """Manages thread configurations, digests, and analysis status"""

    def __init__(self):
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_db(self):
        """Initialize database schema"""
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = self._get_conn()
        self._create_tables(conn)
        self._migrate_position_column(conn)
        conn.close()
        logger.info(f"Thread digest DB initialized at {DB_PATH}")

    @staticmethod
    def _create_tables(conn):
        """Create core tables and indexes"""
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS thread_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                jid TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                platform TEXT NOT NULL DEFAULT 'whatsapp',
                is_group INTEGER NOT NULL DEFAULT 1,
                threshold_messages INTEGER NOT NULL DEFAULT 20,
                threshold_days INTEGER NOT NULL DEFAULT 3,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS thread_digests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER NOT NULL REFERENCES thread_configs(id),
                summary TEXT NOT NULL,
                action_items TEXT NOT NULL DEFAULT '[]',
                extracted_links TEXT NOT NULL DEFAULT '[]',
                key_topics TEXT NOT NULL DEFAULT '[]',
                message_count INTEGER NOT NULL,
                date_from TEXT,
                date_to TEXT,
                model TEXT DEFAULT 'claude',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS thread_analysis_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER NOT NULL REFERENCES thread_configs(id),
                message_count_at_analysis INTEGER NOT NULL,
                triggered_by TEXT DEFAULT 'manual',
                status TEXT DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS whatsapp_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER NOT NULL REFERENCES thread_configs(id),
                message_id TEXT NOT NULL UNIQUE,
                author TEXT,
                author_jid TEXT,
                body TEXT,
                timestamp INTEGER NOT NULL,
                from_me INTEGER DEFAULT 0,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_digests_thread
                ON thread_digests(thread_id);
            CREATE INDEX IF NOT EXISTS idx_digests_created
                ON thread_digests(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_analysis_log_thread
                ON thread_analysis_log(thread_id);
            CREATE INDEX IF NOT EXISTS idx_wa_messages_thread
                ON whatsapp_messages(thread_id);
            CREATE INDEX IF NOT EXISTS idx_wa_messages_ts
                ON whatsapp_messages(timestamp);
        """)
        conn.commit()

    @staticmethod
    def _migrate_position_column(conn):
        """Add position column to thread_configs if missing"""
        cols = [r[1] for r in conn.execute(
            "PRAGMA table_info(thread_configs)").fetchall()]
        if 'position' not in cols:
            conn.execute(
                "ALTER TABLE thread_configs ADD COLUMN position INTEGER NOT NULL DEFAULT 0")
            rows = conn.execute(
                "SELECT id FROM thread_configs ORDER BY name"
            ).fetchall()
            for i, row in enumerate(rows):
                conn.execute(
                    "UPDATE thread_configs SET position = ? WHERE id = ?",
                    (i, row['id']))
            conn.commit()
            logger.info("Migrated thread_configs: added position column")

    # ------------------------------------------------------------------
    # Thread configs CRUD
    # ------------------------------------------------------------------

    def list_threads(self):
        """List all thread configs"""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM thread_configs ORDER BY position, name"
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_thread(self, thread_id):
        """Get a single thread config by ID"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM thread_configs WHERE id = ?", (thread_id,)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def get_thread_by_jid(self, jid):
        """Get a thread config by JID"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM thread_configs WHERE jid = ?", (jid,)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def create_thread(self, data):
        """Create a new thread config"""
        jid = data.get('jid', '').strip()
        name = data.get('name', '').strip()
        if not jid or not name:
            return None, "jid and name are required"

        conn = self._get_conn()
        try:
            # Assign next position (append at end)
            max_pos = conn.execute(
                "SELECT COALESCE(MAX(position), -1) FROM thread_configs"
            ).fetchone()[0]

            conn.execute(
                """INSERT INTO thread_configs
                   (jid, name, platform, is_group, threshold_messages,
                    threshold_days, enabled, position)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    jid, name,
                    data.get('platform', 'whatsapp'),
                    1 if data.get('is_group', True) else 0,
                    data.get('threshold_messages', 20),
                    data.get('threshold_days', 3),
                    1 if data.get('enabled', True) else 0,
                    max_pos + 1
                )
            )
            conn.commit()
            thread_id = conn.execute(
                "SELECT id FROM thread_configs WHERE jid = ?", (jid,)
            ).fetchone()['id']
            conn.close()
            return thread_id, None
        except sqlite3.IntegrityError:
            conn.close()
            return None, f"Thread with JID {jid} already exists"

    def update_thread(self, thread_id, data):
        """Update a thread config"""
        allowed = {
            'name', 'platform', 'is_group', 'threshold_messages',
            'threshold_days', 'enabled'
        }
        updates = []
        values = []
        for key, val in data.items():
            if key in allowed:
                if key in ('is_group', 'enabled'):
                    val = 1 if val else 0
                updates.append(f"{key} = ?")
                values.append(val)

        if not updates:
            return False, "No valid fields to update"

        updates.append("updated_at = CURRENT_TIMESTAMP")
        values.append(thread_id)

        conn = self._get_conn()
        result = conn.execute(
            "UPDATE thread_configs SET " + ', '.join(updates) + " WHERE id = ?",
            values
        )
        conn.commit()
        conn.close()
        return result.rowcount > 0, None

    def move_thread(self, thread_id, direction):
        """Move a thread up or down in display order

        Args:
            thread_id: ID of thread to move
            direction: 'up' or 'down'
        Returns:
            (success, error)
        """
        conn = self._get_conn()
        current = conn.execute(
            "SELECT id, position FROM thread_configs WHERE id = ?",
            (thread_id,)
        ).fetchone()
        if not current:
            conn.close()
            return False, "Thread not found"

        cur_pos = current['position']

        if direction == 'up':
            # Find the thread just above (largest position < cur_pos)
            neighbor = conn.execute(
                """SELECT id, position FROM thread_configs
                   WHERE position < ? ORDER BY position DESC LIMIT 1""",
                (cur_pos,)
            ).fetchone()
        else:
            # Find the thread just below (smallest position > cur_pos)
            neighbor = conn.execute(
                """SELECT id, position FROM thread_configs
                   WHERE position > ? ORDER BY position ASC LIMIT 1""",
                (cur_pos,)
            ).fetchone()

        if not neighbor:
            conn.close()
            return True, None  # Already at top/bottom

        # Swap positions
        conn.execute(
            "UPDATE thread_configs SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (neighbor['position'], thread_id))
        conn.execute(
            "UPDATE thread_configs SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (cur_pos, neighbor['id']))
        conn.commit()
        conn.close()
        return True, None

    def delete_thread(self, thread_id):
        """Delete a thread config and its digests"""
        conn = self._get_conn()
        conn.execute(
            "DELETE FROM thread_analysis_log WHERE thread_id = ?",
            (thread_id,))
        conn.execute(
            "DELETE FROM thread_digests WHERE thread_id = ?", (thread_id,))
        result = conn.execute(
            "DELETE FROM thread_configs WHERE id = ?", (thread_id,))
        conn.commit()
        conn.close()
        return result.rowcount > 0

    # ------------------------------------------------------------------
    # WhatsApp message persistence
    # ------------------------------------------------------------------

    def store_whatsapp_messages(self, thread_id, messages):
        """Upsert WhatsApp messages into DB (dedup by message_id)

        Args:
            thread_id: thread config ID
            messages: list of dicts from Evolution API proxy

        Returns:
            (inserted_count, total_in_db)
        """
        if not messages:
            return 0, 0

        conn = self._get_conn()
        inserted = 0
        for msg in messages:
            msg_id = msg.get('message_id')
            if not msg_id:
                continue
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO whatsapp_messages
                       (thread_id, message_id, author, author_jid,
                        body, timestamp, from_me)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        thread_id,
                        msg_id,
                        msg.get('author'),
                        msg.get('author_jid'),
                        msg.get('text') or msg.get('body'),
                        msg.get('timestamp', 0),
                        1 if msg.get('from_me') else 0
                    )
                )
                inserted += conn.total_changes  # tracks if row was actually inserted
            except sqlite3.IntegrityError:
                pass

        conn.commit()
        total = conn.execute(
            "SELECT COUNT(*) FROM whatsapp_messages WHERE thread_id = ?",
            (thread_id,)
        ).fetchone()[0]
        conn.close()
        logger.info(
            f"WhatsApp messages stored for thread {thread_id}: "
            f"{len(messages)} fetched, {total} total in DB")
        return len(messages), total

    def get_whatsapp_messages(self, thread_id, since=None, limit=500):
        """Get WhatsApp messages from DB

        Args:
            thread_id: thread config ID
            since: ISO date string to filter messages after this date
            limit: max messages to return

        Returns:
            list of message dicts
        """
        conn = self._get_conn()
        query = "SELECT * FROM whatsapp_messages WHERE thread_id = ?"
        params = [thread_id]

        if since:
            try:
                since_dt = datetime.fromisoformat(since)
                since_ts = int(since_dt.timestamp())
                query += " AND timestamp >= ?"
                params.append(since_ts)
            except (ValueError, TypeError):
                pass

        query += " ORDER BY timestamp ASC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()
        conn.close()

        return [
            {
                'message_id': r['message_id'],
                'author': r['author'],
                'author_jid': r['author_jid'],
                'text': r['body'],
                'timestamp': r['timestamp'],
                'from_me': bool(r['from_me'])
            }
            for r in rows
        ]

    def get_whatsapp_message_count(self, thread_id):
        """Get total stored message count for a thread"""
        conn = self._get_conn()
        count = conn.execute(
            "SELECT COUNT(*) FROM whatsapp_messages WHERE thread_id = ?",
            (thread_id,)
        ).fetchone()[0]
        conn.close()
        return count

    # ------------------------------------------------------------------
    # Digests
    # ------------------------------------------------------------------

    def store_digest(self, thread_id, data):
        """Store a new digest for a thread"""
        summary = data.get('summary', '').strip()
        if not summary:
            return None, "summary is required"

        action_items = json.dumps(
            data.get('action_items', []), ensure_ascii=False)
        extracted_links = json.dumps(
            data.get('extracted_links', []), ensure_ascii=False)
        key_topics = json.dumps(
            data.get('key_topics', []), ensure_ascii=False)
        message_count = data.get('message_count', 0)

        conn = self._get_conn()

        # Verify thread exists
        thread = conn.execute(
            "SELECT id FROM thread_configs WHERE id = ?", (thread_id,)
        ).fetchone()
        if not thread:
            conn.close()
            return None, f"Thread {thread_id} not found"

        cursor = conn.execute(
            """INSERT INTO thread_digests
               (thread_id, summary, action_items, extracted_links,
                key_topics, message_count, date_from, date_to, model)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                thread_id, summary, action_items, extracted_links,
                key_topics, message_count,
                data.get('date_from'), data.get('date_to'),
                data.get('model', 'claude')
            )
        )
        digest_id = cursor.lastrowid

        # Log the analysis
        conn.execute(
            """INSERT INTO thread_analysis_log
               (thread_id, message_count_at_analysis, triggered_by, status)
               VALUES (?, ?, ?, 'completed')""",
            (thread_id, message_count, data.get('triggered_by', 'manual'))
        )

        conn.commit()
        conn.close()
        return digest_id, None

    def get_digests(self, thread_id, limit=10):
        """Get digest history for a thread"""
        conn = self._get_conn()
        rows = conn.execute(
            """SELECT * FROM thread_digests
               WHERE thread_id = ?
               ORDER BY created_at DESC
               LIMIT ?""",
            (thread_id, limit)
        ).fetchall()
        conn.close()
        return [self._format_digest(r) for r in rows]

    def get_latest_digests(self):
        """Get the latest digest for each enabled thread (dashboard view)"""
        conn = self._get_conn()
        rows = conn.execute(
            """SELECT tc.id as thread_id, tc.jid, tc.name, tc.platform,
                      tc.is_group, tc.enabled,
                      td.id as digest_id, td.summary, td.action_items,
                      td.extracted_links, td.key_topics, td.message_count,
                      td.date_from, td.date_to, td.model, td.created_at
               FROM thread_configs tc
               LEFT JOIN thread_digests td ON td.id = (
                   SELECT id FROM thread_digests
                   WHERE thread_id = tc.id
                   ORDER BY created_at DESC LIMIT 1
               )
               WHERE tc.enabled = 1
               ORDER BY tc.position, tc.name"""
        ).fetchall()
        conn.close()

        results = []
        for r in rows:
            item = {
                'thread_id': r['thread_id'],
                'jid': r['jid'],
                'name': r['name'],
                'platform': r['platform'],
                'is_group': bool(r['is_group']),
                'enabled': bool(r['enabled']),
                'digest': None
            }
            if r['digest_id']:
                item['digest'] = {
                    'id': r['digest_id'],
                    'summary': r['summary'],
                    'action_items': json.loads(r['action_items'] or '[]'),
                    'extracted_links': json.loads(
                        r['extracted_links'] or '[]'),
                    'key_topics': json.loads(r['key_topics'] or '[]'),
                    'message_count': r['message_count'],
                    'date_from': r['date_from'],
                    'date_to': r['date_to'],
                    'model': r['model'],
                    'created_at': r['created_at']
                }
            results.append(item)

        return results

    # ------------------------------------------------------------------
    # Status (hybrid trigger)
    # ------------------------------------------------------------------

    def get_status(self, platform_proxies=None):
        """Calculate which threads need analysis

        Args:
            platform_proxies: dict of platform -> proxy service instances
        """
        conn = self._get_conn()
        threads = conn.execute(
            "SELECT * FROM thread_configs WHERE enabled = 1"
        ).fetchall()

        now = datetime.now()
        results = [
            self._compute_thread_status(conn, t, now, platform_proxies)
            for t in threads
        ]

        conn.close()
        return results

    def _compute_thread_status(self, conn, t, now, platform_proxies):
        """Compute status for a single thread"""
        thread_id = t['id']

        last_log = conn.execute(
            """SELECT message_count_at_analysis, created_at
               FROM thread_analysis_log
               WHERE thread_id = ? AND status = 'completed'
               ORDER BY created_at DESC LIMIT 1""",
            (thread_id,)
        ).fetchone()

        last_count = last_log['message_count_at_analysis'] if last_log else 0
        last_date, days_elapsed = self._parse_last_analysis(last_log, now)

        current_count = last_count
        if platform_proxies:
            proxy = platform_proxies.get(t['platform'])
            if proxy:
                live_count = proxy.get_message_count(t['jid'])
                if live_count > 0:
                    current_count = live_count

        new_messages = max(0, current_count - last_count)
        threshold_msgs = t['threshold_messages']
        threshold_days = t['threshold_days']

        needs_analysis = (
            (new_messages >= threshold_msgs) or
            (days_elapsed >= threshold_days and new_messages > 0)
        )

        return {
            'thread_id': thread_id,
            'jid': t['jid'],
            'name': t['name'],
            'platform': t['platform'],
            'current_count': current_count,
            'last_analyzed_count': last_count,
            'new_messages': new_messages,
            'days_since_analysis': days_elapsed if days_elapsed < 999 else None,
            'last_analysis_date': (
                last_date.isoformat() if last_date else None),
            'threshold_messages': threshold_msgs,
            'threshold_days': threshold_days,
            'needs_analysis': needs_analysis
        }

    @staticmethod
    def _parse_last_analysis(last_log, now):
        """Parse last analysis date and compute days elapsed"""
        last_date = None
        days_elapsed = 999
        if last_log and last_log['created_at']:
            try:
                last_date = datetime.fromisoformat(last_log['created_at'])
                days_elapsed = (now - last_date).days
            except (ValueError, TypeError):
                pass
        return last_date, days_elapsed

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _format_digest(self, row):
        """Format a digest row into a dict with parsed JSON"""
        d = dict(row)
        for field in ('action_items', 'extracted_links', 'key_topics'):
            try:
                d[field] = json.loads(d[field] or '[]')
            except (json.JSONDecodeError, TypeError):
                d[field] = []
        return d


thread_digest_service = ThreadDigestService()
