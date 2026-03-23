/**
 * HH Design Module
 * Architecture introspection + Feature wishlist CRUD
 */

import API from './api.js';

class HHDesignModule {
    constructor() {
        this.currentTab = 'architecture';
        this.archData = null;
    }

    async load() {
        this.loadArchitecture();
    }

    setTab(tab) {
        this.currentTab = tab;
        const archView = document.getElementById('hhd-architecture');
        const featView = document.getElementById('hhd-features');
        const btnArch = document.getElementById('hhd-tab-arch');
        const btnFeat = document.getElementById('hhd-tab-feat');

        if (tab === 'architecture') {
            archView.style.display = 'block';
            featView.style.display = 'none';
            btnArch.classList.add('active');
            btnFeat.classList.remove('active');
            this.loadArchitecture();
        } else {
            archView.style.display = 'none';
            featView.style.display = 'block';
            btnArch.classList.remove('active');
            btnFeat.classList.add('active');
            this.loadFeatures();
        }
    }

    async loadArchitecture() {
        const statsEl = document.getElementById('hhd-arch-stats');
        const detailsEl = document.getElementById('hhd-arch-details');
        if (!statsEl) return;

        try {
            const data = await API.hhDesign.getArchitecture();
            this.archData = data;
            this._renderArchStats(data.summary, statsEl);
            this._renderArchDetails(data, detailsEl);
        } catch (error) {
            console.error('Failed to load architecture:', error);
            statsEl.innerHTML = '<p style="color:#dc2626;text-align:center;padding:20px;grid-column:1/-1;">Erreur de chargement</p>';
        }
    }

    _renderArchStats(summary, el) {
        if (!summary) return;
        const cards = [
            { label: 'Pages', value: summary.pages, color: '#6366f1' },
            { label: 'API Routes', value: summary.api_routes, color: '#10b981' },
            { label: 'Services', value: summary.services, color: '#f59e0b' },
            { label: 'JS Modules', value: summary.js_modules, color: '#3b82f6' },
            { label: 'Templates', value: summary.templates, color: '#8b5cf6' },
            { label: 'Total LOC', value: summary.total_loc?.toLocaleString() || '—', color: '#ef4444' },
        ];

        el.innerHTML = cards.map(c => `
            <div style="background:var(--card-bg,#fff);border-radius:10px;padding:16px;text-align:center;border:1px solid var(--border-color,#e5e7eb);">
                <div style="font-size:1.8em;font-weight:700;color:${c.color};">${c.value}</div>
                <div style="font-size:0.82em;color:#6b7280;margin-top:4px;">${c.label}</div>
            </div>
        `).join('');
    }

    _renderArchDetails(data, el) {
        if (!el) return;
        let html = '';

        // Pages
        if (data.pages?.length) {
            html += this._archSection('Pages', '#6366f1', data.pages.map(p => `<code>${p}</code>`));
        }

        // API Routes
        if (data.api_routes?.length) {
            html += this._archSection('API Routes', '#10b981',
                data.api_routes.map(r => `<code style="color:#10b981;">${r.method}</code> <code>${r.path}</code> <span style="color:#9ca3af;font-size:0.8em;">${this._esc(r.file)}</span>`)
            );
        }

        // Services
        if (data.services?.length) {
            html += this._archSection('Services', '#f59e0b',
                data.services.map(s => `<strong>${this._esc(s.name)}</strong> <span style="color:#9ca3af;font-size:0.8em;">${s.loc} LOC — ${this._esc(s.file)}</span>`)
            );
        }

        // JS Modules
        if (data.js_modules?.length) {
            html += this._archSection('JS Modules', '#3b82f6',
                data.js_modules.map(m => `<strong>${this._esc(m.name)}</strong> <span style="color:#9ca3af;font-size:0.8em;">${m.loc} LOC</span>`)
            );
        }

        // Templates
        if (data.templates?.length) {
            html += this._archSection('Templates', '#8b5cf6',
                data.templates.map(t => `<code>${this._esc(t.name)}</code> <span style="color:#9ca3af;font-size:0.8em;">${t.loc} LOC</span>`)
            );
        }

        el.innerHTML = html;
    }

    _archSection(title, color, items) {
        const id = 'hhd-arch-' + title.toLowerCase().replace(/\s+/g, '-');
        return `
            <div style="margin-bottom:16px;">
                <div style="font-weight:600;font-size:0.9em;color:${color};cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-color,#e5e7eb);"
                     onclick="const el=document.getElementById('${id}');el.style.display=el.style.display==='none'?'block':'none'">
                    ${title} (${items.length})
                </div>
                <div id="${id}" style="padding:8px 0;">
                    ${items.map(i => `<div style="font-size:0.82em;padding:3px 8px;">${i}</div>`).join('')}
                </div>
            </div>`;
    }

    async loadFeatures() {
        const listEl = document.getElementById('hhd-features-list');
        if (!listEl) return;

        const status = document.getElementById('hhd-filter-status')?.value || '';
        const category = document.getElementById('hhd-filter-category')?.value || '';

        try {
            const response = await API.hhDesign.getFeatures(status, category);
            const features = response.features || [];
            if (!features.length) {
                listEl.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:30px;">Aucune feature trouvee</p>';
                return;
            }
            listEl.innerHTML = features.map(f => this._featureCard(f)).join('');
        } catch (error) {
            console.error('Failed to load features:', error);
            listEl.innerHTML = '<p style="color:#dc2626;text-align:center;padding:20px;">Erreur de chargement</p>';
        }
    }

    _featureCard(f) {
        const statusColors = {
            'idea': '#9ca3af', 'planned': '#6366f1', 'in-progress': '#f59e0b',
            'done': '#10b981', 'rejected': '#ef4444'
        };
        const priorityColors = {
            'P1-Urgent': '#ef4444', 'P2-High': '#f59e0b',
            'P3-Normal': '#3b82f6', 'P4-Low': '#9ca3af'
        };

        return `
            <div style="background:var(--card-bg,#fff);border:1px solid var(--border-color,#e5e7eb);border-radius:10px;padding:14px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:0.92em;">${this._esc(f.title)}</div>
                        ${f.description ? `<div style="font-size:0.82em;color:#6b7280;margin-top:4px;">${this._esc(f.description)}</div>` : ''}
                        ${f.pain_point ? `<div style="font-size:0.78em;color:#9ca3af;margin-top:2px;font-style:italic;">Pain: ${this._esc(f.pain_point)}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                        <span style="font-size:0.72em;padding:2px 8px;border-radius:12px;background:${statusColors[f.status] || '#9ca3af'}22;color:${statusColors[f.status] || '#9ca3af'};font-weight:500;">${this._esc(f.status)}</span>
                        <span style="font-size:0.72em;padding:2px 8px;border-radius:12px;background:${priorityColors[f.priority] || '#9ca3af'}22;color:${priorityColors[f.priority] || '#9ca3af'};font-weight:500;">${this._esc(f.priority)}</span>
                        <span style="font-size:0.72em;padding:2px 6px;border-radius:8px;background:#f3f4f6;color:#6b7280;">${this._esc(f.category)}</span>
                    </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
                    <button class="btn btn-sm" style="font-size:0.75em;padding:3px 10px;" onclick="window.HHDesignModule.editFeature(${f.id})">Editer</button>
                    <button class="btn btn-sm" style="font-size:0.75em;padding:3px 10px;color:#ef4444;" onclick="window.HHDesignModule.deleteFeature(${f.id})">Supprimer</button>
                </div>
            </div>`;
    }

    showModal(featureId = null) {
        const modal = document.getElementById('hhd-modal');
        const title = document.getElementById('hhd-modal-title');
        const form = document.getElementById('hhd-feature-form');

        form.reset();
        document.getElementById('hhd-f-id').value = '';

        if (featureId) {
            title.textContent = 'Modifier Feature';
        } else {
            title.textContent = 'Nouvelle Feature';
        }

        modal.style.display = 'flex';
    }

    hideModal() {
        document.getElementById('hhd-modal').style.display = 'none';
    }

    async editFeature(id) {
        try {
            const response = await API.hhDesign.getFeatures();
            const feature = (response.features || []).find(f => f.id === id);
            if (!feature) return;

            document.getElementById('hhd-f-id').value = feature.id;
            document.getElementById('hhd-f-title').value = feature.title || '';
            document.getElementById('hhd-f-description').value = feature.description || '';
            document.getElementById('hhd-f-category').value = feature.category || 'ux';
            document.getElementById('hhd-f-priority').value = feature.priority || 'P3-Normal';
            document.getElementById('hhd-f-status').value = feature.status || 'idea';
            document.getElementById('hhd-f-painpoint').value = feature.pain_point || '';

            document.getElementById('hhd-modal-title').textContent = 'Modifier Feature';
            document.getElementById('hhd-modal').style.display = 'flex';
        } catch (error) {
            console.error('Failed to load feature for edit:', error);
        }
    }

    async saveFeature(event) {
        event.preventDefault();

        const id = document.getElementById('hhd-f-id').value;
        const data = {
            title: document.getElementById('hhd-f-title').value,
            description: document.getElementById('hhd-f-description').value,
            category: document.getElementById('hhd-f-category').value,
            priority: document.getElementById('hhd-f-priority').value,
            status: document.getElementById('hhd-f-status').value,
            pain_point: document.getElementById('hhd-f-painpoint').value,
        };

        try {
            if (id) {
                await API.hhDesign.updateFeature(id, data);
            } else {
                await API.hhDesign.createFeature(data);
            }
            this.hideModal();
            this.loadFeatures();
        } catch (error) {
            console.error('Failed to save feature:', error);
            alert('Erreur lors de la sauvegarde');
        }
    }

    async deleteFeature(id) {
        if (!confirm('Supprimer cette feature ?')) return;

        try {
            await API.hhDesign.deleteFeature(id);
            this.loadFeatures();
        } catch (error) {
            console.error('Failed to delete feature:', error);
        }
    }

    _esc(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const hhDesignModule = new HHDesignModule();
window.HHDesignModule = hhDesignModule;

export default hhDesignModule;
