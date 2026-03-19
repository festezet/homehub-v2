/**
 * AI Profile Module - Draft generation + Notifications
 */

import API from './api.js';
import './api-features.js';
import Utils from './utils.js';

const aiProfileModule = {
    loaded: false,
    contacts: [],
    mode: 'api',

    async load() {
        if (!this.loaded) {
            await this.loadContacts();
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

    async loadContacts() {
        const searchInput = document.getElementById('ai-profile-contact-search');
        const dropdown = document.getElementById('ai-profile-contact-dropdown');
        try {
            const result = await API.aiProfile.getContacts();
            this.contacts = result.data || [];
            searchInput.placeholder = `Rechercher parmi ${this.contacts.length} contacts...`;
            this._setupContactSearch(searchInput, dropdown);
        } catch {
            searchInput.placeholder = 'Service indisponible';
            searchInput.disabled = true;
        }
    },

    _setupContactSearch(input, dropdown) {
        let highlightIdx = -1;

        const showDropdown = (items) => {
            if (items.length === 0) {
                dropdown.innerHTML = '<div class="ai-profile-search-no-result">Aucun contact</div>';
            } else {
                dropdown.innerHTML = items.map((c, i) => `
                    <div class="ai-profile-search-item ${i === highlightIdx ? 'highlighted' : ''}"
                         data-contact-id="${c.contact_id}" data-index="${i}">
                        <span class="ai-profile-search-name">${this._escapeHtml(c.contact_id)}</span>
                        <span class="ai-profile-search-count">${c.email_count} emails</span>
                    </div>
                `).join('');
            }
            dropdown.classList.add('visible');
        };

        const selectContact = (contactId) => {
            const contact = this.contacts.find(c => c.contact_id === contactId);
            if (!contact) return;
            input.value = contact.contact_id;
            document.getElementById('ai-profile-contact').value = contactId;
            dropdown.classList.remove('visible');
            highlightIdx = -1;
            this._onContactChange();
        };

        const filterContacts = () => {
            const q = input.value.toLowerCase().trim();
            if (!q) return this.contacts.slice(0, 20);
            return this.contacts.filter(c => c.contact_id.toLowerCase().includes(q));
        };

        input.addEventListener('focus', () => {
            highlightIdx = -1;
            showDropdown(filterContacts());
        });

        input.addEventListener('input', () => {
            highlightIdx = -1;
            // Clear selection if user edits text
            document.getElementById('ai-profile-contact').value = '';
            document.getElementById('ai-profile-contact-info').style.display = 'none';
            showDropdown(filterContacts());
        });

        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.ai-profile-search-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightIdx = Math.min(highlightIdx + 1, items.length - 1);
                items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIdx));
                items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightIdx = Math.max(highlightIdx - 1, 0);
                items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIdx));
                items[highlightIdx]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlightIdx >= 0 && items[highlightIdx]) {
                    selectContact(items[highlightIdx].dataset.contactId);
                }
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('visible');
            }
        });

        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.ai-profile-search-item');
            if (item) selectContact(item.dataset.contactId);
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ai-profile-search-wrapper')) {
                dropdown.classList.remove('visible');
            }
        });
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
            document.getElementById('ai-profile-contact-count').textContent =
                `${contact?.email_count || '?'} emails`;
            infoDiv.style.display = 'flex';
        } catch {
            infoDiv.style.display = 'none';
        }
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
            const result = await API.aiProfile.generateDraft({ contact_id: contactId, subject, context });
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
            await API.aiProfile.addToQueue({ contact_id: contactId, subject, context });
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

    _getProjectMapData() {
        const nodes = [
            // Core purpose
            { id: 'purpose', label: 'AI Profile', type: 'core', r: 32,
              desc: 'Rendre le profil de consultant offshore wind visible et parsable par les agents AI. Architecture agent-first.' },

            // Feature groups
            { id: 'discovery', label: 'Discovery', type: 'feature', r: 22,
              desc: 'Profil structure JSON-LD schema.org, decouvrable par les agents AI et moteurs de recherche.' },
            { id: 'notifications', label: 'Notifications', type: 'feature', r: 22,
              desc: 'Scan periodique des boites mail pour detecter les emails de contacts professionnels cibles.' },
            { id: 'messaging', label: 'Messaging', type: 'feature', r: 22,
              desc: 'Communication multi-canal : WhatsApp et LinkedIn depuis une interface unifiee.' },
            { id: 'email-style', label: 'Email Style\nLearning', type: 'feature', r: 22,
              desc: 'Apprentissage du style d\'ecriture par correspondant pour generation de brouillons personnalises.' },
            { id: 'documents', label: 'Documents', type: 'feature', r: 22,
              desc: 'Base de donnees de documents et pieces jointes Gmail, triees et indexees.' },
            { id: 'crm', label: 'CRM', type: 'feature', r: 22,
              desc: 'Base de donnees unifiee des contacts professionnels, partagee entre les modules.' },
            { id: 'references', label: 'Personal\nReferences', type: 'feature', r: 20,
              desc: 'Base de references personnelles retrouvables par Claude (docs, liens, rappels).' },

            // Discovery components
            { id: 'jsonld', label: 'JSON-LD', type: 'component', r: 14,
              desc: 'Profil schema.org/Person avec CV, skills, projets en format structure.' },
            { id: 'openapi', label: 'OpenAPI', type: 'component', r: 14,
              desc: 'Specification OpenAPI pour les endpoints API du profil.' },
            { id: 'llmstxt', label: 'llms.txt', type: 'component', r: 14,
              desc: 'Fichier convention pour decouverte par agents LLM.' },
            { id: 'portfolio', label: '19 Projets', type: 'component', r: 14,
              desc: '19 projets en 5 categories : Offshore Wind, AI, Business, Infrastructure, Creative.' },
            { id: 'skills', label: 'Skills', type: 'component', r: 14,
              desc: '7 categories de competences avec preuves verifiables (repos GitHub, credentials).' },
            { id: 'festezet', label: 'festezet.dev', type: 'tech', r: 12,
              desc: 'Site deploye sur Hostinger, build statique genere par build_static.py.' },

            // Notifications components
            { id: 'gmail-scan', label: 'Gmail', type: 'component', r: 14,
              desc: 'Scan Gmail via API OAuth2, reutilise token gmail-cleaner.' },
            { id: 'hostinger-scan', label: 'Hostinger', type: 'component', r: 14,
              desc: 'Scan Hostinger via IMAP (imaplib stdlib).' },
            { id: 'ntfy', label: 'ntfy Push', type: 'tech', r: 12,
              desc: 'Push notifications via ntfy Docker (port 8090).' },
            { id: 'scheduler', label: 'APScheduler', type: 'tech', r: 12,
              desc: 'Scan automatique toutes les 5 minutes.' },

            // Messaging components
            { id: 'whatsapp', label: 'WhatsApp', type: 'component', r: 14,
              desc: 'CLI + scanner + endpoint envoi via Evolution API (port 8084).' },
            { id: 'linkedin', label: 'LinkedIn', type: 'component', r: 14,
              desc: 'CLI + scanner + auth cookie. Messaging API cassee cote LinkedIn.' },

            // Email Style components
            { id: 'chromadb', label: 'ChromaDB', type: 'tech', r: 12,
              desc: '1139 emails indexes, embeddings MiniLM-L6-v2, recherche similaire.' },
            { id: 'draft-gen', label: 'Draft\nGenerator', type: 'component', r: 14,
              desc: 'Generation brouillons few-shot (5 exemples) via Claude Sonnet API.' },
            { id: 'corpus', label: '1972 Emails', type: 'component', r: 14,
              desc: 'Corpus complet : 1610 Gmail + 362 Hostinger, 345 correspondants.' },

            // Documents components
            { id: 'attachments', label: '268 PJ', type: 'component', r: 14,
              desc: '268 pieces jointes telechargees, triees via interface custom, 52 importees en DB.' },
            { id: 'documents-db', label: 'documents.db', type: 'tech', r: 12,
              desc: '102 documents indexes (50 manuels + 52 importes).' },

            // Tech stack
            { id: 'flask', label: 'Flask', type: 'tech', r: 12,
              desc: 'Backend Flask sur port 5100, blueprints, auth Bearer token.' },
            { id: 'sqlite', label: 'SQLite', type: 'tech', r: 12,
              desc: 'notifications.db, documents.db, ai_profile.db, crm.db.' },
            { id: 'claude-api', label: 'Claude API', type: 'tech', r: 12,
              desc: 'Anthropic Claude Sonnet pour generation de brouillons.' },
        ];

        const links = [
            // Purpose -> Features
            { source: 'purpose', target: 'discovery' },
            { source: 'purpose', target: 'notifications' },
            { source: 'purpose', target: 'messaging' },
            { source: 'purpose', target: 'email-style' },
            { source: 'purpose', target: 'documents' },
            { source: 'purpose', target: 'crm' },
            { source: 'purpose', target: 'references' },

            // Discovery -> Components
            { source: 'discovery', target: 'jsonld' },
            { source: 'discovery', target: 'openapi' },
            { source: 'discovery', target: 'llmstxt' },
            { source: 'discovery', target: 'portfolio' },
            { source: 'discovery', target: 'skills' },
            { source: 'discovery', target: 'festezet' },

            // Notifications -> Components
            { source: 'notifications', target: 'gmail-scan' },
            { source: 'notifications', target: 'hostinger-scan' },
            { source: 'notifications', target: 'ntfy' },
            { source: 'notifications', target: 'scheduler' },

            // Messaging -> Components
            { source: 'messaging', target: 'whatsapp' },
            { source: 'messaging', target: 'linkedin' },

            // Email Style -> Components
            { source: 'email-style', target: 'chromadb' },
            { source: 'email-style', target: 'draft-gen' },
            { source: 'email-style', target: 'corpus' },
            { source: 'draft-gen', target: 'claude-api' },

            // Documents -> Components
            { source: 'documents', target: 'attachments' },
            { source: 'documents', target: 'documents-db' },

            // Cross-links
            { source: 'crm', target: 'whatsapp' },
            { source: 'crm', target: 'linkedin' },
            { source: 'crm', target: 'gmail-scan' },
            { source: 'crm', target: 'corpus' },

            // Tech shared
            { source: 'notifications', target: 'flask' },
            { source: 'email-style', target: 'flask' },
            { source: 'notifications', target: 'sqlite' },
            { source: 'documents', target: 'sqlite' },
            { source: 'references', target: 'sqlite' },
        ];

        return { nodes, links };
    },

    renderProjectMap() {
        if (typeof d3 === 'undefined') return;

        const container = document.getElementById('ai-profile-map-container');
        const svg = d3.select('#ai-profile-map-svg');
        const tooltip = document.getElementById('ai-profile-map-tooltip');

        // Clear previous render
        svg.selectAll('*').remove();

        const width = container.clientWidth;
        const height = container.clientHeight;

        svg.attr('viewBox', [0, 0, width, height]);

        const { nodes, links } = this._getProjectMapData();

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

    // --- Database Map (D3 Force-directed graph) ---

    _dbMapSimulation: null,
    _dbMapZoom: null,

    _getDbMapData() {
        const nodes = [
            // Databases (orange, large)
            { id: 'notifications-db', label: 'notifications.db', type: 'database', r: 26,
              desc: 'Scan emails & push notifications. 2 tables.' },
            { id: 'ai-profile-db', label: 'ai_profile.db', type: 'database', r: 22,
              desc: 'References personnelles retrouvables par Claude. 1 table.' },
            { id: 'documents-db', label: 'documents.db', type: 'database', r: 26,
              desc: 'Pieces jointes Gmail indexees avec BLOBs. 79 MB. 1 table.' },
            { id: 'email-context-db', label: 'email_context.db', type: 'database', r: 28,
              desc: 'Corpus emails pour apprentissage de style. 3 tables, 3200+ rows.' },
            { id: 'chroma-db', label: 'ChromaDB', type: 'vector', r: 26,
              desc: 'Vector store pour recherche semantique emails. 1139 embeddings MiniLM-L6-v2.' },
            { id: 'crm-db', label: 'crm.db', type: 'database', r: 30,
              desc: 'CRM contacts + email archives + campaigns. 12 tables, 750+ rows.' },

            // notifications.db tables
            { id: 'tbl-notifications', label: 'notifications', type: 'table', r: 14, rows: 12,
              desc: 'id, source, contact_id, contact_name, subject, preview, status, created_at, read_at' },
            { id: 'tbl-scan-log', label: 'scan_log', type: 'table', r: 14, rows: 92,
              desc: 'Historique des scans periodiques (APScheduler 5min)' },

            // ai_profile.db tables
            { id: 'tbl-personal-refs', label: 'personal_references', type: 'table', r: 12, rows: 1,
              desc: 'id, topic, keywords, description, file_path, urls, notes, reminder_date' },

            // documents.db tables
            { id: 'tbl-documents', label: 'documents', type: 'table', r: 16, rows: 102,
              desc: 'id, title, source, category, subcategory, format, size_bytes, content_blob, tags, file_path' },

            // email_context.db tables
            { id: 'tbl-emails', label: 'emails', type: 'table', r: 18, rows: 1974,
              desc: 'Corpus complet : 1610 Gmail + 362 Hostinger. contact_id, subject, body, account, date' },
            { id: 'tbl-threads', label: 'threads', type: 'table', r: 16, rows: 1233,
              desc: 'Threads de conversation regroupes. thread_id, contact_id, subject, last_date' },
            { id: 'tbl-draft-queue', label: 'draft_queue', type: 'table', r: 12, rows: 0,
              desc: 'File d\'attente brouillons mode Session. contact_id, subject, context, status' },

            // ChromaDB tables (simplified)
            { id: 'tbl-embeddings', label: 'embeddings', type: 'table', r: 16, rows: 1139,
              desc: '1139 vecteurs MiniLM-L6-v2 pour recherche similaire few-shot' },

            // crm.db tables
            { id: 'tbl-contacts', label: 'contacts', type: 'table', r: 16, rows: 34,
              desc: 'contact_id, first_name, last_name, company, position, email, phone, language' },
            { id: 'tbl-templates', label: 'templates', type: 'table', r: 12, rows: 12,
              desc: 'Templates email par type (follow-up, intro, proposal...)' },
            { id: 'tbl-signals', label: 'signals', type: 'table', r: 12, rows: 11,
              desc: 'Signaux CRM : interactions detectees automatiquement' },
            { id: 'tbl-email-archives', label: 'email_archives', type: 'table', r: 16, rows: 637,
              desc: 'Archives emails CRM avec metadata et categorisation' },
            { id: 'tbl-campaigns', label: 'campaigns', type: 'table', r: 12, rows: 0,
              desc: 'Campagnes outreach (contacts groupes, templates, suivi)' },
            { id: 'tbl-contact-notes', label: 'contact_notes', type: 'table', r: 12, rows: 0,
              desc: 'Notes manuelles sur les contacts' },
        ];

        const links = [
            // DB -> Tables
            { source: 'notifications-db', target: 'tbl-notifications' },
            { source: 'notifications-db', target: 'tbl-scan-log' },
            { source: 'ai-profile-db', target: 'tbl-personal-refs' },
            { source: 'documents-db', target: 'tbl-documents' },
            { source: 'email-context-db', target: 'tbl-emails' },
            { source: 'email-context-db', target: 'tbl-threads' },
            { source: 'email-context-db', target: 'tbl-draft-queue' },
            { source: 'chroma-db', target: 'tbl-embeddings' },
            { source: 'crm-db', target: 'tbl-contacts' },
            { source: 'crm-db', target: 'tbl-templates' },
            { source: 'crm-db', target: 'tbl-signals' },
            { source: 'crm-db', target: 'tbl-email-archives' },
            { source: 'crm-db', target: 'tbl-campaigns' },
            { source: 'crm-db', target: 'tbl-contact-notes' },

            // Cross-database relationships
            { source: 'tbl-emails', target: 'tbl-embeddings', cross: true },
            { source: 'tbl-emails', target: 'tbl-contacts', cross: true },
            { source: 'tbl-email-archives', target: 'tbl-contacts', cross: true },
            { source: 'tbl-notifications', target: 'tbl-contacts', cross: true },
            { source: 'tbl-threads', target: 'tbl-emails', cross: true },
        ];

        return { nodes, links };
    },

    renderDbMap() {
        if (typeof d3 === 'undefined') return;

        const container = document.getElementById('ai-profile-dbmap-container');
        const svg = d3.select('#ai-profile-dbmap-svg');
        const tooltip = document.getElementById('ai-profile-dbmap-tooltip');

        svg.selectAll('*').remove();

        const width = container.clientWidth;
        const height = container.clientHeight;
        svg.attr('viewBox', [0, 0, width, height]);

        const { nodes, links } = this._getDbMapData();

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
