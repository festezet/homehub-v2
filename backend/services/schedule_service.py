"""
Schedule Service - Manages TODO scheduling and Claude planning proposals
Handles automatic placement of TODOs in available calendar slots
"""

import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import json

from .calendar_service import calendar_service
from .google_calendar import google_calendar_service

# Database paths
TODO_DB_PATH = '/data/projects/infrastructure/data/todo.db'
CALENDAR_DB_PATH = '/data/projects/infrastructure/data/calendar.db'


class ScheduleService:
    """Service for managing TODO scheduling"""

    def __init__(self):
        self._init_db()

    def _init_db(self) -> None:
        """Initialize scheduled_todos table"""
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scheduled_todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                todo_id INTEGER NOT NULL,
                scheduled_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                status TEXT DEFAULT 'proposed',
                proposed_by TEXT DEFAULT 'claude',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()

    def get_schedulable_todos(self, limit: int = 20) -> List[Dict]:
        """
        Get TODOs that are candidates for scheduling

        Criteria:
        - Status: To Do or In Progress
        - Priority: P1-Urgent or P2-High
        - Has deadline within next 2 weeks OR no deadline but high priority
        - Not already scheduled

        Returns:
            List of TODO items ready for scheduling
        """
        conn = sqlite3.connect(TODO_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        two_weeks = (datetime.now() + timedelta(weeks=2)).strftime('%Y-%m-%d')

        cursor.execute('''
            SELECT id, action, status, priority, deadline, category, objective, time, notes
            FROM todos
            WHERE status IN ('To Do', 'In Progress')
            AND priority IN ('P1-Urgent', 'P2-High')
            AND (deadline IS NULL OR deadline <= ?)
            ORDER BY
                CASE priority
                    WHEN 'P1-Urgent' THEN 1
                    WHEN 'P2-High' THEN 2
                    ELSE 3
                END,
                deadline ASC NULLS LAST
            LIMIT ?
        ''', (two_weeks, limit))

        todos = [dict(row) for row in cursor.fetchall()]
        conn.close()

        # Filter out already scheduled todos
        scheduled_ids = self._get_scheduled_todo_ids()
        todos = [t for t in todos if t['id'] not in scheduled_ids]

        return todos

    def _get_scheduled_todo_ids(self) -> set:
        """Get IDs of todos that are already scheduled"""
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT todo_id FROM scheduled_todos
            WHERE status IN ('proposed', 'confirmed')
            AND scheduled_date >= date('now')
        ''')

        ids = {row[0] for row in cursor.fetchall()}
        conn.close()

        return ids

    def propose_schedule(self, user_email: str, week_start: datetime) -> Dict:
        """
        Generate a scheduling proposal for TODOs using Claude logic

        This analyzes available slots and TODO requirements to create
        an optimal schedule proposal for user validation.

        Args:
            user_email: Google account email for calendar access
            week_start: Monday of the week to schedule

        Returns:
            Dict with proposed schedule and reasoning
        """
        # Get schedulable todos
        todos = self.get_schedulable_todos()
        if not todos:
            return {
                'success': True,
                'proposals': [],
                'message': 'Aucun TODO P1/P2 a planifier'
            }

        # Get week schedule (template)
        week_schedule = calendar_service.get_week_schedule(week_start)

        # Get Google Calendar events
        google_events = {}
        if google_calendar_service.is_authenticated(user_email):
            google_events = google_calendar_service.get_week_events(user_email, week_start)

        # Generate proposals
        proposals = []
        used_slots = set()  # Track used (day, start_time) pairs

        for todo in todos:
            # Find best slot for this todo
            best_slot = self._find_slot_for_todo(
                todo, week_schedule, google_events, used_slots
            )

            if best_slot:
                proposal = {
                    'todo_id': todo['id'],
                    'todo_action': todo['action'],
                    'todo_priority': todo['priority'],
                    'todo_deadline': todo['deadline'],
                    'todo_time': todo.get('time', 30),
                    'scheduled_date': best_slot['date'],
                    'day': best_slot['day'],
                    'start_time': best_slot['start'],
                    'end_time': best_slot['end'],
                    'slot_activity': best_slot['activity'],
                    'reasoning': self._generate_reasoning(todo, best_slot)
                }
                proposals.append(proposal)

                # Mark slot as used
                used_slots.add((best_slot['day'], best_slot['start']))

        return {
            'success': True,
            'proposals': proposals,
            'week_start': week_start.strftime('%Y-%m-%d'),
            'todos_analyzed': len(todos),
            'todos_scheduled': len(proposals)
        }

    def _find_slot_for_todo(self, todo: Dict, week_schedule: Dict,
                            google_events: Dict, used_slots: set) -> Optional[Dict]:
        """Find the best available slot for a TODO"""
        todo_category = todo.get('category', 'Admin')
        todo_time = todo.get('time', 30)
        todo_deadline = todo.get('deadline')

        # Get category mapping
        mapping = calendar_service.get_todo_category_mapping()
        preferred_categories = mapping.get(todo_category, ['dev', 'prospection'])

        # Calculate deadline urgency
        deadline_priority_days = {}
        if todo_deadline:
            try:
                deadline_date = datetime.strptime(todo_deadline, '%Y-%m-%d')
                for day_name, day_data in week_schedule.items():
                    day_date = datetime.strptime(day_data['date'], '%Y-%m-%d')
                    days_until_deadline = (deadline_date - day_date).days
                    deadline_priority_days[day_name] = days_until_deadline
            except:
                pass

        # Sort days by deadline proximity if applicable
        days_to_check = list(week_schedule.keys())
        if deadline_priority_days:
            days_to_check = sorted(
                days_to_check,
                key=lambda d: deadline_priority_days.get(d, 999)
            )

        for day_name in days_to_check:
            day_data = week_schedule[day_name]
            day_events = google_events.get(day_name, [])

            # Get available slots for this day
            available = calendar_service.get_available_slots(day_name, day_events)

            for slot in available:
                # Skip if slot already used
                if (day_name, slot['start']) in used_slots:
                    continue

                # Check if slot category matches
                if slot['category'] in preferred_categories:
                    # Check if slot duration is sufficient
                    slot_duration = self._get_slot_duration(slot)
                    if slot_duration >= todo_time:
                        return {
                            'day': day_name,
                            'date': day_data['date'],
                            'start': slot['start'],
                            'end': slot['end'],
                            'activity': slot['activity'],
                            'category': slot['category']
                        }

        # Fallback: any flexible slot with sufficient time
        for day_name in days_to_check:
            day_data = week_schedule[day_name]
            day_events = google_events.get(day_name, [])
            available = calendar_service.get_available_slots(day_name, day_events)

            for slot in available:
                if (day_name, slot['start']) in used_slots:
                    continue

                slot_duration = self._get_slot_duration(slot)
                if slot_duration >= todo_time:
                    return {
                        'day': day_name,
                        'date': day_data['date'],
                        'start': slot['start'],
                        'end': slot['end'],
                        'activity': slot['activity'],
                        'category': slot['category']
                    }

        return None

    def _get_slot_duration(self, slot: Dict) -> int:
        """Calculate slot duration in minutes"""
        start = datetime.strptime(slot['start'], '%H:%M')
        end = datetime.strptime(slot['end'], '%H:%M')
        return int((end - start).total_seconds() / 60)

    def _generate_reasoning(self, todo: Dict, slot: Dict) -> str:
        """Generate human-readable reasoning for slot choice"""
        reasons = []

        # Priority reason
        if todo['priority'] == 'P1-Urgent':
            reasons.append("Priorite urgente")
        elif todo['priority'] == 'P2-High':
            reasons.append("Haute priorite")

        # Deadline reason
        if todo.get('deadline'):
            reasons.append(f"Deadline: {todo['deadline']}")

        # Category match reason
        if slot.get('category'):
            category_labels = {
                'dev': 'Developpement',
                'prospection': 'Prospection',
                'routine': 'Routine',
                'veille': 'Veille'
            }
            label = category_labels.get(slot['category'], slot['category'])
            reasons.append(f"Creneau {label}")

        return " | ".join(reasons) if reasons else "Creneau disponible"

    def apply_schedule(self, proposals: List[Dict]) -> Dict:
        """
        Apply validated schedule proposals

        Args:
            proposals: List of proposals to apply (from propose_schedule)

        Returns:
            Dict with success status and applied count
        """
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        cursor = conn.cursor()

        applied = 0
        errors = []

        for proposal in proposals:
            try:
                cursor.execute('''
                    INSERT INTO scheduled_todos
                    (todo_id, scheduled_date, start_time, end_time, status, proposed_by)
                    VALUES (?, ?, ?, ?, 'confirmed', 'claude')
                ''', (
                    proposal['todo_id'],
                    proposal['scheduled_date'],
                    proposal['start_time'],
                    proposal['end_time']
                ))
                applied += 1
            except Exception as e:
                errors.append({
                    'todo_id': proposal['todo_id'],
                    'error': str(e)
                })

        conn.commit()
        conn.close()

        return {
            'success': len(errors) == 0,
            'applied': applied,
            'errors': errors
        }

    def get_scheduled_todos(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """
        Get scheduled todos for date range

        Args:
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of scheduled todos with full details
        """
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Query only from scheduled_todos (no cross-database JOIN)
        cursor.execute('''
            SELECT *
            FROM scheduled_todos
            WHERE scheduled_date BETWEEN ? AND ?
            AND status IN ('proposed', 'confirmed')
            ORDER BY scheduled_date, start_time
        ''', (start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')))

        scheduled = [dict(row) for row in cursor.fetchall()]
        conn.close()

        # Fetch todo details from todo.db
        if scheduled:
            todo_conn = sqlite3.connect(TODO_DB_PATH)
            todo_conn.row_factory = sqlite3.Row
            todo_cursor = todo_conn.cursor()

            todo_ids = [s['todo_id'] for s in scheduled]
            placeholders = ','.join('?' * len(todo_ids))

            todo_cursor.execute(f'''
                SELECT id, action, priority, category, deadline, notes
                FROM todos WHERE id IN ({placeholders})
            ''', todo_ids)

            todos_map = {row['id']: dict(row) for row in todo_cursor.fetchall()}
            todo_conn.close()

            # Merge todo details
            for s in scheduled:
                todo_details = todos_map.get(s['todo_id'], {})
                s['action'] = todo_details.get('action', 'Unknown')
                s['priority'] = todo_details.get('priority', 'P3-Normal')
                s['category'] = todo_details.get('category', 'Admin')
                s['deadline'] = todo_details.get('deadline')
                s['notes'] = todo_details.get('notes')

        return scheduled

    def cancel_scheduled_todo(self, scheduled_id: int) -> bool:
        """Cancel a scheduled todo"""
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE scheduled_todos
            SET status = 'cancelled', updated_at = ?
            WHERE id = ?
        ''', (datetime.now().isoformat(), scheduled_id))

        conn.commit()
        conn.close()

        return True


# Singleton instance
schedule_service = ScheduleService()
