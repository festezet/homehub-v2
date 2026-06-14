/**
 * WhatsApp Historique Module — Split-panel chat interface
 * DB-first chat list with background Evolution API sync.
 * Replaces the old accordion-based historique tab.
 */

import API from './api.js';

const whatsappHistModule = {
    chats: [],
    activeChat: null,
    messageCache: {},
    searchQuery: '',
    syncing: false,
    replyTo: null,  // {message_id, author, text} — message being replied to
    pendingPhoto: null,  // {base64, mimetype, filename, dataUrl, size} — photo selected for next send

    // --- Init & Load ---

    async load() {
        if (!this._bound) {
            this._bindEvents();
            this._bound = true;
        }
        await this.loadChatList();

        // Auto-load first favorite conversation
        const firstFav = this.chats.find(c => c.favorite);
        if (firstFav && !this.activeChat) {
            this.selectChat(firstFav.id);
        }
    },

    _bindEvents() {
        // Search filter
        document.getElementById('td-chat-search')?.addEventListener('input', (e) => {
            this.filterChats(e.target.value);
        });

        // Sync button
        document.getElementById('td-chat-sync-btn')?.addEventListener('click', () => {
            this.triggerSync();
        });

        // Chat item clicks (event delegation)
        document.getElementById('td-chat-items')?.addEventListener('click', (e) => {
            // Star toggle
            const starBtn = e.target.closest('.td-chat-star-btn');
            if (starBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(starBtn.dataset.id);
                if (id) this.toggleFavorite(id);
                return;
            }

            // Chat item select
            const item = e.target.closest('.td-chat-item');
            if (item && item.dataset.chatId) {
                this.selectChat(parseInt(item.dataset.chatId));
            }
        });
    },

    // --- Chat List ---

    async loadChatList() {
        const container = document.getElementById('td-chat-items');
        container.innerHTML = '<div class="td-chat-loading">Chargement...</div>';

        try {
            const resp = await API.fetch(`${API.BASE_URL}/whatsapp/chats`);
            this.chats = resp.chats || [];

            if (this.chats.length === 0) {
                container.innerHTML = '<div class="td-chat-loading">Aucune conversation. Cliquez &#x1f504; pour synchroniser.</div>';
                return;
            }

            this.renderChatList();
        } catch (err) {
            console.error('Error loading chats:', err);
            container.innerHTML = '<div class="td-chat-loading" style="color:#ef4444;">Erreur de chargement.</div>';
        }
    },

    async triggerSync() {
        if (this.syncing) return;
        this.syncing = true;

        const btn = document.getElementById('td-chat-sync-btn');
        if (btn) {
            btn.disabled = true;
            btn.classList.add('syncing');
        }

        try {
            await API.fetch(`${API.BASE_URL}/whatsapp/chats/sync`, { method: 'POST' });
            await this.loadChatList();
            // Re-select active chat if still present
            if (this.activeChat) {
                const stillThere = this.chats.find(c => c.id === this.activeChat);
                if (!stillThere) this._showEmptyState();
            }
        } catch (err) {
            console.error('Sync error:', err);
        } finally {
            this.syncing = false;
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('syncing');
            }
        }
    },

    renderChatList() {
        const container = document.getElementById('td-chat-items');
        const q = this.searchQuery.toLowerCase();

        // Filter by search
        let filtered = this.chats;
        if (q) {
            filtered = filtered.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.jid || '').toLowerCase().includes(q)
            );
        }

        // Split favorites vs rest
        const favs = filtered.filter(c => c.favorite);
        const rest = filtered.filter(c => !c.favorite);

        let html = '';

        if (favs.length > 0) {
            html += '<div class="td-chat-fav-header">Favoris</div>';
            html += favs.map(c => this._renderChatItem(c)).join('');
        }

        if (rest.length > 0) {
            if (favs.length > 0) {
                html += '<div class="td-chat-section-header">Conversations</div>';
            }
            html += rest.map(c => this._renderChatItem(c)).join('');
        }

        if (!html) {
            html = '<div class="td-chat-loading">Aucun resultat.</div>';
        }

        container.innerHTML = html;
    },

    _renderChatItem(chat) {
        const isActive = chat.id === this.activeChat;
        const typeIcon = chat.type === 'group' ? '\u{1F465}' : '\u{1F464}';
        const initial = (chat.name || '?')[0].toUpperCase();
        const starClass = chat.favorite ? ' active' : '';

        // Format date
        let dateStr = '';
        if (chat.last_ts) {
            const d = new Date(chat.last_ts * 1000);
            const now = new Date();
            const diffD = Math.floor((now - d) / 86400000);
            if (diffD === 0) {
                dateStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            } else if (diffD < 7) {
                dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short' });
            } else {
                dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            }
        }

        // Preview
        let preview = '';
        if (chat.last_message) {
            const prefix = chat.last_author ? `${this._esc(chat.last_author.split(' ')[0])}: ` : '';
            const text = this._esc(chat.last_message.substring(0, 60));
            preview = `${prefix}${text}`;
        }

        // Badge "Suivi" for configured chats
        const suiviBadge = chat.configured ? '<span class="td-chat-badge-suivi">Suivi</span>' : '';

        return `<div class="td-chat-item${isActive ? ' active' : ''}" data-chat-id="${chat.id}">
            <div class="td-chat-item-avatar">${typeIcon === '\u{1F465}' ? typeIcon : initial}</div>
            <div class="td-chat-item-info">
                <div class="td-chat-item-name">${this._esc(chat.name || chat.jid)}${suiviBadge}</div>
                <div class="td-chat-item-preview">${preview || '&nbsp;'}</div>
            </div>
            <div class="td-chat-item-right">
                <div class="td-chat-item-date">${dateStr}</div>
                ${chat.msg_count > 0 ? `<div class="td-chat-item-count">${chat.msg_count}</div>` : ''}
                <button class="td-chat-star-btn${starClass}" data-id="${chat.id}" title="Favori">&#9733;</button>
            </div>
        </div>`;
    },

    filterChats(query) {
        this.searchQuery = query;
        this.renderChatList();
    },

    // --- Messages ---

    async selectChat(chatId) {
        this.activeChat = chatId;

        // Highlight in list
        document.querySelectorAll('.td-chat-item').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.chatId) === chatId);
        });

        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;

        const view = document.getElementById('td-message-view');

        // Show header + loading + input bar
        view.innerHTML = `
            <div class="td-message-header">
                <div style="flex:1;min-width:0;">
                    <strong>${this._esc(chat.name || chat.jid)}</strong>
                    <span style="font-size:0.8rem;color:var(--text-secondary,#a0a0b0);">${this._esc(chat.jid)}</span>
                </div>
                <button id="td-msg-refresh-btn" class="btn btn-sm td-chat-sync-btn" title="Rafraîchir les messages">🔄</button>
            </div>
            <div class="td-message-container" id="td-msg-container">
                <div class="td-chat-loading">Chargement des messages...</div>
            </div>
            <div id="td-reply-preview" class="td-reply-preview" style="display:none;">
                <div class="td-reply-preview-content">
                    <span class="td-reply-preview-author"></span>
                    <span class="td-reply-preview-text"></span>
                </div>
                <button class="td-reply-preview-close" title="Annuler">&times;</button>
            </div>
            <div id="td-photo-preview" class="td-photo-preview" style="display:none;">
                <img id="td-photo-preview-img" class="td-photo-preview-img" />
                <div class="td-photo-preview-info">
                    <div class="td-photo-preview-name" id="td-photo-preview-name"></div>
                    <div class="td-photo-preview-size" id="td-photo-preview-size"></div>
                </div>
                <button class="td-photo-preview-close" id="td-photo-preview-close" title="Annuler">&times;</button>
            </div>
            <div class="td-message-input-bar">
                <input type="file" id="td-msg-photo-input" accept="image/*" style="display:none;">
                <button id="td-msg-photo-btn" class="td-msg-photo-btn" title="Joindre une photo">&#x1F4F7;</button>
                <textarea id="td-msg-input" placeholder="Ecrire un message..." rows="1"></textarea>
                <button id="td-msg-send-btn" title="Envoyer">&#x27A4;</button>
            </div>
            <div id="td-drop-overlay" class="td-drop-overlay" style="display:none;">
                <div class="td-drop-overlay-inner">
                    <div class="td-drop-overlay-icon">&#x1F4F7;</div>
                    <div class="td-drop-overlay-text">Deposez l'image ici</div>
                </div>
            </div>`;

        // Bind input events
        const input = document.getElementById('td-msg-input');
        const sendBtn = document.getElementById('td-msg-send-btn');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            // Auto-resize textarea
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            });
        }
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Refresh button
        const refreshBtn = document.getElementById('td-msg-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshMessages());
        }

        // Reply button + thumbnail clicks (event delegation on message container)
        document.getElementById('td-msg-container')?.addEventListener('click', (e) => {
            const replyBtn = e.target.closest('.td-msg-reply-btn');
            if (replyBtn) {
                e.preventDefault();
                const msgId = replyBtn.dataset.msgId;
                const author = replyBtn.dataset.author;
                const text = replyBtn.dataset.text;
                this.setReplyTo(msgId, author, text);
                return;
            }

            // Thumbnail click → load full image
            const thumb = e.target.closest('.td-msg-thumb');
            if (thumb) {
                e.preventDefault();
                this._showFullImage(thumb.dataset.msgId, thumb.dataset.fromMe === '1');
                return;
            }

            // Image placeholder click → load full image
            const placeholder = e.target.closest('.td-msg-img-placeholder');
            if (placeholder) {
                e.preventDefault();
                this._showFullImage(placeholder.dataset.msgId, placeholder.dataset.fromMe === '1');
            }
        });

        // Close reply preview
        document.querySelector('.td-reply-preview-close')?.addEventListener('click', () => {
            this.clearReply();
        });

        // Photo upload — open file picker
        const photoBtn = document.getElementById('td-msg-photo-btn');
        const photoInput = document.getElementById('td-msg-photo-input');
        if (photoBtn && photoInput) {
            photoBtn.addEventListener('click', () => photoInput.click());
            photoInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) this._handlePhotoSelected(file);
                photoInput.value = '';  // reset so same file can be re-selected
            });
        }

        // Close photo preview
        document.getElementById('td-photo-preview-close')?.addEventListener('click', () => {
            this.clearPendingPhoto();
        });

        // Drag & Drop image support
        this._bindDragAndDrop();

        // Reset stale state when switching chat
        this.clearPendingPhoto();

        try {
            // Use cache if available, fetch fresh otherwise
            const cached = this.messageCache[chatId];
            const fetchFresh = !cached;
            const url = `${API.BASE_URL}/whatsapp/chats/${chatId}/messages?limit=500${fetchFresh ? '&fetch=1' : ''}`;
            const resp = await API.fetch(url);
            const messages = resp.messages || [];

            this.messageCache[chatId] = messages;
            this._renderMessages(messages);
        } catch (err) {
            console.error('Error loading messages:', err);
            document.getElementById('td-msg-container').innerHTML =
                '<div class="td-message-no-messages" style="color:#ef4444;">Erreur de chargement des messages.</div>';
        }
    },

    _renderMessages(messages) {
        const container = document.getElementById('td-msg-container');
        if (!container) return;

        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="td-message-no-messages">Aucun message texte.</div>';
            return;
        }

        // Sort ascending by timestamp
        const sorted = [...messages].sort((a, b) => {
            const ta = a.timestamp || 0;
            const tb = b.timestamp || 0;
            return ta - tb;
        });

        let html = '';
        let lastDate = '';

        for (const msg of sorted) {
            const ts = (msg.timestamp || 0) * 1000;
            const date = new Date(ts);
            const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            // Date separator
            if (dateStr !== lastDate) {
                html += `<div class="td-msg-date-sep">${dateStr}</div>`;
                lastDate = dateStr;
            }

            const body = msg.text || msg.body || '';
            if (!body.trim() && !msg.media_type) continue;

            const author = msg.from_me ? 'Moi' : (msg.author || 'Inconnu');
            const fromMe = msg.from_me ? ' from-me' : '';

            const msgId = msg.message_id || '';
            const replyData = msgId ? ` data-msg-id="${this._esc(msgId)}" data-author="${this._esc(author)}" data-text="${this._esc((body || '').substring(0, 80))}"` : '';

            // Media content (thumbnail + click for full)
            let mediaHtml = '';
            if (msg.thumbnail && (msg.media_type === 'image' || msg.media_type === 'sticker')) {
                mediaHtml = `<div class="td-msg-media">
                    <img src="data:image/jpeg;base64,${msg.thumbnail}" class="td-msg-thumb"
                         data-msg-id="${this._esc(msgId)}" data-from-me="${msg.from_me ? 1 : 0}" title="Cliquer pour agrandir" />
                </div>`;
            } else if (msg.media_type === 'image' && !msg.thumbnail) {
                mediaHtml = `<div class="td-msg-media">
                    <img class="td-msg-thumb td-msg-thumb-loading" data-msg-id="${this._esc(msgId)}" data-from-me="${msg.from_me ? 1 : 0}"
                         data-auto-load="1" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect fill='%23333' width='120' height='80'/%3E%3Ctext x='50%25' y='50%25' fill='%23888' font-size='12' text-anchor='middle' dominant-baseline='middle'%3E%E2%8C%9B%3C/text%3E%3C/svg%3E"
                         title="Chargement..." style="cursor:pointer;opacity:0.5;" />
                </div>`;
            } else if (msg.media_type === 'video') {
                mediaHtml = `<div class="td-msg-media">
                    ${msg.thumbnail ? `<img src="data:image/jpeg;base64,${msg.thumbnail}" class="td-msg-thumb" />` : ''}
                    <span class="td-msg-media-badge">\u{1F3AC} Video</span>
                </div>`;
            } else if (msg.media_type === 'audio') {
                mediaHtml = '<div class="td-msg-media"><span class="td-msg-media-badge">\u{1F3B5} Audio</span></div>';
            } else if (msg.media_type === 'document') {
                mediaHtml = '<div class="td-msg-media"><span class="td-msg-media-badge">\u{1F4CE} Document</span></div>';
            }

            const bodyHtml = body.trim() && !body.startsWith('[')
                ? `<div class="td-msg-body">${this._linkify(this._esc(body))}</div>`
                : (body.trim() && !mediaHtml ? `<div class="td-msg-body">${this._linkify(this._esc(body))}</div>` : '');

            html += `<div class="td-msg${fromMe}">
                <div class="td-msg-header">
                    <span class="td-msg-author">${this._esc(author)}</span>
                    <span class="td-msg-time">${timeStr}</span>
                    ${msgId ? `<button class="td-msg-reply-btn"${replyData} title="Repondre">&#x21A9;</button>` : ''}
                </div>
                ${mediaHtml}
                ${bodyHtml}
            </div>`;
        }

        container.innerHTML = html || '<div class="td-message-no-messages">Aucun message texte.</div>';

        // Scroll to bottom (most recent)
        container.scrollTop = container.scrollHeight;

        // Auto-load images without thumbnails
        this._autoLoadMissingThumbnails(container);
    },

    // --- Reply ---

    setReplyTo(messageId, author, text) {
        this.replyTo = { message_id: messageId, author, text };
        const preview = document.getElementById('td-reply-preview');
        if (preview) {
            preview.style.display = 'flex';
            preview.querySelector('.td-reply-preview-author').textContent = author;
            preview.querySelector('.td-reply-preview-text').textContent = text;
        }
        document.getElementById('td-msg-input')?.focus();
    },

    clearReply() {
        this.replyTo = null;
        const preview = document.getElementById('td-reply-preview');
        if (preview) preview.style.display = 'none';
    },

    // --- Photo upload ---

    _bindDragAndDrop() {
        const view = document.getElementById('td-message-view');
        const overlay = document.getElementById('td-drop-overlay');
        if (!view || !overlay) return;

        // Counter to handle nested dragenter/dragleave
        let dragDepth = 0;

        const hasFiles = (e) => {
            const types = e.dataTransfer && e.dataTransfer.types;
            if (!types) return false;
            for (const t of types) {
                if (t === 'Files' || t === 'application/x-moz-file') return true;
            }
            return false;
        };

        view.addEventListener('dragenter', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            dragDepth++;
            overlay.style.display = 'flex';
        });

        view.addEventListener('dragover', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        view.addEventListener('dragleave', (e) => {
            if (!hasFiles(e)) return;
            dragDepth--;
            if (dragDepth <= 0) {
                dragDepth = 0;
                overlay.style.display = 'none';
            }
        });

        view.addEventListener('drop', (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            dragDepth = 0;
            overlay.style.display = 'none';

            const files = e.dataTransfer.files;
            if (!files || files.length === 0) return;
            // Take first image file
            const imgFile = Array.from(files).find(f => f.type.startsWith('image/'));
            if (!imgFile) {
                window.Utils?.showToast?.('Format non supporte (image requise)', 'error');
                return;
            }
            this._handlePhotoSelected(imgFile);
        });
    },

    _handlePhotoSelected(file) {
        // Limit ~16MB (WhatsApp Evolution API practical limit)
        const MAX_BYTES = 16 * 1024 * 1024;
        if (!file.type.startsWith('image/')) {
            window.Utils?.showToast?.('Format non supporte (image requise)', 'error');
            return;
        }
        if (file.size > MAX_BYTES) {
            window.Utils?.showToast?.('Photo trop volumineuse (max 16 Mo)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            // dataUrl format: "data:image/jpeg;base64,XXXXX"
            const commaIdx = dataUrl.indexOf(',');
            const base64 = commaIdx >= 0 ? dataUrl.substring(commaIdx + 1) : '';
            this.pendingPhoto = {
                base64,
                mimetype: file.type,
                filename: file.name || 'photo.jpg',
                dataUrl,
                size: file.size
            };
            this._renderPhotoPreview();
        };
        reader.onerror = () => {
            window.Utils?.showToast?.('Erreur de lecture du fichier', 'error');
        };
        reader.readAsDataURL(file);
    },

    _renderPhotoPreview() {
        const preview = document.getElementById('td-photo-preview');
        if (!preview || !this.pendingPhoto) return;
        const img = document.getElementById('td-photo-preview-img');
        const name = document.getElementById('td-photo-preview-name');
        const size = document.getElementById('td-photo-preview-size');
        if (img) img.src = this.pendingPhoto.dataUrl;
        if (name) name.textContent = this.pendingPhoto.filename;
        if (size) size.textContent = this._formatSize(this.pendingPhoto.size);
        preview.style.display = 'flex';
    },

    clearPendingPhoto() {
        this.pendingPhoto = null;
        const preview = document.getElementById('td-photo-preview');
        if (preview) preview.style.display = 'none';
    },

    _formatSize(bytes) {
        if (bytes < 1024) return `${bytes} o`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    },

    // --- Send Message ---

    async sendMessage() {
        if (!this.activeChat) return;

        const input = document.getElementById('td-msg-input');
        const text = (input?.value || '').trim();
        const photo = this.pendingPhoto;

        // Need at least one of: text or photo
        if (!text && !photo) return;

        const sendBtn = document.getElementById('td-msg-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            if (photo) {
                // Send media (with optional caption)
                const payload = {
                    media: photo.base64,
                    mimetype: photo.mimetype,
                    filename: photo.filename
                };
                if (text) payload.caption = text;
                await API.fetch(`${API.BASE_URL}/whatsapp/chats/${this.activeChat}/send-media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // Send text only
                const payload = { text };
                if (this.replyTo) {
                    payload.quoted_message_id = this.replyTo.message_id;
                }
                await API.fetch(`${API.BASE_URL}/whatsapp/chats/${this.activeChat}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            // Clear input + reply + photo
            input.value = '';
            input.style.height = 'auto';
            this.clearReply();
            const photoSentDataUrl = photo ? photo.dataUrl : null;
            this.clearPendingPhoto();

            // Add message locally for instant feedback
            const now = Math.floor(Date.now() / 1000);
            const localMsg = {
                author: 'Moi',
                text,
                timestamp: now,
                from_me: true
            };
            if (photoSentDataUrl) {
                // Strip "data:image/...;base64," prefix for thumbnail field
                const commaIdx = photoSentDataUrl.indexOf(',');
                localMsg.thumbnail = commaIdx >= 0 ? photoSentDataUrl.substring(commaIdx + 1) : '';
                localMsg.media_type = 'image';
            }
            const cached = this.messageCache[this.activeChat] || [];
            cached.push(localMsg);
            this.messageCache[this.activeChat] = cached;
            this._renderMessages(cached);

        } catch (err) {
            console.error('Error sending message:', err);
            window.Utils?.showToast?.(photo ? 'Erreur d\'envoi de la photo' : 'Erreur d\'envoi', 'error');
            if (input) {
                input.style.borderColor = '#ef4444';
                setTimeout(() => { input.style.borderColor = ''; }, 2000);
            }
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            input?.focus();
        }
    },

    // --- Refresh Messages ---

    async refreshMessages() {
        if (!this.activeChat) return;
        const btn = document.getElementById('td-msg-refresh-btn');
        if (btn) { btn.disabled = true; btn.classList.add('syncing'); }

        // Visual feedback: dim container during fetch
        const container = document.getElementById('td-msg-container');
        if (container) {
            container.style.transition = 'opacity 0.15s';
            container.style.opacity = '0.4';
        }

        try {
            const resp = await API.fetch(
                `${API.BASE_URL}/whatsapp/chats/${this.activeChat}/messages?limit=500&fetch=1`);
            const messages = resp.messages || [];
            const oldCount = (this.messageCache[this.activeChat] || []).length;
            this.messageCache[this.activeChat] = messages;
            this._renderMessages(messages);
            const diff = messages.length - oldCount;
            const msg = diff > 0
                ? `+${diff} nouveau(x) message(s)`
                : `${messages.length} messages (a jour)`;
            window.Utils?.showToast?.(msg, diff > 0 ? 'success' : 'info');
        } catch (err) {
            console.error('Refresh error:', err);
            window.Utils?.showToast?.('Erreur de rafraichissement', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.classList.remove('syncing'); }
            // Fade container back in
            if (container) {
                container.style.transition = 'opacity 0.3s';
                container.style.opacity = '1';
            }
        }
    },

    // --- Favorite ---

    async toggleFavorite(chatId) {
        try {
            await API.fetch(`${API.BASE_URL}/whatsapp/chats/${chatId}/favorite`, {
                method: 'PUT'
            });

            // Toggle in local data
            const chat = this.chats.find(c => c.id === chatId);
            if (chat) chat.favorite = !chat.favorite;

            this.renderChatList();
        } catch (err) {
            console.error('Error toggling favorite:', err);
        }
    },

    // --- Auto-load missing thumbnails ---

    _autoLoadMissingThumbnails(container) {
        const imgs = container.querySelectorAll('img[data-auto-load="1"]');
        if (!imgs.length) return;

        const chat = this.chats.find(c => c.id === this.activeChat);
        if (!chat) return;

        for (const img of imgs) {
            const msgId = img.dataset.msgId;
            const fromMe = img.dataset.fromMe === '1';
            if (!msgId) continue;

            const params = `jid=${encodeURIComponent(chat.jid)}${fromMe ? '&from_me=1' : ''}`;
            API.fetch(`${API.BASE_URL}/whatsapp/media/${encodeURIComponent(msgId)}?${params}`)
                .then(resp => {
                    if (resp.base64) {
                        const mime = resp.mimetype || 'image/jpeg';
                        img.src = `data:${mime};base64,${resp.base64}`;
                        img.style.opacity = '1';
                        img.classList.remove('td-msg-thumb-loading');
                        img.removeAttribute('data-auto-load');
                        img.title = 'Cliquer pour agrandir';
                    } else {
                        this._setImgFailed(img);
                    }
                })
                .catch(() => {
                    this._setImgFailed(img);
                });
        }
    },

    _setImgFailed(img) {
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect fill='%23333' width='120' height='80'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-size='10' text-anchor='middle' dominant-baseline='middle'%3EImage expir%C3%A9e%3C/text%3E%3C/svg%3E";
        img.style.opacity = '0.4';
        img.classList.remove('td-msg-thumb-loading');
        img.removeAttribute('data-auto-load');
        img.title = 'Image non disponible';
        img.style.cursor = 'default';
    },

    // --- Full image lightbox ---

    async _showFullImage(messageId, fromMe = false) {
        if (!messageId || !this.activeChat) return;

        const chat = this.chats.find(c => c.id === this.activeChat);
        if (!chat) return;

        // Create lightbox overlay
        const overlay = document.createElement('div');
        overlay.className = 'td-lightbox';
        overlay.innerHTML = '<div class="td-lightbox-loading">Chargement...</div>';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);

        try {
            const params = `jid=${encodeURIComponent(chat.jid)}${fromMe ? '&from_me=1' : ''}`;
            const resp = await API.fetch(
                `${API.BASE_URL}/whatsapp/media/${encodeURIComponent(messageId)}?${params}`
            );
            if (resp.base64) {
                const mime = resp.mimetype || 'image/jpeg';
                overlay.innerHTML = `<img src="data:${mime};base64,${resp.base64}" class="td-lightbox-img" />
                    <button class="td-lightbox-close">&times;</button>`;
                overlay.querySelector('.td-lightbox-close').addEventListener('click', () => overlay.remove());
            } else {
                overlay.innerHTML = '<div class="td-lightbox-loading" style="color:#ef4444;">Image non disponible</div>';
                setTimeout(() => overlay.remove(), 2000);
            }
        } catch (err) {
            console.error('Error loading full image:', err);
            const is404 = err.message && err.message.includes('404');
            const msg = is404
                ? 'Image expirée — le CDN WhatsApp ne conserve pas les anciens médias'
                : 'Erreur de chargement';
            overlay.innerHTML = `<div class="td-lightbox-loading" style="color:#ef4444;">${msg}</div>`;
            setTimeout(() => overlay.remove(), is404 ? 3000 : 2000);
        }
    },

    // --- Helpers ---

    _showEmptyState() {
        this.activeChat = null;
        document.getElementById('td-message-view').innerHTML = `
            <div class="td-message-empty">
                <div class="td-message-empty-icon">&#x1f4ac;</div>
                <p>Selectionnez une conversation</p>
            </div>`;
    },

    _linkify(html) {
        // Convert URLs to clickable links (applied AFTER _esc so HTML is safe)
        return html.replace(
            /(https?:\/\/[^\s<&]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
    },

    _esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

export default whatsappHistModule;
