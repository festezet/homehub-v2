/**
 * Utility Functions Module
 */

const Utils = {
    /**
     * Format date string to French locale
     * @param {string} dateStr - Date string to format
     * @returns {string} Formatted date
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR');
    },

    /**
     * Format datetime to relative time (e.g., "il y a 2 heures")
     * @param {string} dateStr - Date string
     * @returns {string} Relative time string
     */
    formatRelativeTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `il y a ${diffMins} min`;
        if (diffHours < 24) return `il y a ${diffHours}h`;
        if (diffDays < 7) return `il y a ${diffDays}j`;
        return this.formatDate(dateStr);
    },

    /**
     * Get priority style class
     * @param {string} priority - Priority level
     * @returns {object} Style object with background and color
     */
    getPriorityStyle(priority) {
        const styles = {
            'P1-Urgent': { background: '#fee2e2', color: '#991b1b' },
            'P2-Important': { background: '#fef3c7', color: '#92400e' },
            'P3-Normal': { background: '#dbeafe', color: '#1e40af' },
            'P4-Bas': { background: '#e5e7eb', color: '#374151' }
        };
        return styles[priority] || styles['P3-Normal'];
    },

    /**
     * Get status style class
     * @param {string} status - Task status
     * @returns {object} Style object with background and color
     */
    getStatusStyle(status) {
        const styles = {
            'To Do': { background: '#f3f4f6', color: '#374151' },
            'In Progress': { background: '#dbeafe', color: '#1e40af' },
            'Done': { background: '#d1fae5', color: '#065f46' },
            'Blocked': { background: '#fee2e2', color: '#991b1b' }
        };
        return styles[status] || styles['To Do'];
    },

    /**
     * Get category icon
     * @param {string} category - Category name
     * @returns {string} Emoji icon
     */
    getCategoryIcon(category) {
        const icons = {
            'Admin': '📋',
            'SASU': '🏢',
            'Dev': '💻',
            'Content': '📝',
            'Marketing': '📈',
            'Finance': '💰',
            'Personal': '👤'
        };
        return icons[category] || '📌';
    },

    /**
     * Get default deadline (14 days from now)
     * @returns {string} Date string in YYYY-MM-DD format
     */
    getDefaultDeadline() {
        const date = new Date();
        date.setDate(date.getDate() + 14);
        return date.toISOString().split('T')[0];
    },

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (success, error, info)
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };

        toast.style.background = colors[type] || colors.info;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * Debounce function to limit rate of execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
};

export default Utils;
