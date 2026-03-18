/**
 * Local Apps Docker Module - Docker stack management for local-apps
 * Extracted from local-apps.js for modularity
 */

import API from './api.js';

const DOCKER_STACKS = {
    'llm': {
        statusUrl: '/api/docker/llm/status',
        startUrl: '/api/docker/llm/start',
        stopUrl: '/api/docker/llm/stop',
        startDelay: 30000,
        label: 'Ollama + Open WebUI'
    },
    'stable-diffusion': {
        statusUrl: '/api/docker/stable-diffusion/status',
        startUrl: '/api/docker/stable-diffusion/start',
        stopUrl: '/api/docker/stable-diffusion/stop',
        startDelay: 180000,
        label: 'Stable Diffusion'
    }
};

/**
 * Attach Docker management methods to a LocalAppsModule instance.
 * Call initDockerMixin(instance) after constructing the module.
 */
export function initDockerMixin(module) {
    module.pollDockerStatus = async function() {
        await this.updateDockerStatuses();
        if (this._pollInterval) clearInterval(this._pollInterval);
        this._pollInterval = setInterval(() => this.updateDockerStatuses(), 30000);
    };

    module.updateDockerStatuses = async function() {
        for (const [stack, config] of Object.entries(DOCKER_STACKS)) {
            try {
                const resp = await fetch(config.statusUrl);
                const data = await resp.json();
                this.updateDockerUI(stack, data.running);
            } catch {
                this.updateDockerUI(stack, false);
            }
        }
    };

    module.updateDockerUI = function(stack, running) {
        const badge = document.getElementById(`docker-status-${stack}`);
        const startBtn = document.getElementById(`docker-start-${stack}`);
        const stopBtn = document.getElementById(`docker-stop-${stack}`);
        const openBtn = document.getElementById(`docker-open-${stack}`);

        if (badge) {
            badge.textContent = running ? 'En ligne' : 'Arrete';
            badge.className = `la-docker-status ${running ? 'online' : 'offline'}`;
        }
        if (startBtn) {
            startBtn.disabled = running;
            startBtn.textContent = running ? 'Demarre' : 'Demarrer';
        }
        if (stopBtn) stopBtn.disabled = !running;
        if (openBtn) openBtn.disabled = !running;
    };

    module.startDockerApp = async function(stack) {
        const config = DOCKER_STACKS[stack];
        if (!config) return;

        this.showToast(`Demarrage de ${config.label}...`, 'info');
        const startBtn = document.getElementById(`docker-start-${stack}`);
        if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Demarrage...'; }

        // Record launch via local apps API
        const app = this.findDockerApp(stack);
        if (app) {
            try { await API.localApps.launchApp(app.id); } catch { /* ignore */ }
        }

        try {
            const resp = await fetch(config.startUrl, { method: 'POST' });
            const data = await resp.json();

            if (data.status === 'success') {
                if (data.stopped && data.stopped.length > 0) {
                    this.showToast(`Autre stack GPU arrete pour liberer VRAM`, 'info');
                }
                this.showToast(`${data.message}`, 'success');
                setTimeout(() => this.updateDockerStatuses(), config.startDelay);
            } else {
                this.showToast(`Erreur: ${data.message}`, 'error');
                if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Demarrer'; }
            }
        } catch (error) {
            console.error(`Error starting ${stack}:`, error);
            this.showToast(`Erreur demarrage ${config.label}`, 'error');
            if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Demarrer'; }
        }
    };

    module.stopDockerApp = async function(stack) {
        const config = DOCKER_STACKS[stack];
        if (!config) return;

        this.showToast(`Arret de ${config.label}...`, 'info');
        const stopBtn = document.getElementById(`docker-stop-${stack}`);
        if (stopBtn) { stopBtn.disabled = true; stopBtn.textContent = 'Arret...'; }

        try {
            const resp = await fetch(config.stopUrl, { method: 'POST' });
            const data = await resp.json();

            if (data.status === 'success') {
                this.showToast(`${data.message} - VRAM liberee`, 'success');
                this.updateDockerStatuses();
            } else {
                this.showToast(`Erreur: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error(`Error stopping ${stack}:`, error);
            this.showToast(`Erreur arret ${config.label}`, 'error');
        } finally {
            if (stopBtn) { stopBtn.disabled = false; stopBtn.textContent = 'Arreter'; }
        }
    };

    module.findDockerApp = function(stack) {
        if (!this.data) return null;
        for (const cat of this.data) {
            const found = cat.apps.find(a => a.docker_stack === stack);
            if (found) return found;
        }
        return null;
    };
}

export { DOCKER_STACKS };
