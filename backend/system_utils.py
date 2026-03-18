"""
System Utilities - X11 environment detection and storage info helpers
Extracted from app.py for modularity (functions >50 lines)
"""

import os
import logging

logger = logging.getLogger(__name__)


def _find_display(env):
    """Try to find a working X11 DISPLAY by probing :0, :1, :2"""
    import subprocess as _sp

    for display in [':0', ':1', ':2']:
        try:
            result = _sp.run(['xdpyinfo'], env={**env, 'DISPLAY': display},
                             capture_output=True, timeout=2)
            if result.returncode == 0:
                return display
        except Exception:
            continue
    return ':0'  # fallback default


def _validate_display_env(env):
    """Ensure all critical X11/session variables are set with fallbacks"""
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


def _extract_session_env(env, critical_vars):
    """Extract environment variables from active user session via /proc"""
    import subprocess as _sp

    try:
        result = _sp.run(
            ['pgrep', '-u', 'fabrice-ryzen', '-f', 'systemd --user'],
            capture_output=True, text=True, timeout=2
        )
        if result.returncode == 0 and result.stdout.strip():
            systemd_pid = result.stdout.strip().split()[0]
            environ_file = f'/proc/{systemd_pid}/environ'
            if os.path.exists(environ_file):
                with open(environ_file, 'rb') as f:
                    environ_data = f.read()
                    for item in environ_data.split(b'\0'):
                        if b'=' in item:
                            key, value = item.decode('utf-8', errors='ignore').split('=', 1)
                            if key in critical_vars:
                                env[key] = value
    except Exception as e:
        logger.warning(f"Could not extract user session environment: {e}")

    return env


def get_x11_env():
    """Get environment variables for launching GUI apps.
    Captures full environment from active X11 session."""
    env = os.environ.copy()

    critical_vars = [
        'DISPLAY', 'XAUTHORITY', 'DBUS_SESSION_BUS_ADDRESS',
        'XDG_RUNTIME_DIR', 'XDG_SESSION_TYPE', 'HOME', 'USER', 'LOGNAME'
    ]

    # Try to get environment from active user session
    env = _extract_session_env(env, critical_vars)

    # Fallback detection for DISPLAY if not found
    if 'DISPLAY' not in env:
        env['DISPLAY'] = _find_display(env)

    # Ensure all critical variables are set
    env = _validate_display_env(env)

    return env


def _parse_disk_info(mount_point):
    """Get disk usage for a specific mount point using df"""
    import subprocess

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


def _parse_lvm_info(root_info, home_info):
    """Build SDB (backup disk) info based on SDD data"""
    if not root_info or not home_info:
        return None

    return {
        'root': {
            'total': '143G',
            'used': root_info['used'],
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


def get_storage_data():
    """Build complete storage info dictionary for all disks.

    Returns:
        dict: Storage info keyed by disk identifier (sda, sdb, sdc, sdd)
    """
    storage = {}

    try:
        # SDD - System disk
        sdd_data = {}
        root_info = _parse_disk_info('/')
        if root_info:
            sdd_data['root'] = root_info
        home_info = _parse_disk_info('/home')
        if home_info:
            sdd_data['home'] = home_info
        if sdd_data:
            storage['sdd'] = sdd_data

        # SDB - System backup disk
        sdb_data = _parse_lvm_info(root_info, home_info)
        if sdb_data:
            storage['sdb'] = sdb_data

        # SDA - LVM Data volumes
        sda_data = {}
        for name, mount in [('projects', '/data/projects'), ('docker', '/data/docker'), ('media', '/data/media')]:
            info = _parse_disk_info(mount)
            if info:
                sda_data[name] = info
        if sda_data:
            storage['sda'] = sda_data

        # SDC - Data backup disk
        sdc_data = {}
        for name, mount in [('projects', '/backup/projects'), ('docker', '/backup/docker'), ('media', '/backup/media')]:
            info = _parse_disk_info(mount)
            if info:
                sdc_data[name] = info
        if sdc_data:
            storage['sdc'] = sdc_data

    except Exception as e:
        logger.error(f"Error getting storage info: {e}")

    return storage


def _resolve_launch_command(project_id, additional_apps):
    """Resolve launcher path and project info for a given project_id.

    Returns:
        tuple: (project_info_dict, error_response_tuple_or_None)
            project_info_dict has keys: name, path, launcher_path
            error_response_tuple is (dict, status_code) or None
    """
    import sqlite3

    # Check additional apps first (APP-XXX)
    if project_id in additional_apps:
        app_info = additional_apps[project_id]
        if not os.path.exists(app_info['launcher_path']):
            return None, ({'status': 'error', 'message': f'Launcher not found: {app_info["launcher_path"]}'}, 404)
        return app_info, None

    # Look up in projects.db (PRJ-XXX)
    db_path = '/data/projects/project-management/data/projects.db'
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute('''
        SELECT name, path, launcher_path, launcher_type
        FROM projects WHERE unique_id = ?
    ''', (project_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None, ({'status': 'error', 'message': f'Project {project_id} not found'}, 404)

    if not row['launcher_path']:
        return None, ({'status': 'error', 'message': f'Project {row["name"]} has no launcher configured'}, 400)

    if not os.path.exists(row['launcher_path']):
        return None, ({'status': 'error', 'message': f'Launcher not found: {row["launcher_path"]}'}, 404)

    return {
        'name': row['name'],
        'path': row['path'],
        'launcher_path': row['launcher_path']
    }, None


def _execute_launch(project_id, project_info):
    """Execute a project/app launch with proper logging and detachment.

    Args:
        project_id: The project/app identifier
        project_info: Dict with name, path, launcher_path

    Returns:
        dict: Success response dict
    """
    import subprocess

    env = get_x11_env()
    log_stdout = f"/tmp/homehub_{project_id}_stdout.log"
    log_stderr = f"/tmp/homehub_{project_id}_stderr.log"

    with open(log_stdout, 'w') as out, open(log_stderr, 'w') as err:
        subprocess.Popen(
            ['bash', project_info['launcher_path']],
            stdout=out,
            stderr=err,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
            cwd=project_info['path'],
            env=env,
            close_fds=True
        )

    logger.info(f"Launched {project_info['name']}, logs: {log_stdout}, {log_stderr}")

    return {
        'status': 'success',
        'message': f"{project_info['name']} launched successfully",
        'project_id': project_id
    }
