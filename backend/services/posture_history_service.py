"""
Posture History Service — read-only access to project-auditor's auditor.db.

Wraps src/posture_history.py from PRJ-031 (project-auditor) so HomeHub can
display posture score evolution without re-implementing storage.
"""

import logging
import os
import sys

logger = logging.getLogger(__name__)


class PostureHistoryService:
    """Service that proxies posture_history calls from project-auditor."""

    AUDITOR_SRC = '/data/projects/project-auditor/src'

    def __init__(self):
        self._ph_module = None

    def _load(self):
        """Lazy-load the posture_history module from project-auditor."""
        if self._ph_module is not None:
            return self._ph_module
        if not os.path.isdir(self.AUDITOR_SRC):
            raise FileNotFoundError(f"project-auditor src/ not found at {self.AUDITOR_SRC}")
        if self.AUDITOR_SRC not in sys.path:
            sys.path.insert(0, self.AUDITOR_SRC)
        import posture_history
        posture_history.init_db(posture_history.AUDITOR_DB)
        self._ph_module = posture_history
        return self._ph_module

    def get_runs(self, limit=10):
        """Return most recent runs as list of dicts."""
        ph = self._load()
        rows = ph.get_runs(limit=limit, db_path=ph.AUDITOR_DB)
        return [dict(r) for r in rows]

    def get_latest_snapshots(self):
        """Return per-project snapshots from the most recent run."""
        ph = self._load()
        rows = ph.get_latest_snapshots(db_path=ph.AUDITOR_DB)
        return [dict(r) for r in rows]

    def get_trends(self):
        """Return delta comparison between two most recent runs (or None)."""
        ph = self._load()
        return ph.get_trends(db_path=ph.AUDITOR_DB)

    def get_project_history(self, project_id, limit=10):
        """Return posture score history for a single project."""
        ph = self._load()
        rows = ph.get_project_history(project_id, limit=limit, db_path=ph.AUDITOR_DB)
        return [dict(r) for r in rows]


posture_history_service = PostureHistoryService()
