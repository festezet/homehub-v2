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
            { id: 'modularity', label: 'Modularity' }
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
            case 'modularity':
                content.innerHTML = '<div id="modularity-container"></div>';
                await modularityAuditModule.load();
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

        let recentActivity = [];
        try {
            const response = await API.activity.getTimeline({ limit: 5 });
            recentActivity = response.timeline || [];
        } catch (e) {
            console.log('Recent activity not available');
        }

        const thisWeek = stats.by_week.length > 0 ? stats.by_week[0].count : 0;

        content.innerHTML = this._renderOverviewStats(stats, thisWeek)
                          + this._renderOverviewProjectsTable()
                          + this._renderOverviewRecentActivity(recentActivity);

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

    _renderOverviewProjectsTable() {
        return `
            <div class="projects-list-container">
                <div class="section-header">
                    <h3>Projets Infrastructure et Applications</h3>
                    <div class="header-actions">
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

    _renderOverviewRecentActivity(recentActivity) {
        if (recentActivity.length === 0) return '';
        const typeColors = {
            'feature': '#3b82f6', 'fix': '#ef4444', 'optimization': '#10b981',
            'creation': '#8b5cf6', 'refactoring': '#f59e0b', 'deployment': '#0ea5e9'
        };

        return `
            <div class="ps-recent-activity">
                <div class="ps-recent-title">Activite recente</div>
                ${recentActivity.map(item => {
                    const color = typeColors[item.type] || '#667eea';
                    return `
                    <div class="ps-recent-item" style="border-left-color: ${color};">
                        <div class="ps-recent-item-title">${this.escapeHtml(item.title)}</div>
                        ${item.project_name ? `<div class="ps-recent-item-project">${this.escapeHtml(item.project_name)}</div>` : ''}
                        <div class="ps-recent-item-date">${item.date ? Utils.formatRelativeTime(item.date) : ''}</div>
                    </div>`;
                }).join('')}
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
