"""
Local Apps Service - Manage locally developed applications
"""

import sqlite3
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/homehub-v2/data/local_apps.db'


class LocalAppsService:
    """Service to manage local applications and categories"""

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()
        logger.info(f"LocalAppsService initialized with database: {db_path}")

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        """Create tables if they don't exist"""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '',
                position INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                category_slug TEXT NOT NULL,
                icon TEXT DEFAULT '',
                app_type TEXT NOT NULL DEFAULT 'project',
                project_id TEXT DEFAULT '',
                launcher_path TEXT DEFAULT '',
                launcher_type TEXT DEFAULT '',
                web_url TEXT DEFAULT '',
                docker_stack TEXT DEFAULT '',
                launch_count INTEGER DEFAULT 0,
                last_launched TIMESTAMP,
                position INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_slug) REFERENCES app_categories(slug)
            )
        """)

        conn.commit()
        conn.close()

    # ---- Categories ----

    def get_categories(self):
        """Get all categories ordered by position"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM app_categories ORDER BY position, id")
        cats = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return cats

    def create_category(self, slug, name, icon='', position=0):
        """Create a new category"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO app_categories (slug, name, icon, position) VALUES (?, ?, ?, ?)",
            (slug, name, icon, position)
        )
        conn.commit()
        cat_id = cursor.lastrowid
        conn.close()
        return cat_id

    # ---- Apps ----

    def get_all_apps(self):
        """Get all apps grouped by category, with frequent-use prepended"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Build frequent-use virtual category (top 5 by launch_count)
        cursor.execute(
            "SELECT * FROM app_entries WHERE launch_count > 0 ORDER BY launch_count DESC LIMIT 5"
        )
        frequent_apps = [dict(row) for row in cursor.fetchall()]

        categories = []

        if frequent_apps:
            categories.append({
                'slug': 'frequent-use',
                'name': 'Frequent Use',
                'icon': '',
                'position': -1,
                'apps': frequent_apps
            })

        # Get real categories with their apps
        cursor.execute("SELECT * FROM app_categories ORDER BY position, id")
        for cat_row in cursor.fetchall():
            cat = dict(cat_row)
            cursor.execute(
                "SELECT * FROM app_entries WHERE category_slug = ? ORDER BY position, name",
                (cat['slug'],)
            )
            cat['apps'] = [dict(row) for row in cursor.fetchall()]
            categories.append(cat)

        conn.close()
        return categories

    def get_app(self, app_id):
        """Get a single app by ID"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM app_entries WHERE id = ?", (app_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def create_app(self, name, category_slug, **kwargs):
        """Create a new app entry"""
        conn = self._get_connection()
        cursor = conn.cursor()

        fields = ['name', 'category_slug']
        values = [name, category_slug]

        valid_optional = {
            'description', 'icon', 'app_type', 'project_id',
            'launcher_path', 'launcher_type', 'web_url',
            'docker_stack', 'position'
        }

        for key, val in kwargs.items():
            if key in valid_optional and val is not None:
                fields.append(key)
                values.append(val)

        placeholders = ', '.join('?' for _ in fields)
        columns = ', '.join(fields)

        cursor.execute(
            "INSERT INTO app_entries (" + columns + ") VALUES (" + placeholders + ")",
            values
        )

        app_id = cursor.lastrowid
        conn.commit()
        conn.close()

        logger.info(f"App created: {name} in {category_slug} [id={app_id}]")
        return app_id

    def update_app(self, app_id, **kwargs):
        """Update an app's fields"""
        valid_fields = {
            'name', 'description', 'category_slug', 'icon', 'app_type',
            'project_id', 'launcher_path', 'launcher_type', 'web_url',
            'docker_stack', 'position'
        }
        updates = {k: v for k, v in kwargs.items() if k in valid_fields}

        if not updates:
            raise ValueError(f"No valid fields to update. Valid: {valid_fields}")

        conn = self._get_connection()
        cursor = conn.cursor()

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [app_id]

        cursor.execute(
            "UPDATE app_entries SET " + set_clause + ", updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values
        )

        if cursor.rowcount == 0:
            conn.close()
            raise Exception(f"App {app_id} not found")

        conn.commit()
        conn.close()
        logger.info(f"App {app_id} updated: {updates}")
        return True

    def delete_app(self, app_id):
        """Delete an app"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM app_entries WHERE id = ?", (app_id,))

        if cursor.rowcount == 0:
            conn.close()
            raise Exception(f"App {app_id} not found")

        conn.commit()
        conn.close()
        logger.info(f"App {app_id} deleted")
        return True

    def record_launch(self, app_id):
        """Increment launch_count and update last_launched, return app info"""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE app_entries SET launch_count = launch_count + 1, "
            "last_launched = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP "
            "WHERE id = ?",
            (app_id,)
        )

        if cursor.rowcount == 0:
            conn.close()
            raise Exception(f"App {app_id} not found")

        conn.commit()

        cursor.execute("SELECT * FROM app_entries WHERE id = ?", (app_id,))
        app = dict(cursor.fetchone())
        conn.close()

        logger.info(f"App {app_id} launched (count: {app['launch_count']})")
        return app

    def get_app_count(self):
        """Get total number of apps"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM app_entries")
        count = cursor.fetchone()[0]
        conn.close()
        return count


# Singleton
local_apps_service = LocalAppsService()
