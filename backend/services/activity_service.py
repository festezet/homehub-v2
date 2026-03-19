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

            query, params = self._build_timeline_query(project_id, activity_type, limit)
            cursor.execute(query, params)

            timeline = [self._row_to_timeline_entry(row) for row in cursor.fetchall()]
            conn.close()
            return timeline

        except Exception as e:
            logger.error(f"Error getting timeline: {e}")
            return []

    @staticmethod
    def _build_timeline_query(project_id, activity_type, limit):
        """Build SQL query and params for timeline"""
        query = """
            SELECT
                m.id, m.project_id, p.name as project_name,
                m.title, m.description, m.type, m.date,
                m.status, m.status_notes, m.source
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
        return query, params

    @staticmethod
    def _row_to_timeline_entry(row):
        """Convert a DB row to a timeline entry dict"""
        return {
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
        }

    def get_project_activity(self, project_id, limit=5):
        """Get recent activity for a specific project"""
        return self.get_timeline(limit=limit, project_id=project_id)

    def log_activity(self, data):
        """Log a new activity entry via API.

        Args:
            data: dict with keys: project_id, type, title,
                  and optional: description, session_doc, date
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            date = data.get('date') or datetime.now().strftime('%Y-%m-%d')

            cursor.execute("""
                INSERT INTO project_milestones
                    (project_id, date, type, title, description, session_doc, status, source)
                VALUES (?, ?, ?, ?, ?, ?, 'completed', 'api')
            """, (data['project_id'], date, data['type'], data['title'],
                  data.get('description'), data.get('session_doc')))

            conn.commit()
            entry_id = cursor.lastrowid
            conn.close()

            logger.info(f"Activity logged: [{data['project_id']}] {data['title']}")
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

            cursor.execute("""
                SELECT
                    p.unique_id, p.name, p.status, p.last_activity,
                    m.title as milestone_title,
                    m.description as milestone_description,
                    m.date as milestone_date, m.type as milestone_type,
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

            results = [self._format_session_row(row) for row in cursor.fetchall()]
            conn.close()
            return results

        except Exception as e:
            logger.error(f"Error getting recent sessions: {e}")
            return []

    def _format_session_row(self, row):
        """Format a single session row with description resolution"""
        description = self._resolve_session_description(row)
        return {
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
        }

    def _resolve_session_description(self, row):
        """Resolve description from API, session file, or DB fallback"""
        source = row['milestone_source']
        session_doc = row['milestone_session_doc']
        description = None

        if source == 'api':
            description = row['milestone_description'] or ''
        elif session_doc:
            filepath = self._find_session_file(session_doc)
            if filepath:
                description = self._extract_session_summary(filepath)

        if not description:
            description = self._clean_milestone_description(
                row['milestone_description'] or '')
        return description

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
        """Extract a readable summary from a SESSION markdown file."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception:
            return None

        parts = []
        ActivityService._extract_context_section(content, parts)
        ActivityService._extract_achievements_section(content, parts)
        ActivityService._extract_next_steps_section(content, parts)
        return '\n'.join(parts) if parts else None

    @staticmethod
    def _extract_context_section(content, parts):
        """Extract Contexte section first paragraph"""
        ctx_match = re.search(
            r'##\s*Contexte\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE)
        if ctx_match:
            first_para = ctx_match.group(1).strip().split('\n\n')[0].strip()
            if first_para:
                parts.append(first_para)

    @staticmethod
    def _extract_achievements_section(content, parts):
        """Extract Realisations/Travail realise section as bullet list"""
        real_match = re.search(
            r'##\s*(?:R[ée]alisations|Travail\s+r[ée]alis[ée]|R[ée]sum[ée])\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE)
        if not real_match:
            return
        achievements = []
        for line in real_match.group(1).strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            if line.startswith('###'):
                achievements.append(line.lstrip('#').strip())
            elif line.startswith(('-', '*', '+')):
                clean = line.lstrip('-*+ ').strip()
                if clean and len(clean) > 10:
                    achievements.append(clean)
            elif line.startswith('**') and line.endswith('**'):
                achievements.append(line.strip('* '))
        if achievements:
            parts.append('\n'.join(achievements[:5]))

    @staticmethod
    def _extract_next_steps_section(content, parts):
        """Extract Actions a venir / Prochaines etapes section"""
        next_match = re.search(
            r'##\s*(?:Actions?\s+[àa]\s+venir|Prochaines?\s+[ée]tapes?|Suite|Next\s+steps?)\s*\n(.*?)(?=\n##|\Z)',
            content, re.DOTALL | re.IGNORECASE)
        if not next_match:
            return
        next_items = []
        for line in next_match.group(1).strip().split('\n'):
            line = line.strip()
            if line.startswith(('-', '*', '+')):
                clean = line.lstrip('-*+ ').strip()
                if clean:
                    next_items.append(clean)
        if next_items:
            parts.append('A venir: ' + ' | '.join(next_items[:3]))

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

    def get_top_projects(self, limit=10):
        """Get most active projects scored by per-activity recency weighting.

        Each activity contributes 1/(1 + days_ago/14) to the score,
        so recent activities weigh heavily while old ones fade out.
        """
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    m.project_id,
                    p.name as project_name,
                    p.status,
                    p.description,
                    COUNT(*) as activity_count,
                    MAX(m.date) as last_activity,
                    CAST(julianday('now') - julianday(MAX(m.date)) AS INTEGER) as days_ago,
                    ROUND(SUM(1.0 / (1.0 + (julianday('now') - julianday(m.date)) / 14.0)), 1) as score
                FROM project_milestones m
                LEFT JOIN projects p ON m.project_id = p.unique_id
                WHERE m.date >= date('now', '-90 days')
                  AND (p.status IS NULL OR p.status != 'archived')
                GROUP BY m.project_id
                ORDER BY score DESC
                LIMIT ?
            """, (limit,))

            results = []
            for row in cursor.fetchall():
                results.append({
                    'project_id': row['project_id'],
                    'name': row['project_name'] or row['project_id'],
                    'status': row['status'] or 'unknown',
                    'description': row['description'] or '',
                    'activity_count': row['activity_count'],
                    'last_activity': row['last_activity'],
                    'days_ago': row['days_ago'] or 0,
                    'score': row['score'] or 0
                })

            conn.close()
            return results

        except Exception as e:
            logger.error(f"Error getting top projects: {e}")
            return []

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


    def get_strategic_ranking(self, limit=15):
        """Get strategic project ranking combining activity, strategy, and health.

        Uses project-auditor ranking engine for composite scoring.
        """
        import sys as _sys
        ranking_src = '/data/projects/project-auditor/src'
        if ranking_src not in _sys.path:
            _sys.path.insert(0, ranking_src)

        try:
            from ranking import compute_composite_ranking
            return compute_composite_ranking(limit=limit)
        except Exception as e:
            logger.error(f"Error computing strategic ranking: {e}")
            return []


# Create singleton instance
activity_service = ActivityService()
