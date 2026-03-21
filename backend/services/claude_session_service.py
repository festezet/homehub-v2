"""
Claude Session Service - Named session management with collaboration
Manages session claiming, work queue, and inter-session briefings.
"""

import sqlite3
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/infrastructure/data/claude_sessions.db'

STALE_HOURS = 4

VALID_NAMES = ['Monet', 'Debussy', 'Francois', 'Chabrol', 'Shannon', 'Lelouch', 'Rains']

NAME_WORK_TYPES = {
    'Monet': 'creative',
    'Debussy': 'media',
    'Francois': 'dev',
    'Chabrol': 'analysis',
    'Shannon': 'data',
    'Lelouch': 'business',
    'Rains': 'infra',
}


class ClaudeSessionService:

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        return conn

    # ── Session management ──

    def get_all_sessions(self):
        """List all session names with their status."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM sessions ORDER BY id')
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_available_names(self):
        """Get names that are idle or stale (claimable)."""
        conn = self._get_connection()
        try:
            self._cleanup_stale(conn)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name, work_type FROM sessions WHERE status = 'idle' ORDER BY id")
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def claim(self, name, work_type=None, project_id=None):
        """Claim a session name. Returns session dict or raises."""
        if name not in VALID_NAMES:
            raise ValueError(f"Unknown name: {name}. Valid: {', '.join(VALID_NAMES)}")

        conn = self._get_connection()
        try:
            self._cleanup_stale(conn)
            cursor = conn.cursor()
            now = datetime.now().isoformat()

            cursor.execute(
                'SELECT status FROM sessions WHERE name = ?', (name,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Session {name} not found in DB")
            if row['status'] == 'active':
                raise ValueError(f"{name} is already active. Use --force or release it first.")

            wtype = work_type or NAME_WORK_TYPES.get(name)
            cursor.execute("""
                UPDATE sessions
                SET status = 'active', work_type = ?, current_project = ?,
                    started_at = ?, last_heartbeat = ?, last_activity = 'claimed'
                WHERE name = ?
            """, (wtype, project_id, now, now, name))
            conn.commit()

            cursor.execute('SELECT * FROM sessions WHERE name = ?', (name,))
            return dict(cursor.fetchone())
        finally:
            conn.close()

    def force_claim(self, name, work_type=None, project_id=None):
        """Force-claim a name even if active (for stale recovery)."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            now = datetime.now().isoformat()
            wtype = work_type or NAME_WORK_TYPES.get(name)
            cursor.execute("""
                UPDATE sessions
                SET status = 'active', work_type = ?, current_project = ?,
                    started_at = ?, last_heartbeat = ?, last_activity = 'force-claimed'
                WHERE name = ?
            """, (wtype, project_id, now, now, name))
            conn.commit()

            # Requeue any work claimed by this stale session
            cursor.execute("""
                UPDATE work_queue
                SET status = 'pending', claimed_by = NULL, claimed_at = NULL
                WHERE claimed_by = ? AND status = 'claimed'
            """, (name,))
            conn.commit()

            cursor.execute('SELECT * FROM sessions WHERE name = ?', (name,))
            return dict(cursor.fetchone())
        finally:
            conn.close()

    def release(self, name):
        """Release a session name back to idle."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE sessions
                SET status = 'idle', current_project = NULL,
                    started_at = NULL, last_heartbeat = NULL, last_activity = NULL
                WHERE name = ?
            """, (name,))
            conn.commit()

            # Requeue any uncompleted work
            cursor.execute("""
                UPDATE work_queue
                SET status = 'pending', claimed_by = NULL, claimed_at = NULL
                WHERE claimed_by = ? AND status = 'claimed'
            """, (name,))
            conn.commit()

            return {'name': name, 'status': 'idle'}
        finally:
            conn.close()

    def heartbeat(self, name, activity=None):
        """Update heartbeat timestamp for a session."""
        conn = self._get_connection()
        try:
            now = datetime.now().isoformat()
            cursor = conn.cursor()
            if activity:
                cursor.execute("""
                    UPDATE sessions SET last_heartbeat = ?, last_activity = ?
                    WHERE name = ? AND status = 'active'
                """, (now, activity, name))
            else:
                cursor.execute("""
                    UPDATE sessions SET last_heartbeat = ?
                    WHERE name = ? AND status = 'active'
                """, (now, name))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def _cleanup_stale(self, conn):
        """Mark sessions as stale if no heartbeat for STALE_HOURS."""
        threshold = (datetime.now() - timedelta(hours=STALE_HOURS)).isoformat()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE sessions
            SET status = 'idle', last_activity = 'auto-released (stale)'
            WHERE status = 'active' AND last_heartbeat < ?
        """, (threshold,))
        if cursor.rowcount > 0:
            logger.info(f"Cleaned up {cursor.rowcount} stale session(s)")
            # Requeue work from stale sessions
            cursor.execute("""
                UPDATE work_queue
                SET status = 'pending', claimed_by = NULL, claimed_at = NULL
                WHERE status = 'claimed' AND claimed_by IN (
                    SELECT name FROM sessions WHERE status = 'idle'
                    AND last_activity = 'auto-released (stale)'
                )
            """)
        conn.commit()

    # ── Work queue ──

    def create_batch(self, batch_id, work_type, items, project_id=None, created_by=None):
        """Create a batch of work items. items = list of dicts (input_data)."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            created = 0
            for item in items:
                cursor.execute("""
                    INSERT INTO work_queue
                        (batch_id, work_type, status, input_data, project_id, created_by)
                    VALUES (?, ?, 'pending', ?, ?, ?)
                """, (
                    batch_id, work_type,
                    json.dumps(item, ensure_ascii=False),
                    project_id, created_by
                ))
                created += 1
            conn.commit()

            # Auto-broadcast briefing
            if created_by:
                self._create_briefing(
                    conn, created_by, None, 'work_available',
                    f"New batch: {batch_id}",
                    f"**{created}** items of type `{work_type}` available.\n"
                    f"Use `/collab work {work_type}` to claim items."
                )
                conn.commit()

            return {'batch_id': batch_id, 'items_created': created}
        finally:
            conn.close()

    def claim_work(self, claimed_by, work_type=None):
        """Atomically claim next pending work item."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            now = datetime.now().isoformat()

            # Atomic claim with subquery
            if work_type:
                cursor.execute("""
                    UPDATE work_queue
                    SET status = 'claimed', claimed_by = ?, claimed_at = ?
                    WHERE id = (
                        SELECT id FROM work_queue
                        WHERE status = 'pending' AND work_type = ?
                        ORDER BY id LIMIT 1
                    )
                """, (claimed_by, now, work_type))
            else:
                cursor.execute("""
                    UPDATE work_queue
                    SET status = 'claimed', claimed_by = ?, claimed_at = ?
                    WHERE id = (
                        SELECT id FROM work_queue
                        WHERE status = 'pending'
                        ORDER BY id LIMIT 1
                    )
                """, (claimed_by, now))
            conn.commit()

            if cursor.rowcount == 0:
                return None

            # Fetch the claimed item
            cursor.execute("""
                SELECT * FROM work_queue
                WHERE claimed_by = ? AND status = 'claimed'
                ORDER BY claimed_at DESC LIMIT 1
            """, (claimed_by,))
            row = cursor.fetchone()
            if row:
                d = dict(row)
                d['input_data'] = json.loads(d['input_data']) if d['input_data'] else {}
                return d
            return None
        finally:
            conn.close()

    def complete_work(self, work_id, output_data=None, error_message=None):
        """Mark a work item as done or failed."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            now = datetime.now().isoformat()
            status = 'failed' if error_message else 'done'
            output = json.dumps(output_data, ensure_ascii=False) if output_data else None

            cursor.execute("""
                UPDATE work_queue
                SET status = ?, output_data = ?, error_message = ?, completed_at = ?
                WHERE id = ?
            """, (status, output, error_message, now, work_id))
            conn.commit()
            return {'id': work_id, 'status': status}
        finally:
            conn.close()

    def get_batch_status(self, batch_id):
        """Get progress for a batch."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT status, count(*) as cnt
                FROM work_queue WHERE batch_id = ?
                GROUP BY status
            """, (batch_id,))
            counts = {row['status']: row['cnt'] for row in cursor.fetchall()}
            total = sum(counts.values())
            return {
                'batch_id': batch_id,
                'total': total,
                'pending': counts.get('pending', 0),
                'claimed': counts.get('claimed', 0),
                'done': counts.get('done', 0),
                'failed': counts.get('failed', 0),
            }
        finally:
            conn.close()

    # ── Briefings ──

    def _create_briefing(self, conn, from_session, to_session, btype, title, content, metadata=None):
        """Internal: insert a briefing (reuses an open connection)."""
        cursor = conn.cursor()
        meta = json.dumps(metadata, ensure_ascii=False) if metadata else None
        cursor.execute("""
            INSERT INTO briefings (from_session, to_session, briefing_type, title, content, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (from_session, to_session, btype, title, content, meta))
        return cursor.lastrowid

    def send_briefing(self, from_session, to_session, btype, title, content, metadata=None):
        """Send a briefing to another session (or broadcast if to_session is None)."""
        conn = self._get_connection()
        try:
            bid = self._create_briefing(conn, from_session, to_session, btype, title, content, metadata)
            conn.commit()
            return {'id': bid, 'from': from_session, 'to': to_session or 'broadcast'}
        finally:
            conn.close()

    def get_briefings(self, session_name, unread_only=True):
        """Get briefings for a session (including broadcasts)."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if unread_only:
                cursor.execute("""
                    SELECT * FROM briefings
                    WHERE (to_session = ? OR to_session IS NULL)
                      AND read_at IS NULL
                      AND from_session != ?
                    ORDER BY created_at DESC
                """, (session_name, session_name))
            else:
                cursor.execute("""
                    SELECT * FROM briefings
                    WHERE to_session = ? OR to_session IS NULL
                    ORDER BY created_at DESC LIMIT 20
                """, (session_name,))
            results = []
            for row in cursor.fetchall():
                d = dict(row)
                if d.get('metadata'):
                    try:
                        d['metadata'] = json.loads(d['metadata'])
                    except (json.JSONDecodeError, TypeError):
                        d['metadata'] = None
                results.append(d)
            return results
        finally:
            conn.close()

    def mark_briefing_read(self, briefing_id):
        """Mark a briefing as read."""
        conn = self._get_connection()
        try:
            now = datetime.now().isoformat()
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE briefings SET read_at = ? WHERE id = ?',
                (now, briefing_id))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    # ── Admin ──

    def get_stats(self):
        """Get overview stats for admin."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            # Active sessions
            cursor.execute("SELECT count(*) as cnt FROM sessions WHERE status = 'active'")
            active = cursor.fetchone()['cnt']
            # Work queue
            cursor.execute("""
                SELECT status, count(*) as cnt FROM work_queue GROUP BY status
            """)
            work = {row['status']: row['cnt'] for row in cursor.fetchall()}
            # Unread briefings
            cursor.execute("SELECT count(*) as cnt FROM briefings WHERE read_at IS NULL")
            unread = cursor.fetchone()['cnt']
            return {
                'active_sessions': active,
                'work_queue': work,
                'unread_briefings': unread,
            }
        finally:
            conn.close()

    def get_dashboard(self):
        """Get rich dashboard with per-session activity and recent work."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()

            # All sessions with status
            cursor.execute('SELECT * FROM sessions ORDER BY id')
            sessions = [dict(r) for r in cursor.fetchall()]

            # Per-session work queue breakdown
            cursor.execute("""
                SELECT claimed_by, status, count(*) as cnt
                FROM work_queue
                WHERE claimed_by IS NOT NULL
                GROUP BY claimed_by, status
            """)
            work_by_session = {}
            for row in cursor.fetchall():
                name = row['claimed_by']
                if name not in work_by_session:
                    work_by_session[name] = {}
                work_by_session[name][row['status']] = row['cnt']

            # Recent completed work items (last 10)
            cursor.execute("""
                SELECT id, batch_id, work_type, claimed_by, completed_at
                FROM work_queue
                WHERE status IN ('done', 'failed')
                ORDER BY completed_at DESC LIMIT 10
            """)
            recent_completed = [dict(r) for r in cursor.fetchall()]

            # Active batches with progress
            cursor.execute("""
                SELECT batch_id, work_type,
                       count(*) as total,
                       sum(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
                       sum(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed,
                       sum(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                       sum(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM work_queue
                GROUP BY batch_id, work_type
                ORDER BY batch_id DESC
            """)
            batches = [dict(r) for r in cursor.fetchall()]

            # Recent briefings (last 10, all)
            cursor.execute("""
                SELECT id, from_session, to_session, briefing_type, title,
                       read_at, created_at
                FROM briefings
                ORDER BY created_at DESC LIMIT 10
            """)
            recent_briefings = [dict(r) for r in cursor.fetchall()]

            return {
                'sessions': sessions,
                'work_by_session': work_by_session,
                'recent_completed': recent_completed,
                'batches': batches,
                'recent_briefings': recent_briefings,
            }
        finally:
            conn.close()


claude_session_service = ClaudeSessionService()
