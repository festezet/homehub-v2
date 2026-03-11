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

# Import services
from services.docker_service import docker_service
from services.todo_service import todo_service
from services.internet_service import internet_service
from services.activity_service import activity_service
from services.infrastructure_service import infrastructure_service
from services.formation_service import formation_service

# Import API routes
from api.docker_routes import docker_bp, init_docker_routes
from api.todo_routes import todo_bp, init_todo_routes
from api.internet_routes import internet_bp, init_internet_routes
from api.calendar_routes import calendar_bp, init_calendar_routes
from api.formation_routes import formation_bp, init_formation_routes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Detect X11 display environment for GUI app launching
def get_x11_env():
    """Get environment variables for launching GUI apps.
    Captures full environment from active X11 session."""
    import subprocess as _sp
    env = os.environ.copy()

    # Critical variables for GUI apps
    critical_vars = [
        'DISPLAY',
        'XAUTHORITY',
        'DBUS_SESSION_BUS_ADDRESS',
        'XDG_RUNTIME_DIR',
        'XDG_SESSION_TYPE',
        'HOME',
        'USER',
        'LOGNAME'
    ]

    # Try to get environment from active user session
    # Find the user's systemd --user process to extract environment
    try:
        # Get the user's systemd --user PID
        result = _sp.run(
            ['pgrep', '-u', 'fabrice-ryzen', '-f', 'systemd --user'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0 and result.stdout.strip():
            systemd_pid = result.stdout.strip().split()[0]

            # Read environment from /proc/<PID>/environ
            environ_file = f'/proc/{systemd_pid}/environ'
            if os.path.exists(environ_file):
                with open(environ_file, 'rb') as f:
                    environ_data = f.read()
                    # Parse null-separated environment variables
                    for item in environ_data.split(b'\0'):
                        if b'=' in item:
                            key, value = item.decode('utf-8', errors='ignore').split('=', 1)
                            if key in critical_vars:
                                env[key] = value

    except Exception as e:
        logger.warning(f"Could not extract user session environment: {e}")

    # Fallback detection for critical variables if not found
    if 'DISPLAY' not in env:
        for display in [':0', ':1', ':2']:
            try:
                result = _sp.run(['xdpyinfo'], env={**env, 'DISPLAY': display},
                       capture_output=True, timeout=2)
                if result.returncode == 0:
                    env['DISPLAY'] = display
                    break
            except Exception:
                continue
        else:
            env['DISPLAY'] = ':0'

    if 'XAUTHORITY' not in env:
        xauth_paths = ['/run/user/1000/gdm/Xauthority', '/home/fabrice-ryzen/.Xauthority']
        for xauth in xauth_paths:
            if os.path.exists(xauth):
                env['XAUTHORITY'] = xauth
                break

    if 'DBUS_SESSION_BUS_ADDRESS' not in env:
        env['DBUS_SESSION_BUS_ADDRESS'] = 'unix:path=/run/user/1000/bus'

    if 'XDG_RUNTIME_DIR' not in env:
        env['XDG_RUNTIME_DIR'] = '/run/user/1000'

    if 'HOME' not in env:
        env['HOME'] = '/home/fabrice-ryzen'

    if 'USER' not in env:
        env['USER'] = 'fabrice-ryzen'
        env['LOGNAME'] = 'fabrice-ryzen'

    return env

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

# Register blueprints
app.register_blueprint(docker_bp)
app.register_blueprint(todo_bp)
app.register_blueprint(internet_bp)
app.register_blueprint(calendar_bp)
app.register_blueprint(formation_bp)

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

@app.route('/api/activity/timeline')
def get_activity_timeline():
    """Get activity timeline (project milestones)"""
    try:
        timeline = activity_service.get_timeline(limit=20)
        return jsonify({
            'status': 'ok',
            'timeline': timeline,
            'count': len(timeline)
        })
    except Exception as e:
        logger.error(f"Error getting timeline: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

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

@app.route('/api/projects')
def get_projects():
    """Get list of projects from projects.db"""
    import sqlite3

    db_path = '/data/projects/project-management/data/projects.db'
    projects = []

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT unique_id, name, category, status, path, description, features, launcher_path, launcher_type, web_url
            FROM projects
            WHERE status != 'archived'
            ORDER BY name
        ''')

        for row in cursor.fetchall():
            # Utiliser la description de la base de données
            description = row['description'] or row['name']

            projects.append({
                'id': row['unique_id'],
                'name': row['name'],
                'category': row['category'],
                'status': row['status'],
                'path': row['path'],
                'description': description,
                'tags': row['features'] or '',
                'launcher_path': row['launcher_path'],
                'launcher_type': row['launcher_type'],
                'web_url': row['web_url']
            })

        conn.close()

    except Exception as e:
        logger.error(f"Error fetching projects: {e}")
        # Return empty list on error

    # Ajouter les applications additionnelles (non dans projects.db)
    additional_apps = [
        {
            'id': 'APP-005',
            'name': 'Claude Voice Input',
            'category': 'development',
            'status': 'active',
            'path': '/data/projects/voice-dictation',
            'description': 'Entrée vocale pour Claude Code - Transcription Whisper GPU',
            'tags': 'voice,whisper,claude,transcription',
            'launcher_path': '/data/projects/voice-dictation/scripts/start_claude_voice_input.sh',
            'launcher_type': 'bash'
        }
    ]
    projects.extend(additional_apps)

    return jsonify({
        'status': 'ok',
        'projects': projects,
        'count': len(projects)
    })

@app.route('/api/system/storage')
def get_storage_info():
    """Get disk storage information in hierarchical format by disk"""
    import subprocess

    def get_partition_info(mount_point):
        """Get disk usage for a specific mount point"""
        try:
            result = subprocess.run(
                ['df', '-h', mount_point],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                if len(lines) > 1:
                    parts = lines[1].split()
                    if len(parts) >= 5:
                        return {
                            'total': parts[1],
                            'used': parts[2],
                            'available': parts[3],
                            'percent': int(parts[4].rstrip('%'))
                        }
        except Exception as e:
            logger.debug(f"Could not get info for {mount_point}: {e}")
        return None

    storage = {}

    try:
        # SDD - System disk (mounted)
        sdd_data = {}
        root_info = get_partition_info('/')
        if root_info:
            sdd_data['root'] = root_info
        home_info = get_partition_info('/home')
        if home_info:
            sdd_data['home'] = home_info
        if sdd_data:
            storage['sdd'] = sdd_data

        # SDB - System backup disk (not mounted, use static estimates)
        # Based on sdd sizes since it's a clone
        if root_info and home_info:
            storage['sdb'] = {
                'root': {
                    'total': '143G',
                    'used': root_info['used'],  # Approximate same usage
                    'available': '~' + root_info['available'],
                    'percent': root_info['percent']
                },
                'home': {
                    'total': '143G',
                    'used': home_info['used'],
                    'available': '~' + home_info['available'],
                    'percent': home_info['percent']
                }
            }

        # SDA - LVM Data volumes (mounted)
        sda_data = {}
        projects_info = get_partition_info('/data/projects')
        if projects_info:
            sda_data['projects'] = projects_info
        docker_info = get_partition_info('/data/docker')
        if docker_info:
            sda_data['docker'] = docker_info
        media_info = get_partition_info('/data/media')
        if media_info:
            sda_data['media'] = media_info
        if sda_data:
            storage['sda'] = sda_data

        # SDC - Data backup disk (mounted)
        sdc_data = {}
        backup_projects_info = get_partition_info('/backup/projects')
        if backup_projects_info:
            sdc_data['projects'] = backup_projects_info
        backup_docker_info = get_partition_info('/backup/docker')
        if backup_docker_info:
            sdc_data['docker'] = backup_docker_info
        backup_media_info = get_partition_info('/backup/media')
        if backup_media_info:
            sdc_data['media'] = backup_media_info
        if sdc_data:
            storage['sdc'] = sdc_data

    except Exception as e:
        logger.error(f"Error getting storage info: {e}")

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
    import subprocess
    import sqlite3
    import os

    # Applications additionnelles (APP-XXX) non dans la DB
    additional_apps = {
        'APP-005': {
            'name': 'Claude Voice Input',
            'path': '/data/projects/voice-dictation',
            'launcher_path': '/data/projects/voice-dictation/scripts/start_claude_voice_input.sh'
        }
    }

    # Vérifier si c'est une APP-XXX
    if project_id in additional_apps:
        app_info = additional_apps[project_id]
        launcher_path = app_info['launcher_path']

        if not os.path.exists(launcher_path):
            return jsonify({
                'status': 'error',
                'message': f'Launcher not found: {launcher_path}'
            }), 404

        env = get_x11_env()

        # Launch with proper logging
        log_stdout = f"/tmp/homehub_{project_id}_stdout.log"
        log_stderr = f"/tmp/homehub_{project_id}_stderr.log"

        with open(log_stdout, 'w') as out, open(log_stderr, 'w') as err:
            subprocess.Popen(
                ['bash', launcher_path],
                stdout=out,
                stderr=err,
                start_new_session=True,
                cwd=app_info['path'],
                env=env
            )

        logger.info(f"Launched app: {app_info['name']}, logs: {log_stdout}, {log_stderr}")

        return jsonify({
            'status': 'success',
            'message': f"{app_info['name']} launched successfully",
            'project_id': project_id
        })

    # Sinon, chercher dans la DB (PRJ-XXX)
    db_path = '/data/projects/project-management/data/projects.db'

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT name, path, launcher_path, launcher_type
            FROM projects
            WHERE unique_id = ?
        ''', (project_id,))

        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({
                'status': 'error',
                'message': f'Project {project_id} not found'
            }), 404

        launcher_path = row['launcher_path']
        if not launcher_path:
            return jsonify({
                'status': 'error',
                'message': f'Project {row["name"]} has no launcher configured'
            }), 400

        # Check if launcher exists
        import os
        if not os.path.exists(launcher_path):
            return jsonify({
                'status': 'error',
                'message': f'Launcher not found: {launcher_path}'
            }), 404

        env = get_x11_env()

        # Launch the project with proper logging
        log_stdout = f"/tmp/homehub_{project_id}_stdout.log"
        log_stderr = f"/tmp/homehub_{project_id}_stderr.log"

        with open(log_stdout, 'w') as out, open(log_stderr, 'w') as err:
            subprocess.Popen(
                ['bash', launcher_path],
                stdout=out,
                stderr=err,
                stdin=subprocess.DEVNULL,
                start_new_session=True,
                cwd=row['path'],
                env=env,
                close_fds=True
            )

        logger.info(f"Launched {row['name']}, logs: {log_stdout}, {log_stderr}")

        logger.info(f"Launched project: {row['name']} ({launcher_path})")

        return jsonify({
            'status': 'success',
            'message': f"{row['name']} launched successfully",
            'project_id': project_id
        })

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
