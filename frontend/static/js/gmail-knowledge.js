/**
 * Gmail Knowledge Module - Dashboard for extracted email knowledge
 */
import API from './api.js';

class GmailKnowledgeModule {
    constructor() {
        this.loaded = false;
        this._searchTimer = null;
        this._annuaireTimer = null;
    }

    async load() {
        if (!this.loaded) {
            await this.loadOverview();
            this.loaded = true;
        }
    }

    switchSubTab(tabName) {
        document.querySelectorAll('.gmail-knowledge-subtab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === tabName);
        });
        document.querySelectorAll('.gmail-knowledge-subtab-content').forEach(c => {
            c.classList.toggle('active', c.id === 'gmail-knowledge-tab-' + tabName);
        });
        const loaders = {
            'overview': () => this.loadOverview(),
            'annuaire': () => this.loadAnnuaire(),
            'documents': () => this.loadDocuments(),
            'events': () => this.loadEvents(),
            'financial': () => this.loadFinancial(),
        };
        if (loaders[tabName]) loaders[tabName]();
    }

    // -- Overview --

    async loadOverview() {
        const statsEl = document.getElementById('gmail-knowledge-stats');
        if (statsEl) statsEl.innerHTML = '<div class="gmail-knowledge-loading">Chargement...</div>';
        try {
            const data = await API.gmailKnowledge.getStats();
            if (data.ok) {
                this._renderStats(data);
                this._renderCharts(data);
            }
        } catch {
            if (statsEl) statsEl.innerHTML = '<div class="gmail-knowledge-empty">Service Gmail Knowledge indisponible (port 5052)</div>';
        }
    }

    _renderStats(data) {
        const statsEl = document.getElementById('gmail-knowledge-stats');
        if (!statsEl) return;
        const items = [
            { label: 'Annuaire', value: (data.accounts || 0) + (data.contacts || 0) },
            { label: 'Documents', value: data.documents || 0 },
            { label: 'Evenements', value: data.life_events || 0 },
            { label: 'Finances', value: data.financial_items || 0 },
            { label: 'Contacts Pro', value: data.professional_contacts || 0 },
        ];
        statsEl.innerHTML = items.map(s =>
            `<div class="gmail-knowledge-stat-card">
                <div class="stat-value">${s.value}</div>
                <div class="stat-label">${s.label}</div>
            </div>`
        ).join('');
    }

    _renderCharts(data) {
        this._renderBarChart('gmail-knowledge-chart-accounts', data.accounts_by_category || {});
        this._renderBarChart('gmail-knowledge-chart-documents', data.documents_by_type || {});
        this._renderBarChart('gmail-knowledge-chart-events', data.events_by_type || {});
    }

    _renderBarChart(containerId, dataMap) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const entries = Object.entries(dataMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (!entries.length) {
            el.innerHTML = '<div class="gmail-knowledge-empty">Aucune donnee</div>';
            return;
        }
        const max = Math.max(...entries.map(e => e[1]));
        el.innerHTML = entries.map(([label, count]) => {
            const pct = Math.round((count / max) * 100);
            return `<div class="gmail-knowledge-bar">
                <span class="gmail-knowledge-bar-label" title="${label}">${label}</span>
                <div class="gmail-knowledge-bar-track">
                    <div class="gmail-knowledge-bar-fill" style="width:${pct}%"></div>
                </div>
                <span class="gmail-knowledge-bar-count">${count}</span>
            </div>`;
        }).join('');
    }

    // -- Annuaire (merged accounts + contacts) --

    debounceAnnuaire() {
        clearTimeout(this._annuaireTimer);
        this._annuaireTimer = setTimeout(() => this.loadAnnuaire(), 300);
    }

    async loadAnnuaire() {
        const list = document.getElementById('gmail-knowledge-annuaire-list');
        if (list) list.innerHTML = '<div class="gmail-knowledge-loading">Chargement...</div>';
        try {
            const q = document.getElementById('gmail-knowledge-annuaire-search')?.value?.trim() || '';
            const type = document.getElementById('gmail-knowledge-annuaire-type')?.value || '';
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            if (type) params.set('type', type);
            const qs = params.toString();
            const data = await API.gmailKnowledge.getAnnuaire(qs ? `?${qs}` : '');
            if (data.ok) this._renderAnnuaireTable(data.entries, data.total);
        } catch {
            if (list) list.innerHTML = '<div class="gmail-knowledge-empty">Erreur de chargement</div>';
        }
    }

    _renderAnnuaireTable(entries, total) {
        const list = document.getElementById('gmail-knowledge-annuaire-list');
        if (!list) return;
        if (!entries.length) {
            list.innerHTML = '<div class="gmail-knowledge-empty">Aucun resultat</div>';
            return;
        }
        const countInfo = `<p style="margin:0 0 8px;color:var(--text-secondary);font-size:0.85em">${total} entree(s)</p>`;
        list.innerHTML = countInfo + `<table>
            <thead><tr><th>Nom</th><th>Email</th><th>Type</th><th>Detail</th><th>Derniere activite</th></tr></thead>
            <tbody>${entries.map(e => `<tr>
                <td>${e.name || ''}</td>
                <td>${e.email || ''}</td>
                <td><span class="gmail-knowledge-badge ${e.type}">${e.type}</span></td>
                <td>${e.detail || e.category || ''}</td>
                <td>${e.last_activity || ''}</td>
            </tr>`).join('')}</tbody>
        </table>`;
    }

    // -- Documents --

    async loadDocuments() {
        const list = document.getElementById('gmail-knowledge-docs-list');
        if (list) list.innerHTML = '<div class="gmail-knowledge-loading">Chargement...</div>';
        try {
            const filter = document.getElementById('gmail-knowledge-docs-filter');
            const type = filter?.value || '';
            const params = type ? `?type=${encodeURIComponent(type)}` : '';
            const data = await API.gmailKnowledge.getDocuments(params);
            if (data.ok) {
                this._populateFilter('gmail-knowledge-docs-filter', data.documents, 'type', 'Tous types');
                this._renderDocumentsTable(data.documents);
            }
        } catch {
            if (list) list.innerHTML = '<div class="gmail-knowledge-empty">Erreur de chargement</div>';
        }
    }

    _renderDocumentsTable(docs) {
        const list = document.getElementById('gmail-knowledge-docs-list');
        if (!list) return;
        if (!docs.length) {
            list.innerHTML = '<div class="gmail-knowledge-empty">Aucun document</div>';
            return;
        }
        list.innerHTML = `<table>
            <thead><tr><th>Titre</th><th>Type</th><th>Expediteur</th><th>Date</th><th>Fichiers</th></tr></thead>
            <tbody>${docs.map(d => {
                let filesCell = '';
                if (d.attachments && d.attachments.length) {
                    filesCell = d.attachments.map(f => {
                        const ext = f.split('.').pop().toLowerCase();
                        const icon = ext === 'pdf' ? '📄' : ['png','jpg','jpeg','gif'].includes(ext) ? '🖼' : '📎';
                        return `<a href="/api/gmail-knowledge/pj/${d.message_id}/${encodeURIComponent(f)}" target="_blank" rel="noopener" class="gmail-knowledge-attachment" title="${f}">${icon} ${f}</a>`;
                    }).join(' ');
                } else if (d.message_id) {
                    filesCell = `<a href="https://mail.google.com/mail/u/0/#inbox/${d.message_id}" target="_blank" rel="noopener" class="gmail-knowledge-gmail-link">Gmail</a>`;
                }
                return `<tr>
                <td>${d.title || ''}</td>
                <td><span class="gmail-knowledge-badge">${d.type || ''}</span></td>
                <td>${d.sender || ''}</td>
                <td>${d.received_date || ''}</td>
                <td>${filesCell}</td>
            </tr>`;
            }).join('')}</tbody>
        </table>`;
    }

    // -- Events --

    async loadEvents() {
        const list = document.getElementById('gmail-knowledge-events-list');
        if (list) list.innerHTML = '<div class="gmail-knowledge-loading">Chargement...</div>';
        try {
            const filter = document.getElementById('gmail-knowledge-events-filter');
            const type = filter?.value || '';
            const params = type ? `?type=${encodeURIComponent(type)}` : '';
            const data = await API.gmailKnowledge.getEvents(params);
            if (data.ok) {
                this._populateFilter('gmail-knowledge-events-filter', data.events, 'event_type', 'Tous types');
                this._renderEventsTable(data.events);
            }
        } catch {
            if (list) list.innerHTML = '<div class="gmail-knowledge-empty">Erreur de chargement</div>';
        }
    }

    _renderEventsTable(events) {
        const list = document.getElementById('gmail-knowledge-events-list');
        if (!list) return;
        if (!events.length) {
            list.innerHTML = '<div class="gmail-knowledge-empty">Aucun evenement</div>';
            return;
        }
        list.innerHTML = `<table>
            <thead><tr><th>Evenement</th><th>Type</th><th>Date</th><th>Source</th></tr></thead>
            <tbody>${events.map(e => `<tr>
                <td>${e.description || ''}</td>
                <td><span class="gmail-knowledge-badge">${e.event_type || ''}</span></td>
                <td>${e.date || ''}</td>
                <td>${e.source_email || ''}</td>
            </tr>`).join('')}</tbody>
        </table>`;
    }

    // -- Financial --

    async loadFinancial() {
        const list = document.getElementById('gmail-knowledge-financial-list');
        if (list) list.innerHTML = '<div class="gmail-knowledge-loading">Chargement...</div>';
        try {
            const data = await API.gmailKnowledge.getFinancial();
            if (data.ok) this._renderFinancialTable(data.financial);
        } catch {
            if (list) list.innerHTML = '<div class="gmail-knowledge-empty">Erreur de chargement</div>';
        }
    }

    _renderFinancialTable(items) {
        const list = document.getElementById('gmail-knowledge-financial-list');
        if (!list) return;
        if (!items.length) {
            list.innerHTML = '<div class="gmail-knowledge-empty">Aucun element financier</div>';
            return;
        }
        list.innerHTML = `<table>
            <thead><tr><th>Description</th><th>Montant</th><th>Type</th><th>Date</th><th>Source</th></tr></thead>
            <tbody>${items.map(f => `<tr>
                <td>${f.description || ''}</td>
                <td>${f.amount || ''} ${f.currency || ''}</td>
                <td>${f.type || ''}</td>
                <td>${f.transaction_date || ''}</td>
                <td>${f.source || ''}</td>
            </tr>`).join('')}</tbody>
        </table>`;
    }

    // -- Search --

    debounceSearch() {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.search(), 300);
    }

    async search() {
        const q = document.getElementById('gmail-knowledge-search-input')?.value?.trim() || '';
        const results = document.getElementById('gmail-knowledge-search-results');
        if (!results) return;
        if (q.length < 2) {
            results.innerHTML = '<p class="gmail-knowledge-hint">Tapez au moins 2 caracteres pour lancer la recherche.</p>';
            return;
        }
        results.innerHTML = '<div class="gmail-knowledge-loading">Recherche...</div>';
        try {
            const data = await API.gmailKnowledge.search(q);
            if (data.ok) this._renderSearchResults(data);
        } catch {
            results.innerHTML = '<div class="gmail-knowledge-empty">Erreur de recherche</div>';
        }
    }

    _renderSearchResults(data) {
        const results = document.getElementById('gmail-knowledge-search-results');
        if (!results) return;
        if (!data.total) {
            results.innerHTML = `<div class="gmail-knowledge-empty">Aucun resultat pour "${data.query}"</div>`;
            return;
        }
        let html = `<p style="margin-bottom:12px;color:var(--text-secondary)">${data.total} resultat(s) pour "${data.query}"</p>`;
        if (data.accounts?.length || data.contacts?.length) {
            const combined = [
                ...(data.accounts || []).map(a => ({ name: a.service_name, email: a.email_used, detail: a.category, type: 'compte' })),
                ...(data.contacts || []).map(c => ({ name: c.name, email: c.email, detail: c.company, type: 'contact' })),
            ];
            html += `<div class="gmail-knowledge-search-section"><h3>Annuaire (${combined.length})</h3>`;
            html += `<table><thead><tr><th>Nom</th><th>Email</th><th>Type</th><th>Detail</th></tr></thead><tbody>`;
            html += combined.map(e => `<tr><td>${e.name || ''}</td><td>${e.email || ''}</td><td><span class="gmail-knowledge-badge ${e.type}">${e.type}</span></td><td>${e.detail || ''}</td></tr>`).join('');
            html += `</tbody></table></div>`;
        }
        if (data.documents?.length) {
            html += `<div class="gmail-knowledge-search-section"><h3>Documents (${data.documents.length})</h3>`;
            html += `<table><thead><tr><th>Titre</th><th>Expediteur</th><th>Type</th><th>Fichiers</th></tr></thead><tbody>`;
            html += data.documents.map(d => {
                let filesCell = '';
                if (d.attachments && d.attachments.length) {
                    filesCell = d.attachments.map(f => {
                        const ext = f.split('.').pop().toLowerCase();
                        const icon = ext === 'pdf' ? '📄' : ['png','jpg','jpeg','gif'].includes(ext) ? '🖼' : '📎';
                        return `<a href="/api/gmail-knowledge/pj/${d.message_id}/${encodeURIComponent(f)}" target="_blank" rel="noopener" class="gmail-knowledge-attachment">${icon} ${f}</a>`;
                    }).join(' ');
                } else if (d.message_id) {
                    filesCell = `<a href="https://mail.google.com/mail/u/0/#inbox/${d.message_id}" target="_blank" rel="noopener" class="gmail-knowledge-gmail-link">Gmail</a>`;
                }
                return `<tr><td>${d.title || ''}</td><td>${d.sender || ''}</td><td>${d.type || ''}</td><td>${filesCell}</td></tr>`;
            }).join('');
            html += `</tbody></table></div>`;
        }
        results.innerHTML = html;
    }

    // -- Helpers --

    _populateFilter(selectId, items, field, defaultLabel) {
        const sel = document.getElementById(selectId);
        if (!sel || sel.options.length > 1) return;
        const values = [...new Set(items.map(i => i[field]).filter(Boolean))].sort();
        sel.innerHTML = `<option value="">${defaultLabel}</option>` +
            values.map(v => `<option value="${v}">${v}</option>`).join('');
    }
}

const gmailKnowledgeModule = new GmailKnowledgeModule();
window._gmailKnowledge = gmailKnowledgeModule;

export default gmailKnowledgeModule;
