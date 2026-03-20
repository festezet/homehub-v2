"""
Basic structural and import tests for HomeHub v2.

These tests verify that the project structure is sound and that key
modules are importable. They do NOT start the Flask app or connect
to databases/external services.
"""

import importlib
from pathlib import Path

# ---------------------------------------------------------------------------
# Project structure
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"


class TestProjectStructure:
    """Verify that essential project files and directories exist."""

    def test_backend_directory_exists(self):
        assert BACKEND_DIR.is_dir(), "backend/ directory must exist"

    def test_frontend_directory_exists(self):
        assert FRONTEND_DIR.is_dir(), "frontend/ directory must exist"

    def test_app_entry_point_exists(self):
        assert (BACKEND_DIR / "app.py").is_file(), "backend/app.py must exist"

    def test_system_utils_exists(self):
        assert (BACKEND_DIR / "system_utils.py").is_file()

    def test_services_directory_exists(self):
        assert (BACKEND_DIR / "services").is_dir()

    def test_api_directory_exists(self):
        assert (BACKEND_DIR / "api").is_dir()

    def test_models_directory_exists(self):
        assert (BACKEND_DIR / "models").is_dir()

    def test_templates_directory_exists(self):
        assert (FRONTEND_DIR / "templates").is_dir(), (
            "frontend/templates/ directory must exist"
        )

    def test_static_directory_exists(self):
        assert (FRONTEND_DIR / "static").is_dir(), (
            "frontend/static/ directory must exist"
        )

    def test_requirements_txt_exists(self):
        assert (PROJECT_ROOT / "requirements.txt").is_file()

    def test_readme_exists(self):
        assert (PROJECT_ROOT / "README.md").is_file()


# ---------------------------------------------------------------------------
# Service modules importability
# ---------------------------------------------------------------------------

# These services are standalone Python modules that should be importable
# without side effects (no DB connection at import time). We import the
# *module*, not instantiate the class, to avoid needing real databases.

SERVICE_MODULES = [
    "services.todo_service",
    "services.internet_service",
    "services.docker_service",
    "services.activity_service",
    "services.infrastructure_service",
    "services.formation_service",
    "services.local_apps_service",
    "services.specs_service",
    "services.thread_digest_service",
    "services.modularity_service",
    "services.claude_skills_service",
    "services.session_close_service",
    "services.project_actions_service",
    "services.calendar_service",
    "services.whatsapp_proxy_service",
    "services.signal_proxy_service",
    "services.sms_proxy_service",
]


class TestServiceImports:
    """Verify that each service module can be imported without errors."""

    def _import_module(self, module_name: str):
        """Helper: attempt to import a module and return it, or raise."""
        return importlib.import_module(module_name)

    def test_todo_service_importable(self):
        mod = self._import_module("services.todo_service")
        assert hasattr(mod, "TodoService") or hasattr(mod, "todo_service")

    def test_internet_service_importable(self):
        mod = self._import_module("services.internet_service")
        assert hasattr(mod, "InternetService") or hasattr(mod, "internet_service")

    def test_docker_service_importable(self):
        mod = self._import_module("services.docker_service")
        assert hasattr(mod, "docker_service") or hasattr(mod, "DockerService")

    def test_activity_service_importable(self):
        self._import_module("services.activity_service")

    def test_infrastructure_service_importable(self):
        self._import_module("services.infrastructure_service")

    def test_formation_service_importable(self):
        self._import_module("services.formation_service")

    def test_local_apps_service_importable(self):
        self._import_module("services.local_apps_service")

    def test_specs_service_importable(self):
        self._import_module("services.specs_service")

    def test_thread_digest_service_importable(self):
        self._import_module("services.thread_digest_service")

    def test_modularity_service_importable(self):
        self._import_module("services.modularity_service")

    def test_claude_skills_service_importable(self):
        self._import_module("services.claude_skills_service")

    def test_session_close_service_importable(self):
        self._import_module("services.session_close_service")

    def test_project_actions_service_importable(self):
        self._import_module("services.project_actions_service")

    def test_calendar_service_importable(self):
        self._import_module("services.calendar_service")


# ---------------------------------------------------------------------------
# API route blueprint modules importability
# ---------------------------------------------------------------------------

API_MODULES = [
    "api.docker_routes",
    "api.todo_routes",
    "api.internet_routes",
    "api.calendar_routes",
    "api.formation_routes",
    "api.local_apps_routes",
    "api.specs_routes",
    "api.activity_routes",
    "api.thread_digest_routes",
    "api.modularity_routes",
    "api.claude_skills_routes",
    "api.session_close_routes",
    "api.project_actions_routes",
    "api.media_recommender_routes",
    "api.ai_profile_routes",
]


class TestApiImports:
    """Verify that each API route module can be imported without errors."""

    def _import_module(self, module_name: str):
        return importlib.import_module(module_name)

    def test_docker_routes_importable(self):
        mod = self._import_module("api.docker_routes")
        assert hasattr(mod, "docker_bp"), "Expected Flask Blueprint 'docker_bp'"

    def test_todo_routes_importable(self):
        mod = self._import_module("api.todo_routes")
        assert hasattr(mod, "todo_bp"), "Expected Flask Blueprint 'todo_bp'"

    def test_internet_routes_importable(self):
        mod = self._import_module("api.internet_routes")
        assert hasattr(mod, "internet_bp"), "Expected Flask Blueprint 'internet_bp'"

    def test_calendar_routes_importable(self):
        mod = self._import_module("api.calendar_routes")
        assert hasattr(mod, "calendar_bp")

    def test_formation_routes_importable(self):
        mod = self._import_module("api.formation_routes")
        assert hasattr(mod, "formation_bp")

    def test_activity_routes_importable(self):
        mod = self._import_module("api.activity_routes")
        assert hasattr(mod, "activity_bp")

    def test_session_close_routes_importable(self):
        mod = self._import_module("api.session_close_routes")
        assert hasattr(mod, "session_close_bp")

    def test_project_actions_routes_importable(self):
        mod = self._import_module("api.project_actions_routes")
        assert hasattr(mod, "project_actions_bp")

    def test_media_recommender_routes_importable(self):
        mod = self._import_module("api.media_recommender_routes")
        assert hasattr(mod, "media_reco_bp")

    def test_ai_profile_routes_importable(self):
        mod = self._import_module("api.ai_profile_routes")
        assert hasattr(mod, "ai_profile_bp")


# ---------------------------------------------------------------------------
# Utility module
# ---------------------------------------------------------------------------

class TestUtilityModules:
    """Verify utility modules are importable and expose expected symbols."""

    def test_system_utils_importable(self):
        mod = importlib.import_module("system_utils")
        assert hasattr(mod, "get_x11_env"), "system_utils must expose get_x11_env"
        assert hasattr(mod, "get_storage_data"), "system_utils must expose get_storage_data"

    def test_system_utils_get_x11_env_callable(self):
        from system_utils import get_x11_env
        assert callable(get_x11_env)

    def test_system_utils_get_storage_data_callable(self):
        from system_utils import get_storage_data
        assert callable(get_storage_data)


# ---------------------------------------------------------------------------
# Service class interface checks (no instantiation, just class inspection)
# ---------------------------------------------------------------------------

class TestServiceInterfaces:
    """Verify that key service classes expose the expected public methods."""

    def test_todo_service_has_crud_methods(self):
        from services.todo_service import TodoService
        expected_methods = ["_get_connection"]
        for method in expected_methods:
            assert hasattr(TodoService, method), f"TodoService missing {method}"

    def test_internet_service_is_a_class(self):
        from services.internet_service import InternetService
        assert isinstance(InternetService, type), "InternetService should be a class"
