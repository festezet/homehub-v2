/**
 * Media Stack Module - Streaming & Download Services
 */

import API from './api.js';
import Utils from './utils.js';

class MediaStackModule {
    constructor() {
        this.services = {
            streaming: [
                { id: 'plex', name: 'Plex', icon: '🎬', description: 'Media Server', port: '32400', container: 'plex', url: 'http://localhost:32400/web' }
            ],
            download: [
                { id: 'radarr', name: 'Radarr', icon: '🎥', description: 'Films', port: '7878', container: 'radarr', url: 'http://localhost:7878' },
                { id: 'sonarr', name: 'Sonarr', icon: '📺', description: 'Séries TV', port: '8989', container: 'sonarr', url: 'http://localhost:8989' },
                { id: 'qbittorrent', name: 'qBittorrent', icon: '⬇️', description: 'Client Torrent', port: '8080', container: 'qbittorrent', url: 'http://localhost:8080' },
                { id: 'prowlarr', name: 'Prowlarr', icon: '🔍', description: 'Indexeur', port: '9696', container: 'prowlarr', url: 'http://localhost:9696' }
            ],
            vpn: [
                { id: 'gluetun', name: 'Gluetun VPN', icon: '🔒', description: 'ProtonVPN', container: 'gluetun' },
                { id: 'flaresolverr', name: 'FlareSolverr', icon: '🔧', description: 'Proxy Cloudflare', port: '8191', container: 'flaresolverr', url: 'http://localhost:8191' },
                { id: 'restart-stack', name: 'Restart Download Stack', icon: '🚀', description: 'VPN + qBittorrent', action: 'restart-download-stack', special: true }
            ]
        };
        this.containerStatuses = {};
    }

    /**
     * Load media stack services
     */
    async load() {
        console.log('🎬 Loading Media Stack...');
        await this.loadContainerStatuses();
        this.render();
    }

    /**
     * Load container statuses from Docker API
     */
    async loadContainerStatuses() {
        try {
            const response = await fetch('/api/docker/containers');
            const data = await response.json();

            if (data.containers) {
                data.containers.forEach(container => {
                    this.containerStatuses[container.name] = container.status;
                });
            }
        } catch (error) {
            console.error('❌ Failed to load container statuses:', error);
        }
    }

    /**
     * Render all services
     */
    render() {
        this.renderServices('streaming-services', this.services.streaming);
        this.renderServices('download-services', this.services.download);
        this.renderServices('vpn-services', this.services.vpn);
    }

    /**
     * Render services in a container
     */
    renderServices(containerId, services) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const html = services.map(service => this.renderServiceCard(service)).join('');
        container.innerHTML = html;
    }

    /**
     * Render a single service card
     */
    renderServiceCard(service) {
        if (service.special) {
            return this._renderSpecialCard(service);
        }
        const status = this.containerStatuses[service.container] || 'stopped';
        const isRunning = status === 'running';
        return this._renderNormalCard(service, isRunning);
    }

    /**
     * Render special action card (e.g. restart stack)
     */
    _renderSpecialCard(service) {
        return `
            <div class="service-card" onclick="window.MediaStack.restartDownloadStack()">
                <div class="service-header">
                    <div class="service-icon" style="background: linear-gradient(135deg, #f59e0b22, #f59e0b44);">
                        ${service.icon}
                    </div>
                    <div class="service-info">
                        <div class="service-name">${service.name}</div>
                        <div class="service-description">${service.description}</div>
                    </div>
                </div>
                <div class="service-footer">
                    <div class="service-actions">
                        <button class="action-btn btn-restart">Redemarrer</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render normal service card with status and controls
     */
    _renderNormalCard(service, isRunning) {
        const statusClass = isRunning ? 'status-running' : 'status-stopped';
        const statusText = isRunning ? 'En ligne' : 'Arrete';

        return `
            <div class="service-card">
                <div class="service-header">
                    <div class="service-icon">${service.icon}</div>
                    <div class="service-info">
                        <div class="service-name">${service.name}</div>
                        <div class="service-description">${service.description}</div>
                    </div>
                </div>
                <div class="service-footer">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="service-status ${statusClass}">
                            <span class="status-dot"></span>
                            ${statusText}
                        </div>
                        ${service.port ? `<div class="service-port">:${service.port}</div>` : ''}
                    </div>
                    <div class="service-actions">
                        ${isRunning && service.url ? `
                            <button class="action-btn btn-open" onclick="window.MediaStack.openService('${service.url}', '${service.name}')">
                                Ouvrir
                            </button>
                        ` : ''}
                        ${isRunning ? `
                            <button class="action-btn btn-stop" onclick="window.MediaStack.controlContainer('${service.container}', 'stop')">
                                Arreter
                            </button>
                        ` : `
                            <button class="action-btn btn-start" onclick="window.MediaStack.controlContainer('${service.container}', 'start')">
                                Demarrer
                            </button>
                        `}
                        <button class="action-btn btn-restart" onclick="window.MediaStack.controlContainer('${service.container}', 'restart')">
                            Restart
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Open service in new tab
     */
    openService(url, name) {
        window.open(url, '_blank');
        Utils.showToast(`Ouverture de ${name}...`, 'info');
    }

    /**
     * Control Docker container
     */
    async controlContainer(container, action) {
        try {
            Utils.showToast(`${action === 'start' ? 'Démarrage' : action === 'stop' ? 'Arrêt' : 'Redémarrage'} de ${container}...`, 'info');

            const response = await fetch('/api/docker/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: container, action })
            });

            const data = await response.json();

            if (data.status === 'ok') {
                Utils.showToast(`${container} ${action === 'start' ? 'démarré' : action === 'stop' ? 'arrêté' : 'redémarré'} avec succès`, 'success');

                // Reload after 2 seconds
                setTimeout(() => this.load(), 2000);
            } else {
                Utils.showToast(`Erreur: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('❌ Failed to control container:', error);
            Utils.showToast('Erreur de communication avec Docker', 'error');
        }
    }

    /**
     * Restart entire download stack (Gluetun + qBittorrent)
     */
    async restartDownloadStack() {
        try {
            Utils.showToast('Redémarrage du Download Stack...', 'info');

            // Restart Gluetun first
            await this.controlContainer('gluetun', 'restart');

            // Wait 5 seconds then restart qBittorrent
            setTimeout(async () => {
                await this.controlContainer('qbittorrent', 'restart');
                Utils.showToast('Download Stack redémarré !', 'success');
            }, 5000);

        } catch (error) {
            console.error('❌ Failed to restart download stack:', error);
            Utils.showToast('Erreur lors du redémarrage du stack', 'error');
        }
    }
}

// Create singleton instance
const mediaStackModule = new MediaStackModule();

// Make available globally
window.MediaStack = mediaStackModule;

export default mediaStackModule;
