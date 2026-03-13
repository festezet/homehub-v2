"""
Activity Service - Manage project activity timeline
"""

import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ActivityService:
    """Service to get project milestones and activity timeline"""

    def __init__(self, db_path='/data/projects/project-management/data/projects.db'):
        self.db_path = db_path
        logger.info(f"Activity Service initialized with database: {db_path}")

    def _get_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)

    def get_timeline(self, limit=20, project_id=None, activity_type=None):
        """Get recent project milestones for timeline"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = """
                SELECT
                    m.id,
                    m.project_id,
                    p.name as project_name,
                    m.title,
                    m.description,
                    m.type,
                    m.date,
                    m.status,
                    m.status_notes,
                    m.source
                FROM project_milestones m
                LEFT JOIN projects p ON m.project_id = p.unique_id
                WHERE 1=1
            """
            params = []

            if project_id:
                query += " AND m.project_id = ?"
                params.append(project_id)

            if activity_type:
                query += " AND m.type = ?"
                params.append(activity_type)

            query += " ORDER BY m.date DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)

            timeline = []
            for row in cursor.fetchall():
                timeline.append({
                    'id': row['id'],
                    'project_id': row['project_id'],
                    'project_name': row['project_name'],
                    'title': row['title'],
                    'description': row['description'],
                    'type': row['type'],
                    'date': row['date'],
                    'status': row['status'],
                    'status_notes': row['status_notes'],
                    'source': row['source']
                })

            conn.close()
            return timeline

        except Exception as e:
            logger.error(f"Error getting timeline: {e}")
            return []

    def get_project_activity(self, project_id, limit=5):
        """Get recent activity for a specific project"""
        return self.get_timeline(limit=limit, project_id=project_id)

    def log_activity(self, project_id, activity_type, title, description=None, session_doc=None, date=None):
        """Log a new activity entry via API"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            if not date:
                date = datetime.now().strftime('%Y-%m-%d')

            cursor.execute("""
                INSERT INTO project_milestones
                    (project_id, date, type, title, description, session_doc, status, source)
                VALUES (?, ?, ?, ?, ?, ?, 'completed', 'api')
            """, (project_id, date, activity_type, title, description, session_doc))

            conn.commit()
            entry_id = cursor.lastrowid
            conn.close()

            logger.info(f"Activity logged: [{project_id}] {title}")
            return entry_id

        except Exception as e:
            logger.error(f"Error logging activity: {e}")
            raise

    def get_activity_stats(self):
        """Get activity statistics: counts by type and by week"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Count by type
            cursor.execute("""
                SELECT type, COUNT(*) as count
                FROM project_milestones
                GROUP BY type
                ORDER BY count DESC
            """)
            by_type = {row['type']: row['count'] for row in cursor.fetchall()}

            # Count by week (last 8 weeks)
            cursor.execute("""
                SELECT
                    strftime('%Y-W%W', date) as week,
                    COUNT(*) as count
                FROM project_milestones
                WHERE date >= date('now', '-56 days')
                GROUP BY week
                ORDER BY week DESC
            """)
            by_week = [{
                'week': row['week'],
                'count': row['count']
            } for row in cursor.fetchall()]

            # Total and last activity date
            cursor.execute("""
                SELECT COUNT(*) as total, MAX(date) as last_date
                FROM project_milestones
            """)
            row = cursor.fetchone()
            total = row['total']
            last_date = row['last_date']

            # Active projects count (with milestones in last 30 days)
            cursor.execute("""
                SELECT COUNT(DISTINCT project_id) as active
                FROM project_milestones
                WHERE date >= date('now', '-30 days')
            """)
            active_projects = cursor.fetchone()['active']

            conn.close()

            return {
                'total': total,
                'last_date': last_date,
                'active_projects': active_projects,
                'by_type': by_type,
                'by_week': by_week
            }

        except Exception as e:
            logger.error(f"Error getting activity stats: {e}")
            return {'total': 0, 'last_date': None, 'active_projects': 0, 'by_type': {}, 'by_week': []}


# Create singleton instance
activity_service = ActivityService()
