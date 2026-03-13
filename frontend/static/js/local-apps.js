/**
 * Local Apps Module - Applications locales groupees par categorie
 * Edit mode: click card to delete, + card to add
 */

import API from './api.js';

const CATEGORY_ICONS = {
    'frequent-use': '\u2B50',
    'ai': '\uD83E\uDD16',
    'development': '\uD83D\uDCBB',
    'business': '\uD83D\uDCBC',
    'creative': '\uD83C\uDFA8',
    'infrastructure': '\uD83C\uDFD7\uFE0F',
    'data': '\uD83D\uDCCA',
    'integration': '\uD83D\uDD17'
};

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

class LocalAppsModule {
    constructor() {
        this.loaded = false;
        this.data = null;
        this.editMode = false;
        this._deleting = false;
        this._pollInterval = null;
    }

    async load() {
        if (this.loaded) return;

        try {
            const response = await API.localApps.getApps();
            if (response.status === 'ok') {
                this.data = response.categories;
                this.render(response.categories);
                this.loaded = true;
                this.pollDockerStatus();
            }
        } catch (error) {
            console.error('Failed to load local apps:', error);
            document.getElementById('local-apps-container').innerHTML =
                '<div style="text-align:center;padding:40px;color:#ef4444;">Erreur de chargement des applications</div>';
        }
    }

    toggleEditMode() {
        this.editMode = !this.editMode;
        const container = document.getElementById('local-apps-container');
        if (!container) return;

        container.classList.toggle('edit-mode', this.editMode);

        const btn = document.getElementById('la-edit-btn');
        if (btn) {
            btn.textContent = this.editMode ? 'Terminer' : 'Editer';
            btn.classList.toggle('active', this.editMode);
        }

        const banner = document.getElementById('la-edit-banner');
        if (banner) {
            banner.style.display = this.editMode ? 'flex' : 'none';
        }
    }

    render(categories) {
        const container = document.getElementById('local-apps-container');
        if (!container) return;

        let html = `
        <div class="la-toolbar">
            <button id="la-edit-btn" class="edit-mode-btn">Editer</button>
        </div>
        <div id="la-edit-banner" class="edit-mode-banner" style="display:none;">
            Mode Edition — Cliquez sur une app pour la supprimer, + pour ajouter
        </div>`;

        for (const cat of categories) {
            if (cat.apps.length === 0 && !this.editMode) continue;

            const icon = CATEGORY_ICONS[cat.slug] || '';
            const isFrequent = cat.slug === 'frequent-use';
            const sectionClass = isFrequent ? 'la-category la-category-frequent-use' : 'la-category';

            html += `
            <div class="${sectionClass}" data-category="${this.esc(cat.slug)}">
                <h2 class="la-category-header">
                    <span class="la-category-icon">${icon}</span> ${this.esc(cat.name)}
                </h2>
                <div class="la-grid">`;

            for (const app of cat.apps) {
                if (app.app_type === 'docker') {
                    html += this.renderDockerCard(app);
                } else {
                    html += this.renderAppCard(app);
                }
            }

            // Add card (visible in edit mode only, not for frequent-use)
            if (!isFrequent) {
                html += `
                    <div class="la-add-card" data-category-slug="${this.esc(cat.slug)}">
                        <div class="la-add-content">
                            <span class="la-add-icon">+</span>
                            <span class="la-add-text">Ajouter</span>
                        </div>
                    </div>`;
            }

            html += `
                </div>
            </div>`;
        }

        container.innerHTML = html;
        this.bindEvents(container);
    }

    renderAppCard(app) {
        const catClass = `la-tag-${app.category_slug}`;
        const hasLauncher = app.launcher_path || app.web_url;
        const launchBadge = app.launch_count > 0
            ? `<span class="la-launch-badge">${app.launch_count}x</span>`
            : '';

        return `
            <div class="la-card" data-app-id="${app.id}" data-app-name="${this.esc(app.name)}">
                <div class="la-card-header">
                    <div class="la-card-icon">${CATEGORY_ICONS[app.category_slug] || '\uD83D\uDCC1'}</div>
                    <div class="la-card-info">
                        <h4 class="la-card-name">${this.esc(app.name)}</h4>
                        <span class="la-card-id">${this.esc(app.project_id)}</span>
                    </div>
                </div>
                <p class="la-card-desc">${this.esc(app.description || 'Pas de description')}</p>
                <div class="la-card-meta">
                    <span class="la-tag ${catClass}">${this.esc(app.category_slug)}</span>
                    ${launchBadge}
                </div>
                <div class="la-card-actions">
                    <button class="la-btn la-btn-launch" ${!hasLauncher ? 'disabled' : ''}
                            data-launch-id="${app.id}">
                        Launch
                    </button>
                    ${app.web_url ? `<button class="la-btn la-btn-open" data-open-url="${this.esc(app.web_url)}">Ouvrir</button>` : ''}
                </div>
            </div>`;
    }

    renderDockerCard(app) {
        const stack = app.docker_stack;
        return `
            <div class="la-card la-card-docker" data-app-id="${app.id}" data-app-name="${this.esc(app.name)}"
                 data-docker-stack="${this.esc(stack)}">
                <div class="la-card-header">
                    <div class="la-card-icon">${stack === 'llm' ? '\uD83E\uDDE0' : '\uD83C\uDFA8'}</div>
                    <div class="la-card-info">
                        <h4 class="la-card-name">${this.esc(app.name)}</h4>
                        <span class="la-card-id">${this.esc(app.project_id)}</span>
                    </div>
                </div>
                <p class="la-card-desc">${this.esc(app.description || '')}</p>
                <div class="la-card-meta">
                    <span class="la-tag la-tag-ai">Docker AI</span>
                    <span class="la-docker-status loading" id="docker-status-${this.esc(stack)}">Chargement...</span>
                </div>
                <div class="la-card-actions">
                    <button class="la-btn la-btn-launch" id="docker-start-${this.esc(stack)}"
                            data-docker-start="${this.esc(stack)}">
                        Demarrer
                    </button>
                    <button class="la-btn la-btn-stop" id="docker-stop-${this.esc(stack)}"
                            data-docker-stop="${this.esc(stack)}" disabled>
                        Arreter
                    </button>
                    <button class="la-btn la-btn-open" id="docker-open-${this.esc(stack)}"
                            data-open-url="${this.esc(app.web_url)}" disabled>
                        Ouvrir
                    </button>
                </div>
            </div>`;
    }

    bindEvents(container) {
        // Edit mode toggle
        document.getElementById('la-edit-btn')?.addEventListener('click', () => this.toggleEditMode());

        container.addEventListener('click', (e) => {
            // Add card
            const addCard = e.target.closest('.la-add-card');
            if (addCard && this.editMode) {
                e.preventDefault();
                this.showAddModal(addCard.dataset.categorySlug);
                return;
            }

            // Launch button
            const launchBtn = e.target.closest('[data-launch-id]');
            if (launchBtn && !this.editMode && !launchBtn.disabled) {
                this.launchApp(parseInt(launchBtn.dataset.launchId));
                return;
            }

            // Open URL button
            const openBtn = e.target.closest('[data-open-url]');
            if (openBtn && !this.editMode && !openBtn.disabled && !openBtn.dataset.dockerStart && !openBtn.dataset.dockerStop) {
                window.open(openBtn.dataset.openUrl, '_blank');
                return;
            }

            // Docker start
            const startBtn = e.target.closest('[data-docker-start]');
            if (startBtn && !this.editMode && !startBtn.disabled) {
                this.startDockerApp(startBtn.dataset.dockerStart);
                return;
            }

            // Docker stop
            const stopBtn = e.target.closest('[data-docker-stop]');
            if (stopBtn && !this.editMode && !stopBtn.disabled) {
                this.stopDockerApp(stopBtn.dataset.dockerStop);
                return;
            }

            // Edit mode: click card to delete
            const card = e.target.closest('.la-card:not(.la-add-card)');
            if (card && this.editMode) {
                const id = parseInt(card.dataset.appId);
                const name = card.dataset.appName;
                this.deleteApp(id, name, card);
            }
        });
    }

    async launchApp(id) {
        try {
            const resp = await API.localApps.launchApp(id);
            if (resp.status === 'ok') {
                this.showToast(resp.message, 'success');

                // Open web_url if available
                const app = resp.app;
                if (app && app.web_url && app.app_type !== 'docker') {
                    setTimeout(() => window.open(app.web_url, '_blank'), 2000);
                }

                // Update launch count in local data
                if (this.data) {
                    for (const cat of this.data) {
                        const found = cat.apps.find(a => a.id === id);
                        if (found) {
                            found.launch_count = (found.launch_count || 0) + 1;
                            break;
                        }
                    }
                }

                // Update badge in DOM
                const card = document.querySelector(`[data-app-id="${id}"]`);
                if (card) {
                    const meta = card.querySelector('.la-card-meta');
                    let badge = meta?.querySelector('.la-launch-badge');
                    const app2 = this.findApp(id);
                    if (badge && app2) {
                        badge.textContent = `${app2.launch_count}x`;
                    } else if (meta && app2) {
                        const span = document.createElement('span');
                        span.className = 'la-launch-badge';
                        span.textContent = `${app2.launch_count}x`;
                        meta.appendChild(span);
                    }
                }
            } else {
                this.showToast(resp.message || 'Erreur', 'error');
            }
        } catch (error) {
            console.error('Launch failed:', error);
            this.showToast('Erreur lors du lancement', 'error');
        }
    }

    findApp(id) {
        if (!this.data) return null;
        for (const cat of this.data) {
            const found = cat.apps.find(a => a.id === id);
            if (found) return found;
        }
        return null;
    }

    async deleteApp(id, name, card) {
        if (this._deleting) return;
        if (!confirm(`Supprimer "${name}" ?`)) return;

        this._deleting = true;
        try {
            const resp = await API.localApps.deleteApp(id);
            if (resp.status === 'ok') {
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.8)';
                setTimeout(() => card.remove(), 300);
                // Update local data
                for (const cat of this.data) {
                    cat.apps = cat.apps.filter(a => a.id !== id);
                }
            } else {
                alert(resp.message || 'Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Erreur lors de la suppression');
        } finally {
            this._deleting = false;
        }
    }

    showAddModal(categorySlug) {
        const existing = document.getElementById('la-add-modal');
        if (existing) existing.remove();

        const catName = this.data?.find(c => c.slug === categorySlug)?.name || categorySlug;
        const categories = this.data?.filter(c => c.slug !== 'frequent-use') || [];

        const modal = document.createElement('div');
        modal.id = 'la-add-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Ajouter une app dans "${this.esc(catName)}"</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <form id="la-add-form" class="modal-form">
                    <div class="form-group">
                        <label for="la-app-name">Nom</label>
                        <input type="text" id="la-app-name" placeholder="Ex: Mon App" required autofocus>
                    </div>
                    <div class="form-group">
                        <label for="la-app-desc">Description</label>
                        <input type="text" id="la-app-desc" placeholder="Description courte">
                    </div>
                    <div class="form-group">
                        <label for="la-app-category">Categorie</label>
                        <select id="la-app-category">
                            ${categories.map(c => `<option value="${this.esc(c.slug)}" ${c.slug === categorySlug ? 'selected' : ''}>${this.esc(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="la-app-type">Type</label>
                        <select id="la-app-type">
                            <option value="project">Projet</option>
                            <option value="system">Systeme</option>
                            <option value="docker">Docker</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="la-app-launcher">Launcher path (optionnel)</label>
                        <input type="text" id="la-app-launcher" placeholder="/data/projects/mon-app/start.sh">
                    </div>
                    <div class="form-group">
                        <label for="la-app-url">Web URL (optionnel)</label>
                        <input type="text" id="la-app-url" placeholder="http://localhost:5050">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-cancel">Annuler</button>
                        <button type="submit" class="btn-save">Ajouter</button>
                    </div>
                </form>
            </div>`;

        document.body.appendChild(modal);

        const removeModal = () => {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        };
        const handleEscape = (e) => { if (e.key === 'Escape') removeModal(); };
        document.addEventListener('keydown', handleEscape);

        modal.addEventListener('click', (e) => { if (e.target === modal) removeModal(); });
        modal.querySelector('.modal-close').addEventListener('click', removeModal);
        modal.querySelector('.btn-cancel').addEventListener('click', removeModal);

        document.getElementById('la-add-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addApp(removeModal);
        });
    }

    async addApp(removeModal) {
        const name = document.getElementById('la-app-name').value.trim();
        const description = document.getElementById('la-app-desc').value.trim();
        const category = document.getElementById('la-app-category').value;
        const app_type = document.getElementById('la-app-type').value;
        const launcher_path = document.getElementById('la-app-launcher').value.trim();
        const web_url = document.getElementById('la-app-url').value.trim();

        if (!name) return;

        const saveBtn = document.querySelector('#la-add-form .btn-save');
        saveBtn.textContent = '...';
        saveBtn.disabled = true;

        try {
            const resp = await API.localApps.createApp({
                name, description, category, app_type, launcher_path, web_url
            });
            if (resp.status === 'ok') {
                removeModal();
                this.loaded = false;
                this.editMode = false;
                await this.load();
                this.toggleEditMode();
            } else {
                alert(resp.message || 'Erreur lors de la creation');
                saveBtn.textContent = 'Ajouter';
                saveBtn.disabled = false;
            }
        } catch (error) {
            console.error('Create failed:', error);
            alert('Erreur lors de la creation');
            saveBtn.textContent = 'Ajouter';
            saveBtn.disabled = false;
        }
    }

    // Docker status polling
    async pollDockerStatus() {
        await this.updateDockerStatuses();
        if (this._pollInterval) clearInterval(this._pollInterval);
        this._pollInterval = setInterval(() => this.updateDockerStatuses(), 30000);
    }

    async updateDockerStatuses() {
        for (const [stack, config] of Object.entries(DOCKER_STACKS)) {
            try {
                const resp = await fetch(config.statusUrl);
                const data = await resp.json();
                this.updateDockerUI(stack, data.running);
            } catch {
                this.updateDockerUI(stack, false);
            }
        }
    }

    updateDockerUI(stack, running) {
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
    }

    async startDockerApp(stack) {
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
    }

    async stopDockerApp(stack) {
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
    }

    findDockerApp(stack) {
        if (!this.data) return null;
        for (const cat of this.data) {
            const found = cat.apps.find(a => a.docker_stack === stack);
            if (found) return found;
        }
        return null;
    }

    showToast(message, type = 'info') {
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(message, type);
        } else {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed; bottom: 20px; right: 20px;
                padding: 12px 20px; border-radius: 8px; color: white;
                font-weight: 500; z-index: 9999; animation: fadeIn 0.3s ease;
                background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    reload() {
        this.loaded = false;
        if (this._pollInterval) clearInterval(this._pollInterval);
        this.load();
    }
}

const localAppsModule = new LocalAppsModule();
window.localAppsModule = localAppsModule;

export default localAppsModule;
