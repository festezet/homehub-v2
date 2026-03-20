"""
Shared test configuration and fixtures for HomeHub v2.

Sets up sys.path so that both the project root and backend/ directory
are importable, matching the runtime environment of the Flask app.
"""

import sys
from pathlib import Path

# Project root: /data/projects/homehub-v2
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"

sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))
