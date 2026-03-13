/**
 * Tabs Module - Handle tab navigation
 */

class TabsManager {
    constructor() {
        this.currentTab = 'activity';
        this.tabsInitialized = false;
    }

    /**
     * Initialize tabs system
     */
    init() {
        if (this.tabsInitialized) return;

        // Setup tab buttons click handlers
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Show initial tab
        this.switchTab(this.currentTab);
        this.tabsInitialized = true;
    }

    /**
     * Switch to a specific tab
     * @param {string} tabName - Name of the tab to switch to
     */
    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Deactivate all tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });

        // Show selected tab content
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
        }

        // Activate selected tab button
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.classList.add('active');
        }

        this.currentTab = tabName;

        // Trigger tab-specific initialization if needed
        this.onTabSwitch(tabName);
    }

    /**
     * Hook for tab-specific actions when switching
     * @param {string} tabName
     */
    onTabSwitch(tabName) {
        // Import modules dynamically when needed
        switch(tabName) {
            case 'local':
                import('./local.js').then(module => module.default.load());
                break;
            case 'dashboard':
                import('./todo.js').then(module => module.default.init());
                break;
            case 'markets':
                // TradingView widgets load automatically
                break;
            case 'infrastructure':
                import('./infrastructure.js').then(module => module.default.load());
                break;
        }
    }

    /**
     * Get current active tab
     * @returns {string}
     */
    getCurrentTab() {
        return this.currentTab;
    }
}

// Create singleton instance
const tabsManager = new TabsManager();

export default tabsManager;
