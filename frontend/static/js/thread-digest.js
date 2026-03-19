/**
 * Thread Digest Module - Multi-platform thread monitoring dashboard
 * Displays Claude-generated digests for monitored threads (WhatsApp, Signal, SMS)
 */

const threadDigestModule = {
    loaded: false,
    threads: [],

    async load() {
        if (!this.loaded) {
            this.bindEvents();
            this.loaded = true;
        }
        await this.refresh();
    },

    bindEvents() {
        // Config modal
        document.getElementById('td-config-btn')?.addEventListener('click', () => this.openConfig());
        document.getElementById('td-config-close')?.addEventListener('click', () => this.closeConfig());
        document.querySelector('.td-modal-backdrop')?.addEventListener('click', () => this.closeConfig());

        // Refresh
        document.getElementById('td-refresh-btn')?.addEventListener('click', () => this.refresh());

        // Add thread form
        document.getElementById('td-add-btn')?.addEventListener('click', () => this.addThread());
        document.getElementById('td-discover-btn')?.addEventListener('click', () => this.discoverChats());
        document.getElementById('td-import-sms-btn')?.addEventListener('click', () => this.importSms());

        // Platform selector toggles discover/import buttons
        document.getElementById('td-add-platform')?.addEventListener('change', (e) => {
            const platform = e.target.value;
            const discoverBtn = document.getElementById('td-discover-btn');
            const importBtn = document.getElementById('td-import-sms-btn');
            const jidInput = document.getElementById('td-add-jid');
            if (discoverBtn) discoverBtn.style.display = (platform === 'sms') ? 'none' : '';
            if (importBtn) importBtn.style.display = (platform === 'sms') ? '' : 'none';
            if (jidInput) {
                const placeholders = { whatsapp: 'JID WhatsApp', signal: 'Group ID Signal', sms: 'Numero de telephone' };
                jidInput.placeholder = placeholders[platform] || 'Identifiant';
            }
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
        const badgeHtml = this._renderCardBadge(status);
        const bodyHtml = d ? this._renderDigestBody(d) : '<div class="td-card-no-digest">Pas encore de digest. Demandez a Claude d\'analyser ce fil.</div>';
        const headerHtml = this._renderCardHeader(thread, index, total, badgeHtml);

        const footerDate = d ? this.formatRelativeDate(d.created_at) : 'Jamais analyse';
        const period = d && d.date_from && d.date_to ? `${d.date_from} → ${d.date_to}` : '';

        return `<div class="td-card${needsClass}">
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
        return '<span class="td-card-badge up-to-date">A jour</span>';
    },

    _renderCardHeader(thread, index, total, badgeHtml) {
        const upDisabled = index === 0 ? ' disabled' : '';
        const downDisabled = index === total - 1 ? ' disabled' : '';
        return `<div class="td-card-header">
            <div class="td-card-reorder">
                <button class="td-move-btn" data-id="${thread.thread_id}" data-dir="up"${upDisabled} title="Monter">&#9650;</button>
                <button class="td-move-btn" data-id="${thread.thread_id}" data-dir="down"${downDisabled} title="Descendre">&#9660;</button>
            </div>
            <div class="td-card-title">
                <span class="td-card-name">${this.escapeHtml(thread.name)}</span>
                <span class="td-card-platform" data-platform="${thread.platform}">${thread.platform}</span>
            </div>
            <div class="td-card-meta">${badgeHtml}</div>
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
            html += `<li class="td-action-item">
                <span class="td-action-bullet">&#9656;</span>
                <span>${this.escapeHtml(a.text)}</span>
                <span class="td-action-urgency ${urgency}">${urgency}</span>
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
        document.getElementById('td-discover-list').style.display = 'none';
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

    async addThread() {
        const nameEl = document.getElementById('td-add-name');
        const jidEl = document.getElementById('td-add-jid');
        const platformEl = document.getElementById('td-add-platform');
        const name = nameEl.value.trim();
        const jid = jidEl.value.trim();
        const platform = platformEl ? platformEl.value : 'whatsapp';

        if (!name || !jid) return;

        try {
            await API.fetch(`${API.BASE_URL}/threads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, jid, platform })
            });
            nameEl.value = '';
            jidEl.value = '';
            await this.loadConfigList();
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
            const resp = await API.fetch(`${API.BASE_URL}/threads/chats?platform=${platform}`);
            const chats = resp.chats || [];

            if (chats.length === 0) {
                listEl.innerHTML = '<p style="padding:8px;color:var(--text-secondary);">Aucun chat trouve (API indisponible?).</p>';
                return;
            }

            listEl.innerHTML = chats.slice(0, 30).map(c => {
                const name = c.name || c.id || 'Sans nom';
                const jid = c.id || c.remoteJid || '';
                return `<div class="td-discover-item" data-jid="${this.escapeHtml(jid)}" data-name="${this.escapeHtml(name)}">
                    <span class="td-discover-item-name">${this.escapeHtml(name)}</span>
                    <span class="td-discover-item-jid">${this.escapeHtml(jid)}</span>
                </div>`;
            }).join('');

            listEl.querySelectorAll('.td-discover-item').forEach(item => {
                item.addEventListener('click', () => {
                    document.getElementById('td-add-name').value = item.dataset.name;
                    document.getElementById('td-add-jid').value = item.dataset.jid;
                    listEl.style.display = 'none';
                });
            });
        } catch (err) {
            listEl.innerHTML = '<p style="padding:8px;color:#ef4444;">Erreur API decouverte.</p>';
        }
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
