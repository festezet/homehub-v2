"""
Claude Analytics API Routes - Message history analytics and insights
"""

import json
import subprocess
from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

claude_analytics_bp = Blueprint('claude_analytics', __name__)

_analytics_service = None


def init_claude_analytics_routes(analytics_service):
    global _analytics_service
    _analytics_service = analytics_service


# ------------------------------------------------------------------
# Import and Stats
# ------------------------------------------------------------------

@claude_analytics_bp.route('/api/claude-analytics/import', methods=['POST'])
def import_history():
    """Import messages from ~/.claude/history.jsonl"""
    try:
        data = request.get_json() or {}
        incremental = data.get('incremental', True)

        result = _analytics_service.import_history(incremental=incremental)

        return success(**result)
    except FileNotFoundError as e:
        return api_error(404, str(e))
    except Exception as e:
        logger.error(f"Error importing history: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/stats')
def get_stats():
    """Get overall statistics for dashboard"""
    try:
        stats = _analytics_service.get_stats()
        return success(**stats)
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Messages and Sessions
# ------------------------------------------------------------------

@claude_analytics_bp.route('/api/claude-analytics/messages')
def get_messages():
    """Get messages with optional filters"""
    try:
        # Parse query parameters
        filters = {}
        if request.args.get('project'):
            filters['project'] = request.args.get('project')
        if request.args.get('session_id'):
            filters['session_id'] = request.args.get('session_id')
        if request.args.get('start_date'):
            filters['start_date'] = request.args.get('start_date')
        if request.args.get('end_date'):
            filters['end_date'] = request.args.get('end_date')
        if request.args.get('search'):
            filters['search'] = request.args.get('search')

        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        result = _analytics_service.get_messages(
            filters=filters if filters else None,
            limit=limit,
            offset=offset
        )

        return success(**result)
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/sessions')
def get_sessions():
    """Get aggregated session data"""
    try:
        filters = {}
        if request.args.get('project'):
            filters['project'] = request.args.get('project')

        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        result = _analytics_service.get_sessions(
            filters=filters if filters else None,
            limit=limit,
            offset=offset
        )

        return success(**result)
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Chart Data
# ------------------------------------------------------------------

@claude_analytics_bp.route('/api/claude-analytics/timeline')
def get_timeline():
    """Get timeline data for charts"""
    try:
        granularity = request.args.get('granularity', 'day')

        if granularity not in ['day', 'week', 'month']:
            return api_error(400, 'Invalid granularity. Must be day, week, or month')

        timeline = _analytics_service.get_timeline_data(granularity=granularity)

        return success(timeline=timeline)
    except Exception as e:
        logger.error(f"Error getting timeline data: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/projects')
def get_projects():
    """Get message count by project (top 10)"""
    try:
        projects = _analytics_service.get_projects_data()
        return success(projects=projects)
    except Exception as e:
        logger.error(f"Error getting projects data: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Pattern Detection
# ------------------------------------------------------------------

@claude_analytics_bp.route('/api/claude-analytics/patterns/detect', methods=['POST'])
def detect_patterns():
    """Detect patterns in all messages using n-gram analysis"""
    try:
        data = request.get_json() or {}
        min_frequency = data.get('min_frequency', 3)

        result = _analytics_service.detect_patterns(min_frequency=min_frequency)

        return success(**result)
    except Exception as e:
        logger.error(f"Error detecting patterns: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/patterns')
def get_patterns():
    """Get patterns with optional filters"""
    try:
        filters = {}
        if request.args.get('status'):
            filters['status'] = request.args.get('status')
        if request.args.get('min_frequency'):
            filters['min_frequency'] = int(request.args.get('min_frequency'))
        if request.args.get('category'):
            filters['category'] = request.args.get('category')

        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        result = _analytics_service.get_patterns(
            filters=filters if filters else None,
            limit=limit,
            offset=offset
        )

        return success(**result)
    except Exception as e:
        logger.error(f"Error getting patterns: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/patterns/<int:pattern_id>', methods=['PATCH'])
def update_pattern(pattern_id):
    """Update a pattern's status or notes"""
    try:
        data = request.get_json() or {}

        updates = {}
        if 'status' in data:
            updates['status'] = data['status']
        if 'notes' in data:
            updates['notes'] = data['notes']

        if not updates:
            return api_error(400, 'No valid update fields provided')

        success_flag = _analytics_service.update_pattern(pattern_id, updates)

        if success_flag:
            return success(message='Pattern updated successfully')
        else:
            return api_error(404, 'Pattern not found')

    except Exception as e:
        logger.error(f"Error updating pattern: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Skills Analysis
# ------------------------------------------------------------------

@claude_analytics_bp.route('/api/claude-analytics/skills/analyze', methods=['POST'])
def analyze_all_skills():
    """Analyze all skills using D1-D4 framework"""
    try:
        result = _analytics_service.analyze_all_skills()
        return success(**result)
    except Exception as e:
        logger.error(f"Error analyzing skills: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/skills')
def get_skill_analyses():
    """Get skill analyses with optional filters"""
    try:
        filters = {}

        if request.args.get('min_overall_score'):
            filters['min_overall_score'] = int(request.args.get('min_overall_score'))
        if request.args.get('max_overall_score'):
            filters['max_overall_score'] = int(request.args.get('max_overall_score'))
        if request.args.get('skill_type'):
            filters['skill_type'] = request.args.get('skill_type')

        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        result = _analytics_service.get_skill_analyses(
            filters=filters if filters else None,
            limit=limit,
            offset=offset
        )

        return success(**result)
    except Exception as e:
        logger.error(f"Error getting skill analyses: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/skills/reanalyze', methods=['POST'])
def reanalyze_skill():
    """Reanalyze a single skill"""
    try:
        data = request.get_json() or {}
        skill_path = data.get('skill_path')

        if not skill_path:
            return api_error(400, 'skill_path is required')

        result = _analytics_service.reanalyze_skill(skill_path)

        if 'error' in result:
            return api_error(500, result['error'])

        return success(**result)
    except Exception as e:
        logger.error(f"Error reanalyzing skill: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/message-quality', methods=['POST'])
def analyze_message_quality():
    """Analyze user message quality using D1-D4 framework"""
    try:
        data = request.get_json() or {}
        sample_size = data.get('sample_size', 1000)

        result = _analytics_service.analyze_message_quality(sample_size=sample_size)

        if 'error' in result:
            return api_error(500, result['error'])

        return success(**result)
    except Exception as e:
        logger.error(f"Error analyzing message quality: {e}")
        return api_error(500, str(e))


@claude_analytics_bp.route('/api/claude-analytics/session-quality', methods=['POST'])
def analyze_session_quality():
    """
    Analyze session quality to detect vague prompts that caused time waste

    Analyzes complete conversation sessions in context to find:
    - Sessions with lots of corrections/clarifications
    - Weak initial prompts that led to problems
    - Back-and-forth patterns indicating confusion
    """
    try:
        data = request.get_json() or {}
        sample_size = data.get('sample_size', 100)

        result = _analytics_service.analyze_session_quality(sample_size=sample_size)

        if 'error' in result:
            return api_error(500, result['error'])

        return success(**result)
    except Exception as e:
        logger.error(f"Error analyzing session quality: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Resume Sessions (for Reprise sub-tab)
# ------------------------------------------------------------------

@claude_analytics_bp.route('/api/claude-analytics/resume-sessions')
def get_resume_sessions():
    """Get recent sessions with sessionId for claude --resume commands.

    Uses daily_review.py to fetch session data for today and optionally yesterday.
    """
    try:
        days = int(request.args.get('days', 2))
        days = min(days, 120)

        from datetime import datetime, timedelta
        from concurrent.futures import ThreadPoolExecutor

        def fetch_day(offset):
            """Fetch sessions for a single day."""
            date_str = (datetime.now() - timedelta(days=offset)).strftime('%Y-%m-%d')
            try:
                result = subprocess.run(
                    ['python3', '/data/projects/infrastructure/scripts/daily_review.py',
                     '--date', date_str, '--json'],
                    capture_output=True, text=True, timeout=30
                )
                if result.returncode == 0 and result.stdout.strip():
                    data = json.loads(result.stdout)
                    sessions = []
                    for s in data.get('sessions', []):
                        s['date'] = date_str
                        sessions.append(s)
                    return sessions
            except (subprocess.TimeoutExpired, json.JSONDecodeError):
                pass
            return []

        all_sessions = []
        workers = min(days, 8)
        with ThreadPoolExecutor(max_workers=workers) as executor:
            results = executor.map(fetch_day, range(days))
            for day_sessions in results:
                all_sessions.extend(day_sessions)

        # Filter: only closed + crashed, with sessionId
        work_sessions = [
            s for s in all_sessions
            if s.get('status') in ('closed', 'crashed') and s.get('sessionId')
        ]

        return success(sessions=work_sessions)

    except Exception as e:
        logger.error(f"Error getting resume sessions: {e}")
        return api_error(500, str(e))
