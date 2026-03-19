/**
 * HomeHub v2 - Main Application Entry Point
 */

import API from './api.js';
import tabsManager from './tabs.js';
import Utils from './utils.js';
import todoModule from './todo.js';
import dockerModule from './docker.js';
import localModule from './local.js';
import internetModule from './internet.js';
import infrastructureModule from './infrastructure.js';
import mediaStackModule from './mediastack.js';
import marketsModule from './markets.js';
import localAppsModule from './local-apps.js';
import systemMonitorModule from './system-monitor.js';
import { calendarModule } from './calendar.js';
import formationModule from './formation.js';
import servicesPortsModule from './services-ports.js';
import threadDigestModule from './thread-digest.js';
import projectStatusModule from './project-status.js';
import mediaRecommenderModule from './media-recommender.js';
import aiProfileModule from './ai-profile.js';
import claudeSkillsModule from './claude-skills.js';

// Make modules available globally for now (will be refactored)
window.API = API;
window.Utils = Utils;

/**
 * Main App Class
 */
class HomeHubApp {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize application
     */
    async init() {
        if (this.initialized) return;

        console.log('🚀 Initializing HomeHub v2...');

        try {
            // Initialize tabs system
            tabsManager.init();

            // Check API availability
            await this.checkAPIs();

            // Load initial data for active tab
            const currentTab = tabsManager.getCurrentTab();
            this.loadTabData(currentTab);

            this.initialized = true;
            console.log('✅ HomeHub v2 initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize HomeHub:', error);
            Utils.showToast('Erreur d\'initialisation de l\'application', 'error');
        }
    }

    /**
     * Check if backend APIs are available
     */
    async checkAPIs() {
        const checkAPI = async (url, name) => {
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
                return response.ok;
            } catch {
                return false;
            }
        };

        const [todoOk, dockerOk] = await Promise.all([
            checkAPI('http://localhost:9998/health', 'TODO'),
            checkAPI('/api/docker/health', 'Docker')
        ]);

        if (todoOk && dockerOk) {
            console.log('✅ All APIs available');
        } else {
            console.warn('⚠️  Some APIs are unavailable');
            this.showAPIWarning();
        }
    }

    /**
     * Show API warning banner
     */
    showAPIWarning() {
        const warning = document.createElement('div');
        warning.id = 'api-warning';
        warning.style.cssText = `
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            color: #92400e;
        `;
        warning.innerHTML = `
            <strong>⚠️  Serveurs API non disponibles</strong>
            <p style="margin: 5px 0 0 0; font-size: 0.9rem;">
                Certaines fonctionnalités peuvent ne pas fonctionner.
                Vérifiez que les serveurs backend sont démarrés.
            </p>
        `;
        const content = document.querySelector('.content');
        if (content) {
            content.prepend(warning);
        }
    }

    /**
     * Get tab name to loader function mapping
     * @returns {Object} map of tabName -> loader function
     */
    _getTabLoaders() {
        return {
            'project-status': () => projectStatusModule.load(),
            'internet': () => internetModule.load(),
            'local': () => localModule.load(),
            'dashboard': () => todoModule.init(),
            'mediastack': () => mediaStackModule.load(),
            'markets': () => marketsModule.load(),
            'infrastructure': () => infrastructureModule.load(),
            'local-apps': () => localAppsModule.load(),
            'system-monitor': () => systemMonitorModule.load(),
            'thread-digest': () => threadDigestModule.load(),
            'calendar': () => calendarModule.init(),
            'formation': () => formationModule.load(),
            'services-ports': () => servicesPortsModule.load(),
            'media-reco': () => mediaRecommenderModule.load(),
            'ai-profile': () => aiProfileModule.load(),
            'claude-skills': () => claudeSkillsModule.load(),
        };
    }

    /**
     * Load data for specific tab
     * @param {string} tabName
     */
    async loadTabData(tabName) {
        console.log('loadTabData called for:', tabName);
        const loaders = this._getTabLoaders();
        const loader = loaders[tabName];
        if (loader) {
            await loader();
        } else {
            console.warn('Unknown tab:', tabName);
        }
    }

    /**
     * Alias for loadTabData (used by base.html navigation)
     * @param {string} pageName
     */
    async loadPage(pageName) {
        console.log('🔗 loadPage called for:', pageName);
        return this.loadTabData(pageName);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new HomeHubApp();
    window.HomeHubApp = app;
    window.homeHub = app; // Compatibility with base.html navigation
    await app.init();
    // Dispatch event when app is fully ready
    window.dispatchEvent(new CustomEvent('homehub-ready'));
});

export default HomeHubApp;
