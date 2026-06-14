"""
WhatsApp Chat Service - Unified chat persistence for split-panel Historique
Manages whatsapp_chats table (all conversations) and links to whatsapp_messages.
DB-first approach: instant list from DB, background sync from Evolution API.
"""

import logging
import os
import sqlite3
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data', 'thread_digests.db'
)


class WhatsAppChatService:
    """Manages whatsapp_chats table and message access for the Historique tab"""

    def __init__(self):
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_db(self):
        """Create whatsapp_chats table + migrate whatsapp_messages"""
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = self._get_conn()
        self._create_chats_table(conn)
        self._migrate_messages_add_jid(conn)
        self._migrate_messages_add_media(conn)
        self._seed_chats_from_configs(conn)
        conn.close()
        logger.info("WhatsApp chat service initialized")

    @staticmethod
    def _create_chats_table(conn):
        """Create whatsapp_chats table if not exists"""
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS whatsapp_chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                jid TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL DEFAULT 'contact',
                last_ts INTEGER NOT NULL DEFAULT 0,
                msg_count INTEGER NOT NULL DEFAULT 0,
                last_message TEXT DEFAULT '',
                last_author TEXT DEFAULT '',
                favorite INTEGER NOT NULL DEFAULT 0,
                thread_config_id INTEGER REFERENCES thread_configs(id),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_wa_chats_jid
                ON whatsapp_chats(jid);
            CREATE INDEX IF NOT EXISTS idx_wa_chats_last_ts
                ON whatsapp_chats(last_ts DESC);
            CREATE INDEX IF NOT EXISTS idx_wa_chats_favorite
                ON whatsapp_chats(favorite);
        """)
        conn.commit()

    @staticmethod
    def _migrate_messages_add_jid(conn):
        """Add jid column to whatsapp_messages if missing, backfill from thread_configs"""
        cols = [r[1] for r in conn.execute(
            "PRAGMA table_info(whatsapp_messages)").fetchall()]
        if 'jid' in cols:
            return

        logger.info("Migrating whatsapp_messages: adding jid column")
        conn.execute(
            "ALTER TABLE whatsapp_messages ADD COLUMN jid TEXT")

        # Backfill jid from thread_configs
        conn.execute("""
            UPDATE whatsapp_messages
            SET jid = (
                SELECT tc.jid FROM thread_configs tc
                WHERE tc.id = whatsapp_messages.thread_id
            )
        """)
        conn.commit()

        # Create index on jid for message queries
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_wa_messages_jid
                ON whatsapp_messages(jid)
        """)
        conn.commit()
        logger.info("whatsapp_messages: jid column added and backfilled")

    @staticmethod
    def _migrate_messages_add_media(conn):
        """Add media_type and thumbnail columns to whatsapp_messages"""
        cols = [r[1] for r in conn.execute(
            "PRAGMA table_info(whatsapp_messages)").fetchall()]
        if 'media_type' in cols:
            return
        logger.info("Migrating whatsapp_messages: adding media columns")
        conn.execute(
            "ALTER TABLE whatsapp_messages ADD COLUMN media_type TEXT")
        conn.execute(
            "ALTER TABLE whatsapp_messages ADD COLUMN thumbnail TEXT")
        conn.commit()
        logger.info("whatsapp_messages: media_type + thumbnail columns added")

    @staticmethod
    def _seed_chats_from_configs(conn):
        """Seed whatsapp_chats from existing thread_configs (one-time migration)"""
        existing = conn.execute(
            "SELECT COUNT(*) FROM whatsapp_chats").fetchone()[0]
        if existing > 0:
            return

        configs = conn.execute("""
            SELECT id, jid, name, is_group, favorite
            FROM thread_configs
            WHERE platform = 'whatsapp'
        """).fetchall()

        if not configs:
            return

        logger.info(f"Seeding whatsapp_chats from {len(configs)} thread_configs")
        for tc in configs:
            chat_type = 'group' if tc['is_group'] else 'contact'

            # Get last message info from whatsapp_messages
            last_msg = conn.execute("""
                SELECT body, author, timestamp
                FROM whatsapp_messages
                WHERE thread_id = ?
                ORDER BY timestamp DESC LIMIT 1
            """, (tc['id'],)).fetchone()

            msg_count = conn.execute(
                "SELECT COUNT(*) FROM whatsapp_messages WHERE thread_id = ?",
                (tc['id'],)).fetchone()[0]

            conn.execute("""
                INSERT OR IGNORE INTO whatsapp_chats
                (jid, name, type, last_ts, msg_count, last_message,
                 last_author, favorite, thread_config_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tc['jid'],
                tc['name'],
                chat_type,
                last_msg['timestamp'] if last_msg else 0,
                msg_count,
                (last_msg['body'] or '')[:200] if last_msg else '',
                last_msg['author'] or '' if last_msg else '',
                tc['favorite'],
                tc['id']
            ))

        conn.commit()
        logger.info(f"Seeded {len(configs)} chats from thread_configs")

    # ------------------------------------------------------------------
    # Chat CRUD
    # ------------------------------------------------------------------

    def list_chats(self):
        """List all chats, favorites first, then by last_ts desc"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT wc.*, tc.enabled as digest_enabled,
                   tc.marked_for_update
            FROM whatsapp_chats wc
            LEFT JOIN thread_configs tc ON tc.id = wc.thread_config_id
            ORDER BY wc.favorite DESC, wc.last_ts DESC
        """).fetchall()
        conn.close()
        return [self._format_chat(r) for r in rows]

    def get_chat(self, chat_id):
        """Get a single chat by ID"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM whatsapp_chats WHERE id = ?",
            (chat_id,)).fetchone()
        conn.close()
        return self._format_chat(row) if row else None

    def get_chat_by_jid(self, jid):
        """Get a chat by JID"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM whatsapp_chats WHERE jid = ?",
            (jid,)).fetchone()
        conn.close()
        return self._format_chat(row) if row else None

    def upsert_chat(self, jid, name, chat_type, last_ts=0,
                    msg_count=0, last_message='', last_author=''):
        """Create or update a chat entry"""
        conn = self._get_conn()

        # Check if thread_config exists for this JID
        tc = conn.execute(
            "SELECT id FROM thread_configs WHERE jid = ?",
            (jid,)).fetchone()
        tc_id = tc['id'] if tc else None

        existing = conn.execute(
            "SELECT id FROM whatsapp_chats WHERE jid = ?",
            (jid,)).fetchone()

        if existing:
            conn.execute("""
                UPDATE whatsapp_chats
                SET name = CASE WHEN ? != '' THEN ? ELSE name END,
                    type = ?,
                    last_ts = MAX(last_ts, ?),
                    msg_count = MAX(msg_count, ?),
                    last_message = CASE WHEN ? > last_ts THEN ? ELSE last_message END,
                    last_author = CASE WHEN ? > last_ts THEN ? ELSE last_author END,
                    thread_config_id = COALESCE(?, thread_config_id),
                    updated_at = CURRENT_TIMESTAMP
                WHERE jid = ?
            """, (name, name, chat_type, last_ts, msg_count,
                  last_ts, last_message[:200],
                  last_ts, last_author,
                  tc_id, jid))
        else:
            conn.execute("""
                INSERT INTO whatsapp_chats
                (jid, name, type, last_ts, msg_count, last_message,
                 last_author, thread_config_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (jid, name, chat_type, last_ts, msg_count,
                  last_message[:200], last_author, tc_id))

        conn.commit()
        chat_id = conn.execute(
            "SELECT id FROM whatsapp_chats WHERE jid = ?",
            (jid,)).fetchone()['id']
        conn.close()
        return chat_id

    def toggle_favorite(self, chat_id):
        """Toggle favorite on any chat. Returns new value or None."""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT favorite FROM whatsapp_chats WHERE id = ?",
            (chat_id,)).fetchone()
        if not row:
            conn.close()
            return None
        new_val = 0 if row['favorite'] else 1
        conn.execute(
            "UPDATE whatsapp_chats SET favorite = ?, "
            "updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_val, chat_id))
        conn.commit()
        conn.close()
        return new_val

    # ------------------------------------------------------------------
    # Sync from Evolution API proxy
    # ------------------------------------------------------------------

    def sync_chats_from_proxy(self, proxy):
        """Fetch all chats from Evolution API and upsert into DB.

        Args:
            proxy: WhatsAppProxyService instance
        Returns:
            (synced_count, total_count)
        """
        all_chats = proxy.find_all_chats()
        if not all_chats:
            return 0, self._count_chats()

        conn = self._get_conn()
        synced = 0

        for chat in all_chats:
            jid = chat.get('jid', '')
            if not jid:
                continue

            # Check if thread_config exists
            tc = conn.execute(
                "SELECT id FROM thread_configs WHERE jid = ?",
                (jid,)).fetchone()
            tc_id = tc['id'] if tc else None

            existing = conn.execute(
                "SELECT id, favorite FROM whatsapp_chats WHERE jid = ?",
                (jid,)).fetchone()

            last_ts = chat.get('last_ts', 0)
            name = chat.get('name', '')
            chat_type = chat.get('type', 'contact')
            msg_count = chat.get('msg_count', 0)

            if existing:
                conn.execute("""
                    UPDATE whatsapp_chats
                    SET name = CASE WHEN ? != '' THEN ? ELSE name END,
                        type = ?,
                        last_ts = MAX(last_ts, ?),
                        msg_count = MAX(msg_count, ?),
                        thread_config_id = COALESCE(?, thread_config_id),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE jid = ?
                """, (name, name, chat_type, last_ts, msg_count,
                      tc_id, jid))
            else:
                conn.execute("""
                    INSERT INTO whatsapp_chats
                    (jid, name, type, last_ts, msg_count,
                     thread_config_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (jid, name, chat_type, last_ts, msg_count, tc_id))

            synced += 1

        conn.commit()
        total = conn.execute(
            "SELECT COUNT(*) FROM whatsapp_chats").fetchone()[0]
        conn.close()

        logger.info(f"Synced {synced} chats from Evolution API, "
                    f"{total} total in DB")
        return synced, total

    def sync_favorites_messages(self, proxy):
        """Fetch fresh messages for all favorite chats.

        Args:
            proxy: WhatsAppProxyService instance
        Returns:
            dict with {synced_chats, total_messages}
        """
        conn = self._get_conn()
        favs = conn.execute(
            "SELECT id, jid, name FROM whatsapp_chats WHERE favorite = 1"
        ).fetchall()
        conn.close()

        if not favs:
            return {'synced_chats': 0, 'total_messages': 0}

        total_msgs = 0
        for fav in favs:
            try:
                fresh = proxy.find_messages(fav['jid'], limit=200)
                if fresh:
                    stored = self.store_messages(
                        fav['id'], fresh, proxy_jid=fav['jid'])
                    total_msgs += stored
            except Exception as e:
                logger.warning(
                    f"Favorites sync failed for {fav['name']}: {e}")

        logger.info(f"Favorites sync: {len(favs)} chats, "
                    f"{total_msgs} new messages")
        return {'synced_chats': len(favs), 'total_messages': total_msgs}

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------

    def get_messages(self, chat_id, since=None, limit=500):
        """Get messages for a chat from whatsapp_messages table.

        Uses jid to query (not thread_id) so works for all chats.
        """
        conn = self._get_conn()
        chat = conn.execute(
            "SELECT jid, thread_config_id FROM whatsapp_chats WHERE id = ?",
            (chat_id,)).fetchone()
        if not chat:
            conn.close()
            return []

        jid = chat['jid']
        thread_id = chat['thread_config_id']

        # Query by jid first (covers migrated data), fallback thread_id
        query = """
            SELECT * FROM whatsapp_messages
            WHERE (jid = ? OR (jid IS NULL AND thread_id = ?))
        """
        params = [jid, thread_id]

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

        result = []
        for r in rows:
            msg = {
                'message_id': r['message_id'],
                'author': r['author'],
                'author_jid': r['author_jid'],
                'text': r['body'],
                'timestamp': r['timestamp'],
                'from_me': bool(r['from_me'])
            }
            if r['media_type']:
                msg['media_type'] = r['media_type']
            if r['thumbnail']:
                msg['thumbnail'] = r['thumbnail']
            result.append(msg)
        return result

    def get_message_count(self, chat_id):
        """Get stored message count for a chat"""
        conn = self._get_conn()
        chat = conn.execute(
            "SELECT jid, thread_config_id FROM whatsapp_chats WHERE id = ?",
            (chat_id,)).fetchone()
        if not chat:
            conn.close()
            return 0

        count = conn.execute("""
            SELECT COUNT(*) FROM whatsapp_messages
            WHERE jid = ? OR (jid IS NULL AND thread_id = ?)
        """, (chat['jid'], chat['thread_config_id'])).fetchone()[0]
        conn.close()
        return count

    def store_messages(self, chat_id, messages, proxy_jid=None):
        """Store messages for a chat (upsert by message_id).

        Args:
            chat_id: whatsapp_chats ID
            messages: list of dicts from proxy (author, text, timestamp, etc.)
            proxy_jid: JID override (for non-configured chats)
        Returns:
            inserted count
        """
        if not messages:
            return 0

        conn = self._get_conn()
        chat = conn.execute(
            "SELECT jid, thread_config_id FROM whatsapp_chats WHERE id = ?",
            (chat_id,)).fetchone()
        if not chat:
            conn.close()
            return 0

        jid = proxy_jid or chat['jid']
        thread_id = chat['thread_config_id']  # Can be None
        inserted = 0

        for msg in messages:
            msg_id = msg.get('message_id')
            if not msg_id:
                continue
            try:
                before = conn.total_changes
                conn.execute("""
                    INSERT INTO whatsapp_messages
                    (thread_id, jid, message_id, author, author_jid,
                     body, timestamp, from_me, media_type, thumbnail)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(message_id) DO UPDATE SET
                        media_type = COALESCE(excluded.media_type, media_type),
                        thumbnail = COALESCE(excluded.thumbnail, thumbnail)
                    WHERE excluded.media_type IS NOT NULL
                        AND (media_type IS NULL OR thumbnail IS NULL)
                """, (
                    thread_id,
                    jid,
                    msg_id,
                    msg.get('author'),
                    msg.get('author_jid'),
                    msg.get('text') or msg.get('body'),
                    msg.get('timestamp', 0),
                    1 if msg.get('from_me') else 0,
                    msg.get('media_type'),
                    msg.get('thumbnail')
                ))
                if conn.total_changes > before:
                    inserted += 1
            except sqlite3.IntegrityError:
                pass

        # Update chat metadata
        if messages:
            last = max(messages, key=lambda m: m.get('timestamp', 0))
            conn.execute("""
                UPDATE whatsapp_chats
                SET last_ts = MAX(last_ts, ?),
                    msg_count = (
                        SELECT COUNT(*) FROM whatsapp_messages
                        WHERE jid = ? OR (jid IS NULL AND thread_id = ?)
                    ),
                    last_message = CASE WHEN ? > last_ts
                        THEN ? ELSE last_message END,
                    last_author = CASE WHEN ? > last_ts
                        THEN ? ELSE last_author END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                last.get('timestamp', 0),
                jid, thread_id,
                last.get('timestamp', 0),
                (last.get('text') or last.get('body') or '')[:200],
                last.get('timestamp', 0),
                last.get('author', ''),
                chat_id
            ))

        conn.commit()
        conn.close()
        return inserted

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _count_chats(self):
        conn = self._get_conn()
        count = conn.execute(
            "SELECT COUNT(*) FROM whatsapp_chats").fetchone()[0]
        conn.close()
        return count

    @staticmethod
    def _format_chat(row):
        if not row:
            return None
        d = dict(row)
        d['favorite'] = bool(d.get('favorite', 0))
        d['digest_enabled'] = bool(d.get('digest_enabled', 0))
        d['marked_for_update'] = bool(d.get('marked_for_update', 0))
        d['configured'] = d.get('thread_config_id') is not None
        return d
