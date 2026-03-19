#!/usr/bin/env python3
"""
HomeHub v2 - Flask Backend
Main application entry point with unified API
"""

from flask import Flask, render_template, jsonify, send_file
from flask_cors import CORS
import logging
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import system utilities (extracted from app.py for modularity)
from system_utils import (
    get_x11_env, get_storage_data,
    _resolve_launch_command, _execute_launch
)

# Import services
from services.docker_service import docker_service
from services.todo_service import todo_service
from services.internet_service import internet_service
from services.activity_service import activity_service
from services.infrastructure_service import infrastructure_service
from services.formation_service import formation_service
from services.local_apps_service import local_apps_service
from services.specs_service import specs_service
from services.thread_digest_service import thread_digest_service
from services.whatsapp_proxy_service import whatsapp_proxy_service
from services.modularity_service import modularity_service
# media_recommender_service removed — proxied to standalone project (port 5056)

# Import API routes
from api.docker_routes import docker_bp, init_docker_routes
from api.todo_routes import todo_bp, init_todo_routes
from api.internet_routes import internet_bp, init_internet_routes
from api.calendar_routes import calendar_bp, init_calendar_routes
from api.formation_routes import formation_bp, init_formation_routes
from api.local_apps_routes import local_apps_bp, init_local_apps_routes
from api.specs_routes import specs_bp, init_specs_routes
from api.activity_routes import activity_bp, init_activity_routes
from api.thread_digest_routes import thread_digest_bp, init_thread_digest_routes
from api.modularity_routes import modularity_bp, init_modularity_routes
from api.media_recommender_routes import media_reco_bp
from api.ai_profile_routes import ai_profile_bp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__,
            template_folder='../frontend/templates',
            static_folder='../frontend/static')

# Enable CORS for API endpoints
CORS(app)

# Initialize services with routes
init_docker_routes(docker_service)
init_todo_routes(todo_service)
init_internet_routes(internet_service)
init_formation_routes(formation_service)
init_local_apps_routes(local_apps_service)
init_specs_routes(specs_service)
init_activity_routes(activity_service)
init_thread_digest_routes(thread_digest_service, whatsapp_proxy_service)
init_modularity_routes(modularity_service)
# media_reco routes are now a proxy — no init needed

# Register blueprints
app.register_blueprint(docker_bp)
app.register_blueprint(todo_bp)
app.register_blueprint(internet_bp)
app.register_blueprint(calendar_bp)
app.register_blueprint(formation_bp)
app.register_blueprint(local_apps_bp)
app.register_blueprint(specs_bp)
app.register_blueprint(activity_bp)
app.register_blueprint(thread_digest_bp)
app.register_blueprint(modularity_bp)
app.register_blueprint(media_reco_bp)
app.register_blueprint(ai_profile_bp)

# ============================================
# ROUTES - Pages
# ============================================

@app.route('/')
def index():
    """Main HomeHub page"""
    return render_template('base.html')

# ============================================
# ROUTES - API
# ============================================

@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'HomeHub v2',
        'version': '2.0.0',
        'apis': {
            'docker': docker_service.available,
            'todo': True
        }
    })

@app.route('/api/infrastructure/dashboard')
def get_infrastructure_dashboard():
    """Get infrastructure monitoring data"""
    try:
        data = infrastructure_service.get_dashboard_data()
        return jsonify({
            'status': 'ok',
            'data': data
        })
    except Exception as e:
        logger.error(f"Error getting infrastructure data: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/services/ports')
def get_services_ports():
    """Get port registry from infrastructure data"""
    import json

    registry_path = '/data/projects/infrastructure/data/port_registry.json'
    try:
        with open(registry_path, 'r') as f:
            data = json.load(f)
        return jsonify({
            'status': 'ok',
            'ports': data.get('ports', []),
            'stacks': data.get('stacks', {}),
            'allocation_ranges': data.get('allocation_ranges', {})
        })
    except FileNotFoundError:
        return jsonify({
            'status': 'error',
            'message': 'port_registry.json not found'
        }), 404
    except Exception as e:
        logger.error(f"Error reading port registry: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/apps')
def get_applications():
    """Get list of installed applications"""
    # Static list for now - could be extended with dynamic detection
    apps = [
        {'id': 'APP-001', 'name': 'GIMP', 'icon': '🎨', 'command': 'gimp'},
        {'id': 'APP-002', 'name': 'Kdenlive', 'icon': '🎬', 'command': 'kdenlive'},
        {'id': 'APP-003', 'name': 'Sublime Text', 'icon': '📝', 'command': 'subl'},
        {'id': 'APP-004', 'name': 'Firefox', 'icon': '🦊', 'command': 'firefox'},
        {'id': 'APP-006', 'name': 'Cursor', 'icon': '⌨️', 'command': 'cursor'}
    ]
    return jsonify({
        'status': 'ok',
        'apps': apps,
        'count': len(apps)
    })

def extract_description_from_readme(project_path):
    """Extract description from README.md (first 15 lines)"""
    import re

    readme_path = os.path.join(project_path, 'README.md')
    if not os.path.exists(readme_path):
        return None

    try:
        with open(readme_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')[:20]

        description = None

        # Stratégie 1: Chercher section "## Description" ou "## 📝 Description"
        for i, line in enumerate(lines):
            if '## ' in line and 'description' in line.lower():
                # Prendre la ligne suivante non vide
                for j in range(i + 1, min(i + 5, len(lines))):
                    candidate = lines[j].strip()
                    if candidate and not candidate.startswith('#') and not candidate.startswith('*') and len(candidate) > 15:
                        description = candidate
                        break
                break

        # Stratégie 2: Ligne juste après le titre H1 (si pas de section Description)
        if not description:
            for i, line in enumerate(lines):
                if line.startswith('# ') and i + 1 < len(lines):
                    # Chercher première ligne de texte après le titre
                    for j in range(i + 1, min(i + 6, len(lines))):
                        candidate = lines[j].strip()
                        # Ignorer métadonnées, lignes vides, badges, sous-titres
                        if not candidate or candidate.startswith('#') or candidate.startswith('**') or candidate.startswith('[') or candidate.startswith('!') or candidate.startswith('-'):
                            continue
                        if len(candidate) > 20:
                            description = candidate
                            break
                    break

        # Nettoyer
        if description:
            # Retirer markdown
            description = re.sub(r'\*\*([^*]+)\*\*', r'\1', description)
            description = re.sub(r'\*([^*]+)\*', r'\1', description)
            description = re.sub(r'`([^`]+)`', r'\1', description)
            description = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', description)
            # Tronquer à 120 caractères
            if len(description) > 120:
                description = description[:117] + '...'
            return description

    except Exception as e:
        logger.debug(f"Could not read README for {project_path}: {e}")

    return None

def _row_to_project(row):
    """Convert a DB row to a project dict"""
    return {
        'id': row['unique_id'], 'name': row['name'],
        'category': row['category'], 'status': row['status'],
        'path': row['path'], 'description': row['description'] or row['name'],
        'tags': row['features'] or '', 'launcher_path': row['launcher_path'],
        'launcher_type': row['launcher_type'], 'web_url': row['web_url']
    }


def _fetch_projects_from_db():
    """Fetch active projects from projects.db"""
    import sqlite3
    db_path = '/data/projects/project-management/data/projects.db'
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('''
            SELECT unique_id, name, category, status, path, description,
                   features, launcher_path, launcher_type, web_url
            FROM projects WHERE status != 'archived' ORDER BY name
        ''')
        projects = [_row_to_project(row) for row in cursor.fetchall()]
        conn.close()
        return projects
    except Exception as e:
        logger.error(f"Error fetching projects: {e}")
        return []


ADDITIONAL_APPS = [
    {
        'id': 'APP-005', 'name': 'Claude Voice Input',
        'category': 'development', 'status': 'active',
        'path': '/data/projects/voice-dictation',
        'description': 'Entree vocale pour Claude Code - Transcription Whisper GPU',
        'tags': 'voice,whisper,claude,transcription',
        'launcher_path': '/data/projects/voice-dictation/scripts/start_claude_voice_input.sh',
        'launcher_type': 'bash'
    },
]


@app.route('/api/projects')
def get_projects():
    """Get list of projects from projects.db"""
    projects = _fetch_projects_from_db()
    projects.extend(ADDITIONAL_APPS)
    return jsonify({
        'status': 'ok', 'projects': projects, 'count': len(projects)
    })

@app.route('/api/system/storage')
def get_storage_info():
    """Get disk storage information in hierarchical format by disk"""
    storage = get_storage_data()
    return jsonify({
        'status': 'ok' if storage else 'error',
        **storage
    })

@app.route('/api/apps/launch/<app_id>', methods=['POST'])
def launch_application(app_id):
    """Launch an application by ID"""
    import subprocess

    # Map app IDs to commands
    apps_map = {
        'APP-001': {'name': 'GIMP', 'command': 'gimp'},
        'APP-002': {'name': 'Kdenlive', 'command': 'kdenlive'},
        'APP-003': {'name': 'Sublime Text', 'command': 'subl'},
        'APP-004': {'name': 'Firefox', 'command': 'firefox'},
        'APP-006': {'name': 'Cursor', 'command': 'cursor'}
    }

    if app_id not in apps_map:
        return jsonify({
            'status': 'error',
            'message': f'Application {app_id} not found'
        }), 404

    app = apps_map[app_id]

    try:
        env = get_x11_env()

        # Launch application using setsid to fully detach from parent process
        subprocess.Popen(
            ['setsid', '-f', app['command']],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env,
            close_fds=True
        )

        logger.info(f"✅ Launched application: {app['name']} ({app['command']})")

        return jsonify({
            'status': 'success',
            'message': f"{app['name']} launched successfully",
            'app_id': app_id
        })

    except FileNotFoundError:
        logger.error(f"❌ Application not found: {app['command']}")
        return jsonify({
            'status': 'error',
            'message': f"Application {app['name']} not installed"
        }), 404

    except Exception as e:
        logger.error(f"❌ Error launching {app['name']}: {e}")
        return jsonify({
            'status': 'error',
            'message': f"Failed to launch {app['name']}: {str(e)}"
        }), 500

@app.route('/api/projects/launch/<project_id>', methods=['POST'])
def launch_project(project_id):
    """Launch a project by its ID (PRJ-XXX or APP-XXX)"""
    # Applications additionnelles (APP-XXX) non dans la DB
    additional_apps = {
        'APP-005': {
            'name': 'Claude Voice Input',
            'path': '/data/projects/voice-dictation',
            'launcher_path': '/data/projects/voice-dictation/scripts/start_claude_voice_input.sh'
        },
    }

    try:
        project_info, error = _resolve_launch_command(project_id, additional_apps)
        if error:
            return jsonify(error[0]), error[1]

        result = _execute_launch(project_id, project_info)
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error launching project {project_id}: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/projects/open/<project_id>', methods=['POST'])
def open_project_folder(project_id):
    """Open project folder in file manager"""
    import subprocess
    import sqlite3

    db_path = '/data/projects/project-management/data/projects.db'

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('SELECT name, path FROM projects WHERE unique_id = ?', (project_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({
                'status': 'error',
                'message': f'Project {project_id} not found'
            }), 404

        # Open folder with default file manager
        env = get_x11_env()

        subprocess.Popen(
            ['xdg-open', row['path']],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )

        logger.info(f"Opened folder: {row['path']}")

        return jsonify({
            'status': 'success',
            'message': f"Opened {row['name']} folder",
            'path': row['path']
        })

    except Exception as e:
        logger.error(f"Error opening project folder {project_id}: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# ============================================
# FILE SERVING - Generated files
# ============================================

@app.route('/api/files/calendar')
def serve_calendar():
    """Serve the generated location calendar HTML file"""
    calendar_path = os.path.expanduser('~/Downloads/calendrier_location_2025.html')
    if os.path.exists(calendar_path):
        return send_file(calendar_path, mimetype='text/html')
    return jsonify({'error': 'Calendar not generated yet'}), 404

# ============================================
# ERROR HANDLERS
# ============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f'Internal error: {error}')
    return jsonify({'error': 'Internal server error'}), 500

# ============================================
# MAIN
# ============================================

if __name__ == '__main__':
    logger.info('🚀 Starting HomeHub v2...')
    logger.info('📊 Dashboard: http://localhost:5000')
    logger.info('📝 Unified API with TODO and Docker Control')
    logger.info(f'🐳 Docker available: {docker_service.available}')

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
