"""
Activity Service - Manage project activity timeline
"""

import sqlite3
import logging

logger = logging.getLogger(__name__)

class ActivityService:
    """Service to get project milestones and activity timeline"""

    def __init__(self, db_path='/data/projects/project-management/data/projects.db'):
        self.db_path = db_path
        logger.info(f"📊 Activity Service initialized with database: {db_path}")

    def _get_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)

    def get_timeline(self, limit=20):
        """Get recent project milestones for timeline"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    m.id,
                    m.project_id,
                    p.name as project_name,
                    m.title,
                    m.description,
                    m.type,
                    m.date,
                    m.status,
                    m.status_notes
                FROM project_milestones m
                LEFT JOIN projects p ON m.project_id = p.id
                ORDER BY m.date DESC
                LIMIT ?
            """, (limit,))

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
                    'status_notes': row['status_notes']
                })

            conn.close()
            return timeline

        except Exception as e:
            logger.error(f"Error getting timeline: {e}")
            return []

# Create singleton instance
activity_service = ActivityService()
