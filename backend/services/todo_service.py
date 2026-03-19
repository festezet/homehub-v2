"""
TODO Service - Manage TODO items
"""

import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class TodoService:
    """Service to manage TODO items"""

    def __init__(self, db_path='/data/projects/infrastructure/data/todo.db'):
        self.db_path = db_path
        logger.info(f"📊 TODO Service initialized with database: {db_path}")

    def _get_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)

    def get_all_todos(self):
        """Get all TODO items"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, action, status, priority, deadline, blocking,
                       objective, notes, category,
                       created_at, updated_at
                FROM todos
                ORDER BY
                    CASE
                        WHEN status = 'To Do' THEN 1
                        WHEN status = 'In Progress' THEN 2
                        WHEN status = 'Done' THEN 3
                    END,
                    priority,
                    deadline ASC
            """)

            todos = []
            for row in cursor.fetchall():
                todos.append({
                    'id': row['id'],
                    'action': row['action'],
                    'status': row['status'],
                    'priority': row['priority'],
                    'deadline': row['deadline'],
                    'blocking': row['blocking'],
                    'objective': row['objective'] or '',
                    'notes': row['notes'] or '',
                    'category': row['category'] or 'Admin',
                    'created_at': row['created_at'],
                    'updated_at': row['updated_at']
                })

            conn.close()
            return todos

        except Exception as e:
            logger.error(f"Error getting todos: {e}")
            raise

    def create_todo(self, todo_data):
        """Create a new TODO item from dict"""
        try:
            action = todo_data.get('action', '')
            status = todo_data.get('status', 'To Do')
            priority = todo_data.get('priority', 'P3-Normal')
            deadline = todo_data.get('deadline')
            blocking = todo_data.get('blocking', 'Non')
            category = todo_data.get('category', 'Admin')
            notes = todo_data.get('notes', '')
            objective = todo_data.get('objective', '')
            withClaude = todo_data.get('withClaude', 'Non')
            time = todo_data.get('time', 30)

            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO todos (action, status, priority, deadline, blocking,
                                   category, notes, objective, withClaude, time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (action, status, priority, deadline, blocking,
                  category, notes, objective, withClaude, time))

            todo_id = cursor.lastrowid
            conn.commit()
            conn.close()

            logger.info(f"✅ TODO created: {todo_id}")
            return todo_id

        except Exception as e:
            logger.error(f"Error creating todo: {e}")
            raise

    def update_todo(self, todo_id, field, value):
        """Update a specific field of a TODO item"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Validate field
            valid_fields = ['action', 'status', 'priority', 'deadline', 'blocking', 'objective', 'notes', 'category']
            if field not in valid_fields:
                raise ValueError(f"Invalid field: {field}")

            cursor.execute(
                "UPDATE todos SET " + field + " = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (value, todo_id))

            if cursor.rowcount == 0:
                raise Exception(f"TODO {todo_id} not found")

            conn.commit()
            conn.close()

            logger.info(f"✅ TODO {todo_id} updated: {field} = {value}")
            return True

        except Exception as e:
            logger.error(f"Error updating todo {todo_id}: {e}")
            raise

    def delete_todo(self, todo_id):
        """Delete a TODO item"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("DELETE FROM todos WHERE id = ?", (todo_id,))

            if cursor.rowcount == 0:
                raise Exception(f"TODO {todo_id} not found")

            conn.commit()
            conn.close()

            logger.info(f"✅ TODO {todo_id} deleted")
            return True

        except Exception as e:
            logger.error(f"Error deleting todo {todo_id}: {e}")
            raise

# Create singleton instance
todo_service = TodoService()
