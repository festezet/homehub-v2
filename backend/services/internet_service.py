"""
Internet Links Service - Manage web shortcuts/bookmarks
"""

import sqlite3
import logging
import os
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/homehub-v2/data/internet_links.db'


class InternetService:
    """Service to manage internet links and categories"""

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()
        logger.info(f"InternetService initialized with database: {db_path}")

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        """Create tables if they don't exist"""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS internet_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '',
                position INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS internet_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                category_slug TEXT NOT NULL,
                favicon_alt TEXT DEFAULT '',
                description TEXT DEFAULT '',
                position INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_slug) REFERENCES internet_categories(slug)
            )
        """)

        conn.commit()
        conn.close()

    def _extract_domain(self, url):
        """Extract display domain from URL"""
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain

    # ---- Categories ----

    def get_categories(self):
        """Get all categories ordered by position"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM internet_categories ORDER BY position, id")
        cats = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return cats

    def create_category(self, slug, name, icon='', position=0):
        """Create a new category"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO internet_categories (slug, name, icon, position) VALUES (?, ?, ?, ?)",
            (slug, name, icon, position)
        )
        conn.commit()
        cat_id = cursor.lastrowid
        conn.close()
        return cat_id

    # ---- Links ----

    def get_all_links(self):
        """Get all links grouped by category"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get categories
        cursor.execute("SELECT * FROM internet_categories ORDER BY position, id")
        categories = []
        for cat_row in cursor.fetchall():
            cat = dict(cat_row)
            cursor.execute(
                "SELECT * FROM internet_links WHERE category_slug = ? ORDER BY position, id",
                (cat['slug'],)
            )
            cat['links'] = [dict(row) for row in cursor.fetchall()]
            categories.append(cat)

        conn.close()
        return categories

    def get_links_flat(self):
        """Get all links as a flat list"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM internet_links ORDER BY category_slug, position, id")
        links = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return links

    def create_link(self, link_data):
        """Create a new internet link from dict: name, url, category_slug, favicon_alt, description, position"""
        name = link_data.get('name', '')
        url = link_data.get('url', '')
        category_slug = link_data.get('category_slug', '')
        favicon_alt = link_data.get('favicon_alt', '')
        description = link_data.get('description', '')
        position = link_data.get('position', 0)

        conn = self._get_connection()
        cursor = conn.cursor()

        if not favicon_alt:
            favicon_alt = name[:2].upper()

        cursor.execute("""
            INSERT INTO internet_links (name, url, category_slug, favicon_alt, description, position)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, url, category_slug, favicon_alt, description, position))

        link_id = cursor.lastrowid
        conn.commit()
        conn.close()

        logger.info(f"Link created: {name} ({url}) in {category_slug} [id={link_id}]")
        return link_id

    def update_link(self, link_id, **kwargs):
        """Update a link's fields"""
        valid_fields = {'name', 'url', 'category_slug', 'favicon_alt', 'description', 'position'}
        updates = {k: v for k, v in kwargs.items() if k in valid_fields}

        if not updates:
            raise ValueError(f"No valid fields to update. Valid: {valid_fields}")

        conn = self._get_connection()
        cursor = conn.cursor()

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [link_id]

        cursor.execute(
            "UPDATE internet_links SET " + set_clause + ", updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values
        )

        if cursor.rowcount == 0:
            conn.close()
            raise Exception(f"Link {link_id} not found")

        conn.commit()
        conn.close()
        logger.info(f"Link {link_id} updated: {updates}")
        return True

    def delete_link(self, link_id):
        """Delete a link"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM internet_links WHERE id = ?", (link_id,))

        if cursor.rowcount == 0:
            conn.close()
            raise Exception(f"Link {link_id} not found")

        conn.commit()
        conn.close()
        logger.info(f"Link {link_id} deleted")
        return True

    def get_link_count(self):
        """Get total number of links"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM internet_links")
        count = cursor.fetchone()[0]
        conn.close()
        return count


# Singleton
internet_service = InternetService()
