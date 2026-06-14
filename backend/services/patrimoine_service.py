"""
Patrimoine Service - Read/write patrimoine data from ai-profile private DB
Provides accounts, snapshots, balances, and analysis comparisons
"""

import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/ai-profile/data/private/patrimoine.db'


class PatrimoineService:

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    # --- Categories ---

    def get_categories(self):
        conn = self._get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM categories ORDER BY display_order"
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    # --- Accounts ---

    def get_accounts(self, category_id=None):
        conn = self._get_connection()
        try:
            if category_id:
                rows = conn.execute(
                    """SELECT a.*, c.name as category_name
                       FROM accounts a JOIN categories c ON a.category_id = c.id
                       WHERE a.category_id = ? ORDER BY a.display_order""",
                    (category_id,)
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT a.*, c.name as category_name
                       FROM accounts a JOIN categories c ON a.category_id = c.id
                       ORDER BY c.display_order, a.display_order"""
                ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def create_account(self, data):
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                """INSERT INTO accounts (name, category_id, account_type, notes, display_order)
                   VALUES (?, ?, ?, ?, ?)""",
                (data['name'], data['category_id'],
                 data.get('account_type', ''), data.get('notes', ''),
                 data.get('display_order', 99))
            )
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()

    def update_account(self, account_id, data):
        conn = self._get_connection()
        try:
            allowed = {'name', 'category_id', 'account_type', 'notes', 'display_order'}
            updates = {k: v for k, v in data.items() if k in allowed}
            if not updates:
                return False
            set_clause = ', '.join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [account_id]
            conn.execute(f"UPDATE accounts SET {set_clause} WHERE id = ?", values)
            conn.commit()
            return True
        finally:
            conn.close()

    def delete_account(self, account_id):
        conn = self._get_connection()
        try:
            conn.execute("DELETE FROM balances WHERE account_id = ?", (account_id,))
            conn.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
            conn.commit()
            return True
        finally:
            conn.close()

    # --- Snapshots ---

    def get_snapshots(self):
        conn = self._get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM snapshots ORDER BY snapshot_date"
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def create_snapshot(self, data):
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "INSERT INTO snapshots (snapshot_date, label) VALUES (?, ?)",
                (data['snapshot_date'], data.get('label', ''))
            )
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()

    def delete_snapshot(self, snapshot_id):
        conn = self._get_connection()
        try:
            conn.execute("DELETE FROM balances WHERE snapshot_id = ?", (snapshot_id,))
            conn.execute("DELETE FROM snapshots WHERE id = ?", (snapshot_id,))
            conn.commit()
            return True
        finally:
            conn.close()

    # --- Balances ---

    def get_balances(self, snapshot_id=None):
        conn = self._get_connection()
        try:
            if snapshot_id:
                rows = conn.execute(
                    """SELECT b.*, a.name as account_name, a.category_id,
                              c.name as category_name
                       FROM balances b
                       JOIN accounts a ON b.account_id = a.id
                       JOIN categories c ON a.category_id = c.id
                       WHERE b.snapshot_id = ?
                       ORDER BY c.display_order, a.display_order""",
                    (snapshot_id,)
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT b.*, a.name as account_name, a.category_id,
                              c.name as category_name, s.snapshot_date, s.label as snapshot_label
                       FROM balances b
                       JOIN accounts a ON b.account_id = a.id
                       JOIN categories c ON a.category_id = c.id
                       JOIN snapshots s ON b.snapshot_id = s.id
                       ORDER BY s.snapshot_date, c.display_order, a.display_order"""
                ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def upsert_balance(self, data):
        """Insert or update a balance for account+snapshot."""
        conn = self._get_connection()
        try:
            existing = conn.execute(
                "SELECT id FROM balances WHERE account_id = ? AND snapshot_id = ?",
                (data['account_id'], data['snapshot_id'])
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE balances SET amount = ? WHERE id = ?",
                    (data['amount'], existing['id'])
                )
            else:
                conn.execute(
                    "INSERT INTO balances (account_id, snapshot_id, amount) VALUES (?, ?, ?)",
                    (data['account_id'], data['snapshot_id'], data['amount'])
                )
            conn.commit()
            return True
        finally:
            conn.close()

    # --- Full table (for frontend display) ---

    def get_full_table(self):
        """Return structured data for the patrimoine table display."""
        conn = self._get_connection()
        try:
            categories = conn.execute(
                "SELECT * FROM categories ORDER BY display_order"
            ).fetchall()
            snapshots = conn.execute(
                "SELECT * FROM snapshots ORDER BY snapshot_date"
            ).fetchall()
            accounts = conn.execute(
                "SELECT * FROM accounts ORDER BY category_id, display_order"
            ).fetchall()
            balances = conn.execute(
                "SELECT * FROM balances"
            ).fetchall()

            # Build balance lookup: (account_id, snapshot_id) -> amount
            bal_map = {}
            for b in balances:
                bal_map[(b['account_id'], b['snapshot_id'])] = b['amount']

            result = {
                'snapshots': [dict(s) for s in snapshots],
                'categories': []
            }

            for cat in categories:
                cat_accounts = [a for a in accounts if a['category_id'] == cat['id']]
                cat_data = {
                    'id': cat['id'],
                    'name': cat['name'],
                    'accounts': [],
                    'totals': {}
                }
                for acc in cat_accounts:
                    acc_data = {
                        'id': acc['id'],
                        'name': acc['name'],
                        'account_type': acc['account_type'],
                        'notes': acc['notes'],
                        'balances': {}
                    }
                    for snap in snapshots:
                        amount = bal_map.get((acc['id'], snap['id']), 0)
                        acc_data['balances'][str(snap['id'])] = amount
                    cat_data['accounts'].append(acc_data)

                # Category totals per snapshot
                for snap in snapshots:
                    total = sum(
                        bal_map.get((a['id'], snap['id']), 0)
                        for a in cat_accounts
                    )
                    cat_data['totals'][str(snap['id'])] = total

                result['categories'].append(cat_data)

            # Grand totals
            result['grand_totals'] = {}
            for snap in snapshots:
                result['grand_totals'][str(snap['id'])] = sum(
                    cat['totals'].get(str(snap['id']), 0)
                    for cat in result['categories']
                )

            return result
        finally:
            conn.close()

    # --- Analysis ---

    def get_analysis(self):
        """Return analysis comparison data."""
        conn = self._get_connection()
        try:
            comparisons = conn.execute(
                "SELECT * FROM analysis_comparisons ORDER BY id"
            ).fetchall()

            result = []
            for comp in comparisons:
                columns = conn.execute(
                    "SELECT * FROM analysis_columns WHERE comparison_id = ? ORDER BY display_order",
                    (comp['id'],)
                ).fetchall()
                rows = conn.execute(
                    "SELECT * FROM analysis_rows WHERE comparison_id = ? ORDER BY display_order",
                    (comp['id'],)
                ).fetchall()
                cells = conn.execute(
                    """SELECT ac.* FROM analysis_cells ac
                       JOIN analysis_rows ar ON ac.row_id = ar.id
                       WHERE ar.comparison_id = ?""",
                    (comp['id'],)
                ).fetchall()

                # Build cell lookup: (row_id, column_id) -> value
                cell_map = {}
                for c in cells:
                    cd = dict(c)
                    cell_map[(cd['row_id'], cd['column_id'])] = {
                        'value': cd['value'],
                        'is_highlight': bool(cd.get('is_highlight', False))
                    }

                # DB schema: context (not description), name (not label), metric (not label)
                compd = dict(comp)
                comp_data = {
                    'id': compd['id'],
                    'title': compd['title'],
                    'description': compd.get('context') or compd.get('description') or '',
                    'recommendation': compd.get('recommendation') or '',
                    'columns': [],
                    'rows': [],
                }
                for c in columns:
                    cd = dict(c)
                    comp_data['columns'].append({
                        'id': cd['id'],
                        'label': cd.get('name') or cd.get('label') or '',
                        'is_winner': bool(cd.get('is_winner', False))
                    })

                for row in rows:
                    rd = dict(row)
                    row_data = {
                        'id': rd['id'],
                        'label': rd.get('metric') or rd.get('label') or '',
                        'row_type': rd.get('row_type') or 'data',
                        'cells': {}
                    }
                    for col in columns:
                        cell = cell_map.get((row['id'], col['id']), {'value': '', 'is_highlight': False})
                        row_data['cells'][str(col['id'])] = cell
                    comp_data['rows'].append(row_data)

                result.append(comp_data)

            return result
        finally:
            conn.close()

    def get_summary(self):
        """Quick summary: latest snapshot totals."""
        conn = self._get_connection()
        try:
            snap = conn.execute(
                "SELECT * FROM snapshots ORDER BY snapshot_date DESC LIMIT 1"
            ).fetchone()
            if not snap:
                return {'total': 0, 'snapshot': None}

            total = conn.execute(
                "SELECT COALESCE(SUM(amount), 0) as total FROM balances WHERE snapshot_id = ?",
                (snap['id'],)
            ).fetchone()['total']

            by_cat = conn.execute(
                """SELECT c.name, COALESCE(SUM(b.amount), 0) as total
                   FROM balances b
                   JOIN accounts a ON b.account_id = a.id
                   JOIN categories c ON a.category_id = c.id
                   WHERE b.snapshot_id = ?
                   GROUP BY c.id ORDER BY c.display_order""",
                (snap['id'],)
            ).fetchall()

            return {
                'total': total,
                'snapshot_date': snap['snapshot_date'],
                'snapshot_label': snap['label'],
                'by_category': [{'name': r['name'], 'total': r['total']} for r in by_cat]
            }
        finally:
            conn.close()


patrimoine_service = PatrimoineService()
