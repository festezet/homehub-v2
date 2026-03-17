/**
 * Modularity Audit Module
 * Displays modularity audit results for all projects
 */

import API from './api.js';

class ModularityAuditModule {
    constructor() {
        this.data = null;
        this.sort = 'score-asc';
        this.scanning = false;
    }

    async load() {
        const container = document.getElementById('modularity-container');
        if (!container) return;

        try {
            const response = await API.modularity.getAudit();
            this.data = response.results || {};
            this.render(container);
        } catch (error) {
            console.error('Failed to load modularity audit:', error);
            this.renderEmpty(container);
        }
    }

    render(container) {
        if (!container) container = document.getElementById('modularity-container');
        if (!container) return;

        const entries = Object.values(this.data);

        if (entries.length === 0) {
            this.renderEmpty(container);
            return;
        }

        const sorted = this._sortData([...entries]);
        const avgScore = Math.round(entries.reduce((s, e) => s + (e.score || 0), 0) / entries.length);
        const totalRed = entries.reduce((s, e) => s + (e.summary?.red || 0), 0);
        const totalYellow = entries.reduce((s, e) => s + (e.summary?.yellow || 0), 0);
        const worstProject = entries.reduce((w, e) => (!w || (e.score || 0) < (w.score || 0)) ? e : w, null);
        const cleanProjects = entries.filter(e => (e.summary?.red || 0) === 0).length;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="sp-stat-card" style="border-top: 3px solid ${this._scoreColor(avgScore)};">
                    <div class="sp-stat-number" style="color: ${this._scoreColor(avgScore)};">${avgScore}</div>
                    <div class="sp-stat-label">Score moyen</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #10b981;">
                    <div class="sp-stat-number" style="color: #10b981;">${cleanProjects}</div>
                    <div class="sp-stat-label">Sans issues rouges</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #ef4444;">
                    <div class="sp-stat-number" style="color: #ef4444;">${totalRed}</div>
                    <div class="sp-stat-label">Issues rouges</div>
                </div>
                <div class="sp-stat-card" style="border-top: 3px solid #f59e0b;">
                    <div class="sp-stat-number" style="color: #f59e0b;">${totalYellow}</div>
                    <div class="sp-stat-label">Issues jaunes</div>
                </div>
                <div class="sp-stat-card">
                    <div class="sp-stat-number">${entries.length}</div>
                    <div class="sp-stat-label">Projets scannes</div>
                </div>
            </div>

            <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <span style="font-size: 0.85em; color: #6b7280;">Trier par :</span>
                <button class="sp-filter-btn ${this.sort === 'score-asc' ? 'active' : ''}" onclick="window.ModularityAuditModule.setSort('score-asc')">Score (pire)</button>
                <button class="sp-filter-btn ${this.sort === 'score-desc' ? 'active' : ''}" onclick="window.ModularityAuditModule.setSort('score-desc')">Score (meilleur)</button>
                <button class="sp-filter-btn ${this.sort === 'name-asc' ? 'active' : ''}" onclick="window.ModularityAuditModule.setSort('name-asc')">Nom</button>
                <button class="sp-filter-btn ${this.sort === 'red-desc' ? 'active' : ''}" onclick="window.ModularityAuditModule.setSort('red-desc')">Issues rouges</button>
                <div style="flex: 1;"></div>
                <button id="modularity-scan-btn" class="sp-filter-btn" style="background: #6366f1; color: white;" onclick="window.ModularityAuditModule.runScan()">
                    ${this.scanning ? 'Scan en cours...' : 'Lancer le scan'}
                </button>
            </div>

            ${worstProject ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 0.85em;">
                Projet le plus critique : <strong>${this._escapeHtml(worstProject.name || worstProject.project)}</strong> — score ${worstProject.score}, ${worstProject.summary?.red || 0} rouge(s), ${worstProject.summary?.yellow || 0} jaune(s)
            </div>
            ` : ''}

            <div class="sp-ports-table">
                <table>
                    <thead>
                        <tr>
                            <th>Projet</th>
                            <th style="width: 80px;">ID</th>
                            <th style="width: 180px;">Score</th>
                            <th style="width: 80px; text-align: right;">Fichiers</th>
                            <th style="width: 90px; text-align: right;">Lignes</th>
                            <th style="width: 70px; text-align: center;">Rouge</th>
                            <th style="width: 70px; text-align: center;">Jaune</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(e => this._renderRow(e)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    _renderRow(entry) {
        const score = entry.score || 0;
        const color = this._scoreColor(score);
        const name = entry.name || entry.project || '?';
        const uid = entry.unique_id || '';
        const red = entry.summary?.red || 0;
        const yellow = entry.summary?.yellow || 0;

        return `
            <tr>
                <td><strong>${this._escapeHtml(name)}</strong></td>
                <td><code style="font-size: 0.8em; color: #6b7280;">${this._escapeHtml(uid)}</code></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; background: #f3f4f6; border-radius: 4px; height: 14px; overflow: hidden;">
                            <div style="width: ${score}%; background: ${color}; height: 100%; border-radius: 4px; transition: width 0.3s;"></div>
                        </div>
                        <span style="font-size: 0.8em; font-weight: 700; color: ${color}; min-width: 28px; text-align: right;">${score}</span>
                    </div>
                </td>
                <td style="text-align: right; font-size: 0.85em; color: #374151;">${entry.files_scanned || 0}</td>
                <td style="text-align: right; font-size: 0.85em; font-family: monospace; color: #374151;">${this._formatNumber(entry.total_lines)}</td>
                <td style="text-align: center;">
                    ${red > 0
                        ? `<span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; font-weight: 600;">${red}</span>`
                        : '<span style="color: #d1d5db;">0</span>'}
                </td>
                <td style="text-align: center;">
                    ${yellow > 0
                        ? `<span style="background: #fffbeb; color: #d97706; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; font-weight: 600;">${yellow}</span>`
                        : '<span style="color: #d1d5db;">0</span>'}
                </td>
            </tr>
        `;
    }

    renderEmpty(container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 1.1em; color: #6b7280; margin-bottom: 16px;">
                    Aucun resultat d'audit en cache.
                </div>
                <div style="font-size: 0.9em; color: #9ca3af; margin-bottom: 24px;">
                    Lancez un scan pour analyser la modularite de tous les projets actifs.
                </div>
                <button id="modularity-scan-btn" class="sp-filter-btn" style="background: #6366f1; color: white; padding: 10px 24px; font-size: 1em;" onclick="window.ModularityAuditModule.runScan()">
                    ${this.scanning ? 'Scan en cours...' : 'Lancer le scan'}
                </button>
            </div>
        `;
    }

    async runScan() {
        const btn = document.getElementById('modularity-scan-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Scan en cours...';
        }
        this.scanning = true;

        try {
            const response = await API.modularity.runScan();
            if (response.status === 'ok') {
                this.data = response.results || {};
                this.scanning = false;
                this.render();
            }
        } catch (error) {
            console.error('Modularity scan failed:', error);
            this.scanning = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Lancer le scan';
            }
        }
    }

    setSort(sort) {
        this.sort = sort;
        this.render();
    }

    _sortData(data) {
        switch (this.sort) {
            case 'score-asc':
                return data.sort((a, b) => (a.score || 0) - (b.score || 0));
            case 'score-desc':
                return data.sort((a, b) => (b.score || 0) - (a.score || 0));
            case 'name-asc':
                return data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            case 'red-desc':
                return data.sort((a, b) => (b.summary?.red || 0) - (a.summary?.red || 0));
            default:
                return data;
        }
    }

    _scoreColor(score) {
        if (score >= 80) return '#10b981';
        if (score >= 50) return '#f59e0b';
        return '#ef4444';
    }

    _formatNumber(n) {
        if (!n) return '-';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const modularityAuditModule = new ModularityAuditModule();
window.ModularityAuditModule = modularityAuditModule;

export default modularityAuditModule;
