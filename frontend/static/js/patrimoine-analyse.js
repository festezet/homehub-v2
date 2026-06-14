/**
 * Patrimoine Analyse Module
 * Render analysis comparison tables from patrimoine DB
 */

import API from './api.js';

class PatrimoineAnalyseModule {
    constructor() {
        this.loaded = false;
    }

    async load() {
        await this._loadAnalysis();
        this.loaded = true;
    }

    async _loadAnalysis() {
        const container = document.getElementById('pat-analyse-content');
        if (!container) return;

        try {
            const res = await API.patrimoine.getAnalysis();
            const comparisons = res.comparisons || [];

            if (!comparisons.length) {
                container.innerHTML = '<p style="text-align:center; padding:40px; opacity:0.5;">Aucune analyse disponible</p>';
                return;
            }

            container.innerHTML = comparisons.map(comp => this._renderComparison(comp)).join('');
        } catch (e) {
            console.error('Patrimoine analysis error:', e);
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#f38ba8;">Erreur chargement analyse</p>';
        }
    }

    _renderComparison(comp) {
        const columns = comp.columns || [];
        const rows = comp.rows || [];

        let html = `<div class="pat-comp-section">`;
        html += `<div class="pat-comp-title">${this._esc(comp.title)}</div>`;
        html += `<table class="pat-comp-table">`;

        // Header
        html += `<thead><tr><th></th>`;
        for (const col of columns) {
            const winCls = col.is_winner ? ' class="pat-winner-col"' : '';
            html += `<th${winCls}>${this._esc(col.label)}${col.is_winner ? ' ✓' : ''}</th>`;
        }
        html += `</tr></thead>`;

        // Rows
        html += `<tbody>`;
        for (const row of rows) {
            const rowClass = row.row_type === 'header' ? 'pat-row-header' : row.row_type === 'total' ? 'pat-row-total' : '';
            html += `<tr class="${rowClass}">`;
            html += `<td>${this._esc(row.label)}</td>`;
            for (const col of columns) {
                const cell = row.cells[String(col.id)] || { value: '', is_highlight: false };
                const cls = cell.is_highlight ? ' class="pat-highlight"' : '';
                html += `<td${cls}>${this._esc(cell.value)}</td>`;
            }
            html += `</tr>`;
        }
        html += `</tbody></table>`;

        // Recommendation block
        if (comp.recommendation) {
            html += `<div class="pat-comp-reco">
                <div class="pat-reco-label">Recommandation</div>
                <div class="pat-reco-text">${this._esc(comp.recommendation)}</div>
            </div>`;
        }

        // Context / explanation block
        if (comp.description) {
            html += `<div class="pat-comp-context">
                <div class="pat-context-label">Contexte de l'analyse</div>
                <div class="pat-context-text">${this._esc(comp.description)}</div>
            </div>`;
        }

        html += `</div>`;

        return html;
    }

    _esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

const patrimoineAnalyseModule = new PatrimoineAnalyseModule();
export default patrimoineAnalyseModule;
