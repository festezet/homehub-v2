/**
 * Claude Skills Module
 * Displays all Claude Code skills and commands from filesystem scan
 */

import API from './api.js';

class ClaudeSkillsModule {
    constructor() {
        this.data = null;
        this.filter = 'all';
    }

    async load() {
        try {
            const response = await API.claude.getSkills();
            this.data = response;
            this.render();
        } catch (error) {
            console.error('Failed to load Claude skills:', error);
            this.renderError();
        }
    }

    render() {
        const container = document.getElementById('claude-skills-dashboard');
        if (!container || !this.data) return;

        const { global_skills, local_skills, commands, stats } = this.data;

        container.innerHTML = `
            ${this._renderStats(stats)}
            ${this._renderFilters(local_skills)}
            ${this._renderSection('Global Skills', global_skills, 'cs-global', '#8b5cf6')}
            ${this._renderSection('Commands', commands, 'cs-commands', '#06b6d4')}
            ${this._renderLocalSkills(local_skills)}
        `;
    }

    _renderStats(stats) {
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="cs-stat-card">
                    <div class="cs-stat-number">${stats.global_skills}</div>
                    <div class="cs-stat-label">Global Skills</div>
                </div>
                <div class="cs-stat-card">
                    <div class="cs-stat-number">${stats.local_skills}</div>
                    <div class="cs-stat-label">Local Skills</div>
                </div>
                <div class="cs-stat-card">
                    <div class="cs-stat-number">${stats.commands}</div>
                    <div class="cs-stat-label">Commands</div>
                </div>
                <div class="cs-stat-card">
                    <div class="cs-stat-number">${stats.projects_with_skills}</div>
                    <div class="cs-stat-label">Projets avec skills</div>
                </div>
            </div>`;
    }

    _renderFilters(localSkills) {
        const projectNames = localSkills.map(s => s.project);
        return `
            <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="cs-filter-btn ${this.filter === 'all' ? 'active' : ''}" onclick="window.ClaudeSkillsModule.setFilter('all')">Tous</button>
                <button class="cs-filter-btn ${this.filter === 'global' ? 'active' : ''}" onclick="window.ClaudeSkillsModule.setFilter('global')">Global Skills</button>
                <button class="cs-filter-btn ${this.filter === 'commands' ? 'active' : ''}" onclick="window.ClaudeSkillsModule.setFilter('commands')">Commands</button>
                ${projectNames.map(name =>
                    `<button class="cs-filter-btn ${this.filter === name ? 'active' : ''}" onclick="window.ClaudeSkillsModule.setFilter('${name}')">${name}</button>`
                ).join('')}
            </div>`;
    }

    _renderSection(title, skills, cssClass, color) {
        if (!skills || skills.length === 0) return '';
        if (this.filter !== 'all' && this.filter !== cssClass.replace('cs-', '')) return '';

        return `
            <div class="cs-section" style="border-left: 4px solid ${color}; margin-bottom: 24px; padding-left: 16px;">
                <h3 style="margin: 0 0 12px 0; color: ${color};">${title} <span style="font-weight: normal; font-size: 0.85em; color: #9ca3af;">(${skills.length})</span></h3>
                <div class="cs-cards-grid">
                    ${skills.map(s => this._renderSkillCard(s)).join('')}
                </div>
            </div>`;
    }

    _renderLocalSkills(localSkills) {
        if (!localSkills || localSkills.length === 0) return '';
        return localSkills
            .filter(proj => this.filter === 'all' || this.filter === proj.project)
            .map(proj => `
                <div class="cs-section" style="border-left: 4px solid #10b981; margin-bottom: 24px; padding-left: 16px;">
                    <h3 style="margin: 0 0 12px 0; color: #10b981;">
                        ${proj.project}
                        <span style="font-weight: normal; font-size: 0.85em; color: #9ca3af;">(${proj.skills.length} skills)</span>
                    </h3>
                    <div class="cs-cards-grid">
                        ${proj.skills.map(s => this._renderSkillCard(s)).join('')}
                    </div>
                </div>
            `).join('');
    }

    _renderSkillCard(skill) {
        const invocable = skill.user_invocable
            ? '<span class="cs-badge cs-badge-invocable">invocable</span>'
            : '<span class="cs-badge cs-badge-internal">internal</span>';
        const hint = skill.argument_hint
            ? `<div class="cs-hint"><code>${this._escapeHtml(skill.argument_hint)}</code></div>`
            : '';
        const command = skill.user_invocable
            ? `<div class="cs-command"><code>/${this._escapeHtml(skill.name)}</code></div>`
            : '';

        return `
            <div class="cs-card">
                <div class="cs-card-header">
                    <span class="cs-card-name">${this._escapeHtml(skill.name)}</span>
                    ${invocable}
                </div>
                <div class="cs-card-desc">${this._escapeHtml(skill.description)}</div>
                ${command}
                ${hint}
            </div>`;
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setFilter(filter) {
        this.filter = filter;
        this.render();
    }

    renderError() {
        const container = document.getElementById('claude-skills-dashboard');
        if (!container) return;
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc2626;">
                Erreur de chargement des skills Claude Code.
                <br><small>Verifiez que le backend HomeHub est demarre.</small>
            </div>
        `;
    }
}

const claudeSkillsModule = new ClaudeSkillsModule();
window.ClaudeSkillsModule = claudeSkillsModule;

export default claudeSkillsModule;
