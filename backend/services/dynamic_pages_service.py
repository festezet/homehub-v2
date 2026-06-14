"""
Dynamic Pages Service - Create and manage on-the-fly HTML pages
"""

import sqlite3
import logging
import os
import uuid
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/homehub-v2/data/dynamic_pages.db'


class DynamicPagesService:
    """Service to create and manage dynamic HTML pages"""

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()
        logger.info(f"DynamicPagesService initialized with database: {db_path}")

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        """Create tables if they don't exist"""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dynamic_pages (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                subtitle TEXT DEFAULT '',
                icon TEXT DEFAULT '',
                html_content TEXT NOT NULL,
                css_content TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                expires_at TEXT,
                section TEXT DEFAULT 'Claude',
                pinned INTEGER DEFAULT 0
            )
        """)

        conn.commit()
        conn.close()

    # ---- Create ----

    def create_page(self, title, html_content, icon='', subtitle='',
                    css_content='', ttl_hours=None, section='Claude', pinned=False):
        """Create a dynamic page. Returns the page id.
        Pages are permanent by default — user decides to keep or delete."""
        self._cleanup_expired()

        page_id = f"dp-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        expires_at = None
        if ttl_hours and not pinned:
            expires_at = (datetime.utcnow() + timedelta(hours=ttl_hours)).isoformat()

        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO dynamic_pages
            (id, title, subtitle, icon, html_content, css_content, created_at, expires_at, section, pinned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (page_id, title, subtitle, icon, html_content, css_content,
              now, expires_at, section, 1 if pinned else 0))
        conn.commit()
        conn.close()

        logger.info(f"Dynamic page created: {page_id} ({title})")
        return page_id

    # ---- Read ----

    def get_page(self, page_id):
        """Get a page by id (full content)"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM dynamic_pages WHERE id = ?", (page_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return dict(row)

    def list_pages(self):
        """List active pages (metadata only, no html_content)"""
        self._cleanup_expired()

        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, subtitle, icon, created_at, expires_at, section, pinned
            FROM dynamic_pages ORDER BY created_at DESC
        """)
        pages = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return pages

    # ---- Delete ----

    def delete_page(self, page_id):
        """Delete a dynamic page"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM dynamic_pages WHERE id = ?", (page_id,))
        if cursor.rowcount == 0:
            conn.close()
            raise ValueError(f"Page {page_id} not found")
        conn.commit()
        conn.close()
        logger.info(f"Dynamic page deleted: {page_id}")

    # ---- Pin ----

    def pin_page(self, page_id):
        """Pin a page (set pinned=1, remove expiry)"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE dynamic_pages SET pinned = 1, expires_at = NULL WHERE id = ?",
            (page_id,)
        )
        if cursor.rowcount == 0:
            conn.close()
            raise ValueError(f"Page {page_id} not found")
        conn.commit()
        conn.close()
        logger.info(f"Dynamic page pinned: {page_id}")

    # ---- Cleanup ----

    def _cleanup_expired(self):
        """Remove expired pages"""
        now = datetime.utcnow().isoformat()
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM dynamic_pages WHERE expires_at IS NOT NULL AND expires_at < ?",
            (now,)
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} expired dynamic pages")


# Singleton
dynamic_pages_service = DynamicPagesService()
