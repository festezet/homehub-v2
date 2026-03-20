"""
Session Close Service - Structured end-of-session records
Complements SESSION_*.md files with queryable structured data
"""

import sqlite3
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/project-management/data/projects.db'


class SessionCloseService:

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def create(self, data):
        """Create a session close record.

        Args:
            data: dict with keys:
                - project_id (str, required): PRJ-XXX
                - session_date (str, required): YYYY-MM-DD
                - summary (str, required): 2-3 sentence summary
                - session_doc (str, optional): SESSION_*.md filename
                - decisions (list, optional): list of decisions made
                - next_steps (list, optional): list of next steps
                - blockers (list, optional): list of blockers
                - files_modified (list, optional): list of files modified
                - duration_minutes (int, optional): session duration
                - category (str, optional): dev, evaluation, gestion-doc, infra...

        Returns:
            int: ID of created record
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO session_close
                    (project_id, session_date, session_doc, summary,
                     decisions, next_steps, blockers, files_modified,
                     duration_minutes, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data['project_id'],
                data['session_date'],
                data.get('session_doc'),
                data['summary'],
                json.dumps(data.get('decisions', []), ensure_ascii=False),
                json.dumps(data.get('next_steps', []), ensure_ascii=False),
                json.dumps(data.get('blockers', []), ensure_ascii=False),
                json.dumps(data.get('files_modified', []), ensure_ascii=False),
                data.get('duration_minutes'),
                data.get('category'),
            ))
            conn.commit()
            close_id = cursor.lastrowid

            # Auto-create project_actions from next_steps
            next_steps = data.get('next_steps', [])
            if next_steps:
                self._create_actions_from_next_steps(
                    cursor, data['project_id'], next_steps,
                    data.get('session_doc'))
                conn.commit()

            logger.info(f"Session close created: [{data['project_id']}] {data['summary'][:60]}")
            return close_id
        finally:
            conn.close()

    def _create_actions_from_next_steps(self, cursor, project_id, next_steps, session_doc):
        """Auto-create project_actions from next_steps list.

        Resolves PRJ-XXX to integer project_id for the FK.
        Skips if a similar title already exists for this project.
        """
        # Resolve PRJ-XXX to integer id
        cursor.execute(
            "SELECT id FROM projects WHERE unique_id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            logger.warning(f"Cannot create actions: project {project_id} not found")
            return
        int_project_id = row['id']

        # Get existing action titles for dedup
        cursor.execute(
            "SELECT title FROM project_actions WHERE project_id = ? AND status != 'done'",
            (int_project_id,))
        existing = {r['title'].lower() for r in cursor.fetchall()}

        created = 0
        for step in next_steps:
            if not step or not isinstance(step, str):
                continue
            if step.lower() in existing:
                continue
            cursor.execute("""
                INSERT INTO project_actions
                    (project_id, type, title, status, priority, session_doc)
                VALUES (?, 'action', ?, 'todo', 'medium', ?)
            """, (int_project_id, step, session_doc))
            created += 1

        if created:
            logger.info(f"Auto-created {created} project_actions from next_steps")

    def get_closes(self, project_id=None, limit=20):
        """List session closes with optional project filter."""
        conn = self._get_connection()
        try:
            query = """
                SELECT sc.*, p.name as project_name
                FROM session_close sc
                LEFT JOIN projects p ON sc.project_id = p.unique_id
                WHERE 1=1
            """
            params = []
            if project_id:
                query += " AND sc.project_id = ?"
                params.append(project_id)
            query += " ORDER BY sc.session_date DESC, sc.id DESC LIMIT ?"
            params.append(limit)

            cursor = conn.cursor()
            cursor.execute(query, params)
            return [self._row_to_dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_latest_by_project(self, project_id):
        """Get the most recent session close for a project."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT sc.*, p.name as project_name
                FROM session_close sc
                LEFT JOIN projects p ON sc.project_id = p.unique_id
                WHERE sc.project_id = ?
                ORDER BY sc.session_date DESC, sc.id DESC
                LIMIT 1
            """, (project_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row) if row else None
        finally:
            conn.close()

    def search(self, query, project_id=None, category=None, limit=20):
        """Full-text search in session_close using FTS5 index."""
        conn = self._get_connection()
        try:
            sql = """
                SELECT sc.id, sc.project_id, sc.session_date, sc.session_doc,
                       sc.summary, sc.category, sc.duration_minutes,
                       sc.decisions, sc.next_steps, sc.created_at,
                       p.name as project_name,
                       snippet(session_close_fts, 1, '<b>', '</b>', '...', 40) as snippet,
                       fts.rank
                FROM session_close_fts fts
                JOIN session_close sc ON sc.id = fts.rowid
                LEFT JOIN projects p ON sc.project_id = p.unique_id
                WHERE session_close_fts MATCH ?
            """
            params = [query]

            if project_id:
                sql += " AND sc.project_id = ?"
                params.append(project_id)
            if category:
                sql += " AND sc.category = ?"
                params.append(category)

            sql += " ORDER BY fts.rank LIMIT ?"
            params.append(limit)

            cursor = conn.cursor()
            cursor.execute(sql, params)
            results = []
            for row in cursor.fetchall():
                d = dict(row)
                d['score'] = round(abs(d.pop('rank')), 2)
                for field in ('decisions', 'next_steps'):
                    val = d.get(field)
                    if val:
                        try:
                            d[field] = json.loads(val)
                        except (json.JSONDecodeError, TypeError):
                            d[field] = []
                    else:
                        d[field] = []
                results.append(d)
            return results
        finally:
            conn.close()

    def get_recent(self, days=7):
        """Get session closes from the last N days."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT sc.*, p.name as project_name
                FROM session_close sc
                LEFT JOIN projects p ON sc.project_id = p.unique_id
                WHERE sc.session_date >= date('now', ?)
                ORDER BY sc.session_date DESC, sc.id DESC
            """, (f'-{days} days',))
            return [self._row_to_dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def _row_to_dict(row):
        """Convert a DB row to a dict, parsing JSON fields."""
        d = dict(row)
        for field in ('decisions', 'next_steps', 'blockers', 'files_modified'):
            val = d.get(field)
            if val:
                try:
                    d[field] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    d[field] = []
            else:
                d[field] = []
        return d


session_close_service = SessionCloseService()
