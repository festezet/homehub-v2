/**
 * Claude Config Module — Unified page: Skills, Analysis D1-D4, Browser, Logigramme
 * Merges ClaudeSkillsModule + ClaudeInstructionsModule
 */
import API from './api.js';

class ClaudeConfigModule {
    constructor() {
        // Skills state
        this.data = null;
        this.filter = 'all';
        // Analysis state
        this.analysisData = null;
        this.analysisPage = 0;
        this.analysisLimit = 10;
        this.analysisFilters = { scoreRange: '', type: '' };
        // Browser state
        this.treeData = null;
        // Graph state
        this.graphData = null;
        this.simulation = null;
        // Sub-tab state
        this.currentSubTab = 'skills';
    }

    // ── Entry point ──────────────────────────────────────────────

    async load() {
        this._bindSubTabs();
        try {
            const response = await API.claude.getSkills();
            this.data = response;
            this.render();
        } catch (error) {
            console.error('Failed to load Claude skills:', error);
            this.renderError();
        }
    }

    // ── Sub-tab navigation ───────────────────────────────────────

    _bindSubTabs() {
        const page = document.getElementById('claude-config-page');
        if (!page) return;
        page.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSubTab(e.target.dataset.subtab);
            });
        });
        // Analysis bindings
        const refreshBtn = document.getElementById('cc-refresh-analysis-btn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshAnalysis());
        const scoreFilter = document.getElementById('cc-analysis-score-filter');
        if (scoreFilter) scoreFilter.addEventListener('change', (e) => { this.analysisFilters.scoreRange = e.target.value; this.analysisPage = 0; this.loadAnalysis(); });
        const typeFilter = document.getElementById('cc-analysis-type-filter');
        if (typeFilter) typeFilter.addEventListener('change', (e) => { this.analysisFilters.type = e.target.value; this.analysisPage = 0; this.loadAnalysis(); });
        const clearFiltersBtn = document.getElementById('cc-analysis-clear-filters-btn');
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => this.clearAnalysisFilters());
        const prevBtn = document.getElementById('cc-analysis-prev-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => { if (this.analysisPage > 0) { this.analysisPage--; this.loadAnalysis(); } });
        const nextBtn = document.getElementById('cc-analysis-next-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => { this.analysisPage++; this.loadAnalysis(); });
        const modalCloseBtns = document.querySelectorAll('#cc-analysis-detail-modal .modal-close');
        modalCloseBtns.forEach(btn => { btn.addEventListener('click', () => this.closeAnalysisModal()); });
    }

    switchSubTab(subtab) {
        this.currentSubTab = subtab;
        const page = document.getElementById('claude-config-page');
        if (!page) return;
        page.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === subtab);
        });
        page.querySelectorAll('.sub-tab-content').forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });
        const activeContent = page.querySelector(`#cc-${subtab}-subtab`);
        if (activeContent) { activeContent.style.display = 'block'; activeContent.classList.add('active'); }
        // Lazy-load data for sub-tabs
        if (subtab === 'analysis' && !this.analysisData) this.loadAnalysis();
        if (subtab === 'browser' && !this.treeData) this._loadBrowser();
        if (subtab === 'logigramme' && !this.graphData) this._loadGraph();
    }

    // ── Skills sub-tab ───────────────────────────────────────────

    render() {
        const container = document.getElementById('cc-skills-dashboard');
        if (!container || !this.data) return;
        const { global_skills, local_skills, commands, stats } = this.data;
        const filterSource = this.filter === 'imported';
        const filteredGlobal = filterSource ? global_skills.filter(s => s.source !== 'native') : global_skills;
        const filteredLocal = filterSource
            ? local_skills.map(p => ({ ...p, skills: p.skills.filter(s => s.source !== 'native') })).filter(p => p.skills.length > 0)
            : local_skills;
        container.innerHTML = `
            ${this._renderStats(stats)}
            ${this._renderFilters(local_skills)}
            ${this._renderSection('Global Skills', filteredGlobal, 'global', '#8b5cf6')}
            ${this._renderSection('Commands', commands, 'commands', '#06b6d4')}
            ${this._renderLocalSkills(filteredLocal)}`;
    }

    _renderStats(stats) {
        const importedColor = stats.imported_skills > 0 ? '#3b82f6' : '#9ca3af';
        return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div class="cs-stat-card"><div class="cs-stat-number">${stats.global_skills}</div><div class="cs-stat-label">Global Skills</div></div>
            <div class="cs-stat-card"><div class="cs-stat-number">${stats.local_skills}</div><div class="cs-stat-label">Local Skills</div></div>
            <div class="cs-stat-card"><div class="cs-stat-number" style="color: ${importedColor}">${stats.imported_skills}</div><div class="cs-stat-label">Imported</div></div>
            <div class="cs-stat-card"><div class="cs-stat-number">${stats.commands}</div><div class="cs-stat-label">Commands</div></div>
            <div class="cs-stat-card"><div class="cs-stat-number">${stats.projects_with_skills}</div><div class="cs-stat-label">Projets</div></div>
        </div>`;
    }

    _renderFilters(localSkills) {
        const projectNames = localSkills.map(s => s.project);
        return `<div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="cs-filter-btn ${this.filter === 'all' ? 'active' : ''}" onclick="window.ClaudeConfigModule.setFilter('all')">Tous</button>
            <button class="cs-filter-btn ${this.filter === 'imported' ? 'active' : ''}" onclick="window.ClaudeConfigModule.setFilter('imported')" style="${this.filter === 'imported' ? 'background:#3b82f6;border-color:#3b82f6;' : ''}">Imported</button>
            <button class="cs-filter-btn ${this.filter === 'global' ? 'active' : ''}" onclick="window.ClaudeConfigModule.setFilter('global')">Global</button>
            <button class="cs-filter-btn ${this.filter === 'commands' ? 'active' : ''}" onclick="window.ClaudeConfigModule.setFilter('commands')">Commands</button>
            ${projectNames.map(name => `<button class="cs-filter-btn ${this.filter === name ? 'active' : ''}" onclick="window.ClaudeConfigModule.setFilter('${name}')">${name}</button>`).join('')}
        </div>`;
    }

    _renderSection(title, skills, filterKey, color) {
        if (!skills || skills.length === 0) return '';
        if (this.filter !== 'all' && this.filter !== 'imported' && this.filter !== filterKey) return '';
        return `<div class="cs-section" style="border-left: 4px solid ${color}; margin-bottom: 24px; padding-left: 16px;">
            <h3 style="margin: 0 0 12px 0; color: ${color};">${title} <span style="font-weight: normal; font-size: 0.85em; color: #9ca3af;">(${skills.length})</span></h3>
            <div class="cs-cards-grid">${skills.map(s => this._renderSkillCard(s)).join('')}</div>
        </div>`;
    }

    _renderLocalSkills(localSkills) {
        if (!localSkills || localSkills.length === 0) return '';
        return localSkills
            .filter(proj => this.filter === 'all' || this.filter === 'imported' || this.filter === proj.project)
            .map(proj => `<div class="cs-section" style="border-left: 4px solid #10b981; margin-bottom: 24px; padding-left: 16px;">
                <h3 style="margin: 0 0 12px 0; color: #10b981;">${proj.project} <span style="font-weight: normal; font-size: 0.85em; color: #9ca3af;">(${proj.skills.length} skills)</span></h3>
                <div class="cs-cards-grid">${proj.skills.map(s => this._renderSkillCard(s)).join('')}</div>
            </div>`).join('');
    }

    _renderSkillCard(skill) {
        const invocable = skill.user_invocable
            ? '<span class="cs-badge cs-badge-invocable">invocable</span>'
            : '<span class="cs-badge cs-badge-internal">internal</span>';
        const sourceBadge = this._renderSourceBadge(skill);
        const hint = skill.argument_hint ? `<div class="cs-hint"><code>${this._esc(skill.argument_hint)}</code></div>` : '';
        const command = skill.user_invocable ? `<div class="cs-command"><code>/${this._esc(skill.name)}</code></div>` : '';
        const sourceRepo = skill.source_repo ? `<div class="cs-source-repo"><a href="https://github.com/${this._esc(skill.source_repo)}" target="_blank">${this._esc(skill.source_repo)}</a></div>` : '';
        const refs = skill.reference_files && skill.reference_files.length > 0
            ? `<div class="cs-refs">${skill.reference_files.length} ref${skill.reference_files.length > 1 ? 's' : ''}</div>` : '';
        const cardClass = skill.source === 'external' ? 'cs-card cs-imported'
            : skill.source === 'community' ? 'cs-card cs-community' : 'cs-card';
        const lineInfo = skill.line_count ? `<span style="font-size:0.7rem;color:#6b7280;margin-left:auto;">${skill.line_count}L</span>` : '';
        return `<div class="${cardClass}">
            <div class="cs-card-header"><span class="cs-card-name">${this._esc(skill.name)}</span>${sourceBadge}${invocable}${lineInfo}</div>
            <div class="cs-card-desc">${this._esc(skill.description)}</div>
            ${command}${hint}${sourceRepo}${refs}
        </div>`;
    }

    _renderSourceBadge(skill) {
        if (skill.source === 'external') return '<span class="cs-badge cs-badge-external">external</span>';
        if (skill.source === 'community') return '<span class="cs-badge cs-badge-community">community</span>';
        return '';
    }

    setFilter(filter) { this.filter = filter; this.render(); }

    renderError() {
        const container = document.getElementById('cc-skills-dashboard');
        if (!container) return;
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #dc2626;">
            Erreur de chargement des skills Claude Code.<br>
            <small>Verifiez que le backend HomeHub est demarre.</small>
        </div>`;
    }

    // ── Analysis sub-tab ─────────────────────────────────────────

    async refreshAnalysis() {
        try {
            const refreshBtn = document.getElementById('cc-refresh-analysis-btn');
            if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '🔄 Analyzing...'; }
            await API.claudeAnalytics.analyzeAllSkills();
            this.analysisPage = 0;
            await this.loadAnalysis();
            if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = '🔄 Refresh Analysis'; }
        } catch (error) {
            console.error('Failed to refresh analysis:', error);
            alert('Erreur lors de l\'analyse des skills');
        }
    }

    async loadAnalysis() {
        try {
            const params = { limit: this.analysisLimit, offset: this.analysisPage * this.analysisLimit };
            if (this.analysisFilters.scoreRange) {
                const [min, max] = this.analysisFilters.scoreRange.split('-').map(Number);
                params.min_overall_score = min;
                params.max_overall_score = max;
            }
            if (this.analysisFilters.type) params.skill_type = this.analysisFilters.type;
            const response = await API.claudeAnalytics.getSkills(params);
            this.analysisData = response;
            this._renderAnalysis();
        } catch (error) {
            console.error('Failed to load analysis:', error);
            this._renderAnalysisError();
        }
    }

    _renderAnalysis() {
        if (!this.analysisData) return;
        const { skills, total, stats } = this.analysisData;
        this._renderAnalysisStats(stats);
        const resultsInfo = document.getElementById('cc-analysis-results-info');
        if (resultsInfo) {
            const start = this.analysisPage * this.analysisLimit + 1;
            const end = Math.min(start + skills.length - 1, total);
            resultsInfo.textContent = `Affichage ${start}-${end} sur ${total} skills`;
        }
        const tbody = document.getElementById('cc-analysis-table-body');
        if (tbody) {
            tbody.innerHTML = skills.length === 0
                ? '<tr><td colspan="8" style="text-align: center; color: #999; padding: 40px;">Aucun résultat</td></tr>'
                : skills.map(skill => this._renderAnalysisRow(skill)).join('');
        }
        this._updateAnalysisPagination(total);
    }

    _renderAnalysisStats(stats) {
        const container = document.getElementById('cc-analysis-stats');
        if (!container || !stats) return;
        container.innerHTML = `
            <div style="background: var(--bg-card, #1e293b); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color, #334155);"><div style="font-size: 28px; font-weight: bold; color: var(--text-primary, #f8fafc); margin-bottom: 5px;">${stats.total || 0}</div><div style="font-size: 14px; color: var(--text-secondary, #94a3b8);">Total Skills</div></div>
            <div style="background: var(--bg-card, #1e293b); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color, #334155);"><div style="font-size: 28px; font-weight: bold; color: #4ade80; margin-bottom: 5px;">${stats.excellent || 0}</div><div style="font-size: 14px; color: var(--text-secondary, #94a3b8);">Excellent (80+)</div></div>
            <div style="background: var(--bg-card, #1e293b); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color, #334155);"><div style="font-size: 28px; font-weight: bold; color: #f59e0b; margin-bottom: 5px;">${stats.good || 0}</div><div style="font-size: 14px; color: var(--text-secondary, #94a3b8);">Bon (60-79)</div></div>
            <div style="background: var(--bg-card, #1e293b); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color, #334155);"><div style="font-size: 28px; font-weight: bold; color: #f87171; margin-bottom: 5px;">${stats.needs_improvement || 0}</div><div style="font-size: 14px; color: var(--text-secondary, #94a3b8);">À améliorer (0-59)</div></div>`;
    }

    _renderAnalysisRow(skill) {
        const scoreColor = (score) => { if (score >= 80) return '#4ade80'; if (score >= 60) return '#f59e0b'; return '#f87171'; };
        const borderColor = 'var(--border-color, #334155)';
        const scoreCell = (score) => `<td style="padding: 12px; text-align: center; border-bottom: 1px solid ${borderColor};"><span style="font-weight: bold; color: ${scoreColor(score)};">${score}</span></td>`;
        
        const rowBg = '#0d1117';
        const cellBase = `padding: 12px; border-bottom: 1px solid ${borderColor};`;

        return `<tr style="cursor: pointer; background: ${rowBg};" onmouseover="this.style.backgroundColor='#161b22'" onmouseout="this.style.backgroundColor='${rowBg}'" onclick="window.ClaudeConfigModule.viewAnalysisDetail('${this._esc(skill.skill_path)}')">
            <td style="${cellBase} border-left: 4px solid var(--primary, #3b82f6);"><strong>${this._esc(skill.skill_name)}</strong></td>
            <td style="${cellBase}"><span style="background: ${skill.skill_type === 'global' ? '#0d2240' : '#2d1a3a'}; color: ${skill.skill_type === 'global' ? '#58a6ff' : '#d397f8'}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${skill.skill_type}</span></td>
            ${scoreCell(skill.d1_score)}${scoreCell(skill.d2_score)}${scoreCell(skill.d3_score)}${scoreCell(skill.d4_score)}
            <td style="${cellBase} text-align: center;"><span style="font-weight: bold; font-size: 18px; color: ${scoreColor(skill.overall_score)};">${skill.overall_score}</span></td>
            <td style="${cellBase}"><button class="btn btn-sm" onclick="event.stopPropagation(); window.ClaudeConfigModule.viewAnalysisDetail('${this._esc(skill.skill_path)}');" style="padding: 6px 12px; font-size: 12px; background: var(--primary, #3b82f6); color: white; border: none; border-radius: 4px; cursor: pointer;">Détails</button></td>
        </tr>`;
    }

    _updateAnalysisPagination(total) {
        const pagination = document.getElementById('cc-analysis-pagination');
        const pageInfo = document.getElementById('cc-analysis-page-info');
        const prevBtn = document.getElementById('cc-analysis-prev-btn');
        const nextBtn = document.getElementById('cc-analysis-next-btn');
        if (!pagination) return;
        const totalPages = Math.ceil(total / this.analysisLimit);
        if (totalPages <= 1) { pagination.style.display = 'none'; return; }
        pagination.style.display = 'flex';
        if (pageInfo) pageInfo.textContent = `Page ${this.analysisPage + 1} / ${totalPages}`;
        if (prevBtn) prevBtn.disabled = this.analysisPage === 0;
        if (nextBtn) nextBtn.disabled = this.analysisPage >= totalPages - 1;
    }

    async viewAnalysisDetail(skillPath) {
        try {
            const skill = this.analysisData.skills.find(s => s.skill_path === skillPath);
            if (!skill) return;
            this._showAnalysisModal(skill);
        } catch (error) { console.error('Failed to view skill detail:', error); }
    }

    _showAnalysisModal(skill) {
        const modal = document.getElementById('cc-analysis-detail-modal');
        if (!modal) return;
        document.getElementById('cc-analysis-detail-name').textContent = skill.skill_name;
        document.getElementById('cc-analysis-detail-type').textContent = skill.skill_type;
        document.getElementById('cc-analysis-detail-path').textContent = skill.skill_path;
        const overallEl = document.getElementById('cc-analysis-detail-overall');
        overallEl.textContent = skill.overall_score;
        overallEl.style.color = this._getScoreColor(skill.overall_score);
        document.getElementById('cc-analysis-detail-d1').textContent = skill.d1_score;
        document.getElementById('cc-analysis-detail-d2').textContent = skill.d2_score;
        document.getElementById('cc-analysis-detail-d3').textContent = skill.d3_score;
        document.getElementById('cc-analysis-detail-d4').textContent = skill.d4_score;
        const recContainer = document.getElementById('cc-analysis-detail-recommendations');
        if (recContainer) {
            const recommendations = JSON.parse(skill.recommendations || '[]');
            recContainer.innerHTML = recommendations.length === 0
                ? '<p style="color: var(--text-secondary, #94a3b8); font-style: italic;">Aucune recommandation - Skill bien structuré!</p>'
                : '<ul style="margin: 0; padding-left: 20px;">' + recommendations.map(rec => `<li style="margin-bottom: 8px; color: var(--text-secondary, #94a3b8);">${this._esc(rec)}</li>`).join('') + '</ul>';
        }
        const detailsContainer = document.getElementById('cc-analysis-detail-details');
        if (detailsContainer) {
            const details = JSON.parse(skill.details || '{}');
            detailsContainer.textContent = JSON.stringify(details, null, 2);
        }
        modal.style.display = 'flex';
    }

    closeAnalysisModal() {
        const modal = document.getElementById('cc-analysis-detail-modal');
        if (modal) modal.style.display = 'none';
    }

    _getScoreColor(score) { if (score >= 80) return '#4ade80'; if (score >= 60) return '#f59e0b'; return '#f87171'; }

    clearAnalysisFilters() {
        this.analysisFilters = { scoreRange: '', type: '' };
        this.analysisPage = 0;
        const scoreFilter = document.getElementById('cc-analysis-score-filter');
        if (scoreFilter) scoreFilter.value = '';
        const typeFilter = document.getElementById('cc-analysis-type-filter');
        if (typeFilter) typeFilter.value = '';
        this.loadAnalysis();
    }

    _renderAnalysisError() {
        const tbody = document.getElementById('cc-analysis-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626; padding: 40px;">Erreur de chargement de l\'analyse</td></tr>';
    }

    // ── Browser sub-tab ──────────────────────────────────────────

    async _loadBrowser() {
        try {
            const response = await API.claudeInstructions.getTree();
            this.treeData = response;
            this._renderGraphStats(response.stats);
            this._renderTree(response);
        } catch (error) {
            console.error('Failed to load claude instructions:', error);
            const panel = document.getElementById('cc-tree-panel');
            if (panel) panel.innerHTML = '<p style="color:#dc2626;text-align:center;padding:20px;">Erreur de chargement</p>';
        }
    }

    _renderGraphStats(stats) {
        const el = document.getElementById('cc-graph-stats');
        if (!el || !stats) return;
        el.textContent = `${stats.rules} rules | ${stats.skills} skills | ${stats.state_files} state files | ${stats.projects_with_claude} projets`;
    }

    _renderTree(data) {
        const panel = document.getElementById('cc-tree-panel');
        if (!panel) return;
        let html = '';
        if (data.master) {
            html += this._treeSection('Master', '#f59e0b', [{ name: data.master.name, path: data.master.path, size: data.master.size }]);
        }
        if (data.rules?.length) html += this._treeSection('Rules', '#8b5cf6', data.rules);
        if (data.skills?.length) html += this._treeSection('Skills', '#10b981', data.skills);
        if (data.state_files?.length) html += this._treeSection('State Files', '#3b82f6', data.state_files);
        if (data.projects?.length) {
            html += '<div style="margin-top: 12px;">';
            html += '<div style="font-weight:600;font-size:0.95em;color:#6366f1;margin-bottom:6px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">Projects (' + data.projects.length + ')</div>';
            html += '<div>';
            for (const proj of data.projects) {
                html += `<div style="margin-bottom:8px;">`;
                html += `<div style="font-size:0.9em;font-weight:500;color:#6366f1;cursor:pointer;padding:3px 0;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">${this._esc(proj.project)} (${proj.file_count})</div>`;
                html += `<div style="display:none;padding-left:12px;">`;
                for (const f of proj.files) {
                    html += `<div class="ci-tree-item" style="font-size:0.88em;padding:4px 6px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background='var(--hover-bg,#334155)'" onmouseout="this.style.background=''" onclick="window.ClaudeConfigModule.loadFile('${this._esc(f.path)}')">${this._esc(f.name)}</div>`;
                }
                html += '</div></div>';
            }
            html += '</div></div>';
        }
        panel.innerHTML = html;
    }

    _treeSection(title, color, items) {
        let html = `<div style="margin-bottom:12px;">`;
        html += `<div style="font-weight:600;font-size:0.95em;color:${color};margin-bottom:4px;">${title}</div>`;
        for (const item of items) {
            const sizeKb = item.size ? ` <span style="color:#9ca3af;font-size:0.8em;">${(item.size / 1024).toFixed(1)}k</span>` : '';
            html += `<div style="font-size:0.9em;padding:4px 8px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background='var(--hover-bg,#334155)'" onmouseout="this.style.background=''" onclick="window.ClaudeConfigModule.loadFile('${this._esc(item.path)}')">${this._esc(item.name)}${sizeKb}</div>`;
        }
        html += '</div>';
        return html;
    }

    async loadFile(path) {
        const panel = document.getElementById('cc-file-panel');
        if (!panel) return;
        panel.innerHTML = '<p style="text-align:center;padding:20px;color:#94a3b8;">Chargement...</p>';
        try {
            const response = await API.claudeInstructions.getFile(path);
            const content = response.content || '';
            const rendered = this._renderMarkdown(content);
            panel.innerHTML = `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-color,#e5e7eb);">
                <strong style="font-size:1em;">${this._esc(response.name)}</strong>
                <span style="color:#9ca3af;font-size:0.85em;margin-left:8px;">${response.lines} lignes | ${(response.size / 1024).toFixed(1)}k</span>
            </div>
            <div class="ci-file-content" style="font-size:0.95em;line-height:1.7;">${rendered}</div>`;
        } catch (error) {
            panel.innerHTML = `<p style="color:#dc2626;text-align:center;padding:20px;">Erreur: ${this._esc(error.message || 'Impossible de lire le fichier')}</p>`;
        }
    }

    _renderMarkdown(text) {
        let html = this._esc(text);
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--code-bg,#334155);padding:12px;border-radius:6px;overflow-x:auto;font-size:0.9em;"><code>$2</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code style="background:var(--code-bg,#334155);padding:2px 5px;border-radius:3px;font-size:0.9em;">$1</code>');
        html = html.replace(/^#### (.+)$/gm, '<h4 style="margin:16px 0 8px;font-size:1.05em;">$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:1.1em;">$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 10px;font-size:1.2em;border-bottom:1px solid var(--border-color,#e5e7eb);padding-bottom:4px;">$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1 style="margin:20px 0 12px;font-size:1.4em;">$1</h1>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, (match, header, sep, body) => {
            const headers = header.split('|').filter(c => c.trim()).map(c => `<th style="padding:6px 10px;border:1px solid var(--border-color,#ddd);font-size:0.95em;">${c.trim()}</th>`).join('');
            const rows = body.trim().split('\n').map(row => {
                const cells = row.split('|').filter(c => c.trim()).map(c => `<td style="padding:6px 10px;border:1px solid var(--border-color,#ddd);font-size:0.95em;">${c.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            return `<table style="border-collapse:collapse;margin:8px 0;width:100%;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
        });
        html = html.replace(/^- (.+)$/gm, '<li style="margin:2px 0;list-style:disc;margin-left:20px;">$1</li>');
        html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin:2px 0;list-style:decimal;margin-left:20px;">$1</li>');
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    // ── Logigramme sub-tab ───────────────────────────────────────

    async _loadGraph() {
        if (this.graphData) { this._renderGraph(this.graphData); return; }
        try {
            const response = await API.claudeInstructions.getGraph();
            this.graphData = response;
            this._renderGraph(response);
        } catch (error) { console.error('Failed to load graph:', error); }
    }

    _renderGraph(data) {
        const svg = d3.select('#cc-graph-svg');
        svg.selectAll('*').remove();
        const width = svg.node()?.getBoundingClientRect().width || 800;
        const height = 600;
        const colorMap = { 'master': '#f59e0b', 'rule': '#8b5cf6', 'skill': '#10b981', 'state': '#3b82f6', 'project': '#6366f1' };
        const nodes = data.nodes.map(d => ({ ...d }));
        const edges = data.edges.map(d => ({ ...d }));

        if (this.simulation) this.simulation.stop();
        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));

        const link = svg.append('g').selectAll('line').data(edges).join('line')
            .attr('stroke', '#d1d5db').attr('stroke-width', 1.5).attr('marker-end', 'url(#arrow)');

        svg.append('defs').append('marker').attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10').attr('refX', 20).attr('refY', 0)
            .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
            .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#9ca3af');

        const node = svg.append('g').selectAll('g').data(nodes).join('g')
            .call(d3.drag()
                .on('start', (event, d) => { if (!event.active) this.simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end', (event, d) => { if (!event.active) this.simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

        node.append('circle')
            .attr('r', d => d.type === 'master' ? 14 : 10)
            .attr('fill', d => colorMap[d.type] || '#6b7280')
            .attr('stroke', '#fff').attr('stroke-width', 2)
            .style('cursor', 'pointer');

        node.append('text').text(d => d.label.replace('.md', ''))
            .attr('dy', -16).attr('text-anchor', 'middle')
            .attr('font-size', '10px').attr('fill', '#94a3b8');

        node.on('click', (event, d) => {
            if (d.path) {
                this.switchSubTab('browser');
                this.loadFile(d.path);
            }
        });

        this.simulation.on('tick', () => {
            link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        const legend = svg.append('g').attr('transform', `translate(${width - 150}, 20)`);
        const types = [['master', 'Master'], ['rule', 'Rules'], ['skill', 'Skills'], ['state', 'State']];
        types.forEach(([type, label], i) => {
            legend.append('circle').attr('cx', 0).attr('cy', i * 20).attr('r', 6).attr('fill', colorMap[type]);
            legend.append('text').attr('x', 14).attr('y', i * 20 + 4).text(label).attr('font-size', '11px').attr('fill', '#94a3b8');
        });
    }

    // ── Shared utility ───────────────────────────────────────────

    _esc(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const claudeConfigModule = new ClaudeConfigModule();
window.ClaudeConfigModule = claudeConfigModule;
export default claudeConfigModule;
