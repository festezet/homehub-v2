"""
WhatsApp Chat API Routes — Split-panel Historique
DB-first chat list + background sync from Evolution API
"""

from flask import Blueprint, request
from shared_lib.flask_helpers import success, error as api_error
import logging

logger = logging.getLogger(__name__)

whatsapp_chat_bp = Blueprint('whatsapp_chat', __name__)

_chat_service = None
_proxy = None


def init_whatsapp_chat_routes(chat_service, whatsapp_proxy):
    global _chat_service, _proxy
    _chat_service = chat_service
    _proxy = whatsapp_proxy


# ------------------------------------------------------------------
# Chat list (DB-first, instant)
# ------------------------------------------------------------------

@whatsapp_chat_bp.route('/api/whatsapp/chats')
def list_chats():
    """List all WhatsApp chats from DB (instant, <50ms)"""
    try:
        chats = _chat_service.list_chats()
        return success(chats=chats, count=len(chats))
    except Exception as e:
        logger.error(f"Error listing chats: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Sync from Evolution API (background trigger)
# ------------------------------------------------------------------

@whatsapp_chat_bp.route('/api/whatsapp/chats/sync', methods=['POST'])
def sync_chats():
    """Fetch all chats from Evolution API and upsert into DB"""
    try:
        if not _proxy:
            return api_error(500, 'WhatsApp proxy not configured')

        synced, total = _chat_service.sync_chats_from_proxy(_proxy)
        return success(
            synced=synced, total=total,
            message=f'{synced} chats synced, {total} total'
        )
    except Exception as e:
        logger.error(f"Error syncing chats: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Sync messages for all favorite chats
# ------------------------------------------------------------------

@whatsapp_chat_bp.route('/api/whatsapp/favorites/sync-messages',
                        methods=['POST'])
def sync_favorites():
    """Fetch fresh messages for all favorite chats from Evolution API"""
    try:
        if not _proxy:
            return api_error(500, 'WhatsApp proxy not configured')

        result = _chat_service.sync_favorites_messages(_proxy)
        return success(**result)
    except Exception as e:
        logger.error(f"Error syncing favorites: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Messages for a chat
# ------------------------------------------------------------------

@whatsapp_chat_bp.route('/api/whatsapp/chats/<int:chat_id>/messages')
def get_messages(chat_id):
    """Get messages for a chat from DB, optionally fetch fresh from proxy.

    Query params:
        limit: max messages (default 500)
        since: ISO date filter
        fetch: if '1', fetch fresh messages from proxy first
    """
    try:
        chat = _chat_service.get_chat(chat_id)
        if not chat:
            return api_error(404, f'Chat {chat_id} not found')

        limit = request.args.get('limit', 500, type=int)
        since = request.args.get('since')
        do_fetch = request.args.get('fetch', '0') == '1'

        fetched = 0
        if do_fetch and _proxy:
            try:
                fresh = _proxy.find_messages(chat['jid'], limit=200)
                if fresh:
                    fetched = _chat_service.store_messages(
                        chat_id, fresh, proxy_jid=chat['jid'])
            except Exception as e:
                logger.warning(
                    f"Proxy fetch failed for chat {chat_id}: {e}")

        messages = _chat_service.get_messages(
            chat_id, since=since, limit=limit)
        total = _chat_service.get_message_count(chat_id)

        return success(
            chat_id=chat_id,
            jid=chat['jid'],
            name=chat['name'],
            messages=messages,
            count=len(messages),
            total_stored=total,
            fetched_from_proxy=fetched
        )
    except Exception as e:
        logger.error(f"Error getting messages for chat {chat_id}: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Send message
# ------------------------------------------------------------------

@whatsapp_chat_bp.route('/api/whatsapp/chats/<int:chat_id>/send',
                        methods=['POST'])
def send_message(chat_id):
    """Send a text message to a WhatsApp chat via Evolution API.

    JSON body:
        text: message text (required)
        quoted_message_id: optional message ID to reply to
    """
    try:
        if not _proxy:
            return api_error(500, 'WhatsApp proxy not configured')

        chat = _chat_service.get_chat(chat_id)
        if not chat:
            return api_error(404, f'Chat {chat_id} not found')

        data = request.get_json(silent=True) or {}
        text = (data.get('text') or '').strip()
        if not text:
            return api_error(400, 'Text is required')

        quoted_id = (data.get('quoted_message_id') or '').strip() or None
        result = _proxy.send_text(chat['jid'], text,
                                  quoted_message_id=quoted_id)
        if not result:
            return api_error(502, 'Failed to send message via Evolution API')

        return success(
            chat_id=chat_id, jid=chat['jid'],
            message='Message sent'
        )
    except Exception as e:
        logger.error(f"Error sending message to chat {chat_id}: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Send media (image/photo)
# ------------------------------------------------------------------

@whatsapp_chat_bp.route('/api/whatsapp/chats/<int:chat_id>/send-media',
                        methods=['POST'])
def send_media_message(chat_id):
    """Send a media message (photo, image) to a WhatsApp chat.

    JSON body:
        media: base64-encoded media content (required, no data: prefix)
        mimetype: e.g. 'image/jpeg' (required)
        filename: original file name (required)
        caption: optional text caption
    """
    try:
        if not _proxy:
            return api_error(500, 'WhatsApp proxy not configured')

        chat = _chat_service.get_chat(chat_id)
        if not chat:
            return api_error(404, f'Chat {chat_id} not found')

        data = request.get_json(silent=True) or {}
        media_b64 = (data.get('media') or '').strip()
        mimetype = (data.get('mimetype') or 'image/jpeg').strip()
        filename = (data.get('filename') or 'photo.jpg').strip()
        caption = (data.get('caption') or '').strip() or None

        if not media_b64:
            return api_error(400, 'media (base64) is required')

        # Strip optional "data:...;base64," prefix if frontend forgot
        if media_b64.startswith('data:'):
            comma = media_b64.find(',')
            if comma > 0:
                media_b64 = media_b64[comma + 1:]

        result = _proxy.send_media(
            chat['jid'], media_b64, mimetype, filename, caption=caption
        )
        if not result:
            return api_error(502, 'Failed to send media via Evolution API')

        return success(
            chat_id=chat_id, jid=chat['jid'],
            message='Media sent'
        )
    except Exception as e:
        logger.error(f"Error sending media to chat {chat_id}: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Media (full-size image proxy)
# ------------------------------------------------------------------

@whatsapp_chat_bp.route('/api/whatsapp/media/<message_id>')
def get_media(message_id):
    """Get full-size media (base64) for a message via Evolution API.

    Query params:
        jid: WhatsApp JID of the chat (required)
    """
    try:
        if not _proxy:
            return api_error(500, 'WhatsApp proxy not configured')

        jid = request.args.get('jid', '').strip()
        if not jid:
            return api_error(400, 'jid query parameter is required')

        from_me = request.args.get('from_me', '0') == '1'
        result = _proxy.get_media_base64(message_id, jid, from_me=from_me)
        if not result:
            return api_error(404, 'Media not found or not available')

        return success(
            message_id=message_id,
            base64=result['base64'],
            mimetype=result['mimetype']
        )
    except Exception as e:
        logger.error(f"Error fetching media {message_id}: {e}")
        return api_error(500, str(e))


# ------------------------------------------------------------------
# Favorite toggle
# ------------------------------------------------------------------

@whatsapp_chat_bp.route('/api/whatsapp/chats/<int:chat_id>/favorite',
                        methods=['PUT'])
def toggle_favorite(chat_id):
    """Toggle favorite on any chat"""
    try:
        new_val = _chat_service.toggle_favorite(chat_id)
        if new_val is None:
            return api_error(404, f'Chat {chat_id} not found')

        return success(
            chat_id=chat_id, favorite=bool(new_val),
            message=f'Chat {"favorited" if new_val else "unfavorited"}'
        )
    except Exception as e:
        logger.error(f"Error toggling favorite for chat {chat_id}: {e}")
        return api_error(500, str(e))
