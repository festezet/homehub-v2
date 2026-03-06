/**
 * Docker Control Module
 */

import API from './api.js';
import Utils from './utils.js';

class DockerModule {
    constructor() {
        this.containers = [];
    }

    /**
     * Initialize Docker module
     */
    async init() {
        await this.loadContainers();
    }

    /**
     * Load Docker containers
     */
    async loadContainers() {
        try {
            const response = await API.docker.getContainers();
            this.containers = response.containers || [];
            this.renderContainers();
        } catch (error) {
            console.error('Failed to load containers:', error);
            this.renderError();
        }
    }

    /**
     * Render containers grid
     */
    renderContainers() {
        const container = document.getElementById('docker-containers-grid');
        if (!container) return;

        if (this.containers.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">Aucun conteneur disponible</p>';
            return;
        }

        const cardsHtml = this.containers.map(c => this.renderContainerCard(c)).join('');
        container.innerHTML = cardsHtml;
    }

    /**
     * Render a single container card
     */
    renderContainerCard(container) {
        const isRunning = container.status === 'running';
        const statusColor = isRunning ? '#10b981' : '#ef4444';
        const statusText = isRunning ? 'Running' : 'Stopped';

        return `
            <div class="site-card">
                <div class="site-preview" style="background: linear-gradient(45deg, ${statusColor}22, ${statusColor}44);">
                    <div class="site-favicon" style="color: ${statusColor};">
                        🐳
                    </div>
                </div>
                <div class="site-info">
                    <div class="site-name">${this.escapeHtml(container.name)}</div>
                    <div class="site-url" style="margin-bottom: 8px;">${container.image || 'Docker'}</div>
                    <div class="status-badge ${isRunning ? 'status-running' : 'status-stopped'}">${statusText}</div>
                    ${container.ports ? `<div style="font-size: 0.75rem; color: #666; margin-top: 4px;">${container.ports}</div>` : ''}
                </div>
                <div class="control-buttons">
                    ${!isRunning ? `<button class="btn-control btn-start" onclick="window.DockerModule.controlContainer('${container.name}', 'start')">▶️ Start</button>` : ''}
                    ${isRunning ? `<button class="btn-control btn-stop" onclick="window.DockerModule.controlContainer('${container.name}', 'stop')">⏹️ Stop</button>` : ''}
                    ${isRunning ? `<button class="btn-control btn-restart" onclick="window.DockerModule.controlContainer('${container.name}', 'restart')">🔄 Restart</button>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Control a container (start/stop/restart)
     */
    async controlContainer(name, action) {
        try {
            Utils.showToast(`${action} ${name}...`, 'info');
            await API.docker.controlContainer(name, action);

            // Wait a bit for the action to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Reload containers
            await this.loadContainers();

            Utils.showToast(`Container ${name} ${action}ed successfully`, 'success');
        } catch (error) {
            console.error(`Failed to ${action} container:`, error);
            Utils.showToast(`Failed to ${action} container`, 'error');
        }
    }

    /**
     * Render error message
     */
    renderError() {
        const container = document.getElementById('docker-containers-grid');
        if (!container) return;

        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <p style="color: #ef4444; font-weight: 600; margin-bottom: 10px;">
                    ⚠️ Impossible de charger les conteneurs Docker
                </p>
                <p style="color: #666; font-size: 0.9rem;">
                    Vérifiez que le serveur Docker Control est démarré (port 9999)
                </p>
            </div>
        `;
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create singleton instance
const dockerModule = new DockerModule();

// Make available globally
window.DockerModule = dockerModule;

export default dockerModule;
