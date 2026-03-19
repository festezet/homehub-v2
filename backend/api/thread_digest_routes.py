"""
Thread Digest API Routes - Multi-platform thread monitoring and digest storage
Supports WhatsApp (Evolution API), Signal (signal-cli), and SMS (XML import)
"""

from flask import Blueprint, jsonify, request
import logging

logger = logging.getLogger(__name__)

thread_digest_bp = Blueprint('thread_digest', __name__)

_digest_service = None
_platform_proxies = {}


def init_thread_digest_routes(digest_service, platform_proxies):
    global _digest_service, _platform_proxies
    _digest_service = digest_service
    _platform_proxies = platform_proxies


def _get_proxy(platform):
    """Get the proxy service for a given platform"""
    return _platform_proxies.get(platform)


# ------------------------------------------------------------------
# Thread configs CRUD
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads')
def list_threads():
    """List all monitored threads"""
    try:
        threads = _digest_service.list_threads()
        return jsonify({
            'status': 'ok',
            'threads': threads,
            'count': len(threads)
        })
    except Exception as e:
        logger.error(f"Error listing threads: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@thread_digest_bp.route('/api/threads', methods=['POST'])
def create_thread():
    """Add a new thread to monitor"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'JSON body required'
            }), 400

        thread_id, error = _digest_service.create_thread(data)
        if error:
            return jsonify({'status': 'error', 'message': error}), 400

        return jsonify({
            'status': 'ok',
            'thread_id': thread_id,
            'message': 'Thread created'
        }), 201
    except Exception as e:
        logger.error(f"Error creating thread: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@thread_digest_bp.route('/api/threads/<int:thread_id>', methods=['PUT'])
def update_thread(thread_id):
    """Update a thread config"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'JSON body required'
            }), 400

        updated, error = _digest_service.update_thread(thread_id, data)
        if error:
            return jsonify({'status': 'error', 'message': error}), 400
        if not updated:
            return jsonify({
                'status': 'error',
                'message': f'Thread {thread_id} not found'
            }), 404

        return jsonify({'status': 'ok', 'message': 'Thread updated'})
    except Exception as e:
        logger.error(f"Error updating thread {thread_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@thread_digest_bp.route('/api/threads/<int:thread_id>', methods=['DELETE'])
def delete_thread(thread_id):
    """Delete a thread and its digests"""
    try:
        deleted = _digest_service.delete_thread(thread_id)
        if not deleted:
            return jsonify({
                'status': 'error',
                'message': f'Thread {thread_id} not found'
            }), 404

        return jsonify({'status': 'ok', 'message': 'Thread deleted'})
    except Exception as e:
        logger.error(f"Error deleting thread {thread_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ------------------------------------------------------------------
# Reorder threads
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/<int:thread_id>/move', methods=['PUT'])
def move_thread(thread_id):
    """Move a thread up or down in display order"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'JSON body required'
            }), 400

        direction = data.get('direction', '').lower()
        if direction not in ('up', 'down'):
            return jsonify({
                'status': 'error',
                'message': 'direction must be "up" or "down"'
            }), 400

        moved, error = _digest_service.move_thread(thread_id, direction)
        if error:
            return jsonify({'status': 'error', 'message': error}), 404

        return jsonify({'status': 'ok', 'message': f'Thread moved {direction}'})
    except Exception as e:
        logger.error(f"Error moving thread {thread_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ------------------------------------------------------------------
# Messages proxy (multi-platform)
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/<int:thread_id>/messages')
def get_messages(thread_id):
    """Fetch messages via the appropriate platform proxy"""
    try:
        thread = _digest_service.get_thread(thread_id)
        if not thread:
            return jsonify({
                'status': 'error',
                'message': f'Thread {thread_id} not found'
            }), 404

        proxy = _get_proxy(thread['platform'])
        if not proxy:
            return jsonify({
                'status': 'error',
                'message': f"Unsupported platform: {thread['platform']}"
            }), 400

        limit = request.args.get('limit', 50, type=int)
        since = request.args.get('since')

        messages = proxy.find_messages(
            thread['jid'], limit=limit, since=since
        )

        return jsonify({
            'status': 'ok',
            'thread_id': thread_id,
            'jid': thread['jid'],
            'name': thread['name'],
            'platform': thread['platform'],
            'messages': messages,
            'count': len(messages)
        })
    except Exception as e:
        logger.error(f"Error fetching messages for thread {thread_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ------------------------------------------------------------------
# Digests
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/<int:thread_id>/digest', methods=['POST'])
def store_digest(thread_id):
    """Store a digest result (called by Claude after analysis)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'JSON body required'
            }), 400

        digest_id, error = _digest_service.store_digest(thread_id, data)
        if error:
            return jsonify({'status': 'error', 'message': error}), 400

        return jsonify({
            'status': 'ok',
            'digest_id': digest_id,
            'message': 'Digest stored'
        }), 201
    except Exception as e:
        logger.error(f"Error storing digest for thread {thread_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@thread_digest_bp.route('/api/threads/<int:thread_id>/digests')
def get_digests(thread_id):
    """Get digest history for a thread"""
    try:
        thread = _digest_service.get_thread(thread_id)
        if not thread:
            return jsonify({
                'status': 'error',
                'message': f'Thread {thread_id} not found'
            }), 404

        limit = request.args.get('limit', 10, type=int)
        digests = _digest_service.get_digests(thread_id, limit=limit)

        return jsonify({
            'status': 'ok',
            'thread_id': thread_id,
            'name': thread['name'],
            'digests': digests,
            'count': len(digests)
        })
    except Exception as e:
        logger.error(f"Error getting digests for thread {thread_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@thread_digest_bp.route('/api/threads/digests/latest')
def get_latest_digests():
    """Get latest digest per enabled thread (dashboard view)"""
    try:
        results = _digest_service.get_latest_digests()
        return jsonify({
            'status': 'ok',
            'threads': results,
            'count': len(results)
        })
    except Exception as e:
        logger.error(f"Error getting latest digests: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ------------------------------------------------------------------
# Status (hybrid trigger, multi-platform)
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/status')
def get_status():
    """Calculate which threads need analysis (hybrid trigger)"""
    try:
        results = _digest_service.get_status(
            platform_proxies=_platform_proxies)
        needs_count = sum(1 for r in results if r['needs_analysis'])

        return jsonify({
            'status': 'ok',
            'threads': results,
            'total': len(results),
            'needs_analysis': needs_count
        })
    except Exception as e:
        logger.error(f"Error getting thread status: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ------------------------------------------------------------------
# Chat discovery (multi-platform)
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/chats')
def discover_chats():
    """List available chats from platform API (for adding new threads)"""
    try:
        platform = request.args.get('platform', 'whatsapp')
        proxy = _get_proxy(platform)
        if not proxy:
            return jsonify({
                'status': 'error',
                'message': f'Unsupported platform: {platform}'
            }), 400

        chats = proxy.find_chats()
        return jsonify({
            'status': 'ok',
            'platform': platform,
            'chats': chats,
            'count': len(chats)
        })
    except Exception as e:
        logger.error(f"Error discovering chats: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ------------------------------------------------------------------
# Signal polling
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/signal/poll', methods=['POST'])
def poll_signal():
    """Poll Signal API for new messages and store locally"""
    try:
        proxy = _get_proxy('signal')
        if not proxy:
            return jsonify({
                'status': 'error',
                'message': 'Signal proxy not configured'
            }), 500

        count = proxy.poll_messages()
        return jsonify({
            'status': 'ok',
            'new_messages': count,
            'message': f'{count} new Signal messages stored'
        })
    except Exception as e:
        logger.error(f"Error polling Signal: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ------------------------------------------------------------------
# SMS import
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/sms/import', methods=['POST'])
def import_sms():
    """Import SMS from Android XML backup file"""
    try:
        data = request.get_json()
        if not data or not data.get('path'):
            return jsonify({
                'status': 'error',
                'message': 'JSON body with "path" field required'
            }), 400

        proxy = _get_proxy('sms')
        if not proxy:
            return jsonify({
                'status': 'error',
                'message': 'SMS proxy not configured'
            }), 500

        imported, error = proxy.import_backup(data['path'])
        if error:
            return jsonify({'status': 'error', 'message': error}), 400

        return jsonify({
            'status': 'ok',
            'imported': imported,
            'message': f'{imported} SMS imported'
        })
    except Exception as e:
        logger.error(f"Error importing SMS: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
