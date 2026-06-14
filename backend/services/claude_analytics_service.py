"""
Claude Analytics Service - Analyzes Claude Code interaction history
Imports messages from ~/.claude/history.jsonl and provides analytics
"""

import json
import logging
import os
import sqlite3
from datetime import datetime
from collections import defaultdict
from services.pattern_detector import PatternDetector
from services.skill_analyzer import SkillAnalyzer
from services.claude_skills_service import ClaudeSkillsService
from services.message_quality_analyzer import MessageQualityAnalyzer
from services.session_quality_analyzer import SessionQualityAnalyzer

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data', 'claude_analytics.db'
)

HISTORY_PATH = os.path.expanduser('~/.claude/history.jsonl')


class ClaudeAnalyticsService:
    """Manages Claude Code message history analytics"""

    def __init__(self):
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_db(self):
        """Initialize database schema"""
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = self._get_conn()
        self._create_tables(conn)
        conn.close()
        logger.info(f"Claude analytics DB initialized at {DB_PATH}")

    @staticmethod
    def _create_tables(conn):
        """Create core tables and indexes"""
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                display TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                project TEXT,
                session_id TEXT,
                pasted_contents TEXT DEFAULT '[]',
                UNIQUE(timestamp, session_id)
            );
            CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                project TEXT,
                message_count INTEGER DEFAULT 0,
                first_timestamp TEXT,
                last_timestamp TEXT
            );

            CREATE TABLE IF NOT EXISTS analytics_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cache_key TEXT UNIQUE NOT NULL,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_text TEXT NOT NULL,
                frequency INTEGER DEFAULT 0,
                first_seen TEXT,
                last_seen TEXT,
                example_messages TEXT DEFAULT '[]',
                status TEXT DEFAULT 'new',
                notes TEXT,
                category TEXT,
                skill_suggestion TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(pattern_text)
            );
            CREATE INDEX IF NOT EXISTS idx_patterns_status ON patterns(status);
            CREATE INDEX IF NOT EXISTS idx_patterns_frequency ON patterns(frequency DESC);

            CREATE TABLE IF NOT EXISTS skill_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skill_name TEXT NOT NULL,
                skill_path TEXT NOT NULL,
                skill_type TEXT,
                d1_score INTEGER,
                d2_score INTEGER,
                d3_score INTEGER,
                d4_score INTEGER,
                overall_score INTEGER,
                recommendations TEXT DEFAULT '[]',
                details TEXT DEFAULT '{}',
                analyzed_at TEXT NOT NULL,
                UNIQUE(skill_path)
            );
            CREATE INDEX IF NOT EXISTS idx_skill_analysis_overall ON skill_analysis(overall_score DESC);
        """)
        conn.commit()

    def import_history(self, incremental=True):
        """
        Import messages from ~/.claude/history.jsonl

        Args:
            incremental: If True, only import new messages (default)

        Returns:
            dict with import statistics
        """
        if not os.path.exists(HISTORY_PATH):
            raise FileNotFoundError(f"History file not found: {HISTORY_PATH}")

        conn = self._get_conn()
        cursor = conn.cursor()

        imported = 0
        skipped = 0
        errors = 0

        try:
            with open(HISTORY_PATH, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if not line.strip():
                        continue

                    try:
                        entry = json.loads(line)

                        # Extract fields
                        display = entry.get('display', '')
                        timestamp_ms = entry.get('timestamp', '')

                        # Convert timestamp from milliseconds to ISO format
                        if timestamp_ms:
                            timestamp = datetime.fromtimestamp(int(timestamp_ms) / 1000).isoformat()
                        else:
                            timestamp = None

                        project = entry.get('project')
                        session_id = entry.get('sessionId')
                        pasted_contents = json.dumps(entry.get('pastedContents', []))

                        # Insert message (will skip if duplicate due to UNIQUE constraint)
                        try:
                            cursor.execute("""
                                INSERT INTO messages (display, timestamp, project, session_id, pasted_contents)
                                VALUES (?, ?, ?, ?, ?)
                            """, (display, timestamp, project, session_id, pasted_contents))
                            imported += 1
                        except sqlite3.IntegrityError:
                            if incremental:
                                skipped += 1
                            else:
                                raise

                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON at line {line_num}: {e}")
                        errors += 1
                    except Exception as e:
                        logger.error(f"Error processing line {line_num}: {e}")
                        errors += 1

            # Update sessions table
            self._update_sessions(conn)

            conn.commit()
            logger.info(f"Import complete: {imported} imported, {skipped} skipped, {errors} errors")

            return {
                'imported': imported,
                'skipped': skipped,
                'errors': errors,
                'total': imported + skipped
            }

        except Exception as e:
            conn.rollback()
            logger.error(f"Import failed: {e}")
            raise
        finally:
            conn.close()

    def _update_sessions(self, conn):
        """Aggregate message data into sessions table"""
        conn.execute("DELETE FROM sessions")
        conn.execute("""
            INSERT INTO sessions (session_id, project, message_count, first_timestamp, last_timestamp)
            SELECT
                session_id,
                project,
                COUNT(*) as message_count,
                MIN(timestamp) as first_timestamp,
                MAX(timestamp) as last_timestamp
            FROM messages
            WHERE session_id IS NOT NULL
            GROUP BY session_id, project
        """)
        conn.commit()

    def get_stats(self):
        """Get overall statistics for dashboard"""
        conn = self._get_conn()
        cursor = conn.cursor()

        # Total messages
        cursor.execute("SELECT COUNT(*) FROM messages")
        total_messages = cursor.fetchone()[0]

        # Total sessions
        cursor.execute("SELECT COUNT(DISTINCT session_id) FROM messages WHERE session_id IS NOT NULL")
        total_sessions = cursor.fetchone()[0]

        # Total projects
        cursor.execute("SELECT COUNT(DISTINCT project) FROM messages WHERE project IS NOT NULL")
        total_projects = cursor.fetchone()[0]

        # Date range
        cursor.execute("SELECT MIN(timestamp), MAX(timestamp) FROM messages")
        row = cursor.fetchone()
        date_range = {
            'start': row[0] if row[0] else None,
            'end': row[1] if row[1] else None
        }

        # Days active (unique dates)
        cursor.execute("""
            SELECT COUNT(DISTINCT DATE(timestamp))
            FROM messages
            WHERE timestamp IS NOT NULL
        """)
        days_active = cursor.fetchone()[0]

        conn.close()

        return {
            'total_messages': total_messages,
            'total_sessions': total_sessions,
            'total_projects': total_projects,
            'date_range': date_range,
            'days_active': days_active
        }

    def get_messages(self, filters=None, limit=50, offset=0):
        """
        Get messages with optional filters

        Args:
            filters: dict with optional keys: project, session_id, start_date, end_date, search
            limit: max results per page
            offset: pagination offset

        Returns:
            dict with messages list and total count
        """
        conn = self._get_conn()
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if filters:
            if filters.get('project'):
                where_clauses.append("project = ?")
                params.append(filters['project'])

            if filters.get('session_id'):
                where_clauses.append("session_id = ?")
                params.append(filters['session_id'])

            if filters.get('start_date'):
                where_clauses.append("timestamp >= ?")
                params.append(filters['start_date'])

            if filters.get('end_date'):
                where_clauses.append("timestamp <= ?")
                params.append(filters['end_date'])

            if filters.get('search'):
                where_clauses.append("display LIKE ?")
                params.append(f"%{filters['search']}%")

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        # Get total count
        cursor.execute(f"SELECT COUNT(*) FROM messages WHERE {where_sql}", params)
        total = cursor.fetchone()[0]

        # Get messages
        query = f"""
            SELECT id, display, timestamp, project, session_id, pasted_contents
            FROM messages
            WHERE {where_sql}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])

        messages = []
        for row in cursor.fetchall():
            messages.append({
                'id': row['id'],
                'display': row['display'],
                'timestamp': row['timestamp'],
                'project': row['project'],
                'session_id': row['session_id'],
                'pasted_contents': json.loads(row['pasted_contents']) if row['pasted_contents'] else []
            })

        conn.close()

        return {
            'messages': messages,
            'total': total,
            'limit': limit,
            'offset': offset
        }

    def get_sessions(self, filters=None, limit=50, offset=0):
        """Get aggregated session data"""
        conn = self._get_conn()
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if filters:
            if filters.get('project'):
                where_clauses.append("project = ?")
                params.append(filters['project'])

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        # Get total count
        cursor.execute(f"SELECT COUNT(*) FROM sessions WHERE {where_sql}", params)
        total = cursor.fetchone()[0]

        # Get sessions
        query = f"""
            SELECT session_id, project, message_count, first_timestamp, last_timestamp
            FROM sessions
            WHERE {where_sql}
            ORDER BY last_timestamp DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])

        sessions = []
        for row in cursor.fetchall():
            sessions.append(dict(row))

        conn.close()

        return {
            'sessions': sessions,
            'total': total,
            'limit': limit,
            'offset': offset
        }

    def get_timeline_data(self, granularity='day'):
        """
        Get timeline data for charts

        Args:
            granularity: 'day', 'week', or 'month'

        Returns:
            list of {date, count} objects
        """
        conn = self._get_conn()
        cursor = conn.cursor()

        if granularity == 'week':
            # Group by week, return Monday of that week as YYYY-MM-DD
            query = """
                SELECT
                    date(timestamp, 'weekday 0', '-6 days') as date,
                    COUNT(*) as count
                FROM messages
                WHERE timestamp IS NOT NULL
                GROUP BY date
                ORDER BY date
            """
        elif granularity == 'month':
            # Group by month, return 1st of the month as YYYY-MM-DD
            query = """
                SELECT
                    strftime('%Y-%m-01', timestamp) as date,
                    COUNT(*) as count
                FROM messages
                WHERE timestamp IS NOT NULL
                GROUP BY date
                ORDER BY date
            """
        else:
            # Daily (default)
            query = """
                SELECT
                    strftime('%Y-%m-%d', timestamp) as date,
                    COUNT(*) as count
                FROM messages
                WHERE timestamp IS NOT NULL
                GROUP BY date
                ORDER BY date
            """

        cursor.execute(query)
        timeline = [{'date': row['date'], 'count': row['count']} for row in cursor.fetchall()]

        conn.close()
        return timeline

    def get_projects_data(self):
        """Get message count by project (top 10)"""
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                COALESCE(project, 'Unknown') as project,
                COUNT(*) as count
            FROM messages
            WHERE COALESCE(project, '') NOT LIKE '%/infrastructure'
            GROUP BY project
            ORDER BY count DESC
            LIMIT 10
        """)

        projects = [{'project': row['project'].rstrip('/').rsplit('/', 1)[-1] if row['project'] else 'Unknown', 'count': row['count']} for row in cursor.fetchall()]

        conn.close()
        return projects

    def detect_patterns(self, min_frequency=3):
        """
        Detect patterns in all messages using n-gram analysis

        Args:
            min_frequency: Minimum occurrences to consider a pattern

        Returns:
            dict with detection statistics
        """
        conn = self._get_conn()
        cursor = conn.cursor()

        # Get all messages
        cursor.execute("SELECT id, display, timestamp FROM messages ORDER BY timestamp")
        messages = [{'id': row['id'], 'display': row['display'], 'timestamp': row['timestamp']} for row in cursor.fetchall()]

        if not messages:
            conn.close()
            return {'patterns_found': 0, 'patterns_new': 0, 'patterns_updated': 0}

        # Initialize pattern detector
        detector = PatternDetector(min_frequency=min_frequency)

        # Detect patterns
        patterns = detector.detect_patterns(messages)

        # Insert or update patterns in database
        patterns_new = 0
        patterns_updated = 0

        for pattern in patterns:
            # Categorize and suggest skill
            category = detector.categorize_pattern(pattern['pattern_text'])
            skill_suggestion = detector.suggest_skill_from_pattern(pattern['pattern_text'], pattern['frequency'])

            try:
                cursor.execute("""
                    INSERT INTO patterns (pattern_text, frequency, first_seen, last_seen, example_messages, category, skill_suggestion, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pattern['pattern_text'],
                    pattern['frequency'],
                    pattern['first_seen'],
                    pattern['last_seen'],
                    json.dumps(pattern['example_messages']),
                    category,
                    json.dumps(skill_suggestion) if skill_suggestion else None,
                    datetime.now().isoformat()
                ))
                patterns_new += 1
            except sqlite3.IntegrityError:
                # Pattern already exists, update it
                cursor.execute("""
                    UPDATE patterns
                    SET frequency = ?, last_seen = ?, example_messages = ?, category = ?, skill_suggestion = ?
                    WHERE pattern_text = ?
                """, (
                    pattern['frequency'],
                    pattern['last_seen'],
                    json.dumps(pattern['example_messages']),
                    category,
                    json.dumps(skill_suggestion) if skill_suggestion else None,
                    pattern['pattern_text']
                ))
                patterns_updated += 1

        conn.commit()
        conn.close()

        logger.info(f"Pattern detection complete: {len(patterns)} found, {patterns_new} new, {patterns_updated} updated")

        return {
            'patterns_found': len(patterns),
            'patterns_new': patterns_new,
            'patterns_updated': patterns_updated
        }

    def get_patterns(self, filters=None, limit=50, offset=0):
        """
        Get patterns with optional filters

        Args:
            filters: dict with optional keys: status, min_frequency, category
            limit: max results per page
            offset: pagination offset

        Returns:
            dict with patterns list and total count
        """
        conn = self._get_conn()
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if filters:
            if filters.get('status'):
                where_clauses.append("status = ?")
                params.append(filters['status'])

            if filters.get('min_frequency'):
                where_clauses.append("frequency >= ?")
                params.append(filters['min_frequency'])

            if filters.get('category'):
                where_clauses.append("category = ?")
                params.append(filters['category'])

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        # Get total count
        cursor.execute(f"SELECT COUNT(*) FROM patterns WHERE {where_sql}", params)
        total = cursor.fetchone()[0]

        # Get patterns
        query = f"""
            SELECT id, pattern_text, frequency, first_seen, last_seen, example_messages, status, notes, category, skill_suggestion
            FROM patterns
            WHERE {where_sql}
            ORDER BY frequency DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])

        patterns = []
        for row in cursor.fetchall():
            patterns.append({
                'id': row['id'],
                'pattern_text': row['pattern_text'],
                'frequency': row['frequency'],
                'first_seen': row['first_seen'],
                'last_seen': row['last_seen'],
                'example_messages': json.loads(row['example_messages']) if row['example_messages'] else [],
                'status': row['status'],
                'notes': row['notes'],
                'category': row['category'],
                'skill_suggestion': json.loads(row['skill_suggestion']) if row['skill_suggestion'] else None
            })

        conn.close()

        return {
            'patterns': patterns,
            'total': total,
            'limit': limit,
            'offset': offset
        }

    def update_pattern(self, pattern_id, updates):
        """
        Update a pattern's status or notes

        Args:
            pattern_id: Pattern ID to update
            updates: dict with optional keys: status, notes

        Returns:
            bool indicating success
        """
        conn = self._get_conn()
        cursor = conn.cursor()

        set_clauses = []
        params = []

        if 'status' in updates:
            set_clauses.append("status = ?")
            params.append(updates['status'])

        if 'notes' in updates:
            set_clauses.append("notes = ?")
            params.append(updates['notes'])

        if not set_clauses:
            conn.close()
            return False

        params.append(pattern_id)
        query = f"UPDATE patterns SET {', '.join(set_clauses)} WHERE id = ?"

        cursor.execute(query, params)
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()

        return success

    def analyze_all_skills(self):
        """
        Analyze all skills (global + local) using D1-D4 framework

        Returns:
            dict with analysis statistics
        """
        analyzer = SkillAnalyzer()
        conn = self._get_conn()
        cursor = conn.cursor()

        # Get all skills from claude_skills_service
        skills_service = ClaudeSkillsService()
        skills_data = skills_service.scan_all()
        all_skills = []

        # Combine global and local skills
        for skill in skills_data.get('global_skills', []):
            all_skills.append({
                'name': skill['name'],
                'path': skill['file'],
                'type': 'global',
                'source': skill.get('source', 'global')
            })

        # Local skills are organized by project
        for project in skills_data.get('local_skills', []):
            for skill in project.get('skills', []):
                all_skills.append({
                    'name': skill['name'],
                    'path': skill['file'],
                    'type': 'local',
                    'source': skill.get('source', 'local')
                })

        analyzed = 0
        updated = 0
        errors = 0

        for skill in all_skills:
            try:
                # Analyze the skill
                result = analyzer.analyze_skill(skill['path'])

                if 'error' in result:
                    logger.warning(f"Error analyzing {skill['name']}: {result['error']}")
                    errors += 1
                    continue

                # Prepare details JSON
                details = {
                    'd1_details': result.get('d1_details', {}),
                    'd2_details': result.get('d2_details', {}),
                    'd3_details': result.get('d3_details', {}),
                    'd4_details': result.get('d4_details', {})
                }

                # Insert or update skill_analysis
                try:
                    cursor.execute("""
                        INSERT INTO skill_analysis
                        (skill_name, skill_path, skill_type, d1_score, d2_score, d3_score, d4_score,
                         overall_score, recommendations, details, analyzed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        skill['name'],
                        skill['path'],
                        skill['type'],
                        result['d1_score'],
                        result['d2_score'],
                        result['d3_score'],
                        result['d4_score'],
                        result['overall_score'],
                        json.dumps(result['recommendations']),
                        json.dumps(details),
                        datetime.now().isoformat()
                    ))
                    analyzed += 1
                except sqlite3.IntegrityError:
                    # Update existing
                    cursor.execute("""
                        UPDATE skill_analysis SET
                        skill_name = ?, skill_type = ?, d1_score = ?, d2_score = ?, d3_score = ?,
                        d4_score = ?, overall_score = ?, recommendations = ?, details = ?, analyzed_at = ?
                        WHERE skill_path = ?
                    """, (
                        skill['name'],
                        skill['type'],
                        result['d1_score'],
                        result['d2_score'],
                        result['d3_score'],
                        result['d4_score'],
                        result['overall_score'],
                        json.dumps(result['recommendations']),
                        json.dumps(details),
                        datetime.now().isoformat(),
                        skill['path']
                    ))
                    updated += 1

            except Exception as e:
                logger.error(f"Error analyzing skill {skill.get('name', 'unknown')}: {e}")
                errors += 1

        conn.commit()
        conn.close()

        return {
            'total_skills': len(all_skills),
            'analyzed': analyzed,
            'updated': updated,
            'errors': errors
        }

    def get_skill_analyses(self, filters=None, limit=50, offset=0):
        """
        Get skill analyses with optional filters

        Args:
            filters: Optional dict with keys: min_overall_score, max_overall_score, skill_type
            limit: Max number of results
            offset: Pagination offset

        Returns:
            dict with skills list and total count
        """
        conn = self._get_conn()
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if filters:
            if 'min_overall_score' in filters:
                where_clauses.append("overall_score >= ?")
                params.append(filters['min_overall_score'])

            if 'max_overall_score' in filters:
                where_clauses.append("overall_score <= ?")
                params.append(filters['max_overall_score'])

            if 'skill_type' in filters:
                where_clauses.append("skill_type = ?")
                params.append(filters['skill_type'])

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        # Get total count
        cursor.execute(f"SELECT COUNT(*) FROM skill_analysis {where_sql}", params)
        total = cursor.fetchone()[0]

        # Get paginated results
        params.extend([limit, offset])
        cursor.execute(f"""
            SELECT id, skill_name, skill_path, skill_type, d1_score, d2_score, d3_score, d4_score,
                   overall_score, recommendations, details, analyzed_at
            FROM skill_analysis
            {where_sql}
            ORDER BY overall_score DESC
            LIMIT ? OFFSET ?
        """, params)

        skills = []
        for row in cursor.fetchall():
            skills.append({
                'id': row['id'],
                'skill_name': row['skill_name'],
                'skill_path': row['skill_path'],
                'skill_type': row['skill_type'],
                'd1_score': row['d1_score'],
                'd2_score': row['d2_score'],
                'd3_score': row['d3_score'],
                'd4_score': row['d4_score'],
                'overall_score': row['overall_score'],
                'recommendations': json.loads(row['recommendations']) if row['recommendations'] else [],
                'details': json.loads(row['details']) if row['details'] else {},
                'analyzed_at': row['analyzed_at']
            })

        conn.close()

        return {
            'skills': skills,
            'total': total,
            'limit': limit,
            'offset': offset
        }

    def reanalyze_skill(self, skill_path):
        """
        Reanalyze a single skill

        Args:
            skill_path: Path to skill file

        Returns:
            dict with updated skill data or error
        """
        analyzer = SkillAnalyzer()
        conn = self._get_conn()
        cursor = conn.cursor()

        try:
            # Get skill name from existing record or from path
            cursor.execute("SELECT skill_name, skill_type FROM skill_analysis WHERE skill_path = ?", (skill_path,))
            existing = cursor.fetchone()

            if existing:
                skill_name = existing['skill_name']
                skill_type = existing['skill_type']
            else:
                # Extract name from path
                skill_name = os.path.basename(os.path.dirname(skill_path))
                skill_type = 'local'

            # Analyze the skill
            result = analyzer.analyze_skill(skill_path)

            if 'error' in result:
                conn.close()
                return {'error': result['error']}

            # Prepare details JSON
            details = {
                'd1_details': result.get('d1_details', {}),
                'd2_details': result.get('d2_details', {}),
                'd3_details': result.get('d3_details', {}),
                'd4_details': result.get('d4_details', {})
            }

            # Update or insert
            cursor.execute("""
                INSERT INTO skill_analysis
                (skill_name, skill_path, skill_type, d1_score, d2_score, d3_score, d4_score,
                 overall_score, recommendations, details, analyzed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(skill_path) DO UPDATE SET
                skill_name = excluded.skill_name,
                skill_type = excluded.skill_type,
                d1_score = excluded.d1_score,
                d2_score = excluded.d2_score,
                d3_score = excluded.d3_score,
                d4_score = excluded.d4_score,
                overall_score = excluded.overall_score,
                recommendations = excluded.recommendations,
                details = excluded.details,
                analyzed_at = excluded.analyzed_at
            """, (
                skill_name,
                skill_path,
                skill_type,
                result['d1_score'],
                result['d2_score'],
                result['d3_score'],
                result['d4_score'],
                result['overall_score'],
                json.dumps(result['recommendations']),
                json.dumps(details),
                datetime.now().isoformat()
            ))

            conn.commit()
            conn.close()

            return {
                'skill_name': skill_name,
                'skill_path': skill_path,
                'd1_score': result['d1_score'],
                'd2_score': result['d2_score'],
                'd3_score': result['d3_score'],
                'd4_score': result['d4_score'],
                'overall_score': result['overall_score'],
                'recommendations': result['recommendations'],
                'details': details
            }

        except Exception as e:
            conn.close()
            logger.error(f"Error reanalyzing skill {skill_path}: {e}")
            return {'error': str(e)}

    def analyze_message_quality(self, sample_size=1000):
        """
        Analyze user message quality using D1-D4 framework

        Args:
            sample_size: Number of messages to analyze (default 1000)

        Returns:
            Dict with analysis results and statistics
        """
        try:
            analyzer = MessageQualityAnalyzer()
            conn = self._get_conn()
            cursor = conn.cursor()

            # Get a representative sample of messages
            # Exclude empty messages and confirmations
            cursor.execute("""
                SELECT id, display, timestamp, project, session_id
                FROM messages
                WHERE LENGTH(TRIM(display)) > 0
                ORDER BY RANDOM()
                LIMIT ?
            """, (sample_size,))

            messages = []
            for row in cursor.fetchall():
                messages.append({
                    'id': row['id'],
                    'display': row['display'],
                    'timestamp': row['timestamp'],
                    'project': row['project'],
                    'session_id': row['session_id']
                })

            conn.close()

            if not messages:
                return {'error': 'No messages found'}

            # Analyze the batch
            result = analyzer.analyze_batch(messages)

            # Add overall insights
            stats = result['stats']
            insights = []

            # D1 insights
            if stats.get('d1', {}).get('avg', 0) < 50:
                insights.append("📝 Vos prompts manquent souvent de clarté - ajoutez une intention explicite")
            elif stats.get('d1', {}).get('avg', 0) >= 70:
                insights.append("✅ Vos prompts sont généralement clairs")

            # D2 insights
            if stats.get('d2', {}).get('avg', 0) < 60:
                insights.append("✍️ Attention à l'orthographe et aux mots de remplissage")
            elif stats.get('d2', {}).get('avg', 0) >= 80:
                insights.append("✅ Vos messages sont concis et bien écrits")

            # D3 insights
            if stats.get('d3', {}).get('avg', 0) < 50:
                insights.append("🎯 Spécifiez davantage vos critères de succès et résultats attendus")
            elif stats.get('d3', {}).get('avg', 0) >= 70:
                insights.append("✅ Vous définissez bien vos intentions et résultats")

            # D4 insights
            if stats.get('d4', {}).get('avg', 0) < 50:
                insights.append("📋 Structurez vos messages complexes avec des listes ou étapes numérotées")
            elif stats.get('d4', {}).get('avg', 0) >= 70:
                insights.append("✅ Vos messages sont bien structurés")

            result['insights'] = insights
            result['overall_rating'] = self._get_rating(stats.get('overall', {}).get('avg', 0))

            logger.info(f"Analyzed {len(messages)} messages - Overall avg: {stats.get('overall', {}).get('avg', 0)}")

            return result

        except Exception as e:
            logger.error(f"Error analyzing message quality: {e}")
            return {'error': str(e)}

    def _get_rating(self, score):
        """Convert score to rating"""
        if score >= 80:
            return 'Excellent'
        elif score >= 70:
            return 'Très bon'
        elif score >= 60:
            return 'Bon'
        elif score >= 50:
            return 'Moyen'
        else:
            return 'À améliorer'

    def analyze_session_quality(self, sample_size=100):
        """
        Analyze session quality to detect vague prompts that led to time waste

        This analyzes complete conversation sessions in context, not isolated messages.
        Detects patterns like:
        - Lots of corrections ("non", "pas comme ça", "recommence")
        - Clarifications needed ("je veux dire", "en fait")
        - Long back-and-forth indicating confusion
        - Weak initial prompts that caused problems

        Args:
            sample_size: Number of sessions to analyze (default 100)

        Returns:
            Dict with analysis results showing problematic sessions
        """
        try:
            analyzer = SessionQualityAnalyzer()
            conn = self._get_conn()
            cursor = conn.cursor()

            # Get a sample of sessions with their messages
            # Prioritize sessions with multiple messages (single-message sessions are less interesting)
            cursor.execute("""
                SELECT session_id, COUNT(*) as msg_count
                FROM messages
                WHERE session_id IS NOT NULL AND LENGTH(TRIM(display)) > 0
                GROUP BY session_id
                HAVING msg_count >= 3
                ORDER BY RANDOM()
                LIMIT ?
            """, (sample_size,))

            session_ids = [row['session_id'] for row in cursor.fetchall()]

            if not session_ids:
                conn.close()
                return {'error': 'No sessions with multiple messages found'}

            # Get all messages for these sessions
            sessions_data = []
            for session_id in session_ids:
                cursor.execute("""
                    SELECT id, display, timestamp, project, session_id
                    FROM messages
                    WHERE session_id = ?
                    ORDER BY timestamp ASC
                """, (session_id,))

                messages = []
                for row in cursor.fetchall():
                    messages.append({
                        'id': row['id'],
                        'display': row['display'],
                        'timestamp': row['timestamp'],
                        'project': row['project'],
                        'session_id': row['session_id']
                    })

                if messages:
                    sessions_data.append(messages)

            conn.close()

            if not sessions_data:
                return {'error': 'No session data found'}

            # Analyze the batch
            result = analyzer.analyze_batch(sessions_data)

            # Add insights
            stats = result['stats']
            insights = []

            problematic_pct = (stats['problematic'] / stats['total_sessions']) * 100
            if problematic_pct > 30:
                insights.append(
                    f"⚠️ {problematic_pct:.0f}% de vos sessions sont problématiques - "
                    "vos prompts initiaux manquent souvent de clarté"
                )
            elif problematic_pct > 15:
                insights.append(
                    f"⚠️ {problematic_pct:.0f}% de sessions ont des problèmes - "
                    "améliorez vos prompts initiaux"
                )
            else:
                insights.append(
                    f"✅ Seulement {problematic_pct:.0f}% de sessions problématiques"
                )

            avg_corrections = stats['avg_corrections_per_session']
            if avg_corrections > 3:
                insights.append(
                    f"🔄 {avg_corrections:.1f} corrections en moyenne par session - "
                    "trop de va-et-vient"
                )
            elif avg_corrections > 1.5:
                insights.append(
                    f"🔄 {avg_corrections:.1f} corrections par session - "
                    "vous pourriez être plus précis dès le départ"
                )
            else:
                insights.append(
                    f"✅ Peu de corrections ({avg_corrections:.1f} par session)"
                )

            # Common problems across worst sessions
            common_issues = defaultdict(int)
            for session in result['worst_sessions']:
                for indicator in session['indicators']:
                    common_issues[indicator] += 1

            if common_issues:
                top_issue = max(common_issues.items(), key=lambda x: x[1])
                insights.append(
                    f"📌 Problème le plus fréquent: {top_issue[0]} "
                    f"({top_issue[1]} sessions)"
                )

            result['insights'] = insights

            logger.info(
                f"Analyzed {stats['total_sessions']} sessions - "
                f"{stats['problematic']} problematic, "
                f"avg problem score: {stats['avg_problem_score']}"
            )

            return result

        except Exception as e:
            logger.error(f"Error analyzing session quality: {e}")
            return {'error': str(e)}


# Singleton instance
claude_analytics_service = ClaudeAnalyticsService()
