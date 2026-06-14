"""
Session Bookmarks Service - Save and restore Claude session context
Stores bookmarks in projects.db for quick session resume
"""

import sqlite3
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/project-management/data/projects.db'

STATUS_OPTIONS = ('pending', 'resumed', 'archived')


class SessionBookmarksService:

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self._ensure_table()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_table(self):
        conn = self._get_connection()
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS session_bookmarks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    project_id TEXT,
                    files_to_read TEXT,
                    session_id TEXT,
                    notes TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)
            conn.commit()
            logger.info("session_bookmarks table ensured")
        finally:
            conn.close()

    @staticmethod
    def _row_to_dict(row):
        d = dict(row)
        if d.get('files_to_read'):
            try:
                d['files_to_read'] = json.loads(d['files_to_read'])
            except (json.JSONDecodeError, TypeError):
                pass
        return d

    def list_bookmarks(self, status=None, project_id=None):
        """List bookmarks with optional filters."""
        conn = self._get_connection()
        try:
            query = "SELECT * FROM session_bookmarks WHERE 1=1"
            params = []
            if status:
                query += " AND status = ?"
                params.append(status)
            if project_id:
                query += " AND project_id = ?"
                params.append(project_id)
            query += " ORDER BY created_at DESC"
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [self._row_to_dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_bookmark(self, bookmark_id):
        """Get a single bookmark by id."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM session_bookmarks WHERE id = ?", (int(bookmark_id),))
            row = cursor.fetchone()
            return self._row_to_dict(row) if row else None
        finally:
            conn.close()

    def create_bookmark(self, data):
        """Create a new session bookmark.

        Args:
            data: dict with keys:
                - date (str, required)
                - subject (str, required)
                - project_id (str, optional): PRJ-XXX
                - files_to_read (list, optional): file paths
                - session_id (str, optional): Claude session id
                - notes (str, optional)
                - status (str, optional): pending/resumed/archived
        """
        files_to_read = data.get('files_to_read')
        if isinstance(files_to_read, list):
            files_to_read = json.dumps(files_to_read)

        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO session_bookmarks
                    (date, subject, project_id, files_to_read, session_id, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data['date'],
                data['subject'],
                data.get('project_id'),
                files_to_read,
                data.get('session_id'),
                data.get('notes'),
                data.get('status', 'pending'),
            ))
            conn.commit()
            bookmark_id = cursor.lastrowid
            logger.info(f"Session bookmark created: #{bookmark_id} - {data['subject']}")
            return {'id': bookmark_id}
        finally:
            conn.close()

    def update_bookmark(self, bookmark_id, data):
        """Update an existing bookmark."""
        allowed = {'date', 'subject', 'project_id', 'files_to_read', 'session_id', 'notes', 'status'}
        updates = {}
        for k, v in data.items():
            if k not in allowed:
                continue
            if k == 'files_to_read' and isinstance(v, list):
                updates[k] = json.dumps(v)
            else:
                updates[k] = v

        if not updates:
            return False

        conn = self._get_connection()
        try:
            set_clause = ', '.join(f"{k} = ?" for k in updates)
            values = list(updates.values())
            values.append(int(bookmark_id))
            cursor = conn.cursor()
            cursor.execute(f"UPDATE session_bookmarks SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def delete_bookmark(self, bookmark_id):
        """Delete a bookmark."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM session_bookmarks WHERE id = ?", (int(bookmark_id),))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def get_stats(self):
        """Get bookmark stats by status."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT status, COUNT(*) as count FROM session_bookmarks GROUP BY status")
            by_status = {row['status']: row['count'] for row in cursor.fetchall()}

            cursor.execute("""
                SELECT project_id, COUNT(*) as count
                FROM session_bookmarks
                WHERE project_id IS NOT NULL
                GROUP BY project_id
                ORDER BY count DESC
                LIMIT 10
            """)
            by_project = [{'project_id': row['project_id'], 'count': row['count']}
                          for row in cursor.fetchall()]

            return {
                'by_status': by_status,
                'by_project': by_project,
                'pending': by_status.get('pending', 0),
                'resumed': by_status.get('resumed', 0),
                'archived': by_status.get('archived', 0),
                'total': sum(by_status.values())
            }
        finally:
            conn.close()


session_bookmarks_service = SessionBookmarksService()
