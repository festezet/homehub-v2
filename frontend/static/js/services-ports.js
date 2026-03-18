/**
 * Services & Ports Module
 * Displays the central port registry from infrastructure/data/port_registry.json
 */

import API from './api.js';

class ServicesPortsModule {
    constructor() {
        this.data = null;
        this.filter = 'all';
    }

    async load() {
        try {
            const response = await API.services.getPorts();
            this.data = response;
            this.render();
        } catch (error) {
            console.error('Failed to load services ports:', error);
            this.renderError();
        }
    }

    /**
     * Stack display config
     */
    _getStackMeta() {
        return {
            'system': { icon: '🖥️', color: '#6b7280' },
            'homehub': { icon: '🏠', color: '#8b5cf6' },
            'ai': { icon: '🤖', color: '#06b6d4' },
            'media': { icon: '🎬', color: '#f59e0b' },
            'download': { icon: '⬇️', color: '#10b981' },
            'projects': { icon: '🔧', color: '#3b82f6' },
            'agent-prompttrain': { icon: '🤖', color: '#ec4899' },
            'tools': { icon: '⚙️', color: '#6366f1' }
        };
    }

    render() {
        const container = document.getElementById('services-ports-dashboard');
        if (!container || !this.data) return;

        const { ports, stacks, allocation_ranges } = this.data;
        const grouped = this._groupByStack(ports);
        const stackMeta = this._getStackMeta();

        container.innerHTML = `
            ${this._renderPortsStats(ports, grouped)}
            ${this._renderStackFilters(grouped, stackMeta)}
            ${this._renderStackSections(grouped, stackMeta, stacks)}
            ${this._renderAllocationRanges(allocation_ranges)}
        `;
    }

    _groupByStack(ports) {
        const grouped = {};
        for (const p of ports) {
            const stack = p.stack || 'other';
            if (!grouped[stack]) grouped[stack] = [];
            grouped[stack].push(p);
        }
        return grouped;
    }

    _renderPortsStats(ports, grouped) {
        const totalPorts = ports.length;
        const totalStacks = Object.keys(grouped).length;
        const activePorts = ports.filter(p => !p.notes?.includes('inactif') && !p.notes?.includes('eteint')).length;

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="sp-stat-card">
                    <div class="sp-stat-number">${totalPorts}</div>
                    <div class="sp-stat-label">Ports enregistres</div>
                </div>
                <div class="sp-stat-card">
                    <div class="sp-stat-number">${activePorts}</div>
                    <div class="sp-stat-label">Actifs</div>
                </div>
                <div class="sp-stat-card">
                    <div class="sp-stat-number">${totalStacks}</div>
                    <div class="sp-stat-label">Stacks</div>
                </div>
                <div class="sp-stat-card">
                    <div class="sp-stat-number">5050-5099</div>
                    <div class="sp-stat-label">Plage projets dev</div>
                </div>
            </div>`;
    }

    _renderStackFilters(grouped, stackMeta) {
        return `
            <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="sp-filter-btn ${this.filter === 'all' ? 'active' : ''}" onclick="window.ServicesPortsModule.setFilter('all')">Tous</button>
                ${Object.keys(grouped).map(stack => {
                    const meta = stackMeta[stack] || { icon: '', color: '#9ca3af' };
                    return `<button class="sp-filter-btn ${this.filter === stack ? 'active' : ''}" onclick="window.ServicesPortsModule.setFilter('${stack}')">${meta.icon} ${stack}</button>`;
                }).join('')}
            </div>`;
    }

    _renderStackSections(grouped, stackMeta, stacks) {
        const stackOrder = ['system', 'homehub', 'ai', 'media', 'download', 'projects', 'agent-prompttrain', 'tools'];
        const orderedStacks = stackOrder.filter(s => grouped[s]);
        for (const s of Object.keys(grouped)) {
            if (!orderedStacks.includes(s)) orderedStacks.push(s);
        }

        return orderedStacks
            .filter(stack => this.filter === 'all' || this.filter === stack)
            .map(stack => this._renderStackSection(stack, grouped[stack], stackMeta, stacks))
            .join('');
    }

    _renderStackSection(stack, stackPorts, stackMeta, stacks) {
        const meta = stackMeta[stack] || { icon: '', color: '#9ca3af' };
        const desc = stacks?.[stack] || stack;

        return `
            <div class="sp-stack-section" style="border-left: 4px solid ${meta.color};">
                <div class="sp-stack-header">
                    <span>${meta.icon} <strong>${stack}</strong></span>
                    <span class="sp-stack-desc">${desc}</span>
                    <span class="sp-stack-count">${stackPorts.length} port${stackPorts.length > 1 ? 's' : ''}</span>
                </div>
                <div class="sp-ports-table">
                    <table>
                        <thead>
                            <tr><th>Port</th><th>Service</th><th>Projet</th><th>Proto</th><th>Bind</th><th>Notes</th></tr>
                        </thead>
                        <tbody>
                            ${stackPorts.sort((a, b) => a.port - b.port).map(p => {
                                const isInactive = p.notes?.includes('inactif') || p.notes?.includes('eteint');
                                const rowClass = isInactive ? 'sp-inactive' : '';
                                return `<tr class="${rowClass}">
                                    <td><code class="sp-port">${p.port}</code></td>
                                    <td>${p.service}</td>
                                    <td class="sp-project">${p.project}</td>
                                    <td><span class="sp-proto">${p.protocol}</span></td>
                                    <td><span class="sp-bind">${p.bind}</span></td>
                                    <td class="sp-notes">${p.notes || ''}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    _renderAllocationRanges(allocation_ranges) {
        if (!allocation_ranges) return '';
        return `
            <div class="sp-ranges-section">
                <h3>Plages d'allocation</h3>
                <div class="sp-ranges-grid">
                    ${Object.entries(allocation_ranges).map(([key, range]) => `
                        <div class="sp-range-item">
                            <span class="sp-range-key">${key.replace(/_/g, ' ')}</span>
                            <span class="sp-range-value">${range}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    setFilter(filter) {
        this.filter = filter;
        this.render();
    }

    renderError() {
        const container = document.getElementById('services-ports-dashboard');
        if (!container) return;
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc2626;">
                Erreur de chargement du registre des ports.
                <br><small>Verifiez que port_registry.json existe dans infrastructure/data/</small>
            </div>
        `;
    }
}

const servicesPortsModule = new ServicesPortsModule();
window.ServicesPortsModule = servicesPortsModule;

export default servicesPortsModule;
