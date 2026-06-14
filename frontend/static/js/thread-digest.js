/**
 * Thread Digest Module - Multi-platform thread monitoring dashboard
 * Displays Claude-generated digests for monitored threads (WhatsApp, Signal, SMS)
 */

import whatsappHistModule from './whatsapp-historique.js?v=10';

const threadDigestModule = {
    loaded: false,
    threads: [],
    activeTab: 'historique',
    digestsEditMode: false,

    async load() {
        if (!this.loaded) {
            this.bindEvents();
            this.loaded = true;
        }
        // Refresh digests in background (still needed when user switches tab)
        this.refresh();
        // Auto-load WhatsApp historique (now the default landing tab)
        if (this.activeTab === 'historique') {
            whatsappHistModule.load();
        }
    },

    bindEvents() {
        // Config modal (fils surveilles)
        document.getElementById('td-config-btn')?.addEventListener('click', () => this.openConfig());
        // Add thread modal
        document.getElementById('td-add-thread-btn')?.addEventListener('click', () => this.openAddModal());
        // Close buttons & backdrops (both modals via data-modal)
        document.querySelectorAll('.td-modal-close, .td-modal-backdrop').forEach(el => {
            el.addEventListener('click', () => {
                const which = el.dataset.modal;
                if (which === 'config') this.closeConfig();
                else if (which === 'add') this.closeAddModal();
            });
        });

        // Refresh (digests only — historique manages its own sync)
        document.getElementById('td-refresh-btn')?.addEventListener('click', () => {
            if (this.activeTab === 'digests') this.refresh();
        });

        // Sub-tabs
        document.querySelectorAll('.td-subtab').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.subtab));
        });

        // Digests edit mode toggle
        document.getElementById('td-digests-edit-btn')?.addEventListener('click', () => this.toggleDigestsEditMode());

        // Add thread form
        document.getElementById('td-add-btn')?.addEventListener('click', () => this.addThread());
        document.getElementById('td-import-sms-btn')?.addEventListener('click', () => this.importSms());

        // Auto-discover: typing in name field triggers discovery (debounced)
        let discoverTimer = null;
        document.getElementById('td-add-name')?.addEventListener('input', (e) => {
            const q = (e.target.value || '').trim();
            if (q.length < 2) {
                document.getElementById('td-discover-list').style.display = 'none';
                return;
            }
            // If chats already fetched, just filter
            if (this._discoverChats && this._discoverChats.length > 0) {
                this._filterDiscoverList(q);
                return;
            }
            // Otherwise fetch with debounce
            clearTimeout(discoverTimer);
            discoverTimer = setTimeout(() => this.discoverChats(), 300);
        });

        // Platform selector toggles import button
        document.getElementById('td-add-platform')?.addEventListener('change', (e) => {
            const platform = e.target.value;
            const importBtn = document.getElementById('td-import-sms-btn');
            const jidInput = document.getElementById('td-add-jid');
            if (importBtn) importBtn.style.display = (platform === 'sms') ? '' : 'none';
            if (jidInput) {
                const placeholders = { whatsapp: 'JID WhatsApp', signal: 'Group ID Signal', sms: 'Numero de telephone' };
                jidInput.placeholder = placeholders[platform] || 'Identifiant';
            }
            // Reset discover cache on platform change
            this._discoverChats = null;
        });

        // Move buttons — event delegation (robust after innerHTML replace)
        document.getElementById('td-cards')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.td-move-btn');
            if (!btn || btn.disabled) return;
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.id;
            const dir = btn.dataset.dir;
            console.log('[TD] Move click (delegation):', { id, dir });
            this.moveThread(id, dir);
        });

        // Delete button — event delegation (robust after innerHTML replace)
        document.getElementById('td-cards')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.td-card-delete-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const id = parseInt(btn.dataset.deleteId);
            console.log('[TD] Delete click (delegation):', { id, deleteId: btn.dataset.deleteId });
            this.deleteThreadFromCard(id);
        });

        // Card checkbox — event delegation
        document.getElementById('td-cards')?.addEventListener('change', (e) => {
            const cb = e.target.closest('.td-card-cb');
            if (!cb) return;
            const id = parseInt(cb.dataset.id);
            this.toggleThreadMark(id, cb.checked);
        });

        // Select all checkbox
        document.getElementById('td-select-all-cb')?.addEventListener('change', (e) => {
            this.toggleAllMarks(e.target.checked);
        });

        // Mark selected button
        document.getElementById('td-update-selected-btn')?.addEventListener('click', () => {
            this.saveMarks();
        });
    },

    async refresh() {
        const cardsEl = document.getElementById('td-cards');
        const emptyEl = document.getElementById('td-empty');

        try {
            // Fetch latest digests and status in parallel
            const [latestResp, statusResp] = await Promise.all([
                API.fetch(`${API.BASE_URL}/threads/digests/latest`),
                API.fetch(`${API.BASE_URL}/threads/status`).catch(() => null)
            ]);

            this.threads = latestResp.threads || [];
            const statusMap = {};
            if (statusResp && statusResp.threads) {
                statusResp.threads.forEach(s => { statusMap[s.thread_id] = s; });
            }

            // Update status indicator
            this.updateStatus(statusResp);

            if (this.threads.length === 0) {
                cardsEl.style.display = 'none';
                emptyEl.style.display = 'block';
                return;
            }

            cardsEl.style.display = 'flex';
            emptyEl.style.display = 'none';
            this.renderCards(this.threads, statusMap);
            this._updateSelectionUI();

        } catch (err) {
            console.error('Thread Digest refresh error:', err);
            cardsEl.innerHTML = '<p style="color:#ef4444;padding:20px;">Erreur de chargement des digests.</p>';
        }
    },

    updateStatus(statusResp) {
        const dot = document.getElementById('td-status-dot');
        const text = document.getElementById('td-status-text');
        if (!dot || !text) return;

        if (!statusResp) {
            dot.className = 'td-status-indicator error';
            text.textContent = 'API indisponible';
            return;
        }

        const needs = statusResp.needs_analysis || 0;
        const total = statusResp.total || 0;

        if (needs === 0) {
            dot.className = 'td-status-indicator ok';
            text.textContent = `${total} fil(s) — tous a jour`;
        } else {
            dot.className = 'td-status-indicator needs';
            text.textContent = `${needs}/${total} fil(s) a analyser`;
        }
    },

    renderCards(threads, statusMap) {
        const cardsEl = document.getElementById('td-cards');
        cardsEl.innerHTML = threads.map((t, idx) =>
            this.renderCard(t, statusMap[t.thread_id], idx, threads.length)
        ).join('');

    },

    renderCard(thread, status, index, total) {
        const d = thread.digest;
        const needsClass = (status && status.needs_analysis) ? ' needs-analysis' : '';
        const markedClass = thread.marked_for_update ? ' marked-for-update' : '';
        const badgeHtml = this._renderCardBadge(status);
        const bodyHtml = d ? this._renderDigestBody(d) : '<div class="td-card-no-digest">Pas encore de digest. Demandez a Claude d\'analyser ce fil.</div>';
        const headerHtml = this._renderCardHeader(thread, index, total, badgeHtml);

        const footerDate = d ? this.formatRelativeDate(d.created_at) : 'Jamais analyse';
        const period = d && d.date_from && d.date_to ? `${d.date_from} → ${d.date_to}` : '';

        return `<div class="td-card${needsClass}${markedClass}" data-thread-id="${thread.thread_id}">
            ${headerHtml}
            <div class="td-card-body">${bodyHtml}</div>
            <div class="td-card-footer">
                <span>${footerDate}</span>
                <span>${period}</span>
            </div>
        </div>`;
    },

    _renderCardBadge(status) {
        if (!status) return '';
        if (status.needs_analysis) {
            const label = status.new_messages > 0 ? `${status.new_messages} nouveaux` : 'A analyser';
            return `<span class="td-card-badge new-msgs">${label}</span>`;
        }
        if (!status.proxy_available) {
            return '<span class="td-card-badge" style="background:#e67e22;color:#fff">Inconnu</span>';
        }
        return '<span class="td-card-badge up-to-date">A jour</span>';
    },

    _renderCardHeader(thread, index, total, badgeHtml) {
        const upDisabled = index === 0 ? ' disabled' : '';
        const downDisabled = index === total - 1 ? ' disabled' : '';
        const checked = thread.marked_for_update ? ' checked' : '';
        return `<div class="td-card-header">
            <div class="td-card-checkbox-wrap">
                <input type="checkbox" class="td-checkbox td-card-cb" data-id="${thread.thread_id}"${checked}>
            </div>
            <div class="td-card-reorder">
                <button class="td-move-btn" data-id="${thread.thread_id}" data-dir="up"${upDisabled} title="Monter">&#9650;</button>
                <button class="td-move-btn" data-id="${thread.thread_id}" data-dir="down"${downDisabled} title="Descendre">&#9660;</button>
            </div>
            <div class="td-card-title">
                <span class="td-card-name">${this.escapeHtml(thread.name)}</span>
                <span class="td-card-platform" data-platform="${thread.platform}">${thread.platform}</span>
            </div>
            <div class="td-card-meta">
                ${badgeHtml}
                <button class="td-card-delete-btn" data-delete-id="${thread.thread_id}" title="Supprimer ce fil">&#10005;</button>
            </div>
        </div>`;
    },

    _renderDigestBody(d) {
        let html = `<div class="td-summary">
            <div class="td-summary-text">${this.escapeHtml(d.summary)}</div>
            <div class="td-summary-date">${this.formatRelativeDate(d.created_at)} — ${d.message_count} messages</div>
        </div>`;

        html += this._renderActionItems(d.action_items || []);
        html += this._renderLinks(d.extracted_links || []);
        html += this._renderTopics(d.key_topics || []);
        return html;
    },

    _renderActionItems(actions) {
        if (actions.length === 0) return '';
        let html = '<div class="td-section-title">Actions</div><ul class="td-actions-list">';
        actions.forEach(a => {
            const urgency = a.urgency || 'medium';
            let linksHtml = '';
            if (a.links && a.links.length > 0) {
                linksHtml = '<div class="td-action-links">' +
                    a.links.map(l => `<a href="${this.escapeHtml(l.url)}" target="_blank" class="td-action-link">${this.escapeHtml(l.title || l.url)}</a>`).join('') +
                    '</div>';
            }
            html += `<li class="td-action-item">
                <span class="td-action-bullet">&#9656;</span>
                <span>${this.escapeHtml(a.text)}</span>
                <span class="td-action-urgency ${urgency}">${urgency}</span>
                ${linksHtml}
            </li>`;
        });
        return html + '</ul>';
    },

    _renderLinks(links) {
        if (links.length === 0) return '';
        let html = '<div class="td-section-title">Liens</div><ul class="td-links-list">';
        links.forEach(l => {
            const title = l.title || l.url;
            const ctx = l.context ? ` <span class="td-link-context">— ${this.escapeHtml(l.context)}</span>` : '';
            html += `<li class="td-link-item"><a href="${this.escapeHtml(l.url)}" target="_blank">${this.escapeHtml(title)}</a>${ctx}</li>`;
        });
        return html + '</ul>';
    },

    _renderTopics(topics) {
        if (topics.length === 0) return '';
        return '<div class="td-topics">' +
            topics.map(t => `<span class="td-topic-tag">${this.escapeHtml(t)}</span>`).join('') +
            '</div>';
    },

    // --- Config Modal ---

    async openConfig() {
        document.getElementById('td-config-modal').style.display = 'flex';
        await this.loadConfigList();
    },

    closeConfig() {
        document.getElementById('td-config-modal').style.display = 'none';
    },

    openAddModal() {
        document.getElementById('td-add-modal').style.display = 'flex';
    },

    closeAddModal() {
        document.getElementById('td-add-modal').style.display = 'none';
        document.getElementById('td-discover-list').style.display = 'none';
        this._discoverChats = null;
    },

    async loadConfigList() {
        const listEl = document.getElementById('td-config-list');
        try {
            const resp = await API.fetch(`${API.BASE_URL}/threads`);
            const threads = resp.threads || [];

            if (threads.length === 0) {
                listEl.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;">Aucun fil configure.</p>';
                return;
            }

            listEl.innerHTML = threads.map(t => `
                <div class="td-config-item" data-id="${t.id}">
                    <div class="td-config-item-info">
                        <span class="td-config-item-name">${this.escapeHtml(t.name)}</span>
                        <span class="td-card-platform" data-platform="${t.platform}">${t.platform}</span>
                        <span class="td-config-item-jid">${this.escapeHtml(t.jid)}</span>
                    </div>
                    <div class="td-config-item-actions">
                        <button class="td-toggle ${t.enabled ? 'on' : 'off'}" data-id="${t.id}" data-enabled="${t.enabled}"></button>
                        <button class="td-delete-btn" data-id="${t.id}">Suppr</button>
                    </div>
                </div>
            `).join('');

            // Bind toggle/delete
            listEl.querySelectorAll('.td-toggle').forEach(btn => {
                btn.addEventListener('click', () => this.toggleThread(btn.dataset.id, btn.dataset.enabled !== '1'));
            });
            listEl.querySelectorAll('.td-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => this.deleteThread(btn.dataset.id));
            });
        } catch (err) {
            listEl.innerHTML = '<p style="color:#ef4444;">Erreur chargement.</p>';
        }
    },

    phoneToJid(input) {
        // Convert French phone numbers to WhatsApp JID
        let cleaned = input.replace(/[\s.\-()]/g, '');
        // Already a JID?
        if (cleaned.includes('@')) return cleaned;
        // +33... -> 33...
        if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
        // 06... or 07... -> 336... or 337...
        if (/^0[67]\d{8}$/.test(cleaned)) cleaned = '33' + cleaned.slice(1);
        // Append WhatsApp suffix for phone numbers
        if (/^\d{8,15}$/.test(cleaned)) return cleaned + '@s.whatsapp.net';
        return input; // return as-is if unrecognized
    },

    async addThread() {
        const nameEl = document.getElementById('td-add-name');
        const jidEl = document.getElementById('td-add-jid');
        const platformEl = document.getElementById('td-add-platform');
        const name = nameEl.value.trim();
        let jid = jidEl.value.trim();
        const platform = platformEl ? platformEl.value : 'whatsapp';

        if (!name || !jid) return;

        // Auto-convert phone number to JID for WhatsApp
        if (platform === 'whatsapp') {
            jid = this.phoneToJid(jid);
        }

        try {
            await API.fetch(`${API.BASE_URL}/threads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, jid, platform })
            });
            nameEl.value = '';
            jidEl.value = '';
            this.closeAddModal();
            // Open config modal to show the new thread
            await this.openConfig();
        } catch (err) {
            console.error('Error adding thread:', err);
        }
    },

    async toggleThread(id, enabled) {
        try {
            await API.fetch(`${API.BASE_URL}/threads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            await this.loadConfigList();
        } catch (err) {
            console.error('Error toggling thread:', err);
        }
    },

    async deleteThread(id) {
        if (!confirm('Supprimer ce fil et ses digests ?')) return;
        try {
            await API.fetch(`${API.BASE_URL}/threads/${id}`, { method: 'DELETE' });
            await this.loadConfigList();
        } catch (err) {
            console.error('Error deleting thread:', err);
        }
    },

    async discoverChats() {
        const listEl = document.getElementById('td-discover-list');
        const platform = document.getElementById('td-add-platform')?.value || 'whatsapp';
        listEl.style.display = 'flex';
        listEl.innerHTML = '<p style="padding:8px;color:var(--text-secondary);">Recherche des chats...</p>';

        try {
            let chats = [];
            let source = 'live';

            // Use all-chats (groups + individuals) as primary for WhatsApp
            if (platform === 'whatsapp') {
                try {
                    const resp = await API.fetch(`${API.BASE_URL}/threads/all-chats`);
                    chats = resp.chats || [];
                    source = resp.source || 'evolution';
                } catch (_) { /* API down */ }
            } else {
                try {
                    const resp = await API.fetch(`${API.BASE_URL}/threads/chats?platform=${platform}`);
                    chats = resp.chats || [];
                } catch (_) { /* API down */ }
            }

            if (chats.length === 0) {
                listEl.innerHTML = `<p style="padding:8px;color:var(--text-secondary);">
                    Aucun chat trouve (API indisponible?).<br>
                    <small>Entrez le nom et le numero de tel (ex: 06 12 34 56 78) manuellement.</small>
                </p>`;
                return;
            }

            // Filter out @lid JIDs (linked device IDs, not useful for monitoring)
            chats = chats.filter(c => !(c.jid || '').endsWith('@lid'));

            // Store (exclude @lid linked contacts) and filter with current query
            this._discoverChats = chats.filter(c => c.type !== 'linked');
            const q = (document.getElementById('td-add-name')?.value || '').trim();
            this._filterDiscoverList(q);
        } catch (err) {
            listEl.innerHTML = '<p style="padding:8px;color:#ef4444;">Erreur API decouverte.</p>';
        }
    },

    _normalize(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    },

    _filterDiscoverList(query) {
        const listEl = document.getElementById('td-discover-list');
        if (!this._discoverChats) return;

        const q = this._normalize(query);
        const filtered = this._discoverChats.filter(c =>
            this._normalize(c.name || '').includes(q) ||
            this._normalize(c.jid || '').includes(q));

        listEl.style.display = 'flex';
        listEl.innerHTML = '';
        if (filtered.length === 0) {
            listEl.innerHTML = '<p style="padding:8px;color:var(--text-secondary);">Aucun resultat</p>';
            return;
        }

        const nameInput = document.getElementById('td-add-name');
        const frag = document.createDocumentFragment();
        filtered.slice(0, 100).forEach(c => {
            const name = c.name || c.id || 'Sans nom';
            const jid = c.jid || c.id || c.remoteJid || '';
            const configured = c.configured ? ' td-discover-configured' : '';
            const badge = c.configured ? '<span style="color:var(--accent);font-size:0.75rem;"> ✓ suivi</span>' : '';
            const type = c.type === 'group' ? '👥' : '👤';
            const div = document.createElement('div');
            div.className = `td-discover-item${configured}`;
            div.dataset.jid = jid;
            div.dataset.name = name;
            div.innerHTML = `<span class="td-discover-item-name">${type} ${this.escapeHtml(name)}${badge}</span>
                <span class="td-discover-item-jid">${this.escapeHtml(jid)}</span>`;
            div.addEventListener('click', () => {
                nameInput.value = name;
                document.getElementById('td-add-jid').value = jid;
                listEl.style.display = 'none';
            });
            frag.appendChild(div);
        });
        listEl.appendChild(frag);
    },

    async importSms() {
        const path = prompt('Chemin du fichier XML (SMS Backup & Restore) :');
        if (!path || !path.trim()) return;

        try {
            const resp = await API.fetch(`${API.BASE_URL}/threads/sms/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path.trim() })
            });
            alert(`${resp.imported || 0} SMS importes avec succes.`);
        } catch (err) {
            console.error('Error importing SMS:', err);
            alert('Erreur lors de l\'import SMS.');
        }
    },

    async moveThread(id, direction) {
        try {
            await API.fetch(`${API.BASE_URL}/threads/${id}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ direction })
            });
            await this.refresh();
        } catch (err) {
            console.error('Error moving thread:', err);
        }
    },

    toggleDigestsEditMode() {
        this.digestsEditMode = !this.digestsEditMode;
        const btn = document.getElementById('td-digests-edit-btn');
        const container = document.getElementById('td-cards');
        if (btn) {
            btn.innerHTML = this.digestsEditMode ? '&#10003; Terminer' : '&#9998; Editer';
            btn.classList.toggle('active', this.digestsEditMode);
        }
        if (container) {
            container.classList.toggle('edit-mode', this.digestsEditMode);
        }
    },

    // ------------------------------------------------------------------
    // Mark for update (checkboxes)
    // ------------------------------------------------------------------

    toggleThreadMark(threadId, checked) {
        // Update local state
        const thread = this.threads.find(t => t.thread_id === threadId);
        if (thread) thread.marked_for_update = checked;

        // Update card CSS
        const card = document.querySelector(`.td-card[data-thread-id="${threadId}"]`);
        if (card) card.classList.toggle('marked-for-update', checked);

        // Persist to backend
        API.fetch(`${API.BASE_URL}/threads/mark-for-update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thread_ids: [threadId], marked: checked })
        }).catch(err => console.error('Error marking thread:', err));

        this._updateSelectionUI();
    },

    async toggleAllMarks(checked) {
        const ids = this.threads.map(t => t.thread_id);
        // Update local state
        this.threads.forEach(t => { t.marked_for_update = checked; });

        // Update all checkboxes
        document.querySelectorAll('.td-card-cb').forEach(cb => { cb.checked = checked; });

        // Update card CSS
        document.querySelectorAll('.td-card').forEach(card => {
            card.classList.toggle('marked-for-update', checked);
        });

        // Persist to backend
        try {
            await API.fetch(`${API.BASE_URL}/threads/mark-for-update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ thread_ids: ids, marked: checked })
            });
        } catch (err) {
            console.error('Error marking all threads:', err);
        }

        this._updateSelectionUI();
    },

    async saveMarks() {
        // The marks are already saved via toggleThreadMark/toggleAllMarks.
        // This button provides visual feedback that selection is persisted.
        const btn = document.getElementById('td-update-selected-btn');
        if (btn) {
            btn.textContent = 'Marques enregistrees !';
            btn.disabled = true;
            setTimeout(() => {
                this._updateSelectionUI();
            }, 1500);
        }
    },

    _updateSelectionUI() {
        const count = this.threads.filter(t => t.marked_for_update).length;
        const total = this.threads.length;

        // Update counter
        const countEl = document.getElementById('td-selected-count');
        if (countEl) countEl.textContent = count;

        // Update button state
        const btn = document.getElementById('td-update-selected-btn');
        if (btn) {
            btn.disabled = count === 0;
            btn.innerHTML = `&#10003; Marquer (<span id="td-selected-count">${count}</span>)`;
        }

        // Update select-all checkbox state
        const selectAll = document.getElementById('td-select-all-cb');
        if (selectAll) {
            selectAll.checked = count === total && total > 0;
            selectAll.indeterminate = count > 0 && count < total;
        }
    },

    async deleteThreadFromCard(id) {
        if (!confirm('Supprimer ce fil et ses digests ?')) return;
        try {
            await API.fetch(`${API.BASE_URL}/threads/${id}`, { method: 'DELETE' });
            await this.refresh();
            // Restore edit mode after refresh
            if (this.digestsEditMode) {
                document.getElementById('td-cards')?.classList.add('edit-mode');
            }
        } catch (err) {
            console.error('Error deleting thread:', err);
        }
    },

    // --- Sub-tabs ---

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.td-subtab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === tab);
        });
        document.getElementById('td-tab-digests').style.display = (tab === 'digests') ? '' : 'none';
        document.getElementById('td-tab-historique').style.display = (tab === 'historique') ? '' : 'none';

        if (tab === 'historique') {
            whatsappHistModule.load();
        }
    },

    // --- Helpers ---

    formatRelativeDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now - date;
            const diffMin = Math.floor(diffMs / 60000);
            const diffH = Math.floor(diffMin / 60);
            const diffD = Math.floor(diffH / 24);

            if (diffMin < 1) return "A l'instant";
            if (diffMin < 60) return `Il y a ${diffMin}min`;
            if (diffH < 24) return `Il y a ${diffH}h`;
            if (diffD < 7) return `Il y a ${diffD}j`;
            return date.toLocaleDateString('fr-FR');
        } catch {
            return dateStr;
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

export default threadDigestModule;
