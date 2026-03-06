"""
Calendar Service - Business logic for calendar operations
Handles weekly template, event merging, and slot availability
"""

import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# Path to weekly template JSON
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'weekly_template.json')


class CalendarService:
    """Service for managing calendar operations"""

    def __init__(self):
        self.template = None
        self._load_template()

    def _load_template(self) -> None:
        """Load weekly template from JSON file"""
        try:
            with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
                self.template = json.load(f)
        except FileNotFoundError:
            self.template = {"slots": [], "categories": {}}

    def get_template(self) -> Dict:
        """Get the current weekly template"""
        self._load_template()  # Always reload to get latest changes
        return self.template

    def update_template(self, data: Dict) -> Dict:
        """Update weekly template and save to file"""
        self.template = data
        self.template['updated'] = datetime.now().isoformat()

        with open(TEMPLATE_PATH, 'w', encoding='utf-8') as f:
            json.dump(self.template, f, ensure_ascii=False, indent=2)

        return self.template

    def get_slots_for_day(self, day_name: str) -> List[Dict]:
        """Get all slots for a specific day with resolved activities"""
        self._load_template()  # Reload to get latest changes
        slots = []

        for slot in self.template.get('slots', []):
            activity = slot['activity']

            # Resolve activity based on day variations
            if activity.get('variations', {}).get(day_name):
                resolved_activity = activity['variations'][day_name]
            else:
                resolved_activity = activity.get('default')

            if resolved_activity:  # Only include if activity exists for this day
                slots.append({
                    'start': slot['start'],
                    'end': slot['end'],
                    'activity': resolved_activity,
                    'category': slot['category'],
                    'is_flexible': slot['is_flexible'],
                    'color': slot['color']
                })

        return slots

    def get_week_schedule(self, start_date: datetime) -> Dict[str, List[Dict]]:
        """Get complete week schedule starting from given date"""
        days = self.template.get('days', ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'])
        schedule = {}

        for i, day_name in enumerate(days):
            current_date = start_date + timedelta(days=i)
            schedule[day_name] = {
                'date': current_date.strftime('%Y-%m-%d'),
                'slots': self.get_slots_for_day(day_name)
            }

        return schedule

    def get_available_slots(self, day_name: str, events: List[Dict] = None) -> List[Dict]:
        """
        Get available (flexible) slots for a day that don't conflict with events

        Args:
            day_name: Name of the day (Lundi, Mardi, etc.)
            events: List of Google Calendar events to check conflicts

        Returns:
            List of available time slots
        """
        available = []

        for slot in self.get_slots_for_day(day_name):
            if not slot['is_flexible']:
                continue

            # Check for conflicts with Google Calendar events
            has_conflict = False
            if events:
                slot_start = self._parse_time(slot['start'])
                slot_end = self._parse_time(slot['end'])

                for event in events:
                    event_start = self._parse_datetime(event.get('start'))
                    event_end = self._parse_datetime(event.get('end'))

                    # Check overlap
                    if event_start and event_end:
                        if not (slot_end <= event_start.time() or slot_start >= event_end.time()):
                            has_conflict = True
                            break

            if not has_conflict:
                available.append(slot)

        return available

    def _parse_time(self, time_str: str) -> datetime.time:
        """Parse time string (HH:MM) to time object"""
        return datetime.strptime(time_str, '%H:%M').time()

    def _parse_datetime(self, dt_dict: Optional[Dict]) -> Optional[datetime]:
        """Parse Google Calendar datetime dict to datetime object"""
        if not dt_dict:
            return None

        if 'dateTime' in dt_dict:
            return datetime.fromisoformat(dt_dict['dateTime'].replace('Z', '+00:00'))
        elif 'date' in dt_dict:
            return datetime.strptime(dt_dict['date'], '%Y-%m-%d')

        return None

    def get_categories(self) -> Dict:
        """Get category definitions"""
        return self.template.get('categories', {})

    def get_todo_category_mapping(self) -> Dict:
        """Get mapping from TODO categories to calendar slot categories"""
        return self.template.get('mapping_todo_categories', {})

    def find_best_slot_for_todo(self, todo: Dict, week_schedule: Dict,
                                 google_events: Dict[str, List]) -> Optional[Dict]:
        """
        Find the best available slot for a TODO based on category and time

        Args:
            todo: TODO item with category and time fields
            week_schedule: Current week schedule
            google_events: Google Calendar events by day

        Returns:
            Best matching slot with day and time info, or None
        """
        todo_category = todo.get('category', 'Admin')
        todo_time = todo.get('time', 30)  # minutes

        # Get preferred calendar categories for this TODO category
        mapping = self.get_todo_category_mapping()
        preferred_categories = mapping.get(todo_category, ['dev', 'prospection'])

        best_slot = None

        for day_name, day_data in week_schedule.items():
            day_events = google_events.get(day_name, [])
            available_slots = self.get_available_slots(day_name, day_events)

            for slot in available_slots:
                # Check if slot category matches preferred categories
                if slot['category'] in preferred_categories:
                    # Check if slot duration is sufficient
                    slot_duration = self._get_slot_duration_minutes(slot)
                    if slot_duration >= todo_time:
                        if best_slot is None:
                            best_slot = {
                                'day': day_name,
                                'date': day_data['date'],
                                'slot': slot
                            }
                            break  # Take first matching slot

            if best_slot:
                break

        return best_slot

    def _get_slot_duration_minutes(self, slot: Dict) -> int:
        """Calculate slot duration in minutes"""
        start = self._parse_time(slot['start'])
        end = self._parse_time(slot['end'])

        start_minutes = start.hour * 60 + start.minute
        end_minutes = end.hour * 60 + end.minute

        return end_minutes - start_minutes


# Singleton instance
calendar_service = CalendarService()
