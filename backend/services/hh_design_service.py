"""
HH Design Service - HomeHub architecture introspection + feature wishlist CRUD
Scans HomeHub codebase dynamically and manages features in SQLite
"""

import os
import re
import glob
import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

HOMEHUB_ROOT = '/data/projects/homehub-v2'
DB_PATH = '/data/projects/homehub-v2/data/hh_design.db'

VALID_CATEGORIES = {'ui', 'backend', 'integration', 'ux'}
VALID_PRIORITIES = {'P1-Urgent', 'P2-High', 'P3-Normal', 'P4-Low'}
VALID_STATUSES = {'idea', 'planned', 'in-progress', 'done', 'rejected'}


class HHDesignService:

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Create features table if not exists."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL DEFAULT 'ux',
                priority TEXT NOT NULL DEFAULT 'P3-Normal',
                status TEXT NOT NULL DEFAULT 'idea',
                pain_point TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ========== Architecture Scanner ==========

    def get_architecture(self):
        """Scan HomeHub codebase and return architecture overview."""
        pages = self._scan_pages()
        api_routes = self._scan_api_routes()
        services = self._scan_services()
        js_modules = self._scan_js_modules()
        templates = self._scan_templates()

        total_loc = (
            sum(s.get('loc', 0) for s in services) +
            sum(j.get('loc', 0) for j in js_modules) +
            sum(r.get('loc', 0) for r in api_routes)
        )

        return {
            'pages': pages,
            'api_routes': api_routes,
            'services': services,
            'js_modules': js_modules,
            'templates': templates,
            'summary': {
                'total_pages': len(pages),
                'total_api_routes': sum(r.get('route_count', 0) for r in api_routes),
                'total_services': len(services),
                'total_js_modules': len(js_modules),
                'total_templates': len(templates),
                'total_loc': total_loc,
            }
        }

    def _scan_pages(self):
        """Extract pages from base.html data-page attributes with descriptions."""
        base_html = os.path.join(HOMEHUB_ROOT, 'frontend', 'templates', 'base.html')
        pages = []
        if not os.path.isfile(base_html):
            return pages
        try:
            with open(base_html, 'r', encoding='utf-8') as f:
                content = f.read()
            # Extract page config for descriptions
            page_descs = {}
            for m in re.finditer(
                r"'([^']+)'\s*:\s*\{\s*title:\s*'([^']*)',\s*subtitle:\s*'([^']*)'",
                content
            ):
                page_descs[m.group(1)] = m.group(3)
            for match in re.finditer(r'data-page="([^"]+)"', content):
                name = match.group(1)
                pages.append({
                    'name': name,
                    'description': page_descs.get(name, ''),
                })
        except Exception as e:
            logger.error(f"Error scanning pages: {e}")
        return pages

    def _scan_api_routes(self):
        """Scan backend/api/*.py for route definitions with docstrings."""
        results = []
        api_dir = os.path.join(HOMEHUB_ROOT, 'backend', 'api')
        if not os.path.isdir(api_dir):
            return results
        for f in sorted(os.listdir(api_dir)):
            if not f.endswith('.py') or f.startswith('__'):
                continue
            fpath = os.path.join(api_dir, f)
            try:
                with open(fpath, 'r', encoding='utf-8') as fh:
                    content = fh.read()
                routes = re.findall(r"@\w+\.route\(['\"]([^'\"]+)['\"]", content)
                loc = content.count('\n') + 1
                desc = self._extract_module_docstring(content)
                results.append({
                    'file': f,
                    'routes': routes,
                    'route_count': len(routes),
                    'loc': loc,
                    'description': desc,
                })
            except Exception:
                continue
        return results

    def _scan_services(self):
        """Scan backend/services/*.py for service classes with docstrings."""
        results = []
        svc_dir = os.path.join(HOMEHUB_ROOT, 'backend', 'services')
        if not os.path.isdir(svc_dir):
            return results
        for f in sorted(os.listdir(svc_dir)):
            if not f.endswith('.py') or f.startswith('__'):
                continue
            fpath = os.path.join(svc_dir, f)
            try:
                with open(fpath, 'r', encoding='utf-8') as fh:
                    content = fh.read()
                classes = re.findall(r'class\s+(\w+)', content)
                loc = content.count('\n') + 1
                desc = self._extract_module_docstring(content)
                results.append({
                    'file': f,
                    'classes': classes,
                    'loc': loc,
                    'description': desc,
                })
            except Exception:
                continue
        return results

    def _scan_js_modules(self):
        """Scan frontend/static/js/*.js for modules with descriptions."""
        results = []
        js_dir = os.path.join(HOMEHUB_ROOT, 'frontend', 'static', 'js')
        if not os.path.isdir(js_dir):
            return results
        for f in sorted(os.listdir(js_dir)):
            if not f.endswith('.js'):
                continue
            fpath = os.path.join(js_dir, f)
            try:
                with open(fpath, 'r', encoding='utf-8') as fh:
                    content = fh.read()
                loc = content.count('\n') + 1
                desc = self._extract_js_description(content)
                results.append({'file': f, 'loc': loc, 'description': desc})
            except Exception:
                continue
        return results

    def _scan_templates(self):
        """Scan frontend/templates/*.html."""
        results = []
        tpl_dir = os.path.join(HOMEHUB_ROOT, 'frontend', 'templates')
        if not os.path.isdir(tpl_dir):
            return results
        for f in sorted(os.listdir(tpl_dir)):
            if not f.endswith('.html'):
                continue
            fpath = os.path.join(tpl_dir, f)
            try:
                size = os.path.getsize(fpath)
                results.append({'file': f, 'size': size})
            except Exception:
                continue
        return results

    @staticmethod
    def _extract_module_docstring(content):
        """Extract first line of module docstring from Python file."""
        m = re.match(r'\s*(?:#.*\n)*\s*(?:\'\'\'|""")(.+?)(?:\'\'\'|""")', content, re.DOTALL)
        if m:
            lines = m.group(1).strip().splitlines()
            # Return first meaningful line (skip module name if it's just a title)
            for line in lines:
                line = line.strip().rstrip('.')
                if line and len(line) > 5:
                    return line
        return ''

    @staticmethod
    def _extract_js_description(content):
        """Extract description from JS file header comment."""
        m = re.match(r'\s*/\*\*?\s*\n?\s*\*?\s*(.+?)[\n*]', content)
        if m:
            return m.group(1).strip().rstrip('.')
        return ''

    # ========== Feature CRUD ==========

    def get_features(self, status=None, category=None):
        """List features with optional filters."""
        conn = self._get_connection()
        try:
            query = "SELECT * FROM features WHERE 1=1"
            params = []
            if status:
                query += " AND status = ?"
                params.append(status)
            if category:
                query += " AND category = ?"
                params.append(category)
            query += " ORDER BY CASE priority WHEN 'P1-Urgent' THEN 0 WHEN 'P2-High' THEN 1 WHEN 'P3-Normal' THEN 2 WHEN 'P4-Low' THEN 3 END, created_at DESC"
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def create_feature(self, data):
        """Create a new feature."""
        title = data.get('title', '').strip()
        if not title:
            raise ValueError('title is required')

        category = data.get('category', 'ux')
        if category not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category: {category}. Valid: {', '.join(VALID_CATEGORIES)}")

        priority = data.get('priority', 'P3-Normal')
        if priority not in VALID_PRIORITIES:
            raise ValueError(f"Invalid priority: {priority}. Valid: {', '.join(VALID_PRIORITIES)}")

        status = data.get('status', 'idea')
        if status not in VALID_STATUSES:
            raise ValueError(f"Invalid status: {status}. Valid: {', '.join(VALID_STATUSES)}")

        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO features (title, description, category, priority, status, pain_point)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (title, data.get('description'), category, priority, status, data.get('pain_point')))
            conn.commit()
            return {'id': cursor.lastrowid}
        finally:
            conn.close()

    def update_feature(self, feature_id, data):
        """Update a feature."""
        allowed = {'title', 'description', 'category', 'priority', 'status', 'pain_point'}
        updates = {}
        for k, v in data.items():
            if k not in allowed:
                continue
            # Validate enums
            if k == 'category' and v not in VALID_CATEGORIES:
                raise ValueError(f"Invalid category: {v}")
            if k == 'priority' and v not in VALID_PRIORITIES:
                raise ValueError(f"Invalid priority: {v}")
            if k == 'status' and v not in VALID_STATUSES:
                raise ValueError(f"Invalid status: {v}")
            updates[k] = v

        if not updates:
            return False

        updates['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        conn = self._get_connection()
        try:
            set_clause = ', '.join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [int(feature_id)]
            cursor = conn.cursor()
            sql = "UPDATE features SET {} WHERE id = ?".format(set_clause)
            cursor.execute(sql, values)
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def delete_feature(self, feature_id):
        """Delete a feature."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM features WHERE id = ?", (int(feature_id),))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()


hh_design_service = HHDesignService()
