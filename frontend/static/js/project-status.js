/**
 * Project Status Module - Unified tab with 3 sub-tabs
 * Overview | Health & Specs | Activity Log
 */

import API from './api.js';
import Utils from './utils.js';
import projectsListModule from './projects-list.js';
import specsModule from './specs.js';
import modularityAuditModule from './modularity-audit.js';

class ProjectStatusModule {
    constructor() {
        this.activeTab = 'overview';
        this.activityData = null;
        this.activityFilter = { project: 'all', type: 'all' };
    }

    async load() {
        this.renderSubTabs();
        await this.loadSubTab(this.activeTab);
    }

    renderSubTabs() {
        const container = document.getElementById('ps-subtab-bar');
        if (!container) return;

        const tabs = [
            { id: 'overview', label: 'Overview' },
            { id: 'health', label: 'Health & Specs' },
            { id: 'activity-log', label: 'Activity Log' },
            { id: 'recent-sessions', label: 'Sessions Recentes' },
            { id: 'project-actions', label: 'Actions Projet' },
            { id: 'modularity', label: 'Modularity' },
            { id: 'posture', label: 'Posture History' }
        ];

        container.innerHTML = tabs.map(tab => `
            <button class="ps-subtab ${this.activeTab === tab.id ? 'active' : ''}"
                    onclick="window.ProjectStatusModule.switchTab('${tab.id}')">
                ${tab.label}
            </button>
        `).join('');
    }

    async switchTab(tabId) {
        this.activeTab = tabId;
        this.renderSubTabs();
        await this.loadSubTab(tabId);
    }

    async loadSubTab(tabId) {
        const content = document.getElementById('ps-content');
        if (!content) return;

        content.innerHTML = '<div class="ps-loading"><span class="spinner"></span> Chargement...</div>';

        switch (tabId) {
            case 'overview':
                await this.renderOverview(content);
                break;
            case 'health':
                await this.renderHealth(content);
                break;
            case 'activity-log':
                await this.renderActivityLog(content);
                break;
            case 'recent-sessions':
                await this.renderRecentSessions(content);
                break;
            case 'project-actions':
                await this.renderProjectActions(content);
                break;
            case 'modularity':
                content.innerHTML = '<div id="modularity-container"></div>';
                await modularityAuditModule.load();
                break;
            case 'posture':
                await this.renderPosture(content);
                break;
        }
    }

    // --- OVERVIEW SUB-TAB ---

    async renderOverview(content) {
        let stats = { total: 0, active_projects: 0, last_date: null, by_week: [] };
        try {
            const response = await API.activity.getStats();
            stats = response.stats || stats;
        } catch (e) {
            console.log('Activity stats not available');
        }

        let topProjects = [];
        try {
            const response = await API.activity.getTopProjects(10);
            topProjects = response.projects || [];
        } catch (e) {
            console.log('Top projects not available');
        }

        const thisWeek = stats.by_week.length > 0 ? stats.by_week[0].count : 0;

        content.innerHTML = this._renderOverviewStats(stats, thisWeek)
                          + this._renderOverviewTopProjects(topProjects)
                          + this._renderOverviewProjectsTable()
                          + this._renderOverviewMethodology();

        await projectsListModule.load();
    }

    _renderOverviewStats(stats, thisWeek) {
        return `
            <div class="ps-stats-grid">
                <div class="ps-stat-card">
                    <div class="ps-stat-number">${stats.total}</div>
                    <div class="ps-stat-label">Total activites</div>
                </div>
                <div class="ps-stat-card">
                    <div class="ps-stat-number">${stats.active_projects}</div>
                    <div class="ps-stat-label">Projets actifs (30j)</div>
                </div>
                <div class="ps-stat-card">
                    <div class="ps-stat-number">${thisWeek}</div>
                    <div class="ps-stat-label">Cette semaine</div>
                </div>
                <div class="ps-stat-card">
                    <div class="ps-stat-number" style="font-size: 1rem;">${stats.last_date || '-'}</div>
                    <div class="ps-stat-label">Derniere activite</div>
                </div>
            </div>`;
    }

    _renderOverviewTopProjects(topProjects) {
        if (topProjects.length === 0) return '';

        const rows = topProjects.map((p, index) => {
            const rank = index + 1;
            const medal = rank <= 3 ? ['&#129351;', '&#129352;', '&#129353;'][rank - 1] : `<span style="color:#9ca3af;">${rank}</span>`;
            const statusClass = p.status === 'active' ? 'ok' : (p.status === 'archived' ? 'stopped' : 'warning');
            const daysLabel = p.days_ago === 0 ? "aujourd'hui" : (p.days_ago === 1 ? 'hier' : `il y a ${p.days_ago}j`);

            const barWidth = topProjects[0].score > 0 ? Math.round((p.score / topProjects[0].score) * 100) : 0;

            return `
            <tr>
                <td style="text-align:center; font-size:1.1rem;">${medal}</td>
                <td><span class="id-badge">${p.project_id}</span></td>
                <td>${this._escapeHtml(p.name)}</td>
                <td style="text-align:center;"><span class="status-badge status-${statusClass}">${p.status}</span></td>
                <td style="text-align:center;">${p.activity_count}</td>
                <td style="text-align:center; color:#9ca3af; font-size:0.85rem;">${daysLabel}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="flex:1; background:#e5e7eb; border-radius:4px; height:8px; overflow:hidden;">
                            <div style="width:${barWidth}%; height:100%; background:linear-gradient(90deg, #667eea, #764ba2); border-radius:4px;"></div>
                        </div>
                        <span style="font-size:0.8rem; color:#e5e7eb; font-weight:600; min-width:32px;">${p.score}</span>
                    </div>
                </td>
                <td style="text-align:center;">
                    <button class="detail-btn" onclick="window.projectsListModule.showDetail('${p.project_id}')" title="Voir details">i</button>
                </td>
            </tr>`;
        }).join('');

        return `
            <div class="projects-list-container" style="margin-bottom: 24px;">
                <div class="section-header">
                    <h3>Projets les plus actifs (90 jours)</h3>
                </div>
                <div class="table-container">
                    <table class="projects-table">
                        <thead>
                            <tr>
                                <th style="width:40px;">#</th>
                                <th class="col-id">ID</th>
                                <th>Projet</th>
                                <th class="col-status">Status</th>
                                <th style="text-align:center; width:70px;">Sessions</th>
                                <th style="text-align:center; width:100px;">Derniere</th>
                                <th style="width:180px;">Score</th>
                                <th style="width:40px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    _renderOverviewProjectsTable() {
        return `
            <div class="projects-list-container">
                <div class="section-header">
                    <h3>Projets Infrastructure et Applications</h3>
                    <div class="header-actions">
                        <input type="text" id="projects-search" class="search-input" placeholder="Rechercher..." autocomplete="off">
                        <select id="projects-category-filter" class="filter-select">
                            <option value="all">Toutes categories</option>
                            <option value="infrastructure">Infrastructure</option>
                            <option value="docker">Docker</option>
                            <option value="apps">Applications Natives</option>
                            <option value="dev">Applications Developpees</option>
                        </select>
                        <button id="btn-refresh-projects" class="btn btn-primary">Rafraichir</button>
                    </div>
                </div>
                <div id="projects-loading" class="loading-indicator">
                    <span class="spinner"></span>
                    <span>Chargement des projets...</span>
                </div>
                <div id="projects-table-container" class="table-container">
                    <table id="projects-table" class="projects-table">
                        <thead>
                            <tr>
                                <th>Categorie</th>
                                <th class="col-id">ID</th>
                                <th>Application / Service</th>
                                <th class="col-status">Status</th>
                                <th>Description</th>
                                <th id="th-score-sort" style="text-align:center; width:90px; cursor:pointer; user-select:none;" title="Cliquer pour trier par score">Score</th>
                                <th class="col-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="projects-tbody"></tbody>
                    </table>
                </div>
                <div id="projects-stats" class="stats-section">
                    <div class="stat-item">
                        <span class="stat-label">Statistiques :</span>
                        <span id="projects-stats-content">Chargement...</span>
                    </div>
                </div>
            </div>`;
    }

    _renderOverviewMethodology() {
        return `
            <div style="padding:12px 16px; margin-top:4px; font-size:0.75rem; color:#6b7280; line-height:1.6; border-top:1px solid #374151;">
                <strong style="color:#9ca3af;">Score composite</strong> — Combine 3 axes :
                <span style="color:#3b82f6;">Activite (35%)</span> frequence et recence des sessions sur 90j |
                <span style="color:#f59e0b;">Strategie (45%)</span> alignement objectifs, potentiel revenus, categorie business |
                <span style="color:#10b981;">Sante (20%)</span> qualite technique (specs, tests, structure).
                Uniquement pour les projets PRJ-*. Voir l'onglet <em>Ranking Strategique</em> pour le detail.
            </div>`;
    }

    // --- HEALTH & SPECS SUB-TAB ---

    async renderHealth(content) {
        content.innerHTML = '<div id="specs-dashboard"><div class="ps-loading"><span class="spinner"></span> Chargement...</div></div>';
        await specsModule.load();
    }

    // --- ACTIVITY LOG SUB-TAB ---

    async renderActivityLog(content) {
        try {
            const response = await API.activity.getTimeline({ limit: 50 });
            this.activityData = response.timeline || [];
        } catch (e) {
            console.error('Failed to load activity timeline:', e);
            this.activityData = [];
        }

        this.renderActivityContent(content);
    }

    renderActivityContent(content) {
        if (!content) content = document.getElementById('ps-content');
        if (!content) return;

        const data = this.activityData || [];
        const projects = [...new Set(data.filter(d => d.project_name).map(d => d.project_name))].sort();
        const types = [...new Set(data.filter(d => d.type).map(d => d.type))].sort();

        let filtered = data;
        if (this.activityFilter.project !== 'all') {
            filtered = filtered.filter(d => d.project_name === this.activityFilter.project);
        }
        if (this.activityFilter.type !== 'all') {
            filtered = filtered.filter(d => d.type === this.activityFilter.type);
        }

        content.innerHTML = this._renderActivityFilters(projects, types, filtered.length)
                          + this._renderActivityTimeline(filtered);
    }

    _renderActivityFilters(projects, types, count) {
        return `
            <div class="ps-activity-filters">
                <select class="ps-filter-select" onchange="window.ProjectStatusModule.filterActivity('project', this.value)">
                    <option value="all">Tous les projets</option>
                    ${projects.map(p => `<option value="${this.escapeAttr(p)}" ${this.activityFilter.project === p ? 'selected' : ''}>${this.escapeHtml(p)}</option>`).join('')}
                </select>
                <select class="ps-filter-select" onchange="window.ProjectStatusModule.filterActivity('type', this.value)">
                    <option value="all">Tous les types</option>
                    ${types.map(t => `<option value="${this.escapeAttr(t)}" ${this.activityFilter.type === t ? 'selected' : ''}>${this.escapeHtml(t)}</option>`).join('')}
                </select>
                <span class="ps-filter-count">${count} entree${count !== 1 ? 's' : ''}</span>
            </div>`;
    }

    _renderActivityTimeline(filtered) {
        const typeColors = {
            'feature': '#3b82f6', 'fix': '#ef4444', 'optimization': '#10b981',
            'creation': '#8b5cf6', 'refactoring': '#f59e0b', 'documentation': '#6b7280',
            'deployment': '#0ea5e9'
        };

        if (filtered.length === 0) {
            return '<div class="ps-timeline"><div class="ps-empty">Aucune activite trouvee.</div></div>';
        }

        return `
            <div class="ps-timeline">
                ${filtered.map(item => {
                    const color = typeColors[item.type] || '#6b7280';
                    return `
                    <div class="ps-timeline-item" style="border-left-color: ${color};">
                        <div class="ps-timeline-header">
                            <div class="ps-timeline-title">${this.escapeHtml(item.title)}</div>
                            <div class="ps-timeline-date">${item.date ? Utils.formatRelativeTime(item.date) : ''}</div>
                        </div>
                        ${item.description ? `<div class="ps-timeline-desc">${this.escapeHtml(item.description)}</div>` : ''}
                        <div class="ps-timeline-meta">
                            ${item.project_name ? `<span class="ps-timeline-project">${this.escapeHtml(item.project_name)}</span>` : ''}
                            <span class="ps-timeline-type" style="background: ${color}15; color: ${color};">${item.type || 'other'}</span>
                            ${item.source === 'api' ? '<span class="ps-timeline-source">API</span>' : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
    }

    // --- RECENT SESSIONS SUB-TAB ---

    async renderRecentSessions(content) {
        let sessions = [];
        try {
            const response = await API.activity.getRecentSessions(10);
            sessions = response.sessions || [];
        } catch (e) {
            console.error('Failed to load recent sessions:', e);
        }

        if (sessions.length === 0) {
            content.innerHTML = '<div class="ps-recent-sessions"><div class="ps-empty">Aucun projet avec activite recente.</div></div>';
            return;
        }

        content.innerHTML = `
            <div class="ps-recent-sessions">
                <div class="ps-sessions-list">
                    ${sessions.map(s => this._renderSessionCard(s)).join('')}
                </div>
            </div>`;
    }

    _renderSessionCard(s) {
        const typeColors = {
            'feature': '#3b82f6', 'fix': '#ef4444', 'optimization': '#10b981',
            'creation': '#8b5cf6', 'refactoring': '#f59e0b', 'documentation': '#6b7280',
            'deployment': '#0ea5e9', 'other': '#9ca3af'
        };
        const typeLabels = {
            'feature': 'Feature', 'fix': 'Fix', 'optimization': 'Optim',
            'creation': 'Creation', 'refactoring': 'Refactor', 'documentation': 'Docs',
            'deployment': 'Deploy', 'other': 'Autre'
        };

        const m = s.milestone;
        const mType = m.type || 'other';
        const color = typeColors[mType] || '#9ca3af';
        const label = typeLabels[mType] || mType;
        const desc = m.description || '';
        const dateStr = m.date ? Utils.formatSessionDate(m.date) : '-';
        let title = m.title || '';
        title = title.replace(/^SESSION\s+\d{4}-\d{2}-\d{2}\s*[-:]\s*/i, '');
        title = title.replace(/^Session\s+\d{4}-\d{2}-\d{2}\s*[-:]\s*/i, '');

        return `
            <div class="ps-session-card" style="border-left: 3px solid ${color};">
                <div class="ps-session-header">
                    <div class="ps-session-project">
                        <span class="ps-session-name">${this.escapeHtml(s.name)}</span>
                        <span class="ps-session-id">${this.escapeHtml(s.unique_id)}</span>
                    </div>
                    <div class="ps-session-meta">
                        <span class="ps-timeline-type" style="background: ${color}15; color: ${color};">${label}</span>
                        <span class="ps-session-date">${dateStr}</span>
                    </div>
                </div>
                <div class="ps-session-title">${this.escapeHtml(title)}</div>
                ${desc ? `<div class="ps-session-desc">${this.escapeHtml(desc)}</div>` : ''}
                ${m.session_doc ? `<div class="ps-session-doc">${this.escapeHtml(m.session_doc)}</div>` : ''}
            </div>`;
    }

    filterActivity(key, value) {
        this.activityFilter[key] = value;
        this.renderActivityContent();
    }

    // --- PROJECT ACTIONS SUB-TAB ---

    async renderProjectActions(content) {
        this.actionsFilter = this.actionsFilter || 'all';
        let actions = [];
        try {
            const params = {};
            if (this.actionsFilter !== 'all') params.status = this.actionsFilter;
            const response = await API.projectActions.list(params);
            actions = response.actions || [];
        } catch (e) {
            console.error('Failed to load project actions:', e);
        }

        const statusOptions = ['all', 'todo', 'in_progress', 'done', 'blocked'];
        const statusLabels = { all: 'Tous', todo: 'A faire', in_progress: 'En cours', done: 'Termine', blocked: 'Bloque' };

        const priorityColors = { critical: '#dc2626', high: '#f59e0b', medium: '#3b82f6', low: '#9ca3af' };
        const statusColors = { todo: '#6b7280', in_progress: '#3b82f6', done: '#10b981', blocked: '#ef4444' };

        const filterHtml = `
            <div class="ps-activity-filters">
                ${statusOptions.map(s => `
                    <button class="ps-action-filter-btn ${this.actionsFilter === s ? 'active' : ''}"
                            onclick="window.ProjectStatusModule.filterActions('${s}')">
                        ${statusLabels[s]}
                    </button>
                `).join('')}
                <span class="ps-filter-count">${actions.length} action${actions.length !== 1 ? 's' : ''}</span>
            </div>`;

        let listHtml;
        if (actions.length === 0) {
            listHtml = '<div class="ps-empty">Aucune action trouvee.</div>';
        } else {
            listHtml = `<div class="ps-actions-list">
                ${actions.map(a => {
                    const pColor = priorityColors[a.priority] || '#6b7280';
                    const sColor = statusColors[a.status] || '#6b7280';
                    return `
                    <div class="ps-action-item">
                        <div class="ps-action-priority" style="background: ${pColor};" title="${a.priority}"></div>
                        <div class="ps-action-body">
                            <div class="ps-action-header">
                                <span class="ps-action-title">${this.escapeHtml(a.title)}</span>
                                <span class="ps-action-status" style="background: ${sColor}15; color: ${sColor};">${a.status}</span>
                            </div>
                            ${a.description ? `<div class="ps-action-desc">${this.escapeHtml(a.description)}</div>` : ''}
                            <div class="ps-action-meta">
                                <span class="ps-action-project">${this.escapeHtml(a.project_name || a.project_id)}</span>
                                <span class="ps-action-type">${a.type || 'action'}</span>
                                ${a.due_date ? `<span class="ps-action-due">Echeance: ${a.due_date}</span>` : ''}
                            </div>
                        </div>
                        <div class="ps-action-btns">
                            ${a.status !== 'done' ? `<button class="ps-action-btn-done" onclick="window.ProjectStatusModule.completeAction(${a.id})" title="Marquer termine">&#10003;</button>` : ''}
                            <button class="ps-action-btn-del" onclick="window.ProjectStatusModule.deleteAction(${a.id})" title="Supprimer">&#10005;</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        }

        content.innerHTML = filterHtml + listHtml;
    }

    async filterActions(status) {
        this.actionsFilter = status;
        const content = document.getElementById('ps-content');
        if (content) {
            content.innerHTML = '<div class="ps-loading"><span class="spinner"></span> Chargement...</div>';
            await this.renderProjectActions(content);
        }
    }

    async completeAction(id) {
        try {
            await API.projectActions.update(id, { status: 'done' });
            await this.filterActions(this.actionsFilter);
        } catch (e) {
            console.error('Failed to complete action:', e);
        }
    }

    async deleteAction(id) {
        if (!confirm('Supprimer cette action ?')) return;
        try {
            await API.projectActions.delete(id);
            await this.filterActions(this.actionsFilter);
        } catch (e) {
            console.error('Failed to delete action:', e);
        }
    }

    // --- POSTURE HISTORY SUB-TAB ---

    async renderPosture(content) {
        let runs = [];
        let trends = null;
        try {
            const r = await fetch(`${API.BASE_URL}/posture-history/runs?limit=20`);
            const data = await r.json();
            runs = data.runs || [];
        } catch (e) {
            console.error('Failed to load posture runs:', e);
        }
        try {
            const r = await fetch(`${API.BASE_URL}/posture-history/trends`);
            const data = await r.json();
            trends = data.trends || null;
        } catch (e) {
            console.error('Failed to load posture trends:', e);
        }

        if (runs.length === 0) {
            content.innerHTML = `
                <div class="ps-section">
                    <h3>Posture History</h3>
                    <p style="color:#888">Aucun audit enregistre. Lancer <code>python3 main.py posture-history --record</code> dans project-auditor.</p>
                </div>
            `;
            return;
        }

        content.innerHTML = this._renderPostureHeader(runs)
                          + this._renderPostureSparkline(runs)
                          + this._renderPostureRunsTable(runs)
                          + this._renderPostureTrends(trends);
    }

    _renderPostureHeader(runs) {
        const last = runs[0];
        return `
            <div class="ps-stats-grid">
                <div class="ps-stat-card">
                    <div class="ps-stat-number">${last.avg_score.toFixed(1)}</div>
                    <div class="ps-stat-label">Score moyen (dernier run)</div>
                </div>
                <div class="ps-stat-card">
                    <div class="ps-stat-number">${last.total_projects}</div>
                    <div class="ps-stat-label">Projets audites</div>
                </div>
                <div class="ps-stat-card">
                    <div class="ps-stat-number">${last.pass_count}</div>
                    <div class="ps-stat-label">PASS (>=80)</div>
                </div>
                <div class="ps-stat-card">
                    <div class="ps-stat-number">${last.warn_count}</div>
                    <div class="ps-stat-label">WARN (60-79)</div>
                </div>
                <div class="ps-stat-card">
                    <div class="ps-stat-number">${last.fail_count}</div>
                    <div class="ps-stat-label">FAIL (<60)</div>
                </div>
            </div>
        `;
    }

    _renderPostureSparkline(runs) {
        const ordered = [...runs].reverse();
        const w = 600, h = 120, pad = 20;
        const scores = ordered.map(r => r.avg_score);
        const maxS = Math.max(...scores, 100);
        const minS = Math.min(...scores, 0);
        const span = Math.max(maxS - minS, 1);
        const stepX = ordered.length > 1 ? (w - pad * 2) / (ordered.length - 1) : 0;
        const points = ordered.map((r, i) => {
            const x = pad + i * stepX;
            const y = h - pad - ((r.avg_score - minS) / span) * (h - pad * 2);
            return `${x},${y}`;
        }).join(' ');
        const dots = ordered.map((r, i) => {
            const x = pad + i * stepX;
            const y = h - pad - ((r.avg_score - minS) / span) * (h - pad * 2);
            return `<circle cx="${x}" cy="${y}" r="3" fill="#3b82f6"><title>${r.run_date}: ${r.avg_score.toFixed(1)}</title></circle>`;
        }).join('');
        return `
            <div class="ps-section">
                <h3>Evolution du score moyen (${ordered.length} runs)</h3>
                <svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${w}px;height:auto;background:#fafafa;border:1px solid #e5e7eb;border-radius:6px">
                    <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="2"/>
                    ${dots}
                    <text x="${pad}" y="14" font-size="10" fill="#888">${maxS.toFixed(0)}</text>
                    <text x="${pad}" y="${h - 4}" font-size="10" fill="#888">${minS.toFixed(0)}</text>
                </svg>
            </div>
        `;
    }

    _renderPostureRunsTable(runs) {
        const rows = runs.map(r => `
            <tr>
                <td>${this.escapeHtml(r.run_date)}</td>
                <td>${r.total_projects}</td>
                <td><strong>${r.avg_score.toFixed(1)}</strong></td>
                <td style="color:#16a34a">${r.pass_count}</td>
                <td style="color:#ca8a04">${r.warn_count}</td>
                <td style="color:#dc2626">${r.fail_count}</td>
            </tr>
        `).join('');
        return `
            <div class="ps-section">
                <h3>Historique des runs</h3>
                <table class="ps-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Projets</th>
                            <th>Score moyen</th>
                            <th>PASS</th>
                            <th>WARN</th>
                            <th>FAIL</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    _renderPostureTrends(trends) {
        if (!trends || !trends.previous_run) {
            return `<div class="ps-section"><h3>Trends</h3><p style="color:#888">Pas assez de runs pour comparer.</p></div>`;
        }
        const fmtDelta = d => {
            const sign = d > 0 ? '+' : '';
            const color = d > 0 ? '#16a34a' : (d < 0 ? '#dc2626' : '#888');
            return `<span style="color:${color};font-weight:600">${sign}${d.toFixed(1)}</span>`;
        };
        const improved = (trends.improved || []).map(p => `
            <tr>
                <td>${this.escapeHtml(p.project_id)}</td>
                <td>${this.escapeHtml(p.name)}</td>
                <td>${p.previous.toFixed(1)} -> ${p.current.toFixed(1)}</td>
                <td>${fmtDelta(p.delta)}</td>
            </tr>
        `).join('');
        const degraded = (trends.degraded || []).map(p => `
            <tr>
                <td>${this.escapeHtml(p.project_id)}</td>
                <td>${this.escapeHtml(p.name)}</td>
                <td>${p.previous.toFixed(1)} -> ${p.current.toFixed(1)}</td>
                <td>${fmtDelta(p.delta)}</td>
            </tr>
        `).join('');
        return `
            <div class="ps-section">
                <h3>Trends (${trends.previous_run.run_date} -> ${trends.current_run.run_date})</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                    <div>
                        <h4 style="color:#16a34a">Ameliorations (${(trends.improved || []).length})</h4>
                        ${improved ? `<table class="ps-table"><thead><tr><th>ID</th><th>Nom</th><th>Avant -> Apres</th><th>Delta</th></tr></thead><tbody>${improved}</tbody></table>` : '<p style="color:#888">Aucune.</p>'}
                    </div>
                    <div>
                        <h4 style="color:#dc2626">Degradations (${(trends.degraded || []).length})</h4>
                        ${degraded ? `<table class="ps-table"><thead><tr><th>ID</th><th>Nom</th><th>Avant -> Apres</th><th>Delta</th></tr></thead><tbody>${degraded}</tbody></table>` : '<p style="color:#888">Aucune.</p>'}
                    </div>
                </div>
            </div>
        `;
    }

    // --- HELPERS ---

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeAttr(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

const projectStatusModule = new ProjectStatusModule();
window.ProjectStatusModule = projectStatusModule;

export default projectStatusModule;
