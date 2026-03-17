"""
WhatsApp Proxy Service - Evolution API proxy for Thread Digest
Handles communication with Evolution API for fetching chats and messages
"""

import logging
import os
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

EVOLUTION_API_URL = 'http://localhost:8084'
EVOLUTION_API_KEY = os.environ.get(
    'EVOLUTION_API_KEY', '0f3d5d85750d372339e68a81cd3bca24')
EVOLUTION_INSTANCE = 'fabrice-whatsapp'
REQUEST_TIMEOUT = 10
REQUEST_TIMEOUT_LONG = 30


class WhatsAppProxyService:
    """Proxy to Evolution API for WhatsApp message retrieval"""

    def find_chats(self):
        """Fetch WhatsApp groups with real names via fetchAllGroups"""
        try:
            headers = {'apikey': EVOLUTION_API_KEY}
            resp = requests.get(
                f'{EVOLUTION_API_URL}/group/fetchAllGroups/{EVOLUTION_INSTANCE}',
                headers=headers,
                params={'getParticipants': 'false'},
                timeout=REQUEST_TIMEOUT_LONG
            )
            if resp.status_code != 200:
                logger.warning(
                    f"Evolution API fetchAllGroups returned {resp.status_code}")
                return []

            groups = resp.json()
            if not isinstance(groups, list):
                return []

            # Format: return id (JID) and subject (real group name)
            return [
                {
                    'id': g.get('id', ''),
                    'name': g.get('subject', 'Sans nom'),
                    'size': g.get('size', 0),
                    'is_community': g.get('isCommunity', False)
                }
                for g in groups
                if g.get('id', '').endswith('@g.us')
            ]

        except requests.ConnectionError:
            logger.warning("Evolution API not reachable (port 8084)")
            return []
        except Exception as e:
            logger.error(f"Error fetching chats: {e}")
            return []

    def find_messages(self, remote_jid, limit=50, since=None):
        """Fetch messages for a specific chat via Evolution API

        Args:
            remote_jid: WhatsApp JID (e.g. 120363355718911950@g.us)
            limit: Max messages to return
            since: ISO date string to filter messages after this date
        """
        try:
            headers = {'apikey': EVOLUTION_API_KEY}
            payload = {
                "where": {"key": {"remoteJid": remote_jid}},
                "limit": limit
            }

            resp = requests.post(
                f'{EVOLUTION_API_URL}/chat/findMessages/{EVOLUTION_INSTANCE}',
                headers=headers,
                json=payload,
                timeout=REQUEST_TIMEOUT
            )
            if resp.status_code != 200:
                logger.warning(
                    f"findMessages for {remote_jid} returned {resp.status_code}")
                return []

            data = resp.json()
            raw_messages = self._extract_messages(data)

            # Parse and format messages
            messages = []
            for msg in raw_messages:
                parsed = self._parse_message(msg)
                if parsed:
                    # Filter by date if since is provided
                    if since and parsed.get('timestamp'):
                        try:
                            msg_date = datetime.fromtimestamp(
                                int(parsed['timestamp']))
                            since_date = datetime.fromisoformat(since)
                            if msg_date < since_date:
                                continue
                        except (ValueError, TypeError, OSError):
                            pass
                    messages.append(parsed)

            return messages

        except requests.ConnectionError:
            logger.warning("Evolution API not reachable (port 8084)")
            return []
        except Exception as e:
            logger.error(f"Error fetching messages for {remote_jid}: {e}")
            return []

    def get_message_count(self, remote_jid):
        """Get approximate message count for a chat (fetch minimal data)"""
        try:
            headers = {'apikey': EVOLUTION_API_KEY}
            resp = requests.post(
                f'{EVOLUTION_API_URL}/chat/findMessages/{EVOLUTION_INSTANCE}',
                headers=headers,
                json={
                    "where": {"key": {"remoteJid": remote_jid}},
                    "limit": 1
                },
                timeout=REQUEST_TIMEOUT
            )
            if resp.status_code != 200:
                return 0

            data = resp.json()
            # Try to get total from response metadata
            if isinstance(data, dict):
                messages = data.get('messages', {})
                if isinstance(messages, dict):
                    total = messages.get('total')
                    if total is not None:
                        return int(total)
                    return len(messages.get('records', []))
            return 0

        except Exception as e:
            logger.error(f"Error getting message count for {remote_jid}: {e}")
            return 0

    def _extract_messages(self, data):
        """Extract message list from Evolution API response"""
        if isinstance(data, dict):
            messages = data.get('messages', {})
            if isinstance(messages, dict):
                return messages.get('records', [])
            if isinstance(messages, list):
                return messages
            return []
        if isinstance(data, list):
            return data
        return []

    def _parse_message(self, msg):
        """Parse a single Evolution API message into clean format"""
        key = msg.get('key', {})
        content = msg.get('message', {})

        text = (
            content.get('conversation') or
            content.get('extendedTextMessage', {}).get('text') or
            ''
        )

        # Extract media info if no text
        media_type = None
        if not text:
            for mtype in ('imageMessage', 'videoMessage', 'audioMessage',
                          'documentMessage', 'stickerMessage'):
                if mtype in content:
                    media_type = mtype.replace('Message', '')
                    caption = content[mtype].get('caption', '')
                    text = caption if caption else f'[{media_type}]'
                    break
            if not text:
                return None

        author_jid = key.get('participant', '').split('@')[0]
        push_name = msg.get('pushName', author_jid)
        timestamp = msg.get('messageTimestamp')
        from_me = key.get('fromMe', False)

        result = {
            'author': push_name or author_jid,
            'author_jid': key.get('participant', ''),
            'text': text,
            'timestamp': timestamp,
            'from_me': from_me,
            'message_id': key.get('id', '')
        }
        if media_type:
            result['media_type'] = media_type

        return result


whatsapp_proxy_service = WhatsAppProxyService()
