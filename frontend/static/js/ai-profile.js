/**
 * AI Profile Module - Draft generation + Notifications
 */

import API from './api.js';
import './api-features.js';
import Utils from './utils.js';

const aiProfileModule = {
    loaded: false,
    contacts: [],
    channels: [],
    mode: 'api',

    async load() {
        if (!this.loaded) {
            await this.loadChannels();
            this._updateChannelSelector();
            this.loaded = true;
        }
        this.loadNotificationStats();
    },

    switchMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.ai-profile-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        const btn = document.getElementById('ai-profile-btn-generate');
        const queueSection = document.getElementById('ai-profile-queue-section');
        const resultSection = document.getElementById('ai-profile-draft-result');
        if (mode === 'queue') {
            btn.textContent = 'Ajouter a la file';
            queueSection.style.display = 'block';
            resultSection.style.display = 'none';
            this.loadQueue();
        } else {
            btn.textContent = 'Generer le brouillon';
            queueSection.style.display = 'none';
        }
    },

    switchSubTab(tabName) {
        document.querySelectorAll('.ai-profile-subtab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === tabName);
        });
        document.querySelectorAll('.ai-profile-subtab-content').forEach(el => {
            el.classList.toggle('active', el.id === `ai-profile-tab-${tabName}`);
        });
        if (tabName === 'notifications') {
            this.loadNotifications();
        }
        if (tabName === 'projectmap') {
            this.renderProjectMap();
        }
        if (tabName === 'dbmap') {
            this.renderDbMap();
        }
    },

    // --- Draft Generation ---

    async loadChannels() {
        try {
            const result = await API.aiProfile.getChannels();
            this.channels = result.data || [];
        } catch {
            this.channels = [{ id: 'email', label: 'Email', status: 'active', corpus: true, send: true }];
        }
    },

    async loadContacts(channel) {
        const select = document.getElementById('ai-profile-contact');
        select.disabled = true;
        select.innerHTML = '<option value="">Chargement...</option>';
        try {
            const result = await API.aiProfile.getContacts(channel);
            this.contacts = result.data || [];
            select.innerHTML = '<option value="">-- Choisir un contact --</option>' +
                this.contacts.map(c => {
                    const label = c.display_name || c.contact_id;
                    const stat = c.email_count
                        ? `${c.email_count} emails`
                        : c.message_count
                            ? `${c.message_count} msgs`
                            : '';
                    const suffix = stat ? ` (${stat})` : '';
                    return `<option value="${c.contact_id}">${this._escapeHtml(label)}${suffix}</option>`;
                }).join('');
            select.disabled = false;
        } catch {
            select.innerHTML = '<option value="">Service indisponible</option>';
            select.disabled = true;
        }
    },

    async _onContactChange() {
        const contactId = document.getElementById('ai-profile-contact').value;
        const infoDiv = document.getElementById('ai-profile-contact-info');
        if (!contactId) {
            infoDiv.style.display = 'none';
            return;
        }
        try {
            const result = await API.aiProfile.getContactContext(contactId);
            const ctx = result.data;
            const contact = this.contacts.find(c => c.contact_id === contactId);
            document.getElementById('ai-profile-contact-lang').textContent =
                ctx.language === 'en' ? 'EN' : 'FR';
            document.getElementById('ai-profile-contact-account').textContent = ctx.account;
            const count = contact?.email_count || contact?.message_count || '?';
            const unit = contact?.email_count ? 'emails' : 'msgs';
            document.getElementById('ai-profile-contact-count').textContent =
                `${count} ${unit}`;
            infoDiv.style.display = 'flex';
        } catch {
            infoDiv.style.display = 'none';
        }
    },

    _updateChannelSelector() {
        const select = document.getElementById('ai-profile-channel');
        select.innerHTML = this.channels
            .filter(ch => ch.status === 'active' || ch.status === 'limited')
            .map(ch => {
                const suffix = ch.status === 'limited' ? ' (limite)' : '';
                return `<option value="${ch.id}">${ch.label}${suffix}</option>`;
            }).join('');
        this._onChannelChange();
    },

    _onChannelChange() {
        const channelId = document.getElementById('ai-profile-channel').value;
        const infoSpan = document.getElementById('ai-profile-channel-info');
        const sendBtn = document.getElementById('ai-profile-btn-send');
        const ch = this.channels.find(c => c.id === channelId);
        if (!ch) {
            infoSpan.style.display = 'none';
            if (sendBtn) sendBtn.style.display = 'none';
            return;
        }
        const parts = [];
        if (ch.corpus) parts.push('corpus');
        if (ch.send) parts.push('envoi');
        if (ch.note) parts.push(ch.note);
        if (parts.length) {
            infoSpan.textContent = parts.join(' | ');
            infoSpan.style.display = 'inline-block';
        } else {
            infoSpan.style.display = 'none';
        }
        if (sendBtn) sendBtn.style.display = ch.send ? 'inline-block' : 'none';
        // Reload contacts for the selected channel
        this.loadContacts(channelId);
    },

    submitDraft() {
        if (this.mode === 'queue') {
            this.addToQueue();
        } else {
            this.generateDraft();
        }
    },

    async generateDraft() {
        const contactId = document.getElementById('ai-profile-contact').value;
        const subject = document.getElementById('ai-profile-subject').value.trim();
        const context = document.getElementById('ai-profile-context').value.trim();

        if (!contactId || !subject || !context) {
            Utils.showToast('Remplir tous les champs', 'error');
            return;
        }

        const btn = document.getElementById('ai-profile-btn-generate');
        btn.disabled = true;
        btn.textContent = 'Generation en cours...';

        try {
            const channel = document.getElementById('ai-profile-channel').value || 'email';
            const result = await API.aiProfile.generateDraft({ contact_id: contactId, subject, context, channel });
            const data = result.data;

            document.getElementById('ai-profile-draft-text').textContent = data.draft;
            document.getElementById('ai-profile-draft-lang').textContent =
                data.language === 'en' ? 'EN' : 'FR';
            document.getElementById('ai-profile-draft-examples').textContent =
                `${data.examples_used} exemples`;
            document.getElementById('ai-profile-draft-tokens').textContent =
                `${data.usage.input_tokens}+${data.usage.output_tokens} tokens`;
            document.getElementById('ai-profile-draft-result').style.display = 'block';

            Utils.showToast('Brouillon genere', 'success');
        } catch (err) {
            Utils.showToast(`Erreur: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Generer le brouillon';
        }
    },

    copyDraft() {
        const text = document.getElementById('ai-profile-draft-text').textContent;
        navigator.clipboard.writeText(text).then(() => {
            Utils.showToast('Copie dans le presse-papier', 'success');
        });
    },

    async sendDraft() {
        const contactId = document.getElementById('ai-profile-contact').value;
        const subject = document.getElementById('ai-profile-subject').value.trim();
        const draftText = document.getElementById('ai-profile-draft-text').textContent;
        const channel = document.getElementById('ai-profile-channel').value || 'email';

        if (!contactId || !draftText) {
            Utils.showToast('Pas de brouillon a envoyer', 'error');
            return;
        }

        const chLabel = this.channels.find(c => c.id === channel)?.label || channel;
        if (!confirm(`Envoyer ce message via ${chLabel} a ${contactId} ?`)) return;

        const btn = document.getElementById('ai-profile-btn-send');
        btn.disabled = true;
        btn.textContent = 'Envoi...';

        try {
            const payload = { channel, to: contactId, body: draftText };
            if (channel === 'email' && subject) payload.subject = subject;
            await API.aiProfile.sendMessage(payload);
            Utils.showToast(`Message envoye via ${chLabel}`, 'success');
        } catch (err) {
            Utils.showToast(`Erreur envoi: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Envoyer';
        }
    },

    // --- Queue Mode ---

    async addToQueue() {
        const contactId = document.getElementById('ai-profile-contact').value;
        const subject = document.getElementById('ai-profile-subject').value.trim();
        const context = document.getElementById('ai-profile-context').value.trim();

        if (!contactId || !subject || !context) {
            Utils.showToast('Remplir tous les champs', 'error');
            return;
        }

        const btn = document.getElementById('ai-profile-btn-generate');
        btn.disabled = true;

        try {
            const channel = document.getElementById('ai-profile-channel').value || 'email';
            await API.aiProfile.addToQueue({ contact_id: contactId, subject, context, channel });
            Utils.showToast('Ajoute a la file d\'attente', 'success');
            document.getElementById('ai-profile-subject').value = '';
            document.getElementById('ai-profile-context').value = '';
            this.loadQueue();
        } catch (err) {
            Utils.showToast(`Erreur: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
        }
    },

    async loadQueue() {
        const listEl = document.getElementById('ai-profile-queue-list');
        try {
            const result = await API.aiProfile.getQueue();
            const items = result.data || [];
            const pending = items.filter(i => i.status === 'pending');
            const done = items.filter(i => i.status === 'done');

            document.getElementById('ai-profile-queue-count').textContent =
                `${pending.length} en attente`;

            if (items.length === 0) {
                listEl.innerHTML = '<div class="ai-profile-empty">Aucun brouillon en file</div>';
                return;
            }

            listEl.innerHTML = items.map(item => this._renderQueueItem(item)).join('');
        } catch {
            listEl.innerHTML = '<div class="ai-profile-empty">Service indisponible</div>';
        }
    },

    _renderQueueItem(item) {
        const isPending = item.status === 'pending';
        const date = item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : '';
        const statusClass = isPending ? 'ai-profile-queue-pending' : 'ai-profile-queue-done';
        const statusLabel = isPending ? 'En attente' : 'Genere';

        let html = `
            <div class="ai-profile-queue-item ${statusClass}">
                <div class="ai-profile-queue-item-header">
                    <strong>${this._escapeHtml(item.contact_id)}</strong>
                    <span class="ai-profile-tag">${statusLabel}</span>
                    ${item.channel ? `<span class="ai-profile-tag" style="background:var(--bg-tertiary)">${this._escapeHtml(item.channel)}</span>` : ''}
                </div>
                <div class="ai-profile-queue-item-subject">${this._escapeHtml(item.subject)}</div>
                <div class="ai-profile-queue-item-context">${this._escapeHtml(item.context)}</div>
                <div class="ai-profile-queue-item-footer">
                    <span class="ai-profile-queue-item-date">${date}</span>
                    <div class="ai-profile-queue-item-actions">`;

        if (!isPending && item.draft_text) {
            html += `<button class="ai-profile-btn-secondary" onclick="window.aiProfileModule.showQueueDraft(${item.id})">Voir</button>`;
        }
        html += `<button class="ai-profile-btn-secondary" onclick="window.aiProfileModule.deleteQueueItem(${item.id})">Supprimer</button>`;
        html += `</div></div></div>`;
        return html;
    },

    showQueueDraft(id) {
        const listEl = document.getElementById('ai-profile-queue-list');
        const item = listEl.querySelector(`[data-queue-id="${id}"]`);
        // Fallback: reload queue and find the item via API
        API.aiProfile.getQueue().then(result => {
            const found = (result.data || []).find(i => i.id === id);
            if (found && found.draft_text) {
                document.getElementById('ai-profile-draft-text').textContent = found.draft_text;
                document.getElementById('ai-profile-draft-lang').textContent =
                    found.language === 'en' ? 'EN' : 'FR';
                document.getElementById('ai-profile-draft-examples').textContent =
                    `${found.examples_used || '?'} exemples`;
                document.getElementById('ai-profile-draft-tokens').textContent = 'session';
                document.getElementById('ai-profile-draft-result').style.display = 'block';
            }
        });
    },

    async deleteQueueItem(id) {
        try {
            await API.aiProfile.deleteFromQueue(id);
            Utils.showToast('Supprime de la file', 'success');
            this.loadQueue();
        } catch (err) {
            Utils.showToast(`Erreur: ${err.message}`, 'error');
        }
    },

    // --- Notifications ---

    async loadNotificationStats() {
        try {
            const result = await API.aiProfile.getNotificationStats();
            const stats = result.data;
            const badge = document.getElementById('ai-profile-notif-badge');
            const unread = stats?.unread || 0;
            if (unread > 0) {
                badge.textContent = unread;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        } catch {
            // Service may be down
        }
    },

    async loadNotifications() {
        const listEl = document.getElementById('ai-profile-notif-list');
        const source = document.getElementById('ai-profile-notif-source')?.value || '';
        const status = document.getElementById('ai-profile-notif-status')?.value || '';

        listEl.innerHTML = '<div class="ai-profile-loading">Chargement...</div>';

        try {
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            if (source) params.set('contact_id', source);
            params.set('limit', '50');

            const result = await API.aiProfile.getNotifications(params.toString());
            const notifications = result.data || [];

            document.getElementById('ai-profile-notif-count').textContent =
                `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`;

            if (notifications.length === 0) {
                listEl.innerHTML = '<div class="ai-profile-empty">Aucune notification</div>';
                return;
            }

            listEl.innerHTML = notifications.map(n => this._renderNotification(n)).join('');
        } catch {
            listEl.innerHTML = '<div class="ai-profile-empty">Service indisponible</div>';
        }
    },

    _renderNotification(n) {
        const sourceIcon = {
            whatsapp: '💬', linkedin: '💼', gmail: '📧', hostinger: '📨'
        }[n.source] || '🔔';
        const isNew = n.status === 'new';
        const date = n.created_at ? new Date(n.created_at).toLocaleString('fr-FR') : '';

        return `
            <div class="ai-profile-notif-item ${isNew ? 'ai-profile-notif-new' : ''}" data-id="${n.id}">
                <div class="ai-profile-notif-icon">${sourceIcon}</div>
                <div class="ai-profile-notif-body">
                    <div class="ai-profile-notif-title">
                        <strong>${this._escapeHtml(n.contact_name || n.contact_id || 'Inconnu')}</strong>
                        <span class="ai-profile-notif-source">${n.source || ''}</span>
                    </div>
                    <div class="ai-profile-notif-preview">${this._escapeHtml(n.preview || n.subject || '')}</div>
                    <div class="ai-profile-notif-date">${date}</div>
                </div>
                ${isNew ? `<button class="ai-profile-btn-mark-read" onclick="window.aiProfileModule.markAsRead(${n.id})">Lu</button>` : ''}
            </div>
        `;
    },

    // --- Project Map (D3 Force-directed graph) ---

    _mapSimulation: null,
    _mapZoom: null,
    _mapApiData: null,
    _pinnedMapNode: null,
    _pinnedDbMapNode: null,

    async _fetchMapData() {
        if (this._mapApiData) return this._mapApiData;
        try {
            const resp = await API.aiProfile.getMapData();
            if (resp && resp.ok) {
                this._mapApiData = resp.data;
                return this._mapApiData;
            }
        } catch (e) {
            console.warn('Map API unavailable, using fallback data');
        }
        return null;
    },

    _convertProjectMapData(json) {
        const nodes = [];
        const links = [];

        // Core node
        nodes.push({
            id: json.core.id, label: json.core.label,
            type: 'core', r: 32, desc: json.core.details
        });

        // Feature nodes + auto-links from core
        for (const f of json.features) {
            nodes.push({
                id: f.id, label: f.label,
                type: 'feature', r: 22, desc: f.details
            });
            links.push({ source: json.core.id, target: f.id });
        }

        // Component nodes + auto-links to parent
        for (const c of json.components) {
            nodes.push({
                id: c.id, label: c.label,
                type: 'component', r: 14, desc: c.details
            });
            if (c.parent) {
                links.push({ source: c.parent, target: c.id });
            }
        }

        // Tech nodes
        for (const t of json.tech) {
            nodes.push({
                id: t.id, label: t.label,
                type: 'tech', r: 12, desc: t.details
            });
        }

        // Explicit cross-links and tech connections
        if (json.links) {
            for (const l of json.links) {
                links.push({ source: l.source, target: l.target });
            }
        }

        return { nodes, links };
    },

    _getProjectMapData() {
        // Minimal fallback when API is unavailable
        return {
            nodes: [
                { id: 'offline', label: 'API indisponible', type: 'core', r: 32,
                  desc: 'Le backend ai-profile (port 5100) ne repond pas. Cliquez Rafraichir apres l\'avoir relance.' }
            ],
            links: []
        };
    },

    async renderProjectMap() {
        if (typeof d3 === 'undefined') return;

        const container = document.getElementById('ai-profile-map-container');
        const svg = d3.select('#ai-profile-map-svg');
        const tooltip = document.getElementById('ai-profile-map-tooltip');

        // Clear previous render
        svg.selectAll('*').remove();

        const width = container.clientWidth;
        const height = container.clientHeight;

        svg.attr('viewBox', [0, 0, width, height]);

        // Fetch from API with fallback to hardcoded data
        let mapData;
        const apiData = await this._fetchMapData();
        if (apiData && apiData.project_map) {
            mapData = this._convertProjectMapData(apiData.project_map);
        } else {
            mapData = this._getProjectMapData();
        }
        const { nodes, links } = mapData;

        const colorMap = {
            core: '#f59e0b',
            feature: '#3b82f6',
            component: '#10b981',
            tech: '#8b5cf6'
        };

        // Zoom behavior
        const g = svg.append('g');

        this._mapZoom = d3.zoom()
            .scaleExtent([0.3, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(this._mapZoom);

        // Links
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', '#334155')
            .attr('stroke-width', d => {
                // Thicker for purpose -> feature links
                const src = nodes.find(n => n.id === d.source || n.id === d.source?.id);
                return src && src.type === 'core' ? 2.5 : 1.2;
            })
            .attr('stroke-opacity', d => {
                const src = nodes.find(n => n.id === d.source || n.id === d.source?.id);
                return src && src.type === 'core' ? 0.6 : 0.3;
            });

        // Nodes
        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('cursor', 'grab')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) this._mapSimulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                    d3.select(event.sourceEvent.target.closest('g')).attr('cursor', 'grabbing');
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) this._mapSimulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                    d3.select(event.sourceEvent.target.closest('g')).attr('cursor', 'grab');
                })
            );

        // Circle backgrounds
        node.append('circle')
            .attr('r', d => d.r)
            .attr('fill', d => colorMap[d.type])
            .attr('fill-opacity', d => d.type === 'core' ? 0.9 : 0.2)
            .attr('stroke', d => colorMap[d.type])
            .attr('stroke-width', d => d.type === 'core' ? 3 : 1.5)
            .attr('stroke-opacity', 0.8);

        // Labels
        node.each(function(d) {
            const lines = d.label.split('\n');
            const el = d3.select(this);
            lines.forEach((line, i) => {
                el.append('text')
                    .text(line)
                    .attr('text-anchor', 'middle')
                    .attr('dy', `${(i - (lines.length - 1) / 2) * 1.1 + 0.35}em`)
                    .attr('fill', d.type === 'core' ? '#1e293b' : '#e2e8f0')
                    .attr('font-size', d.type === 'core' ? '11px' : d.type === 'feature' ? '10px' : '8.5px')
                    .attr('font-weight', d.type === 'core' ? '700' : d.type === 'feature' ? '600' : '400')
                    .attr('pointer-events', 'none');
            });
        });

        // Tooltip
        node.on('mouseenter', (event, d) => {
            tooltip.innerHTML = `<strong>${d.label.replace('\n', ' ')}</strong><br>${d.desc}`;
            tooltip.classList.add('visible');
        })
        .on('mousemove', (event) => {
            tooltip.style.left = `${event.clientX + 14}px`;
            tooltip.style.top = `${event.clientY - 10}px`;
        })
        .on('mouseleave', () => {
            tooltip.classList.remove('visible');
        });

        // Highlight on hover
        node.on('mouseenter.highlight', (event, d) => {
            const connected = new Set();
            connected.add(d.id);
            links.forEach(l => {
                const sid = typeof l.source === 'object' ? l.source.id : l.source;
                const tid = typeof l.target === 'object' ? l.target.id : l.target;
                if (sid === d.id) connected.add(tid);
                if (tid === d.id) connected.add(sid);
            });

            node.select('circle')
                .attr('fill-opacity', n => connected.has(n.id) ? (n.type === 'core' ? 0.9 : 0.5) : 0.08)
                .attr('stroke-opacity', n => connected.has(n.id) ? 1 : 0.2);
            node.selectAll('text')
                .attr('fill-opacity', n => connected.has(n.id) ? 1 : 0.2);
            link
                .attr('stroke-opacity', l => {
                    const sid = typeof l.source === 'object' ? l.source.id : l.source;
                    const tid = typeof l.target === 'object' ? l.target.id : l.target;
                    return (sid === d.id || tid === d.id) ? 0.7 : 0.05;
                })
                .attr('stroke', l => {
                    const sid = typeof l.source === 'object' ? l.source.id : l.source;
                    const tid = typeof l.target === 'object' ? l.target.id : l.target;
                    return (sid === d.id || tid === d.id) ? colorMap[d.type] : '#334155';
                })
                .attr('stroke-width', l => {
                    const sid = typeof l.source === 'object' ? l.source.id : l.source;
                    const tid = typeof l.target === 'object' ? l.target.id : l.target;
                    return (sid === d.id || tid === d.id) ? 2.5 : 1;
                });
        })
        .on('mouseleave.highlight', () => {
            node.select('circle')
                .attr('fill-opacity', d => d.type === 'core' ? 0.9 : 0.2)
                .attr('stroke-opacity', 0.8);
            node.selectAll('text')
                .attr('fill-opacity', 1);
            link
                .attr('stroke', '#334155')
                .attr('stroke-opacity', d => {
                    const src = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
                    return src && src.type === 'core' ? 0.6 : 0.3;
                })
                .attr('stroke-width', d => {
                    const src = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
                    return src && src.type === 'core' ? 2.5 : 1.2;
                });
        });

        // Click to pin detail panel
        node.on('click.pin', (event, d) => {
            if (this._pinnedMapNode === d.id) {
                this.unpinProjectMapNode();
            } else {
                this._showProjectMapDetail(d, colorMap);
            }
        });

        // Force simulation
        this._mapSimulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
                const src = nodes.find(n => n.id === (typeof d.source === 'object' ? d.source.id : d.source));
                if (src && src.type === 'core') return 140;
                if (src && src.type === 'feature') return 80;
                return 60;
            }))
            .force('charge', d3.forceManyBody().strength(d => {
                if (d.type === 'core') return -600;
                if (d.type === 'feature') return -300;
                return -120;
            }))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => d.r + 8))
            .on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                node.attr('transform', d => `translate(${d.x},${d.y})`);
            });
    },

    resetMapZoom() {
        const svg = d3.select('#ai-profile-map-svg');
        if (this._mapZoom) {
            svg.transition().duration(500).call(this._mapZoom.transform, d3.zoomIdentity);
        }
    },

    async refreshProjectMap() {
        this._mapApiData = null;
        this._pinnedMapNode = null;
        const detail = document.getElementById('ai-profile-map-detail');
        if (detail) detail.style.display = 'none';
        await this.renderProjectMap();
    },

    _showProjectMapDetail(d, colorMap) {
        const panel = document.getElementById('ai-profile-map-detail');
        const badge = document.getElementById('ai-profile-map-detail-type');
        const title = document.getElementById('ai-profile-map-detail-title');
        const desc = document.getElementById('ai-profile-map-detail-desc');
        badge.textContent = d.type;
        badge.style.background = colorMap[d.type] + '33';
        badge.style.color = colorMap[d.type];
        title.textContent = d.label.replace('\n', ' ');
        desc.textContent = d.desc;
        panel.style.display = 'block';
        panel.style.borderLeftColor = colorMap[d.type];
        this._pinnedMapNode = d.id;
    },

    unpinProjectMapNode() {
        this._pinnedMapNode = null;
        const panel = document.getElementById('ai-profile-map-detail');
        if (panel) panel.style.display = 'none';
    },

    // --- Database Map (D3 Force-directed graph) ---

    _dbMapSimulation: null,
    _dbMapZoom: null,

    _getDbMapData() {
        // Minimal fallback when API is unavailable
        return {
            nodes: [
                { id: 'offline', label: 'API indisponible', type: 'database', r: 30,
                  desc: 'Le backend ai-profile (port 5100) ne repond pas. Cliquez Rafraichir apres l\'avoir relance.' }
            ],
            links: []
        };
    },

    async renderDbMap() {
        if (typeof d3 === 'undefined') return;

        const container = document.getElementById('ai-profile-dbmap-container');
        const svg = d3.select('#ai-profile-dbmap-svg');
        const tooltip = document.getElementById('ai-profile-dbmap-tooltip');

        svg.selectAll('*').remove();

        const width = container.clientWidth;
        const height = container.clientHeight;
        svg.attr('viewBox', [0, 0, width, height]);

        // Fetch from API with fallback to hardcoded data
        let mapData;
        const apiData = await this._fetchMapData();
        if (apiData && apiData.db_map) {
            mapData = apiData.db_map;
        } else {
            mapData = this._getDbMapData();
        }
        const { nodes, links } = mapData;

        const colorMap = {
            database: '#f59e0b',
            table: '#3b82f6',
            vector: '#8b5cf6'
        };

        const g = svg.append('g');

        this._dbMapZoom = d3.zoom()
            .scaleExtent([0.3, 3])
            .on('zoom', (event) => g.attr('transform', event.transform));
        svg.call(this._dbMapZoom);

        // Links
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', d => d.cross ? '#f59e0b' : '#334155')
            .attr('stroke-width', d => d.cross ? 1.5 : 1.2)
            .attr('stroke-opacity', d => d.cross ? 0.4 : 0.3)
            .attr('stroke-dasharray', d => d.cross ? '5,4' : 'none');

        // Nodes
        const self = this;
        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('cursor', 'grab')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) self._dbMapSimulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end', (event, d) => {
                    if (!event.active) self._dbMapSimulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                })
            );

        // Shapes: rounded rect for tables, circle for databases
        node.each(function(d) {
            const el = d3.select(this);
            const color = colorMap[d.type];
            const isDb = d.type === 'database' || d.type === 'vector';

            if (isDb) {
                el.append('circle')
                    .attr('r', d.r)
                    .attr('fill', color)
                    .attr('fill-opacity', 0.25)
                    .attr('stroke', color)
                    .attr('stroke-width', 2.5)
                    .attr('stroke-opacity', 0.9);
            } else {
                const w = Math.max(d.label.length * 7, 70);
                const h = 28 + (d.rows > 0 ? 10 : 0);
                el.append('rect')
                    .attr('x', -w / 2).attr('y', -h / 2)
                    .attr('width', w).attr('height', h)
                    .attr('rx', 6).attr('ry', 6)
                    .attr('fill', color)
                    .attr('fill-opacity', 0.12)
                    .attr('stroke', color)
                    .attr('stroke-width', 1.5)
                    .attr('stroke-opacity', 0.7);
            }
        });

        // Labels
        node.each(function(d) {
            const el = d3.select(this);
            const isDb = d.type === 'database' || d.type === 'vector';
            el.append('text')
                .text(d.label)
                .attr('text-anchor', 'middle')
                .attr('dy', isDb ? '0.35em' : (d.rows > 0 ? '-0.1em' : '0.35em'))
                .attr('fill', '#e2e8f0')
                .attr('font-size', isDb ? '10px' : '9px')
                .attr('font-weight', isDb ? '700' : '500')
                .attr('pointer-events', 'none');
            if (!isDb && d.rows !== undefined) {
                el.append('text')
                    .text(`${d.rows} rows`)
                    .attr('text-anchor', 'middle')
                    .attr('dy', '1.3em')
                    .attr('fill', '#94a3b8')
                    .attr('font-size', '7.5px')
                    .attr('pointer-events', 'none');
            }
        });

        // Tooltip
        node.on('mouseenter', (event, d) => {
            const rowInfo = d.rows !== undefined ? ` | ${d.rows} rows` : '';
            tooltip.innerHTML = `<strong>${d.label}</strong>${rowInfo}<br>${d.desc}`;
            tooltip.classList.add('visible');
        })
        .on('mousemove', (event) => {
            tooltip.style.left = `${event.clientX + 14}px`;
            tooltip.style.top = `${event.clientY - 10}px`;
        })
        .on('mouseleave', () => tooltip.classList.remove('visible'));

        // Highlight on hover
        node.on('mouseenter.highlight', (event, d) => {
            const connected = new Set([d.id]);
            links.forEach(l => {
                const sid = typeof l.source === 'object' ? l.source.id : l.source;
                const tid = typeof l.target === 'object' ? l.target.id : l.target;
                if (sid === d.id) connected.add(tid);
                if (tid === d.id) connected.add(sid);
            });
            node.selectAll('circle, rect')
                .attr('fill-opacity', n => connected.has(n.id) ? (n.type !== 'table' ? 0.4 : 0.25) : 0.05)
                .attr('stroke-opacity', n => connected.has(n.id) ? 1 : 0.15);
            node.selectAll('text')
                .attr('fill-opacity', n => connected.has(n.id) ? 1 : 0.15);
            link
                .attr('stroke-opacity', l => {
                    const sid = typeof l.source === 'object' ? l.source.id : l.source;
                    const tid = typeof l.target === 'object' ? l.target.id : l.target;
                    return (sid === d.id || tid === d.id) ? 0.8 : 0.04;
                })
                .attr('stroke-width', l => {
                    const sid = typeof l.source === 'object' ? l.source.id : l.source;
                    const tid = typeof l.target === 'object' ? l.target.id : l.target;
                    return (sid === d.id || tid === d.id) ? 2.5 : 1;
                });
        })
        .on('mouseleave.highlight', () => {
            node.selectAll('circle, rect')
                .attr('fill-opacity', d => d.type !== 'table' ? 0.25 : 0.12)
                .attr('stroke-opacity', d => d.type !== 'table' ? 0.9 : 0.7);
            node.selectAll('text').attr('fill-opacity', 1);
            link
                .attr('stroke-opacity', d => d.cross ? 0.4 : 0.3)
                .attr('stroke-width', d => d.cross ? 1.5 : 1.2);
        });

        // Click to pin detail panel
        node.on('click.pin', (event, d) => {
            if (this._pinnedDbMapNode === d.id) {
                this.unpinDbMapNode();
            } else {
                this._showDbMapDetail(d, colorMap);
            }
        });

        // Force simulation
        this._dbMapSimulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
                const src = nodes.find(n => n.id === (typeof d.source === 'object' ? d.source.id : d.source));
                return (src && (src.type === 'database' || src.type === 'vector')) ? 100 : 70;
            }))
            .force('charge', d3.forceManyBody().strength(d => {
                if (d.type === 'database' || d.type === 'vector') return -400;
                return -100;
            }))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => d.r + 12))
            .on('tick', () => {
                link
                    .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
                node.attr('transform', d => `translate(${d.x},${d.y})`);
            });
    },

    resetDbMapZoom() {
        const svg = d3.select('#ai-profile-dbmap-svg');
        if (this._dbMapZoom) {
            svg.transition().duration(500).call(this._dbMapZoom.transform, d3.zoomIdentity);
        }
    },

    async refreshDbMap() {
        this._mapApiData = null;
        this._pinnedDbMapNode = null;
        const detail = document.getElementById('ai-profile-dbmap-detail');
        if (detail) detail.style.display = 'none';
        await this.renderDbMap();
    },

    _showDbMapDetail(d, colorMap) {
        const panel = document.getElementById('ai-profile-dbmap-detail');
        const badge = document.getElementById('ai-profile-dbmap-detail-type');
        const title = document.getElementById('ai-profile-dbmap-detail-title');
        const desc = document.getElementById('ai-profile-dbmap-detail-desc');
        badge.textContent = d.type;
        badge.style.background = colorMap[d.type] + '33';
        badge.style.color = colorMap[d.type];
        title.textContent = d.label;
        const rowInfo = d.rows !== undefined ? ` (${d.rows} rows)` : '';
        desc.textContent = d.desc + rowInfo;
        panel.style.display = 'block';
        panel.style.borderLeftColor = colorMap[d.type];
        this._pinnedDbMapNode = d.id;
    },

    unpinDbMapNode() {
        this._pinnedDbMapNode = null;
        const panel = document.getElementById('ai-profile-dbmap-detail');
        if (panel) panel.style.display = 'none';
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    async markAsRead(id) {
        try {
            await API.aiProfile.markAsRead(id);
            this.loadNotifications();
            this.loadNotificationStats();
        } catch (err) {
            Utils.showToast(`Erreur: ${err.message}`, 'error');
        }
    },

    async triggerScan() {
        try {
            Utils.showToast('Scan en cours...', 'info');
            await API.aiProfile.triggerScan();
            Utils.showToast('Scan termine', 'success');
            this.loadNotifications();
            this.loadNotificationStats();
        } catch (err) {
            Utils.showToast(`Erreur scan: ${err.message}`, 'error');
        }
    }
};

window.aiProfileModule = aiProfileModule;

export default aiProfileModule;
