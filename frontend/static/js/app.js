/**
 * HomeHub v2 - Main Application Entry Point
 */

import API from './api.js';
import tabsManager from './tabs.js';
import Utils from './utils.js';
import todoModule from './todo.js';
import dockerModule from './docker.js';
import localModule from './local.js';
import activityModule from './activity.js';
import internetModule from './internet.js';
import infrastructureModule from './infrastructure.js';
import mediaStackModule from './mediastack.js';
import marketsModule from './markets.js';
import localAppsModule from './local-apps.js';
import systemMonitorModule from './system-monitor.js';
import projectsListModule from './projects-list.js';
import { calendarModule } from './calendar.js';

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
     * Load data for specific tab
     * @param {string} tabName
     */
    async loadTabData(tabName) {
        console.log('📄 loadTabData called for:', tabName);
        switch(tabName) {
            case 'activity':
                console.log('📊 Loading activity module...');
                await activityModule.load();
                break;
            case 'internet':
                console.log('🌐 Loading internet module...');
                await internetModule.load();
                break;
            case 'local':
                console.log('💻 Loading local module...');
                await localModule.load();
                break;
            case 'dashboard':
                console.log('✅ Loading TODO module...');
                await todoModule.init();
                console.log('✅ TODO module initialized');
                break;
            case 'mediastack':
                console.log('🎬 Loading Media Stack module...');
                await mediaStackModule.load();
                break;
            case 'markets':
                console.log('📈 Loading Markets module...');
                await marketsModule.load();
                break;
            case 'infrastructure':
                console.log('🛠️ Loading infrastructure module...');
                await infrastructureModule.load();
                break;
            case 'local-apps':
                console.log('📱 Loading Local Apps module...');
                await localAppsModule.load();
                break;
            case 'system-monitor':
                console.log('📊 Loading System Monitor module...');
                await systemMonitorModule.load();
                break;
            case 'projects-list':
                console.log('📋 Loading Projects List module...');
                await projectsListModule.load();
                break;
            case 'calendar':
                console.log('📅 Loading Calendar module...');
                await calendarModule.init();
                break;
            default:
                console.warn('⚠️ Unknown tab:', tabName);
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
