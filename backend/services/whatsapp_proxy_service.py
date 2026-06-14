"""
WhatsApp Proxy Service - Evolution API proxy for Thread Digest
Handles communication with Evolution API for fetching chats and messages
"""

import logging
import os
import time
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

EVOLUTION_API_URL = os.environ.get('EVOLUTION_API_URL', 'http://localhost:8084')
EVOLUTION_API_KEY = os.environ.get(
    'EVOLUTION_API_KEY', '0f3d5d85750d372339e68a81cd3bca24')
EVOLUTION_INSTANCE = 'fabrice-whatsapp'
REQUEST_TIMEOUT = 10
REQUEST_TIMEOUT_LONG = 30


class WhatsAppProxyService:
    """Proxy to Evolution API for WhatsApp message retrieval"""

    CACHE_TTL = 300  # 5 minutes

    def __init__(self):
        self._all_chats_cache = None
        self._all_chats_cache_ts = 0
        # LID mapping: phone_jid -> lid_jid and reverse
        self._lid_map = {}       # phone@s.whatsapp.net -> lid@lid
        self._lid_reverse = {}   # lid@lid -> phone@s.whatsapp.net
        self._lid_map_ts = 0

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

    def find_all_chats(self):
        """Discover ALL WhatsApp chats (groups + individuals) by scanning messages.

        Combines fetchAllGroups (for group names) with full message scan
        (for individual contacts). Results cached for CACHE_TTL seconds.

        Returns:
            list of {jid, name, last_ts, msg_count, type}
        """
        # Return cache if fresh
        if (self._all_chats_cache is not None
                and time.time() - self._all_chats_cache_ts < self.CACHE_TTL):
            return self._all_chats_cache

        # 1. Get group names from fetchAllGroups
        group_names = {}
        try:
            groups = self.find_chats()
            for g in groups:
                group_names[g['id']] = g['name']
        except Exception as e:
            logger.warning(f"fetchAllGroups failed, continuing: {e}")

        # 2. Scan all messages to discover unique JIDs
        #    LID messages (xxx@lid) are resolved to their phone JID via
        #    remoteJidAlt, so chats dict always uses phone JIDs as keys.
        headers = {'apikey': EVOLUTION_API_KEY}
        chats = {}  # phone_jid -> {name, last_ts, msg_count, type}
        page = 1
        max_pages = 50

        try:
            while page <= max_pages:
                resp = requests.post(
                    f'{EVOLUTION_API_URL}/chat/findMessages/'
                    f'{EVOLUTION_INSTANCE}',
                    headers=headers,
                    json={"where": {}, "limit": 50, "page": page},
                    timeout=REQUEST_TIMEOUT_LONG
                )
                if resp.status_code != 200:
                    break

                raw = self._extract_messages(resp.json())
                if not raw:
                    break

                for msg in raw:
                    key = msg.get('key') or {}
                    jid = key.get('remoteJid', '')
                    if (not jid
                            or jid in ('status@broadcast',
                                       '0@s.whatsapp.net')):
                        continue

                    # Resolve LID to phone JID for unified chat entries
                    if jid.endswith('@lid'):
                        alt = key.get('remoteJidAlt', '')
                        if alt.endswith('@s.whatsapp.net'):
                            self._lid_map[alt] = jid
                            self._lid_reverse[jid] = alt
                            jid = alt
                        else:
                            # No alt JID available, skip orphan LID
                            continue

                    ts = msg.get('messageTimestamp', 0)
                    from_me = key.get('fromMe', False)
                    push_name = msg.get('pushName', '')

                    if jid not in chats:
                        chats[jid] = {
                            'jid': jid,
                            'name': '',
                            'last_ts': 0,
                            'msg_count': 0,
                            'type': self._jid_type(jid)
                        }

                    entry = chats[jid]
                    entry['msg_count'] += 1
                    if isinstance(ts, (int, float)) and ts > entry['last_ts']:
                        entry['last_ts'] = int(ts)

                    # Name resolution: prefer non-from_me pushName for contacts
                    if not entry['name'] and not from_me and push_name:
                        entry['name'] = push_name

                page += 1

        except requests.ConnectionError:
            logger.warning("Evolution API not reachable during all-chats scan")
        except Exception as e:
            logger.error(f"Error scanning all chats: {e}")

        # Update LID map timestamp since we just scanned
        self._lid_map_ts = time.time()

        # 3. Apply group names (override message-based names)
        for jid, gname in group_names.items():
            if jid in chats:
                chats[jid]['name'] = gname
            else:
                chats[jid] = {
                    'jid': jid, 'name': gname,
                    'last_ts': 0, 'msg_count': 0, 'type': 'group'
                }

        # 4. Fallback names for contacts without pushName
        for entry in chats.values():
            if not entry['name']:
                phone = entry['jid'].split('@')[0]
                if len(phone) > 6:
                    entry['name'] = f'+{phone}'
                else:
                    entry['name'] = entry['jid'].split('@')[0]

        # 5. Sort by last message timestamp desc
        result = sorted(chats.values(), key=lambda c: c['last_ts'],
                        reverse=True)

        # Cache
        self._all_chats_cache = result
        self._all_chats_cache_ts = time.time()
        logger.info(f"All-chats scan: {len(result)} chats discovered")
        return result

    @staticmethod
    def _jid_type(jid):
        if jid.endswith('@g.us'):
            return 'group'
        if jid.endswith('@s.whatsapp.net'):
            return 'contact'
        if jid.endswith('@lid'):
            return 'linked'
        return 'unknown'

    def _build_lid_map(self):
        """Scan recent messages to build phone_jid <-> lid_jid mapping.

        WhatsApp migrated to LID (Linked ID) addressing. New messages have
        remoteJid=xxx@lid with remoteJidAlt=yyy@s.whatsapp.net in the key.
        """
        if (self._lid_map
                and time.time() - self._lid_map_ts < self.CACHE_TTL):
            return

        headers = {'apikey': EVOLUTION_API_KEY}
        try:
            for page in range(1, 51):  # Scan all pages
                resp = requests.post(
                    f'{EVOLUTION_API_URL}/chat/findMessages/'
                    f'{EVOLUTION_INSTANCE}',
                    headers=headers,
                    json={"where": {}, "limit": 50, "page": page},
                    timeout=REQUEST_TIMEOUT_LONG
                )
                if resp.status_code != 200:
                    break
                raw = self._extract_messages(resp.json())
                if not raw:
                    break
                for msg in raw:
                    key = msg.get('key') or {}
                    jid = key.get('remoteJid', '')
                    alt = key.get('remoteJidAlt', '')
                    if (jid.endswith('@lid') and
                            alt.endswith('@s.whatsapp.net')):
                        self._lid_map[alt] = jid
                        self._lid_reverse[jid] = alt
        except Exception as e:
            logger.warning(f"LID map build failed: {e}")

        self._lid_map_ts = time.time()
        if self._lid_map:
            logger.info(f"LID map: {len(self._lid_map)} mappings")

    def _resolve_lid(self, phone_jid):
        """Return the LID JID for a phone JID, or None."""
        self._build_lid_map()
        return self._lid_map.get(phone_jid)

    def _resolve_phone(self, lid_jid):
        """Return the phone JID for a LID JID, or None."""
        self._build_lid_map()
        return self._lid_reverse.get(lid_jid)

    def send_text(self, remote_jid, text, quoted_message_id=None):
        """Send a text message via Evolution API.

        Args:
            remote_jid: WhatsApp JID
            text: Message text
            quoted_message_id: Optional message ID to reply/quote
        Returns:
            dict with API response or None on failure
        """
        try:
            headers = {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
            payload = {
                "number": remote_jid,
                "text": text
            }
            if quoted_message_id:
                payload["quoted"] = {
                    "key": {
                        "remoteJid": remote_jid,
                        "id": quoted_message_id
                    }
                }
            resp = requests.post(
                f'{EVOLUTION_API_URL}/message/sendText/'
                f'{EVOLUTION_INSTANCE}',
                headers=headers,
                json=payload,
                timeout=REQUEST_TIMEOUT
            )
            if resp.status_code not in (200, 201):
                logger.warning(
                    f"sendText to {remote_jid} returned {resp.status_code}: "
                    f"{resp.text[:200]}")
                return None

            return resp.json()

        except requests.ConnectionError:
            logger.warning("Evolution API not reachable for sendText")
            return None
        except Exception as e:
            logger.error(f"Error sending text to {remote_jid}: {e}")
            return None

    def send_media(self, remote_jid, media_base64, mimetype,
                   filename, caption=None):
        """Send media (image/video/document) via Evolution API.

        Args:
            remote_jid: WhatsApp JID
            media_base64: Base64-encoded media (no data: prefix)
            mimetype: e.g. 'image/jpeg', 'image/png', 'video/mp4'
            filename: Original filename for the media
            caption: Optional text caption to display with the media
        Returns:
            dict with API response or None on failure
        """
        try:
            if mimetype.startswith('image/'):
                mediatype = 'image'
            elif mimetype.startswith('video/'):
                mediatype = 'video'
            elif mimetype.startswith('audio/'):
                mediatype = 'audio'
            else:
                mediatype = 'document'

            headers = {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
            payload = {
                "number": remote_jid,
                "mediatype": mediatype,
                "mimetype": mimetype,
                "media": media_base64,
                "fileName": filename,
            }
            if caption:
                payload["caption"] = caption

            resp = requests.post(
                f'{EVOLUTION_API_URL}/message/sendMedia/'
                f'{EVOLUTION_INSTANCE}',
                headers=headers,
                json=payload,
                timeout=REQUEST_TIMEOUT_LONG
            )
            if resp.status_code not in (200, 201):
                logger.warning(
                    f"sendMedia to {remote_jid} returned "
                    f"{resp.status_code}: {resp.text[:200]}")
                return None

            return resp.json()

        except requests.ConnectionError:
            logger.warning("Evolution API not reachable for sendMedia")
            return None
        except Exception as e:
            logger.error(f"Error sending media to {remote_jid}: {e}")
            return None

    def find_messages(self, remote_jid, limit=50, since=None, page=1):
        """Fetch messages for a specific chat via Evolution API.

        For contacts with LID migration, queries both the phone JID and
        the LID JID, then merges results by message_id.

        Args:
            remote_jid: WhatsApp JID (e.g. 33659314086@s.whatsapp.net)
            limit: Max messages to return (API caps at 50/page)
            since: ISO date string to filter messages after this date
            page: Page number for pagination (1-based)
        """
        # Build list of JIDs to query (phone + LID if available)
        jids_to_query = [remote_jid]
        if remote_jid.endswith('@s.whatsapp.net'):
            lid = self._resolve_lid(remote_jid)
            if lid:
                jids_to_query.append(lid)

        all_messages = {}  # message_id -> parsed message (dedup)

        for jid in jids_to_query:
            try:
                headers = {'apikey': EVOLUTION_API_KEY}
                payload = {
                    "where": {"key": {"remoteJid": jid}},
                    "limit": limit,
                    "page": page
                }

                resp = requests.post(
                    f'{EVOLUTION_API_URL}/chat/findMessages/'
                    f'{EVOLUTION_INSTANCE}',
                    headers=headers,
                    json=payload,
                    timeout=REQUEST_TIMEOUT
                )
                if resp.status_code != 200:
                    logger.warning(
                        f"findMessages for {jid} returned "
                        f"{resp.status_code}")
                    continue

                data = resp.json()
                raw_messages = self._extract_messages(data)

                for msg in raw_messages:
                    try:
                        parsed = self._parse_message(msg)
                    except Exception:
                        continue
                    if not parsed:
                        continue

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

                    mid = parsed.get('message_id', '')
                    if mid:
                        all_messages[mid] = parsed
                    else:
                        all_messages[id(parsed)] = parsed

            except requests.ConnectionError:
                logger.warning("Evolution API not reachable (port 8084)")
            except Exception as e:
                logger.error(f"Error fetching messages for {jid}: {e}")

        # Sort merged results by timestamp desc
        messages = sorted(
            all_messages.values(),
            key=lambda m: int(m.get('timestamp', 0) or 0),
            reverse=True
        )
        return messages

    def get_message_count(self, remote_jid):
        """Get approximate message count for a chat (phone JID + LID)"""
        total = 0
        jids = [remote_jid]
        if remote_jid.endswith('@s.whatsapp.net'):
            lid = self._resolve_lid(remote_jid)
            if lid:
                jids.append(lid)

        headers = {'apikey': EVOLUTION_API_KEY}
        for jid in jids:
            try:
                resp = requests.post(
                    f'{EVOLUTION_API_URL}/chat/findMessages/'
                    f'{EVOLUTION_INSTANCE}',
                    headers=headers,
                    json={
                        "where": {"key": {"remoteJid": jid}},
                        "limit": 1
                    },
                    timeout=REQUEST_TIMEOUT
                )
                if resp.status_code != 200:
                    continue

                data = resp.json()
                if isinstance(data, dict):
                    messages = data.get('messages', {})
                    if isinstance(messages, dict):
                        count = messages.get('total')
                        if count is not None:
                            total += int(count)
                        else:
                            total += len(messages.get('records', []))
            except Exception as e:
                logger.error(
                    f"Error getting message count for {jid}: {e}")

        return total

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
        key = msg.get('key') or {}
        content = msg.get('message') or {}

        text = (
            content.get('conversation') or
            content.get('extendedTextMessage', {}).get('text') or
            ''
        )

        # Always check for media (images, videos, etc.)
        media_type = None
        thumbnail = None
        for mtype in ('imageMessage', 'videoMessage', 'audioMessage',
                      'documentMessage', 'stickerMessage'):
            if mtype in content:
                media_type = mtype.replace('Message', '')
                caption = content[mtype].get('caption', '')
                if not text:
                    text = caption if caption else f'[{media_type}]'
                thumb = content[mtype].get('jpegThumbnail', '')
                if thumb:
                    thumbnail = thumb
                break

        if not text and not media_type:
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
        if thumbnail:
            result['thumbnail'] = thumbnail

        return result


    def get_media_base64(self, message_id, remote_jid, from_me=False):
        """Fetch full-size media as base64 via Evolution API.

        Tries phone JID first, then LID JID if the first attempt fails
        (recent messages may be stored under LID addressing).

        Args:
            message_id: Evolution API message ID
            remote_jid: WhatsApp JID of the chat
            from_me: whether the message was sent by the user
        Returns:
            dict with {base64, mimetype} or None
        """
        jids_to_try = [remote_jid]
        if remote_jid.endswith('@s.whatsapp.net'):
            lid = self._resolve_lid(remote_jid)
            if lid:
                jids_to_try.append(lid)

        headers = {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
        }

        for jid in jids_to_try:
            try:
                key = {"remoteJid": jid, "id": message_id}
                if from_me:
                    key["fromMe"] = True
                payload = {
                    "message": {"key": key},
                    "convertToMp4": False
                }
                resp = requests.post(
                    f'{EVOLUTION_API_URL}/chat/'
                    f'getBase64FromMediaMessage/{EVOLUTION_INSTANCE}',
                    headers=headers,
                    json=payload,
                    timeout=REQUEST_TIMEOUT_LONG
                )
                if resp.status_code >= 300:
                    continue

                data = resp.json()
                base64_data = data.get('base64', '')
                mimetype = data.get('mimetype', 'image/jpeg')
                if base64_data:
                    return {'base64': base64_data, 'mimetype': mimetype}

            except requests.ConnectionError:
                logger.warning("Evolution API not reachable for media")
                return None
            except Exception as e:
                logger.error(f"Error fetching media {message_id}: {e}")

        return None


whatsapp_proxy_service = WhatsAppProxyService()
