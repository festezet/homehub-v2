"""
Thread Digest API Routes - Multi-platform thread monitoring and digest storage
Supports WhatsApp (Evolution API), Signal (signal-cli), and SMS (XML import)
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
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
        return success(threads=threads, count=len(threads))
    except Exception as e:
        logger.error(f"Error listing threads: {e}")
        return api_error(500, str(e))


@thread_digest_bp.route('/api/threads', methods=['POST'])
def create_thread():
    """Add a new thread to monitor"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'JSON body required')

        thread_id, error = _digest_service.create_thread(data)
        if error:
            return api_error(400, error)

        return success(thread_id=thread_id, message='Thread created',
                       status_code=201)
    except Exception as e:
        logger.error(f"Error creating thread: {e}")
        return api_error(500, str(e))


@thread_digest_bp.route('/api/threads/<int:thread_id>', methods=['PUT'])
def update_thread(thread_id):
    """Update a thread config"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'JSON body required')

        updated, error = _digest_service.update_thread(thread_id, data)
        if error:
            return api_error(400, error)
        if not updated:
            return api_error(404, f'Thread {thread_id} not found')

        return success(message='Thread updated')
    except Exception as e:
        logger.error(f"Error updating thread {thread_id}: {e}")
        return api_error(500, str(e))


@thread_digest_bp.route('/api/threads/<int:thread_id>', methods=['DELETE'])
def delete_thread(thread_id):
    """Delete a thread and its digests"""
    try:
        deleted = _digest_service.delete_thread(thread_id)
        if not deleted:
            return api_error(404, f'Thread {thread_id} not found')

        return success(message='Thread deleted')
    except Exception as e:
        logger.error(f"Error deleting thread {thread_id}: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Mark for update
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/mark-for-update', methods=['PUT'])
def mark_for_update():
    """Batch set marked_for_update on threads"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'JSON body required')

        thread_ids = data.get('thread_ids', [])
        marked = data.get('marked', True)

        if not isinstance(thread_ids, list):
            return api_error(400, 'thread_ids must be a list')

        count = _digest_service.mark_threads_for_update(thread_ids, marked)
        return success(message=f'{count} thread(s) updated', count=count)
    except Exception as e:
        logger.error(f"Error marking threads: {e}")
        return api_error(500, str(e))


@thread_digest_bp.route('/api/threads/clear-marks', methods=['POST'])
def clear_marks():
    """Reset all marked_for_update flags"""
    try:
        _digest_service.clear_all_marks()
        return success(message='All marks cleared')
    except Exception as e:
        logger.error(f"Error clearing marks: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Favorite toggle
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/<int:thread_id>/favorite', methods=['PUT'])
def toggle_favorite(thread_id):
    """Toggle favorite flag on a thread"""
    try:
        new_val = _digest_service.toggle_favorite(thread_id)
        if new_val is None:
            return api_error(404, f'Thread {thread_id} not found')

        return success(
            thread_id=thread_id, favorite=bool(new_val),
            message=f'Thread {"favorited" if new_val else "unfavorited"}')
    except Exception as e:
        logger.error(f"Error toggling favorite for thread {thread_id}: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Reorder threads
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/<int:thread_id>/move', methods=['PUT'])
def move_thread(thread_id):
    """Move a thread up or down in display order"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'JSON body required')

        direction = data.get('direction', '').lower()
        if direction not in ('up', 'down'):
            return api_error(400, 'direction must be "up" or "down"')

        moved, error = _digest_service.move_thread(thread_id, direction)
        if error:
            return api_error(404, error)

        return success(message=f'Thread moved {direction}')
    except Exception as e:
        logger.error(f"Error moving thread {thread_id}: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Messages proxy (multi-platform)
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/<int:thread_id>/messages')
def get_messages(thread_id):
    """Fetch messages via platform proxy, persist WhatsApp messages, return from DB

    For WhatsApp: fetches fresh messages from Evolution API, upserts into DB,
    then returns full history from DB (not just the fresh batch).
    For other platforms: proxies directly as before.

    Query params:
        limit: max messages to return (default 200)
        since: ISO date string to filter messages after this date
        skip_fetch: if '1', skip proxy fetch and return DB only (WhatsApp)
    """
    try:
        thread = _digest_service.get_thread(thread_id)
        if not thread:
            return api_error(404, f'Thread {thread_id} not found')

        limit = request.args.get('limit', 200, type=int)
        since = request.args.get('since')
        skip_fetch = request.args.get('skip_fetch', '0') == '1'

        # WhatsApp: persist messages in DB for full history
        if thread['platform'] == 'whatsapp':
            fetched_count = 0
            if not skip_fetch:
                proxy = _get_proxy('whatsapp')
                if proxy:
                    try:
                        fresh = proxy.find_messages(
                            thread['jid'], limit=200)
                        if fresh:
                            fetched_count, _ = (
                                _digest_service.store_whatsapp_messages(
                                    thread_id, fresh))
                    except Exception as e:
                        logger.warning(
                            f"Proxy fetch failed for thread {thread_id}, "
                            f"returning DB data: {e}")

            messages = _digest_service.get_whatsapp_messages(
                thread_id, since=since, limit=limit)
            total_stored = _digest_service.get_whatsapp_message_count(
                thread_id)

            return success(
                thread_id=thread_id,
                jid=thread['jid'],
                name=thread['name'],
                platform=thread['platform'],
                messages=messages,
                count=len(messages),
                total_stored=total_stored,
                fetched_from_proxy=fetched_count
            )

        # Other platforms: proxy directly (Signal, SMS already have persistence)
        proxy = _get_proxy(thread['platform'])
        if not proxy:
            return api_error(400, f"Unsupported platform: {thread['platform']}")

        messages = proxy.find_messages(
            thread['jid'], limit=limit, since=since)

        return success(
            thread_id=thread_id,
            jid=thread['jid'],
            name=thread['name'],
            platform=thread['platform'],
            messages=messages,
            count=len(messages)
        )
    except Exception as e:
        logger.error(f"Error fetching messages for thread {thread_id}: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Digests
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/<int:thread_id>/digest', methods=['POST'])
def store_digest(thread_id):
    """Store a digest result (called by Claude after analysis)"""
    try:
        data = request.get_json()
        if not data:
            return api_error(400, 'JSON body required')

        digest_id, error = _digest_service.store_digest(thread_id, data)
        if error:
            return api_error(400, error)

        return success(digest_id=digest_id, message='Digest stored',
                       status_code=201)
    except Exception as e:
        logger.error(f"Error storing digest for thread {thread_id}: {e}")
        return api_error(500, str(e))


@thread_digest_bp.route('/api/threads/<int:thread_id>/digests')
def get_digests(thread_id):
    """Get digest history for a thread"""
    try:
        thread = _digest_service.get_thread(thread_id)
        if not thread:
            return api_error(404, f'Thread {thread_id} not found')

        limit = request.args.get('limit', 10, type=int)
        digests = _digest_service.get_digests(thread_id, limit=limit)

        return success(
            thread_id=thread_id,
            name=thread['name'],
            digests=digests,
            count=len(digests)
        )
    except Exception as e:
        logger.error(f"Error getting digests for thread {thread_id}: {e}")
        return api_error(500, str(e))


@thread_digest_bp.route('/api/threads/digests/latest')
def get_latest_digests():
    """Get latest digest per enabled thread (dashboard view)"""
    try:
        results = _digest_service.get_latest_digests()
        return success(threads=results, count=len(results))
    except Exception as e:
        logger.error(f"Error getting latest digests: {e}")
        return api_error(500, str(e))


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

        return success(
            threads=results,
            total=len(results),
            needs_analysis=needs_count
        )
    except Exception as e:
        logger.error(f"Error getting thread status: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Message counts (single query for historique tab)
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/message-counts')
def get_message_counts():
    """Return message counts per thread in a single DB query"""
    try:
        import sqlite3, os
        db = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            'data', 'thread_digests.db')
        conn = sqlite3.connect(db)
        c = conn.cursor()
        c.execute("""SELECT thread_id, COUNT(*) as cnt
                     FROM whatsapp_messages GROUP BY thread_id""")
        counts = {str(r[0]): r[1] for r in c.fetchall()}
        conn.close()

        return success(counts=counts)
    except Exception as e:
        logger.error(f"Error getting message counts: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# All chats discovery (Historique tab — all WhatsApp conversations)
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/all-chats')
def all_chats():
    """Discover ALL WhatsApp chats (groups + contacts) via message scan.

    Returns every JID found in Evolution API with name, last_ts, msg_count.
    Also marks which ones are already configured in thread_configs.
    Cached server-side for 5 minutes.

    Fallback: when Evolution API is down, returns configured threads
    with message counts from local DB.
    """
    try:
        proxy = _get_proxy('whatsapp')
        chats = []
        source = 'evolution'

        if proxy:
            chats = proxy.find_all_chats()

        # Mark configured threads (full dict for enrichment)
        configured = {}
        try:
            threads = _digest_service.list_threads()
            for t in threads:
                configured[t['jid']] = t
        except Exception:
            pass

        if chats:
            # Evolution API returned data — enrich with config info
            for c in chats:
                thr = configured.get(c['jid'])
                c['thread_id'] = thr['id'] if thr else None
                c['configured'] = thr is not None
                c['marked_for_update'] = bool(
                    thr.get('marked_for_update')) if thr else False
                c['favorite'] = bool(
                    thr.get('favorite')) if thr else False
        else:
            # Fallback: build chat list from DB (configured threads only)
            source = 'database'
            chats = _digest_service.get_all_chats_from_db()

        return success(chats=chats, count=len(chats), source=source)
    except Exception as e:
        logger.error(f"Error discovering all chats: {e}")
        return api_error(500, str(e))


@thread_digest_bp.route('/api/threads/proxy-messages')
def proxy_messages():
    """Fetch messages directly from Evolution API for a given JID.

    Used by Historique tab for non-configured chats (no thread_id in DB).
    Query params:
        jid: WhatsApp JID (required)
        limit: max messages (default 100)
        page: pagination (default 1)
    """
    try:
        jid = request.args.get('jid')
        if not jid:
            return api_error(400, 'jid parameter required')

        proxy = _get_proxy('whatsapp')
        if not proxy:
            return api_error(500, 'WhatsApp proxy not configured')

        limit = request.args.get('limit', 100, type=int)
        page = request.args.get('page', 1, type=int)

        messages = proxy.find_messages(jid, limit=limit, page=page)
        return success(jid=jid, messages=messages, count=len(messages))
    except Exception as e:
        logger.error(f"Error proxying messages for JID: {e}")
        return api_error(500, str(e))


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
            return api_error(400, f'Unsupported platform: {platform}')

        chats = proxy.find_chats()
        return success(platform=platform, chats=chats, count=len(chats))
    except Exception as e:
        logger.error(f"Error discovering chats: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Signal polling
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/signal/poll', methods=['POST'])
def poll_signal():
    """Poll Signal API for new messages and store locally"""
    try:
        proxy = _get_proxy('signal')
        if not proxy:
            return api_error(500, 'Signal proxy not configured')

        count = proxy.poll_messages()
        return success(
            new_messages=count,
            message=f'{count} new Signal messages stored'
        )
    except Exception as e:
        logger.error(f"Error polling Signal: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# SMS import
# ------------------------------------------------------------------

@thread_digest_bp.route('/api/threads/sms/import', methods=['POST'])
def import_sms():
    """Import SMS from Android XML backup file"""
    try:
        data = request.get_json()
        if not data or not data.get('path'):
            return api_error(400, 'JSON body with "path" field required')

        proxy = _get_proxy('sms')
        if not proxy:
            return api_error(500, 'SMS proxy not configured')

        imported, error = proxy.import_backup(data['path'])
        if error:
            return api_error(400, error)

        return success(
            imported=imported,
            message=f'{imported} SMS imported'
        )
    except Exception as e:
        logger.error(f"Error importing SMS: {e}")
        return api_error(500, str(e))
