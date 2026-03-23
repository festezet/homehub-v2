"""
Life Tasks Service - CRUD for ephemeral life tasks with category templates
Manages LIFE-XXX tasks in projects.db
"""

import sqlite3
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/project-management/data/projects.db'

TEMPLATES = {
    'repair': {
        'label': 'Reparation/SAV',
        'icon': 'wrench',
        'default_steps': [
            'Diagnostiquer le probleme',
            'Verifier la garantie',
            'Obtenir un devis',
            'Valider la reparation',
            'Recuperer le materiel'
        ],
        'context_fields': ['device', 'issue', 'warranty', 'repair_shop', 'quote']
    },
    'travel': {
        'label': 'Voyage/Deplacement',
        'icon': 'plane',
        'default_steps': [
            'Reserver le transport',
            'Reserver l\'hebergement',
            'Preparer le programme',
            'Rassembler les documents',
            'Faire la valise'
        ],
        'context_fields': ['destination', 'dates', 'purpose', 'transport', 'accommodation', 'budget']
    },
    'admin': {
        'label': 'Demarche administrative',
        'icon': 'file-text',
        'default_steps': [
            'Rassembler les documents',
            'Contacter l\'organisme',
            'Soumettre la demande',
            'Suivre le dossier'
        ],
        'context_fields': ['organism', 'reference', 'contact_person', 'documents_needed']
    },
    'health': {
        'label': 'Sante',
        'icon': 'heart',
        'default_steps': [
            'Prendre rendez-vous',
            'Preparer les documents',
            'Consultation',
            'Suivi post-consultation'
        ],
        'context_fields': ['practitioner', 'appointment_date', 'symptoms', 'prescription']
    },
    'purchase': {
        'label': 'Achat',
        'icon': 'shopping-cart',
        'default_steps': [
            'Rechercher les options',
            'Comparer les offres',
            'Commander',
            'Suivre la livraison'
        ],
        'context_fields': ['item', 'budget', 'options', 'order_ref']
    },
    'event': {
        'label': 'Evenement',
        'icon': 'calendar',
        'default_steps': [
            'Confirmer la date',
            'Organiser la logistique',
            'Preparer le necessaire',
            'Jour J'
        ],
        'context_fields': ['event_name', 'date', 'location', 'participants']
    }
}


class LifeTasksService:

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _generate_unique_id(self, cursor):
        """Generate next LIFE-XXX id."""
        cursor.execute("SELECT unique_id FROM life_tasks ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        if row:
            num = int(row['unique_id'].split('-')[1]) + 1
        else:
            num = 1
        return f"LIFE-{num:03d}"

    @staticmethod
    def _row_to_dict(row):
        d = dict(row)
        for field in ('context_data', 'steps'):
            if d.get(field):
                try:
                    d[field] = json.loads(d[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        return d

    def get_templates(self):
        """Return all category templates."""
        return TEMPLATES

    def get_tasks(self, status=None, category=None):
        """List tasks with optional filters."""
        conn = self._get_connection()
        try:
            query = "SELECT * FROM life_tasks WHERE 1=1"
            params = []
            if status:
                query += " AND status = ?"
                params.append(status)
            if category:
                query += " AND category = ?"
                params.append(category)
            query += " ORDER BY CASE priority WHEN 'P1-Urgent' THEN 0 WHEN 'P2-High' THEN 1 WHEN 'P3-Normal' THEN 2 WHEN 'P4-Low' THEN 3 ELSE 4 END, created_at DESC"
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [self._row_to_dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def get_task(self, unique_id):
        """Get a single task by LIFE-XXX id or integer id."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if isinstance(unique_id, int) or unique_id.isdigit():
                cursor.execute("SELECT * FROM life_tasks WHERE id = ?", (int(unique_id),))
            else:
                cursor.execute("SELECT * FROM life_tasks WHERE unique_id = ?", (unique_id,))
            row = cursor.fetchone()
            return self._row_to_dict(row) if row else None
        finally:
            conn.close()

    def create_task(self, data):
        """Create a new life task.

        Args:
            data: dict with keys:
                - title (str, required)
                - category (str, required): repair, travel, admin, health, purchase, event
                - priority (str, optional)
                - description (str, optional)
                - due_date (str, optional)
                - context_data (dict, optional)
                - steps (list, optional): overrides template defaults
        """
        category = data.get('category')
        if category not in TEMPLATES:
            raise ValueError(f"Unknown category: {category}. Valid: {', '.join(TEMPLATES.keys())}")

        template = TEMPLATES[category]

        # Use provided steps or template defaults
        steps = data.get('steps')
        if steps is None:
            steps = [{'text': s, 'done': False} for s in template['default_steps']]
        elif isinstance(steps, list) and steps and isinstance(steps[0], str):
            steps = [{'text': s, 'done': False} for s in steps]

        # Build context_data from template fields
        context_data = data.get('context_data', {})

        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            unique_id = self._generate_unique_id(cursor)

            cursor.execute("""
                INSERT INTO life_tasks
                    (unique_id, title, category, priority, description, due_date, context_data, steps)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                unique_id,
                data['title'],
                category,
                data.get('priority', 'P3-Normal'),
                data.get('description'),
                data.get('due_date'),
                json.dumps(context_data) if context_data else None,
                json.dumps(steps),
            ))
            conn.commit()
            logger.info(f"Life task created: {unique_id} - {data['title']} [{category}]")
            return {'id': cursor.lastrowid, 'unique_id': unique_id}
        finally:
            conn.close()

    def update_task(self, unique_id, data):
        """Update an existing task fields."""
        allowed = {'title', 'priority', 'description', 'due_date', 'status', 'context_data', 'resolution'}
        updates = {}
        for k, v in data.items():
            if k not in allowed:
                continue
            if k == 'context_data' and isinstance(v, dict):
                updates[k] = json.dumps(v)
            else:
                updates[k] = v

        if not updates:
            return False

        updates['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        conn = self._get_connection()
        try:
            set_clause = ', '.join(f"{k} = ?" for k in updates)
            values = list(updates.values())

            cursor = conn.cursor()
            if isinstance(unique_id, int) or unique_id.isdigit():
                values.append(int(unique_id))
                cursor.execute(f"UPDATE life_tasks SET {set_clause} WHERE id = ?", values)
            else:
                values.append(unique_id)
                cursor.execute(f"UPDATE life_tasks SET {set_clause} WHERE unique_id = ?", values)
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def update_steps(self, unique_id, steps):
        """Update the steps checklist for a task."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(unique_id, int) or unique_id.isdigit():
                cursor.execute(
                    "UPDATE life_tasks SET steps = ?, updated_at = ? WHERE id = ?",
                    (json.dumps(steps), now, int(unique_id)))
            else:
                cursor.execute(
                    "UPDATE life_tasks SET steps = ?, updated_at = ? WHERE unique_id = ?",
                    (json.dumps(steps), now, unique_id))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def resolve_task(self, unique_id, resolution=None):
        """Mark a task as completed with optional resolution note."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(unique_id, int) or unique_id.isdigit():
                cursor.execute(
                    "UPDATE life_tasks SET status = 'completed', resolution = ?, resolved_at = ?, updated_at = ? WHERE id = ?",
                    (resolution, now, now, int(unique_id)))
            else:
                cursor.execute(
                    "UPDATE life_tasks SET status = 'completed', resolution = ?, resolved_at = ?, updated_at = ? WHERE unique_id = ?",
                    (resolution, now, now, unique_id))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def delete_task(self, unique_id):
        """Delete a task."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if isinstance(unique_id, int) or unique_id.isdigit():
                cursor.execute("DELETE FROM life_tasks WHERE id = ?", (int(unique_id),))
            else:
                cursor.execute("DELETE FROM life_tasks WHERE unique_id = ?", (unique_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def get_stats(self):
        """Get stats by status and category."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT status, COUNT(*) as count FROM life_tasks GROUP BY status")
            by_status = {row['status']: row['count'] for row in cursor.fetchall()}

            cursor.execute("""
                SELECT category, COUNT(*) as count,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
                FROM life_tasks GROUP BY category
            """)
            by_category = [{
                'category': row['category'],
                'total': row['count'],
                'active': row['active']
            } for row in cursor.fetchall()]

            # Overdue count
            cursor.execute("""
                SELECT COUNT(*) as count FROM life_tasks
                WHERE status = 'active' AND due_date IS NOT NULL AND due_date < date('now')
            """)
            overdue = cursor.fetchone()['count']

            return {
                'by_status': by_status,
                'by_category': by_category,
                'overdue': overdue,
                'active': by_status.get('active', 0),
                'completed': by_status.get('completed', 0),
                'total': sum(by_status.values())
            }
        finally:
            conn.close()


life_tasks_service = LifeTasksService()
