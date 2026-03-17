"""
Activity Service - Manage project activity timeline
"""

import sqlite3
import logging
import os
import re
import glob
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

    def get_recent_sessions(self, limit=10):
        """Get projects with most recent session activity, ordered by milestone date"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Get latest milestone per project, preferring api source over session_extraction
            cursor.execute("""
                SELECT
                    p.unique_id,
                    p.name,
                    p.status,
                    p.last_activity,
                    m.title as milestone_title,
                    m.description as milestone_description,
                    m.date as milestone_date,
                    m.type as milestone_type,
                    m.session_doc as milestone_session_doc,
                    m.source as milestone_source
                FROM projects p
                INNER JOIN project_milestones m ON m.id = (
                    SELECT m2.id FROM project_milestones m2
                    WHERE m2.project_id = p.unique_id
                    ORDER BY m2.date DESC,
                             CASE WHEN m2.source = 'api' THEN 0 ELSE 1 END,
                             m2.id DESC
                    LIMIT 1
                )
                WHERE p.status != 'archived'
                ORDER BY m.date DESC, m.id DESC
                LIMIT ?
            """, (limit,))

            results = []
            for row in cursor.fetchall():
                session_doc = row['milestone_session_doc']
                source = row['milestone_source']
                description = None

                # If source='api', use DB description (manually synthesized)
                # If source='session_extraction', try to read SESSION file
                if source == 'api':
                    description = row['milestone_description'] or ''
                elif session_doc:
                    # Try reading the actual SESSION file for a rich summary
                    filepath = self._find_session_file(session_doc)
                    if filepath:
                        description = self._extract_session_summary(filepath)

                # Fallback to cleaned DB description
                if not description:
                    description = self._clean_milestone_description(
                        row['milestone_description'] or '')
                results.append({
                    'unique_id': row['unique_id'],
                    'name': row['name'],
                    'status': row['status'],
                    'last_activity': row['last_activity'],
                    'milestone': {
                        'title': row['milestone_title'],
                        'description': description,
                        'date': row['milestone_date'],
                        'type': row['milestone_type'],
                        'session_doc': row['milestone_session_doc'],
                        'source': row['milestone_source']
                    }
                })

            conn.close()
            return results

        except Exception as e:
            logger.error(f"Error getting recent sessions: {e}")
            return []

    @staticmethod
    def _find_session_file(session_doc):
        """Find a SESSION file on disk given its filename"""
        if not session_doc:
            return None
        # Search in project docs/ and infrastructure sessions/
        search_patterns = [
            f'/data/projects/*/docs/{session_doc}',
            f'/data/projects/infrastructure/docs/sessions/*/{session_doc}',
        ]
        for pattern in search_patterns:
            matches = glob.glob(pattern)
            if matches:
                return matches[0]
        return None

    @staticmethod
    def _extract_session_summary(filepath):
        """Extract a readable summary from a SESSION markdown file.
        Looks for Contexte + Realisations/Travail realise sections."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception:
            return None

        parts = []

        # Extract Contexte section
        ctx_match = re.search(
            r'##\s*Contexte\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE)
        if ctx_match:
            ctx = ctx_match.group(1).strip()
            # Take first paragraph only
            first_para = ctx.split('\n\n')[0].strip()
            if first_para:
                parts.append(first_para)

        # Extract Realisations / Travail realise section
        real_match = re.search(
            r'##\s*(?:R[ée]alisations|Travail\s+r[ée]alis[ée]|R[ée]sum[ée])\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE)
        if real_match:
            real_text = real_match.group(1).strip()
            # Extract bullet points and sub-headers as achievements
            achievements = []
            for line in real_text.split('\n'):
                line = line.strip()
                if not line:
                    continue
                # Sub-headers like ### Title
                if line.startswith('###'):
                    achievements.append(line.lstrip('#').strip())
                # Bullet points
                elif line.startswith(('-', '*', '+')):
                    clean = line.lstrip('-*+ ').strip()
                    if clean and len(clean) > 10:
                        achievements.append(clean)
                # Bold items
                elif line.startswith('**') and line.endswith('**'):
                    achievements.append(line.strip('* '))
            if achievements:
                parts.append('\n'.join(achievements[:5]))

        # Extract Actions a venir / Prochaines etapes
        next_match = re.search(
            r'##\s*(?:Actions?\s+[àa]\s+venir|Prochaines?\s+[ée]tapes?|Suite|Next\s+steps?)\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE)
        if next_match:
            next_text = next_match.group(1).strip()
            next_items = []
            for line in next_text.split('\n'):
                line = line.strip()
                if line.startswith(('-', '*', '+')):
                    clean = line.lstrip('-*+ ').strip()
                    if clean:
                        next_items.append(clean)
            if next_items:
                parts.append('A venir: ' + ' | '.join(next_items[:3]))

        return '\n'.join(parts) if parts else None

    @staticmethod
    def _clean_milestone_description(text):
        """Strip markdown headers and metadata lines, extract useful content"""
        if not text:
            return ''
        lines = text.split('\n')
        cleaned = []
        skip_re = re.compile(
            r'^\*\*(?:Projet|Dur[ée]e|Statut|Date|Cat[ée]gorie)\*\*\s*:',
            re.IGNORECASE)
        extract_re = re.compile(
            r'^\*\*(?:Contexte|Objectif|R[ée]sum[ée])\*\*\s*:\s*(.+)',
            re.IGNORECASE)
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('#'):
                continue
            if skip_re.match(stripped):
                continue
            m = extract_re.match(stripped)
            if m:
                cleaned.append(m.group(1).strip())
                continue
            if not cleaned and not stripped:
                continue
            cleaned.append(stripped)
        while cleaned and not cleaned[-1]:
            cleaned.pop()
        return '\n'.join(cleaned)

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
