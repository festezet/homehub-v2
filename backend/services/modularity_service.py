"""
Modularity Audit Service - Run modularity checks across projects via subprocess
"""

import subprocess
import json
import sqlite3
import logging

logger = logging.getLogger(__name__)

DB_PATH = '/data/projects/project-management/data/projects.db'
AUDIT_SCRIPT = '/data/projects/project-auditor/src/modularity_audit.py'


class ModularityService:
    """Service to run modularity audits on projects"""

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self.results = {}
        logger.info("Modularity Service initialized")

    def get_results(self):
        """Return cached audit results"""
        return self.results

    def scan_project(self, project_path, project_id=None, project_name=None):
        """Run modularity audit on a single project"""
        try:
            result = subprocess.run(
                ['python3', AUDIT_SCRIPT, '--json', project_path],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0 and result.stdout.strip():
                data = json.loads(result.stdout)
                if project_id:
                    data['unique_id'] = project_id
                if project_name:
                    data['name'] = project_name
                return data
        except subprocess.TimeoutExpired:
            logger.warning(f"Timeout scanning {project_path}")
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from audit of {project_path}")
        except Exception as e:
            logger.warning(f"Error scanning {project_path}: {e}")
        return None

    def scan_all_projects(self):
        """Scan all active projects and cache results"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT unique_id, name, path FROM projects
                WHERE status = 'active'
                ORDER BY name
            """)
            projects = cursor.fetchall()
            conn.close()
        except Exception as e:
            logger.error(f"Error reading projects DB: {e}")
            return {}

        results = {}
        for row in projects:
            data = self.scan_project(row['path'], row['unique_id'], row['name'])
            if data:
                results[row['unique_id']] = data

        self.results = results
        logger.info(f"Modularity scan complete: {len(results)} projects")
        return results


modularity_service = ModularityService()
