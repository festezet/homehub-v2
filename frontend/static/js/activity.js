/**
 * Activity Timeline Module
 */

import API from './api.js';
import Utils from './utils.js';

class ActivityModule {
    constructor() {
        this.timeline = [];
    }

    /**
     * Load activity timeline
     */
    async load() {
        try {
            const response = await API.activity.getTimeline();
            this.timeline = response.timeline || [];
            this.render();
        } catch (error) {
            console.error('Failed to load activity:', error);
            this.renderPlaceholder();
        }
    }

    /**
     * Render timeline
     */
    render() {
        const container = document.getElementById('activity-timeline-container');
        if (!container) return;

        if (this.timeline.length === 0) {
            this.renderPlaceholder();
            return;
        }

        const html = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${this.timeline.map(item => this.renderTimelineItem(item)).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Render a timeline item
     */
    renderTimelineItem(item) {
        return `
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="font-weight: 600; color: #333;">${this.escapeHtml(item.title)}</div>
                    <div style="font-size: 0.85rem; color: #666;">${Utils.formatRelativeTime(item.date)}</div>
                </div>
                ${item.description ? `<div style="color: #666; font-size: 0.9rem;">${this.escapeHtml(item.description)}</div>` : ''}
                ${item.project ? `<div style="margin-top: 8px; font-size: 0.85rem; color: #667eea;">📁 ${this.escapeHtml(item.project)}</div>` : ''}
            </div>
        `;
    }

    /**
     * Render placeholder
     */
    renderPlaceholder() {
        const container = document.getElementById('activity-timeline-container');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
                <h3 style="color: #333; margin-bottom: 10px;">Chronologie d'activité</h3>
                <p style="color: #666; max-width: 500px; margin: 0 auto;">
                    La chronologie affichera les jalons et activités récentes de vos projets.
                    <br><br>
                    Cette fonctionnalité sera pleinement implémentée en Phase 3.
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
const activityModule = new ActivityModule();

// Make available globally
window.ActivityModule = activityModule;

export default activityModule;
