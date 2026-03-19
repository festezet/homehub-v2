"""
Project Actions Service - CRUD for project-level action items
Wraps the existing project_actions table with API-friendly methods
"""

import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/project-management/data/projects.db'


class ProjectActionsService:

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_actions(self, project_id=None, status=None):
        """List actions with optional filters.

        Args:
            project_id: PRJ-XXX string (resolved to integer internally)
            status: todo, in_progress, done, blocked
        """
        conn = self._get_connection()
        try:
            query = """
                SELECT pa.*, p.unique_id as project_uid, p.name as project_name
                FROM project_actions pa
                LEFT JOIN projects p ON pa.project_id = p.id
                WHERE 1=1
            """
            params = []
            if project_id:
                query += " AND p.unique_id = ?"
                params.append(project_id)
            if status:
                query += " AND pa.status = ?"
                params.append(status)
            query += " ORDER BY CASE pa.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, pa.created_at DESC"

            cursor = conn.cursor()
            cursor.execute(query, params)
            return [self._row_to_dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def create_action(self, data):
        """Create a new project action.

        Args:
            data: dict with keys:
                - project_id (str, required): PRJ-XXX
                - title (str, required)
                - type (str, optional): action, bug, improvement, refactor (default: action)
                - description (str, optional)
                - priority (str, optional): low, medium, high, critical (default: medium)
                - due_date (str, optional): YYYY-MM-DD
                - session_doc (str, optional)
        """
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            # Resolve PRJ-XXX to integer
            int_id = self._resolve_project_id(cursor, data['project_id'])
            if int_id is None:
                raise ValueError(f"Project {data['project_id']} not found")

            cursor.execute("""
                INSERT INTO project_actions
                    (project_id, type, title, description, status, priority, due_date, session_doc)
                VALUES (?, ?, ?, ?, 'todo', ?, ?, ?)
            """, (
                int_id,
                data.get('type', 'action'),
                data['title'],
                data.get('description'),
                data.get('priority', 'medium'),
                data.get('due_date'),
                data.get('session_doc'),
            ))
            conn.commit()
            action_id = cursor.lastrowid
            logger.info(f"Action created: [{data['project_id']}] {data['title']}")
            return action_id
        finally:
            conn.close()

    def update_action(self, action_id, data):
        """Update an existing action.

        Args:
            action_id: integer
            data: dict with any of: status, priority, title, description, due_date, type
        """
        allowed = {'status', 'priority', 'title', 'description', 'due_date', 'type'}
        updates = {k: v for k, v in data.items() if k in allowed}
        if not updates:
            return False

        # Auto-set completed_at when marking done
        if updates.get('status') == 'done':
            updates['completed_at'] = datetime.now().isoformat()

        conn = self._get_connection()
        try:
            set_clause = ', '.join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [action_id]

            cursor = conn.cursor()
            cursor.execute(
                f"UPDATE project_actions SET {set_clause} WHERE id = ?",
                values)
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def delete_action(self, action_id):
        """Delete an action by ID."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM project_actions WHERE id = ?", (action_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def get_stats(self):
        """Get action counts by status and by project."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT pa.status, COUNT(*) as count
                FROM project_actions pa
                GROUP BY pa.status
            """)
            by_status = {row['status']: row['count'] for row in cursor.fetchall()}

            cursor.execute("""
                SELECT p.unique_id, p.name, COUNT(*) as count,
                       SUM(CASE WHEN pa.status = 'todo' THEN 1 ELSE 0 END) as todo,
                       SUM(CASE WHEN pa.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
                FROM project_actions pa
                LEFT JOIN projects p ON pa.project_id = p.id
                WHERE pa.status != 'done'
                GROUP BY pa.project_id
                ORDER BY count DESC
            """)
            by_project = [{
                'project_id': row['unique_id'],
                'name': row['name'],
                'total': row['count'],
                'todo': row['todo'],
                'in_progress': row['in_progress'],
            } for row in cursor.fetchall()]

            return {'by_status': by_status, 'by_project': by_project}
        finally:
            conn.close()

    @staticmethod
    def _resolve_project_id(cursor, unique_id):
        """Resolve PRJ-XXX to integer project id."""
        cursor.execute("SELECT id FROM projects WHERE unique_id = ?", (unique_id,))
        row = cursor.fetchone()
        return row['id'] if row else None

    @staticmethod
    def _row_to_dict(row):
        d = dict(row)
        # Use the resolved unique_id as the public project_id
        d['project_id'] = d.pop('project_uid', None) or f"id:{d.get('project_id')}"
        return d


project_actions_service = ProjectActionsService()
