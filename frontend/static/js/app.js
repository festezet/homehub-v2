/**
 * HomeHub v2 - Main Application Entry Point
 */

import API from './api.js';
import tabsManager from './tabs.js';
import Utils from './utils.js';
import todoModule from './todo.js';
import internetModule from './internet.js';
import mediaStackModule from './mediastack.js';
import marketsModule from './markets.js';
import cryptoModule from './crypto.js';
import localAppsModule from './local-apps.js';
import systemMonitorModule from './system-monitor.js';
import { calendarModule } from './calendar.js';
import formationModule from './formation.js';
import servicesPortsModule from './services-ports.js';
import threadDigestModule from './thread-digest.js?v=17';
import projectStatusModule from './project-status.js';
import mediaRecommenderModule from './media-recommender.js';
import aiProfileModule from './ai-profile.js';
import claudeConfigModule from './claude-config.js';
import linkedinPostsModule from './linkedin-posts.js';
import linkedinProspectionModule from './linkedin-prospection.js';
import lifeTasksModule from './life-tasks.js';
import hhDesignModule from './hh-design.js';
import gmailKnowledgeModule from './gmail-knowledge.js';
import invitesModule from './invites.js';
import veilleIAModule from './veille-ia.js';
import sessionBookmarksModule from './session-bookmarks.js';
import autismModule from './autism.js';
import patrimoineModule from './patrimoine.js';
import patrimoineAnalyseModule from './patrimoine-analyse.js';
import claudeAnalyticsModule from './claude-analytics.js';
import emailDraftModule from './email-draft.js';

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
            'dashboard': () => todoModule.init(),
            'mediastack': () => mediaStackModule.load(),
            'markets': () => marketsModule.load(),
            'crypto': () => cryptoModule.load(),
            'local-apps': () => localAppsModule.load(),
            'system-monitor': () => systemMonitorModule.load(),
            'thread-digest': () => threadDigestModule.load(),
            'calendar': () => calendarModule.init(),
            'formation': () => formationModule.load(),
            'services-ports': () => servicesPortsModule.load(),
            'media-reco': () => mediaRecommenderModule.load(),
            'ai-profile': () => aiProfileModule.load(),
            'claude-config': () => claudeConfigModule.load(),
            'linkedin-posts': () => linkedinPostsModule.load(),
            'linkedin-prospection': () => linkedinProspectionModule.load(),
            'life-tasks': () => lifeTasksModule.load(),
            'hh-design': () => hhDesignModule.load(),
            'gmail-knowledge': () => gmailKnowledgeModule.load(),
            'invites': () => invitesModule.load(),
            'veille-ia': () => veilleIAModule.load(),
            'session-bookmarks': () => sessionBookmarksModule.load(),
            'autism': () => autismModule.load(),
            'patrimoine': () => patrimoineModule.load(),
            'patrimoine-analyse': () => patrimoineAnalyseModule.load(),
            'claude-analytics': () => claudeAnalyticsModule.load(),
            'email-draft': () => emailDraftModule.load(),
        };
    }

    /**
     * Load data for specific tab
     * @param {string} tabName
     */
    async loadTabData(tabName) {
        console.log('loadTabData called for:', tabName);
        // Dynamic pages are handled by dynamic-pages.js via switchPage
        if (tabName && tabName.startsWith('dp-')) {
            if (window.dynamicPages) {
                await window.dynamicPages.loadPage(tabName);
            }
            return;
        }
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
