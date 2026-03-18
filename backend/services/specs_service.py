"""Specs & Health Service - Track SPEC.md status and project health"""

import sqlite3
import os
import json
import re
import subprocess
import socket
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/project-management/data/projects.db'
PORT_REGISTRY = '/data/projects/infrastructure/data/port_registry.json'
SOURCE_EXTENSIONS = {
    '.py', '.js', '.html', '.css', '.ts', '.tsx', '.dart',
    '.sh', '.sql', '.jsx', '.vue', '.svelte'
}
EXCLUDE_DIRS = {
    'venv', 'node_modules', '.git', 'data', '__pycache__', 'build',
    '.dart_tool', '.pub-cache', 'dist', 'egg-info', '.eggs',
    '.tox', 'htmlcov', '.mypy_cache', '.pytest_cache', 'migrations'
}


class SpecsService:
    """Track specification files and project health across projects"""

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        logger.info(f"Specs Service initialized: {db_path}")

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def get_all_specs(self):
        """Get all active projects with their spec and health status"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, unique_id, name, path, status,
                       spec_status, spec_date, spec_lines, spec_notes,
                       health_loc, health_has_tests, health_deps_count,
                       health_last_commit, health_readme_score,
                       health_has_gitignore, health_portability_score,
                       health_score
                FROM projects
                WHERE status = 'active'
                ORDER BY name
            """)

            port_map = self._load_port_map()
            specs = [
                self._row_to_spec(row, port_map)
                for row in cursor.fetchall()
            ]

            conn.close()
            return specs

        except Exception as e:
            logger.error(f"Error getting specs: {e}")
            raise

    def _row_to_spec(self, row, port_map):
        """Convert a project DB row to a spec dict with port info"""
        port_info = port_map.get(row['name'], {})
        return {
            'id': row['id'],
            'unique_id': row['unique_id'],
            'name': row['name'],
            'path': row['path'],
            'project_status': row['status'],
            'spec_status': row['spec_status'] or 'missing',
            'spec_date': row['spec_date'],
            'spec_lines': row['spec_lines'] or 0,
            'spec_notes': row['spec_notes'] or '',
            'health_loc': row['health_loc'] or 0,
            'health_has_tests': row['health_has_tests'] or 0,
            'health_deps_count': row['health_deps_count'] or 0,
            'health_last_commit': row['health_last_commit'],
            'health_readme_score': row['health_readme_score'] or 0,
            'health_has_gitignore': row['health_has_gitignore'] or 0,
            'health_portability_score': row['health_portability_score'] or 0,
            'health_score': row['health_score'] or 0,
            'health_port': port_info.get('port'),
            'health_service_up': self._check_port(port_info.get('port')) if port_info.get('port') else None
        }

    def update_spec(self, project_id, field, value):
        """Update a specific spec field"""
        try:
            valid_fields = ['spec_status', 'spec_date', 'spec_lines', 'spec_notes']
            if field not in valid_fields:
                raise ValueError(f"Invalid field: {field}")

            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute(f"""
                UPDATE projects
                SET {field} = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (value, project_id))

            if cursor.rowcount == 0:
                conn.close()
                raise Exception(f"Project {project_id} not found")

            conn.commit()
            conn.close()

            logger.info(f"Spec updated: {project_id} {field}={value}")
            return True
        except Exception as e:
            logger.error(f"Error updating spec {project_id}: {e}")
            raise

    def scan_specs(self):
        """Scan filesystem for SPEC.md files and update database"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, name, path FROM projects WHERE status = 'active'
            """)

            results = {'updated': 0, 'found': 0, 'missing': 0}

            for row in cursor.fetchall():
                spec_path = os.path.join(row['path'], 'docs', 'spec', 'SPEC.md')

                if os.path.exists(spec_path):
                    results['found'] += 1
                    try:
                        stat = os.stat(spec_path)
                        mtime = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d')
                        with open(spec_path, 'r', encoding='utf-8') as f:
                            lines = len(f.readlines())

                        cursor.execute("""
                            UPDATE projects
                            SET spec_status = 'complete', spec_date = ?, spec_lines = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        """, (mtime, lines, row['id']))
                        results['updated'] += 1
                    except Exception as e:
                        logger.warning(f"Error reading {spec_path}: {e}")
                else:
                    results['missing'] += 1
                    cursor.execute("""
                        UPDATE projects
                        SET spec_status = 'missing', spec_lines = 0,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND (spec_status IS NULL OR spec_status = 'missing')
                    """, (row['id'],))

            conn.commit()
            conn.close()

            logger.info(f"Spec scan complete: {results}")
            return results

        except Exception as e:
            logger.error(f"Error scanning specs: {e}")
            raise

    def scan_health(self):
        """Scan all projects for health metrics and update database"""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, name, path, spec_status FROM projects WHERE status = 'active'
            """)

            results = {'scanned': 0, 'errors': 0}

            for row in cursor.fetchall():
                path = row['path']
                if not os.path.isdir(path):
                    results['errors'] += 1
                    continue

                try:
                    self._scan_project_health(cursor, row)
                    results['scanned'] += 1
                except Exception as e:
                    logger.warning(f"Error scanning health for {row['name']}: {e}")
                    results['errors'] += 1

            conn.commit()
            conn.close()

            logger.info(f"Health scan complete: {results}")
            return results

        except Exception as e:
            logger.error(f"Error in health scan: {e}")
            raise

    def _scan_project_health(self, cursor, row):
        """Collect health metrics for a single project and update DB"""
        path = row['path']
        health_data = {
            'spec_status': row['spec_status'] or 'missing',
            'loc': self._count_loc(path),
            'has_tests': 1 if self._has_tests(path) else 0,
            'deps_count': self._count_deps(path),
            'last_commit': self._last_commit(path),
            'readme_score': self._readme_score(path),
            'has_gitignore': 1 if os.path.exists(os.path.join(path, '.gitignore')) else 0,
            'portability_score': self._portability_score(path),
        }
        health_data['health_score'] = self._compute_health_score(health_data)

        cursor.execute("""
            UPDATE projects SET
                health_loc = ?, health_has_tests = ?, health_deps_count = ?,
                health_last_commit = ?, health_readme_score = ?,
                health_has_gitignore = ?, health_portability_score = ?,
                health_score = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (health_data['loc'], health_data['has_tests'],
              health_data['deps_count'], health_data['last_commit'],
              health_data['readme_score'], health_data['has_gitignore'],
              health_data['portability_score'], health_data['health_score'],
              row['id']))

    def _count_loc(self, project_path):
        """Count lines of source code, excluding generated/vendor dirs"""
        total = 0
        for root, dirs, files in os.walk(project_path):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in SOURCE_EXTENSIONS:
                    try:
                        filepath = os.path.join(root, f)
                        with open(filepath, 'r', encoding='utf-8', errors='ignore') as fh:
                            total += sum(1 for _ in fh)
                    except Exception:
                        pass
        return total

    def _has_tests(self, project_path):
        for root, dirs, files in os.walk(project_path):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            for d in dirs:
                if d in ('tests', 'test', '__tests__'):
                    return True
            for f in files:
                if f.startswith('test_') or f.endswith('_test.py') or f.endswith('.test.js') or f.endswith('.test.ts'):
                    return True
                if f in ('pytest.ini', 'jest.config.js', 'jest.config.ts', 'vitest.config.ts'):
                    return True
        return False

    def _count_deps(self, project_path):
        count = 0

        # Python requirements.txt
        req_path = os.path.join(project_path, 'requirements.txt')
        if os.path.exists(req_path):
            try:
                with open(req_path, 'r') as f:
                    count += sum(1 for line in f if line.strip() and not line.startswith('#') and not line.startswith('-'))
            except Exception:
                pass

        # Node package.json
        pkg_path = os.path.join(project_path, 'package.json')
        if os.path.exists(pkg_path):
            try:
                with open(pkg_path, 'r') as f:
                    pkg = json.load(f)
                count += len(pkg.get('dependencies', {}))
                count += len(pkg.get('devDependencies', {}))
            except Exception:
                pass

        # Flutter pubspec.yaml (simple line counting)
        pubspec_path = os.path.join(project_path, 'pubspec.yaml')
        if os.path.exists(pubspec_path):
            try:
                with open(pubspec_path, 'r') as f:
                    in_deps = False
                    for line in f:
                        stripped = line.strip()
                        if stripped in ('dependencies:', 'dev_dependencies:'):
                            in_deps = True
                            continue
                        if in_deps:
                            if (line.startswith('  ') or line.startswith('\t')) and ':' in stripped and not stripped.startswith('#'):
                                if stripped != 'flutter:' and not stripped.startswith('sdk:'):
                                    count += 1
                            elif stripped and not stripped.startswith('#'):
                                in_deps = False
            except Exception:
                pass

        return count

    def _last_commit(self, project_path):
        try:
            result = subprocess.run(
                ['git', '-C', project_path, 'log', '-1', '--format=%cd', '--date=short'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except Exception:
            pass
        return None

    def _readme_score(self, project_path):
        """Check README completeness (0-100)"""
        readme_path = os.path.join(project_path, 'README.md')
        if not os.path.exists(readme_path):
            return 0

        try:
            with open(readme_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception:
            return 0

        score = 30  # README exists

        if 'Objectif' in content:
            score += 25
        if 'Structure' in content:
            score += 25
        if 'marrage' in content or 'Installation' in content or 'Lancement' in content:
            score += 20

        return score

    def _portability_score(self, project_path):
        """Check project portability (0-100)"""
        score = 100

        # Check hardcoded absolute paths in source files
        path_files = self._count_pattern_files(
            project_path,
            r'/data/projects/|/data/docker/|/home/fabrice'
        )
        score -= min(40, path_files * 8)

        # Check hardcoded localhost URLs in source files
        url_files = self._count_pattern_files(
            project_path,
            r'localhost:[0-9]{4,5}'
        )
        score -= min(20, url_files * 5)

        # Has .env.example or .env.template
        has_env_example = any(
            os.path.exists(os.path.join(project_path, f))
            for f in ('.env.example', '.env.template', '.env.sample')
        )
        if not has_env_example:
            score -= 20

        # Has setup.sh or install.sh
        has_setup = any(
            os.path.exists(os.path.join(project_path, f))
            for f in ('setup.sh', 'install.sh', 'Makefile', 'docker-compose.yml')
        )
        if not has_setup:
            score -= 20

        return max(0, score)

    def _count_pattern_files(self, project_path, pattern):
        """Count source files matching a regex pattern"""
        try:
            excludes = []
            for d in EXCLUDE_DIRS:
                excludes.extend(['--exclude-dir', d])

            includes = []
            for ext in SOURCE_EXTENSIONS:
                includes.extend(['--include', '*' + ext])

            result = subprocess.run(
                ['grep', '-rlP', pattern] + excludes + includes + [project_path],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                return 0
            files = [l for l in result.stdout.strip().split('\n') if l]
            return len(files)
        except Exception:
            return 0

    def _check_port(self, port):
        if not port:
            return None
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.5)
            result = sock.connect_ex(('127.0.0.1', int(port)))
            sock.close()
            return result == 0
        except Exception:
            return False

    def _load_port_map(self):

        try:
            if os.path.exists(PORT_REGISTRY):
                with open(PORT_REGISTRY, 'r') as f:
                    registry = json.load(f)
                port_map = {}
                for entry in registry.get('ports', []):
                    project = entry.get('project', '')
                    # Map project names, keep only dev projects (not system/docker)
                    if entry.get('stack') in ('projects', 'homehub'):
                        port_map[project] = {
                            'port': entry['port'],
                            'service': entry.get('service', ''),
                            'health_endpoint': entry.get('health_endpoint')
                        }
                return port_map
        except Exception as e:
            logger.warning(f"Could not load port registry: {e}")
        return {}

    def _compute_health_score(self, health_data):
        """Compute composite health score 0-100 from health_data dict"""
        score = 0

        # SPEC.md present: 15 pts
        spec_status = health_data.get('spec_status', 'missing')
        if spec_status == 'complete':
            score += 15
        elif spec_status == 'draft':
            score += 7

        # README completeness: 10 pts (proportional)
        score += int(health_data.get('readme_score', 0) * 10 / 100)

        # Has tests: 15 pts
        if health_data.get('has_tests'):
            score += 15

        # Has .gitignore: 5 pts
        if health_data.get('has_gitignore'):
            score += 5

        # Git recency: 15 pts
        score += self._git_recency_score(health_data.get('last_commit'))

        # Dependencies tracked: 10 pts
        if health_data.get('deps_count', 0) > 0:
            score += 10

        # Has code: 10 pts
        loc = health_data.get('loc', 0)
        if loc > 100:
            score += 10
        elif loc > 0:
            score += 5

        # Portability: 20 pts (proportional to 0-100 score)
        score += int(health_data.get('portability_score', 0) * 20 / 100)

        return min(score, 100)

    @staticmethod
    def _git_recency_score(last_commit):
        """Calculate git recency score (0-15) from last commit date string"""
        if not last_commit:
            return 0
        try:
            commit_date = datetime.strptime(last_commit, '%Y-%m-%d')
            days_ago = (datetime.now() - commit_date).days
            if days_ago <= 30:
                return 15
            elif days_ago <= 90:
                return 10
            elif days_ago <= 180:
                return 5
        except Exception:
            pass
        return 0


specs_service = SpecsService()
