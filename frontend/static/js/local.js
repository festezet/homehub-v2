/**
 * Local Applications Module
 */

import API from './api.js';
import Utils from './utils.js';
import dockerModule from './docker.js';

class LocalModule {
    constructor() {
        this.applications = [];
    }

    /**
     * Load local applications and Docker containers
     */
    async load() {
        await Promise.all([
            this.loadApplications(),
            dockerModule.init()
        ]);
    }

    /**
     * Load applications from API
     */
    async loadApplications() {
        try {
            console.log('📱 Loading applications...');
            const response = await API.apps.getAll();
            console.log('📦 Applications response:', response);
            this.applications = response.apps || response.applications || [];
            console.log('✅ Applications loaded:', this.applications.length);
            this.renderApplications();
        } catch (error) {
            console.error('❌ Failed to load applications:', error);
            this.renderError();
        }
    }

    /**
     * Render applications grid
     */
    renderApplications() {
        const container = document.getElementById('local-apps-grid');
        if (!container) return;

        if (this.applications.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">Aucune application disponible</p>';
            return;
        }

        const cardsHtml = this.applications.map(app => this.renderAppCard(app)).join('');
        container.innerHTML = cardsHtml;

        // Add click handlers via event delegation (more reliable than inline onclick)
        container.querySelectorAll('.site-card[data-app-id]').forEach(card => {
            card.addEventListener('click', () => {
                const appId = card.dataset.appId;
                const appName = card.dataset.appName;
                this.launchApp(appId, appName);
            });
        });
    }

    /**
     * Render a single application card
     */
    renderAppCard(app) {
        const statusColor = '#10b981'; // Default operational
        const icon = app.icon || '📦';
        const appId = app.id || app.launcher_id || '';

        return `
            <div class="site-card" style="cursor: pointer;" data-app-id="${appId}" data-app-name="${this.escapeHtml(app.name)}">
                <div class="site-preview" style="background: linear-gradient(45deg, ${statusColor}22, ${statusColor}44);">
                    <div class="site-favicon" style="font-size: 48px;">
                        ${icon}
                    </div>
                </div>
                <div class="site-info">
                    <div class="site-name">${this.escapeHtml(app.name)}</div>
                    <div class="site-url" style="font-size: 0.8rem; color: #666;">${this.escapeHtml(app.command || app.description || 'Application locale')}</div>
                </div>
            </div>
        `;
    }

    /**
     * Launch an application
     */
    async launchApp(launcherId, appName) {
        try {
            Utils.showToast(`Lancement de ${appName}...`, 'info');
            await API.apps.launch(launcherId);
            Utils.showToast(`${appName} lancé avec succès`, 'success');
        } catch (error) {
            console.error('Failed to launch app:', error);
            Utils.showToast(`Erreur lors du lancement de ${appName}`, 'error');
        }
    }

    /**
     * Render error message
     */
    renderError() {
        const container = document.getElementById('local-apps-grid');
        if (!container) return;

        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <p style="color: #ef4444; font-weight: 600; margin-bottom: 10px;">
                    ⚠️ Impossible de charger les applications
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
const localModule = new LocalModule();

// Make available globally
window.LocalModule = localModule;

export default localModule;
