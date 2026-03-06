/**
 * Infrastructure Module
 */

import API from './api.js';
import Utils from './utils.js';

class InfrastructureModule {
    constructor() {
        this.data = null;
    }

    /**
     * Load infrastructure data
     */
    async load() {
        try {
            const response = await API.infrastructure.getDashboard();
            this.data = response.data || null;
            this.render();
        } catch (error) {
            console.error('Failed to load infrastructure:', error);
            this.renderPlaceholder();
        }
    }

    /**
     * Render infrastructure dashboard
     */
    render() {
        const container = document.getElementById('infrastructure-dashboard');
        if (!container) return;

        if (!this.data) {
            this.renderPlaceholder();
            return;
        }

        const html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                ${this.renderSystemCard()}
                ${this.renderStorageCard()}
                ${this.renderDockerCard()}
                ${this.renderServicesCard()}
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Render system info card
     */
    renderSystemCard() {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-size: 32px; margin-bottom: 10px;">💻</div>
                <h3 style="margin-bottom: 15px; color: #333;">Système</h3>
                <div style="color: #666; font-size: 0.9rem; line-height: 1.6;">
                    <div><strong>OS:</strong> Ubuntu 22.04 LTS</div>
                    <div><strong>CPU:</strong> Ryzen 5 4600G</div>
                    <div><strong>RAM:</strong> 16 GB</div>
                    <div><strong>GPU:</strong> GTX 1080 (8GB)</div>
                </div>
            </div>
        `;
    }

    /**
     * Render storage info card
     */
    renderStorageCard() {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-size: 32px; margin-bottom: 10px;">💾</div>
                <h3 style="margin-bottom: 15px; color: #333;">Stockage</h3>
                <div style="color: #666; font-size: 0.9rem; line-height: 1.6;">
                    <div><strong>Type:</strong> LVM (4x SSD 1TB)</div>
                    <div><strong>/data:</strong> Données projets</div>
                    <div><strong>/backup:</strong> Sauvegardes</div>
                </div>
            </div>
        `;
    }

    /**
     * Render Docker info card
     */
    renderDockerCard() {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-size: 32px; margin-bottom: 10px;">🐳</div>
                <h3 style="margin-bottom: 15px; color: #333;">Docker</h3>
                <div style="color: #666; font-size: 0.9rem; line-height: 1.6;">
                    <div><strong>AI Stack:</strong> Whisper, Ollama</div>
                    <div><strong>Media:</strong> Plex, *arr stack</div>
                    <div><strong>Download:</strong> qBittorrent</div>
                </div>
            </div>
        `;
    }

    /**
     * Render services info card
     */
    renderServicesCard() {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="font-size: 32px; margin-bottom: 10px;">⚙️</div>
                <h3 style="margin-bottom: 15px; color: #333;">Services</h3>
                <div style="color: #666; font-size: 0.9rem; line-height: 1.6;">
                    <div><strong>TODO API:</strong> Port 9998</div>
                    <div><strong>Docker Control:</strong> Port 9999</div>
                    <div><strong>HomeHub v2:</strong> Port 5000</div>
                </div>
            </div>
        `;
    }

    /**
     * Render placeholder
     */
    renderPlaceholder() {
        const container = document.getElementById('infrastructure-dashboard');
        if (!container) return;

        // Render static cards for now
        this.data = {};
        this.render();
    }
}

// Create singleton instance
const infrastructureModule = new InfrastructureModule();

// Make available globally
window.InfrastructureModule = infrastructureModule;

export default infrastructureModule;
