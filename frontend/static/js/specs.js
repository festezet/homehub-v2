/**
 * Specs & Health Module
 * Two views: Specifications tracking + Project health dashboard
 */

import API from './api.js';

class SpecsModule {
    constructor() {
        this.data = null;
        this.filter = 'all';
        this.view = 'specs'; // 'specs' or 'health'
        this.healthSort = 'score-desc';
    }

    async load() {
        try {
            const response = await API.specs.getAll();
            this.data = response.specs;
            this.render();
        } catch (error) {
            console.error('Failed to load specs:', error);
            this.renderError();
        }
    }

    render() {
        const container = document.getElementById('specs-dashboard');
        if (!container || !this.data) return;

        const viewToggle = `
            <div style="display: flex; gap: 4px; margin-bottom: 20px; background: #f3f4f6; border-radius: 8px; padding: 4px; width: fit-content;">
                <button class="sp-view-btn ${this.view === 'specs' ? 'active' : ''}" onclick="window.SpecsModule.setView('specs')">Specifications</button>
                <button class="sp-view-btn ${this.view === 'health' ? 'active' : ''}" onclick="window.SpecsModule.setView('health')">Sante des projets</button>
            </div>
        `;

        let content = '';
        if (this.view === 'specs') {
            content = this.renderSpecsView();
        } else {
            content = this.renderHealthView();
        }

        container.innerHTML = viewToggle + content;
    }

    // --- SPECS VIEW ---

    renderSpecsView() {
        const specs = this.filter === 'all'
            ? this.data
            : this.data.filter(s => s.spec_status === this.filter);

        const counts = {
            total: this.data.length,
            complete: this.data.filter(s => s.spec_status === 'complete').length,
            draft: this.data.filter(s => s.spec_status === 'draft').length,
            missing: this.data.filter(s => s.spec_status === 'missing').length,
            outdated: this.data.filter(s => s.spec_status === 'outdated').length
        };

        return this._renderSpecsStats(counts)
             + this._renderSpecsFilters(counts)
             + this._renderSpecsTable(specs);
    }

    _renderSpecsStats(counts) {
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="sp-stat-card">
                    <div class="sp-stat-number">${counts.total}</div>
                    <div class="sp-stat-label">Projets actifs</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #10b981;">
                    <div class="sp-stat-number" style="color: #10b981;">${counts.complete}</div>
                    <div class="sp-stat-label">Specs completes</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #f59e0b;">
                    <div class="sp-stat-number" style="color: #f59e0b;">${counts.draft}</div>
                    <div class="sp-stat-label">Brouillons</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #ef4444;">
                    <div class="sp-stat-number" style="color: #ef4444;">${counts.missing}</div>
                    <div class="sp-stat-label">Manquantes</div>
                </div>
                ${counts.outdated > 0 ? `
                <div class="sp-stat-card" style="border-top: 3px solid #8b5cf6;">
                    <div class="sp-stat-number" style="color: #8b5cf6;">${counts.outdated}</div>
                    <div class="sp-stat-label">Obsoletes</div>
                </div>` : ''}
            </div>`;
    }

    _renderSpecsFilters(counts) {
        return `
            <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <button class="sp-filter-btn ${this.filter === 'all' ? 'active' : ''}" onclick="window.SpecsModule.setFilter('all')">Tous (${counts.total})</button>
                <button class="sp-filter-btn ${this.filter === 'complete' ? 'active' : ''}" onclick="window.SpecsModule.setFilter('complete')">Complete (${counts.complete})</button>
                <button class="sp-filter-btn ${this.filter === 'draft' ? 'active' : ''}" onclick="window.SpecsModule.setFilter('draft')">Brouillon (${counts.draft})</button>
                <button class="sp-filter-btn ${this.filter === 'missing' ? 'active' : ''}" onclick="window.SpecsModule.setFilter('missing')">Manquante (${counts.missing})</button>
                ${counts.outdated > 0 ? `<button class="sp-filter-btn ${this.filter === 'outdated' ? 'active' : ''}" onclick="window.SpecsModule.setFilter('outdated')">Obsolete (${counts.outdated})</button>` : ''}
                <div style="flex: 1;"></div>
                <button class="sp-filter-btn" style="background: #3b82f6; color: white;" onclick="window.SpecsModule.scanSpecs()">Scanner fichiers</button>
            </div>`;
    }

    _renderSpecsTable(specs) {
        const statusColors = {
            'complete': '#10b981', 'draft': '#f59e0b',
            'missing': '#ef4444', 'outdated': '#8b5cf6'
        };
        const statusLabels = {
            'complete': 'Complete', 'draft': 'Brouillon',
            'missing': 'Manquante', 'outdated': 'Obsolete'
        };

        return `
            <div class="sp-ports-table">
                <table>
                    <thead>
                        <tr>
                            <th>Projet</th>
                            <th>ID</th>
                            <th style="width: 130px;">Statut</th>
                            <th style="width: 110px;">Date</th>
                            <th style="width: 70px;">Lignes</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${specs.map(s => this._renderSpecsRow(s, statusColors, statusLabels)).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    _renderSpecsRow(s, statusColors, statusLabels) {
        const color = statusColors[s.spec_status] || '#6b7280';
        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td><code style="font-size: 0.8em; color: #6b7280;">${s.unique_id}</code></td>
                <td>
                    <select
                        data-id="${s.id}" data-field="spec_status"
                        onchange="window.SpecsModule.onFieldChange(this)"
                        style="padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 0.85em; background: white; color: ${color}; font-weight: 600; cursor: pointer;">
                        ${['missing', 'draft', 'complete', 'outdated'].map(opt =>
                            `<option value="${opt}" ${s.spec_status === opt ? 'selected' : ''} style="color: ${statusColors[opt]};">${statusLabels[opt]}</option>`
                        ).join('')}
                    </select>
                </td>
                <td style="color: #6b7280; font-size: 0.85em;">${s.spec_date || '-'}</td>
                <td style="text-align: center; color: #6b7280; font-size: 0.85em;">${s.spec_lines || '-'}</td>
                <td>
                    <span
                        contenteditable="true"
                        data-id="${s.id}" data-field="spec_notes"
                        class="specs-editable-note"
                        style="display: inline-block; min-width: 100px; padding: 2px 6px; border: 1px solid transparent; border-radius: 4px; font-size: 0.85em; color: #374151; outline: none;"
                        onfocus="this.style.borderColor='#3b82f6'; this.style.background='#f0f7ff';"
                        onblur="this.style.borderColor='transparent'; this.style.background='transparent'; window.SpecsModule.onNoteBlur(this);"
                    >${s.spec_notes || ''}</span>
                </td>
            </tr>`;
    }

    // --- HEALTH VIEW ---

    renderHealthView() {
        const sorted = this._sortHealthData([...this.data]);
        const needsScan = this.data.every(s => !s.health_score);

        const stats = {
            avgScore: this.data.length > 0
                ? Math.round(this.data.reduce((sum, s) => sum + (s.health_score || 0), 0) / this.data.length) : 0,
            healthy: this.data.filter(s => (s.health_score || 0) >= 60).length,
            critical: this.data.filter(s => (s.health_score || 0) < 40).length,
            withTests: this.data.filter(s => s.health_has_tests).length,
            portable: this.data.filter(s => (s.health_portability_score || 0) >= 60).length,
            servicesUp: this.data.filter(s => s.health_service_up === true).length,
            servicesTotal: this.data.filter(s => s.health_service_up !== null).length
        };

        return this._renderHealthStats(stats)
             + this._renderHealthScanBanner(needsScan)
             + this._renderHealthSortBar()
             + this._renderHealthTable(sorted);
    }

    _renderHealthStats(stats) {
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="sp-stat-card" style="border-top: 3px solid ${this._scoreColor(stats.avgScore)};">
                    <div class="sp-stat-number" style="color: ${this._scoreColor(stats.avgScore)};">${stats.avgScore}</div>
                    <div class="sp-stat-label">Score moyen</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #10b981;">
                    <div class="sp-stat-number" style="color: #10b981;">${stats.healthy}</div>
                    <div class="sp-stat-label">Projets sains</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #ef4444;">
                    <div class="sp-stat-number" style="color: #ef4444;">${stats.critical}</div>
                    <div class="sp-stat-label">Critiques</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #6366f1;">
                    <div class="sp-stat-number" style="color: #6366f1;">${stats.withTests}</div>
                    <div class="sp-stat-label">Avec tests</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #8b5cf6;">
                    <div class="sp-stat-number" style="color: #8b5cf6;">${stats.portable}/${this.data.length}</div>
                    <div class="sp-stat-label">Portables</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #0ea5e9;">
                    <div class="sp-stat-number" style="color: #0ea5e9;">${stats.servicesUp}/${stats.servicesTotal}</div>
                    <div class="sp-stat-label">Services up</div>
                </div>
            </div>`;
    }

    _renderHealthScanBanner(needsScan) {
        if (!needsScan) return '';
        return `
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 1.4em;">!</span>
                <div>
                    <strong>Aucune donnee de sante.</strong> Lancez un scan pour analyser vos projets.
                </div>
                <button class="sp-filter-btn" style="background: #f59e0b; color: white; margin-left: auto;" onclick="window.SpecsModule.scanHealth()">Scanner maintenant</button>
            </div>`;
    }

    _renderHealthSortBar() {
        return `
            <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <span style="font-size: 0.85em; color: #6b7280;">Trier par :</span>
                <button class="sp-filter-btn ${this.healthSort === 'score-desc' ? 'active' : ''}" onclick="window.SpecsModule.setHealthSort('score-desc')">Score</button>
                <button class="sp-filter-btn ${this.healthSort === 'name-asc' ? 'active' : ''}" onclick="window.SpecsModule.setHealthSort('name-asc')">Nom</button>
                <button class="sp-filter-btn ${this.healthSort === 'loc-desc' ? 'active' : ''}" onclick="window.SpecsModule.setHealthSort('loc-desc')">LOC</button>
                <button class="sp-filter-btn ${this.healthSort === 'commit-desc' ? 'active' : ''}" onclick="window.SpecsModule.setHealthSort('commit-desc')">Activite</button>
                <button class="sp-filter-btn ${this.healthSort === 'portability-desc' ? 'active' : ''}" onclick="window.SpecsModule.setHealthSort('portability-desc')">Portabilite</button>
                <div style="flex: 1;"></div>
                <button class="sp-filter-btn" style="background: #f97316; color: white;" onclick="window.SpecsModule.scanSecurity()">Scanner securite</button>
                <button class="sp-filter-btn" style="background: #6366f1; color: white;" onclick="window.SpecsModule.scanHealth()">Scanner sante</button>
            </div>`;
    }

    _renderHealthTable(sorted) {
        return `
            <div class="sp-ports-table">
                <table>
                    <thead>
                        <tr>
                            <th>Projet</th>
                            <th style="width: 180px;">Score</th>
                            <th style="width: 60px; text-align: center;" title="SPEC.md">SPEC</th>
                            <th style="width: 60px; text-align: center;" title="README score">README</th>
                            <th style="width: 60px; text-align: center;" title="Tests presents">Tests</th>
                            <th style="width: 50px; text-align: center;" title=".gitignore">.git*</th>
                            <th style="width: 70px; text-align: center;" title="Portabilite (chemins absolus, .env, setup.sh)">Port.</th>
                            <th style="width: 55px; text-align: center;" title="Security Posture Score (project-auditor)">Sec.</th>
                            <th style="width: 80px; text-align: right;">LOC</th>
                            <th style="width: 55px; text-align: right;">Deps</th>
                            <th style="width: 100px;">Dernier commit</th>
                            <th style="width: 60px; text-align: center;">Service</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(s => this._renderHealthRow(s)).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    _renderHealthRow(s) {
        const score = s.health_score || 0;
        const scoreColor = this._scoreColor(score);
        const specOk = s.spec_status === 'complete' || s.spec_status === 'draft';
        const commitColor = this._commitRecencyColor(s.health_last_commit);

        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; background: #f3f4f6; border-radius: 4px; height: 14px; overflow: hidden;">
                            <div style="width: ${score}%; background: ${scoreColor}; height: 100%; border-radius: 4px; transition: width 0.3s;"></div>
                        </div>
                        <span style="font-size: 0.8em; font-weight: 700; color: ${scoreColor}; min-width: 28px; text-align: right;">${score}</span>
                    </div>
                </td>
                <td style="text-align: center;">${specOk
                    ? '<span style="color: #10b981; font-weight: 700;">OK</span>'
                    : '<span style="color: #ef4444; font-weight: 700;">--</span>'}</td>
                <td style="text-align: center;">
                    <span style="font-size: 0.8em; font-weight: 600; color: ${this._readmeColor(s.health_readme_score)};">${s.health_readme_score || 0}%</span>
                </td>
                <td style="text-align: center;">${s.health_has_tests
                    ? '<span style="color: #10b981; font-weight: 700;">OK</span>'
                    : '<span style="color: #d1d5db;">--</span>'}</td>
                <td style="text-align: center;">${s.health_has_gitignore
                    ? '<span style="color: #10b981; font-weight: 700;">OK</span>'
                    : '<span style="color: #d1d5db;">--</span>'}</td>
                <td style="text-align: center;">
                    <span style="font-size: 0.8em; font-weight: 600; color: ${this._portabilityColor(s.health_portability_score)};">${s.health_portability_score || 0}%</span>
                </td>
                <td style="text-align: center;">
                    ${s.security_posture_score != null
                        ? `<span style="font-size: 0.8em; font-weight: 600; color: ${this._scoreColor(s.security_posture_score)};">${s.security_posture_score}</span>`
                        : '<span style="color: #d1d5db;">--</span>'}
                </td>
                <td style="text-align: right; font-size: 0.8em; font-family: monospace; color: #374151;">${this._formatLoc(s.health_loc)}</td>
                <td style="text-align: right; font-size: 0.8em; color: #6b7280;">${s.health_deps_count || '-'}</td>
                <td style="font-size: 0.8em; color: ${commitColor};">${s.health_last_commit || '-'}</td>
                <td style="text-align: center;">${this._renderServiceStatus(s)}</td>
            </tr>
        `;
    }

    // --- HELPERS ---

    _scoreColor(score) {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#3b82f6';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    }

    _portabilityColor(score) {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#3b82f6';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    }

    _readmeColor(score) {
        if (score >= 80) return '#10b981';
        if (score >= 50) return '#f59e0b';
        return '#ef4444';
    }

    _commitRecencyColor(dateStr) {
        if (!dateStr) return '#d1d5db';
        try {
            const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
            if (days <= 30) return '#10b981';
            if (days <= 90) return '#f59e0b';
            return '#ef4444';
        } catch {
            return '#6b7280';
        }
    }

    _formatLoc(loc) {
        if (!loc) return '-';
        if (loc >= 1000) return (loc / 1000).toFixed(1) + 'k';
        return String(loc);
    }

    _renderServiceStatus(s) {
        if (s.health_service_up === null || s.health_service_up === undefined) {
            return '<span style="color: #d1d5db;" title="Pas de port attribue">-</span>';
        }
        if (s.health_service_up) {
            return `<span style="display: inline-block; width: 10px; height: 10px; background: #10b981; border-radius: 50%;" title="Port ${s.health_port} : actif"></span>`;
        }
        return `<span style="display: inline-block; width: 10px; height: 10px; background: #d1d5db; border-radius: 50%; border: 1px solid #9ca3af;" title="Port ${s.health_port} : inactif"></span>`;
    }

    _sortHealthData(data) {
        switch (this.healthSort) {
            case 'score-desc':
                return data.sort((a, b) => (b.health_score || 0) - (a.health_score || 0));
            case 'name-asc':
                return data.sort((a, b) => a.name.localeCompare(b.name));
            case 'loc-desc':
                return data.sort((a, b) => (b.health_loc || 0) - (a.health_loc || 0));
            case 'commit-desc':
                return data.sort((a, b) => {
                    if (!a.health_last_commit) return 1;
                    if (!b.health_last_commit) return -1;
                    return b.health_last_commit.localeCompare(a.health_last_commit);
                });
            case 'portability-desc':
                return data.sort((a, b) => (b.health_portability_score || 0) - (a.health_portability_score || 0));
            default:
                return data;
        }
    }

    // --- ACTIONS ---

    setView(view) {
        this.view = view;
        this.render();
    }

    setFilter(filter) {
        this.filter = filter;
        this.render();
    }

    setHealthSort(sort) {
        this.healthSort = sort;
        this.render();
    }

    async onFieldChange(el) {
        const id = el.dataset.id;
        const field = el.dataset.field;
        const value = el.value;

        try {
            await API.specs.update(id, field, value);
            const item = this.data.find(s => s.id === parseInt(id));
            if (item) item[field] = value;
            this.render();
        } catch (error) {
            console.error('Failed to update spec:', error);
        }
    }

    async onNoteBlur(el) {
        const id = el.dataset.id;
        const value = el.textContent.trim();
        const item = this.data.find(s => s.id === parseInt(id));

        if (item && item.spec_notes === value) return;

        try {
            await API.specs.update(id, 'spec_notes', value);
            if (item) item.spec_notes = value;
        } catch (error) {
            console.error('Failed to update note:', error);
        }
    }

    async scanSpecs() {
        try {
            const response = await API.specs.scan();
            if (response.status === 'ok') {
                const r = response.results;
                alert(`Scan termine: ${r.found} specs trouvees, ${r.updated} mises a jour, ${r.missing} manquantes`);
                await this.load();
            }
        } catch (error) {
            console.error('Failed to scan specs:', error);
        }
    }

    async scanSecurity() {
        const btn = document.querySelector('[onclick*="scanSecurity"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Scan securite...';
        }

        try {
            const response = await API.specs.securityScan();
            if (response.status === 'ok') {
                const r = response.results;
                alert(`Scan securite termine: ${r.scanned} projets audites, ${r.errors} erreurs`);
                await this.load();
            }
        } catch (error) {
            console.error('Failed to scan security:', error);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Scanner securite';
            }
        }
    }

    async scanHealth() {
        const btn = document.querySelector('[onclick*="scanHealth"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Scan en cours...';
        }

        try {
            const response = await API.specs.healthScan();
            if (response.status === 'ok') {
                const r = response.results;
                alert(`Scan sante termine: ${r.scanned} projets analyses, ${r.errors} erreurs`);
                await this.load();
            }
        } catch (error) {
            console.error('Failed to scan health:', error);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Scanner sante';
            }
        }
    }

    renderError() {
        const container = document.getElementById('specs-dashboard');
        if (!container) return;
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc2626;">
                Erreur de chargement des specifications.
                <br><small>Verifiez que le backend est demarre.</small>
            </div>
        `;
    }
}

const specsModule = new SpecsModule();
window.SpecsModule = specsModule;

export default specsModule;
