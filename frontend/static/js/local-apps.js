/**
 * Local Apps Module - Display locally developed applications from projects.db
 */

class LocalAppsModule {
    constructor() {
        this.projects = [];
        this.filteredProjects = [];
        this.loaded = false;
    }

    async load() {
        console.log('📱 Loading Local Apps module...');

        // Show loading
        const loading = document.getElementById('dev-apps-loading');
        const grid = document.getElementById('dev-apps-grid');

        if (loading) loading.style.display = 'flex';
        if (grid) grid.style.display = 'none';

        try {
            await this.fetchProjects();
            this.filteredProjects = [...this.projects];
            this.render();
            this.setupEventListeners();
            this.loaded = true;

            // Load AI Docker status
            await this.updateAIStatus();
        } catch (error) {
            console.error('Error loading local apps:', error);
            this.showError('Erreur lors du chargement des projets');
        } finally {
            if (loading) loading.style.display = 'none';
            if (grid) grid.style.display = 'grid';
        }
    }

    async updateAIStatus() {
        // Update LLM status
        try {
            const llmResponse = await fetch('/api/docker/llm/status');
            const llmData = await llmResponse.json();

            const llmBadge = document.getElementById('llm-status-badge');
            const btnStartLLM = document.getElementById('btn-start-llm');
            const btnStopLLM = document.getElementById('btn-stop-llm');
            const btnOpenLLM = document.getElementById('btn-open-llm');

            if (llmData.running) {
                if (llmBadge) llmBadge.innerHTML = '✅ En ligne';
                if (llmBadge) llmBadge.className = 'app-status status-active';
                if (btnStartLLM) btnStartLLM.disabled = true;
                if (btnStartLLM) btnStartLLM.innerHTML = '<span>✅</span> Démarré';
                if (btnStopLLM) btnStopLLM.disabled = false;
                if (btnOpenLLM) btnOpenLLM.disabled = false;
            } else {
                if (llmBadge) llmBadge.innerHTML = '⏸️ Arrêté';
                if (llmBadge) llmBadge.className = 'app-status status-paused';
                if (btnStartLLM) btnStartLLM.disabled = false;
                if (btnStartLLM) btnStartLLM.innerHTML = '<span>▶</span> Démarrer';
                if (btnStopLLM) btnStopLLM.disabled = true;
                if (btnOpenLLM) btnOpenLLM.disabled = true;
            }
        } catch (error) {
            console.error('Error fetching LLM status:', error);
        }

        // Update Stable Diffusion status
        try {
            const sdResponse = await fetch('/api/docker/stable-diffusion/status');
            const sdData = await sdResponse.json();

            const sdBadge = document.getElementById('sd-status-badge');
            const btnStartSD = document.getElementById('btn-start-sd');
            const btnStopSD = document.getElementById('btn-stop-sd');
            const btnOpenSD = document.getElementById('btn-open-sd');

            if (sdData.running) {
                if (sdBadge) sdBadge.innerHTML = '✅ En ligne';
                if (sdBadge) sdBadge.className = 'app-status status-active';
                if (btnStartSD) btnStartSD.disabled = true;
                if (btnStartSD) btnStartSD.innerHTML = '<span>✅</span> Démarré';
                if (btnStopSD) btnStopSD.disabled = false;
                if (btnOpenSD) btnOpenSD.disabled = false;
            } else {
                if (sdBadge) sdBadge.innerHTML = '⏸️ Arrêté';
                if (sdBadge) sdBadge.className = 'app-status status-paused';
                if (btnStartSD) btnStartSD.disabled = false;
                if (btnStartSD) btnStartSD.innerHTML = '<span>▶</span> Démarrer';
                if (btnStopSD) btnStopSD.disabled = true;
                if (btnOpenSD) btnOpenSD.disabled = true;
            }
        } catch (error) {
            console.error('Error fetching SD status:', error);
        }
    }

    async startLLM() {
        console.log('🧠 Starting LLM stack...');
        this.showToast('Démarrage de Ollama + Open WebUI...', 'info');

        const btnStartLLM = document.getElementById('btn-start-llm');
        if (btnStartLLM) {
            btnStartLLM.disabled = true;
            btnStartLLM.innerHTML = '<span>⏳</span> Démarrage...';
        }

        try {
            const response = await fetch('/api/docker/llm/start', { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
                // Show if Stable Diffusion was stopped
                if (data.stopped && data.stopped.length > 0) {
                    this.showToast('⚠️ Stable Diffusion arrêté pour libérer VRAM', 'info');
                }

                this.showToast(data.message + ' - Attendre 30s avant ouverture', 'success');

                // Wait 30 seconds then enable open button
                setTimeout(() => {
                    const btnOpenLLM = document.getElementById('btn-open-llm');
                    if (btnOpenLLM) btnOpenLLM.disabled = false;
                    this.updateAIStatus();
                }, 30000);
            } else {
                this.showToast('Erreur: ' + data.message, 'error');
                if (btnStartLLM) {
                    btnStartLLM.disabled = false;
                    btnStartLLM.innerHTML = '<span>▶</span> Démarrer LLM';
                }
            }
        } catch (error) {
            console.error('Error starting LLM:', error);
            this.showToast('Erreur lors du démarrage du LLM', 'error');
            if (btnStartLLM) {
                btnStartLLM.disabled = false;
                btnStartLLM.innerHTML = '<span>▶</span> Démarrer LLM';
            }
        }
    }

    async stopLLM() {
        console.log('🛑 Stopping LLM stack...');
        this.showToast('Arrêt de Ollama + Open WebUI...', 'info');

        const btnStopLLM = document.getElementById('btn-stop-llm');
        if (btnStopLLM) {
            btnStopLLM.disabled = true;
            btnStopLLM.innerHTML = '<span>⏳</span> Arrêt...';
        }

        try {
            const response = await fetch('/api/docker/llm/stop', { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(data.message + ' - VRAM libérée', 'success');
                this.updateAIStatus();
            } else {
                this.showToast('Erreur: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error stopping LLM:', error);
            this.showToast('Erreur lors de l\'arrêt du LLM', 'error');
        } finally {
            if (btnStopLLM) {
                btnStopLLM.disabled = false;
                btnStopLLM.innerHTML = '<span>⏹</span> Arrêter';
            }
        }
    }

    async startStableDiffusion() {
        console.log('🎨 Starting Stable Diffusion...');
        this.showToast('Démarrage de Stable Diffusion (2-3 min)...', 'info');

        const btnStartSD = document.getElementById('btn-start-sd');
        if (btnStartSD) {
            btnStartSD.disabled = true;
            btnStartSD.innerHTML = '<span>⏳</span> Démarrage...';
        }

        try {
            const response = await fetch('/api/docker/stable-diffusion/start', { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
                // Show if LLM was stopped
                if (data.stopped && data.stopped.length > 0) {
                    const stoppedApps = data.stopped.join(', ');
                    this.showToast(`⚠️ ${stoppedApps} arrêté(s) pour libérer VRAM`, 'info');
                }

                this.showToast(data.message + ' - Attendre 2-3 min', 'success');

                // Wait 3 minutes then enable open button
                setTimeout(() => {
                    const btnOpenSD = document.getElementById('btn-open-sd');
                    if (btnOpenSD) btnOpenSD.disabled = false;
                    this.updateAIStatus();
                }, 180000);
            } else {
                this.showToast('Erreur: ' + data.message, 'error');
                if (btnStartSD) {
                    btnStartSD.disabled = false;
                    btnStartSD.innerHTML = '<span>▶</span> Démarrer SD';
                }
            }
        } catch (error) {
            console.error('Error starting Stable Diffusion:', error);
            this.showToast('Erreur lors du démarrage de SD', 'error');
            if (btnStartSD) {
                btnStartSD.disabled = false;
                btnStartSD.innerHTML = '<span>▶</span> Démarrer SD';
            }
        }
    }

    async stopStableDiffusion() {
        console.log('🛑 Stopping Stable Diffusion...');
        this.showToast('Arrêt de Stable Diffusion...', 'info');

        const btnStopSD = document.getElementById('btn-stop-sd');
        if (btnStopSD) {
            btnStopSD.disabled = true;
            btnStopSD.innerHTML = '<span>⏳</span> Arrêt...';
        }

        try {
            const response = await fetch('/api/docker/stable-diffusion/stop', { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(data.message + ' - VRAM libérée', 'success');
                this.updateAIStatus();
            } else {
                this.showToast('Erreur: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error stopping Stable Diffusion:', error);
            this.showToast('Erreur lors de l\'arrêt de SD', 'error');
        } finally {
            if (btnStopSD) {
                btnStopSD.disabled = false;
                btnStopSD.innerHTML = '<span>⏹</span> Arrêter';
            }
        }
    }

    async fetchProjects() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) throw new Error('Failed to fetch projects');
            const data = await response.json();
            this.projects = data.projects || [];
        } catch (error) {
            console.error('Error fetching projects:', error);
            // Fallback to static data if API fails
            this.projects = await this.fetchProjectsFallback();
        }
    }

    async fetchProjectsFallback() {
        // Try the infrastructure service endpoint
        try {
            const response = await fetch('/api/infrastructure/projects');
            if (response.ok) {
                const data = await response.json();
                return data.projects || [];
            }
        } catch (e) {
            console.log('Infrastructure API not available, using static list');
        }

        // Return empty if all fails
        return [];
    }

    getCategoryIcon(category) {
        const icons = {
            'development': '💻',
            'business': '💼',
            'creative': '🎨',
            'infrastructure': '🏗️',
            'data': '📊',
            'integration': '🔗'
        };
        return icons[category] || '📁';
    }

    getCategoryClass(category) {
        return `tag-${category}`;
    }

    getStatusClass(status) {
        return `status-${status}`;
    }

    render() {
        const grid = document.getElementById('dev-apps-grid');
        if (!grid) return;

        if (this.filteredProjects.length === 0) {
            grid.innerHTML = `
                <div class="no-results">
                    <p>Aucun projet trouve</p>
                    <p style="font-size: 0.9rem;">Essayez de modifier vos filtres</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.filteredProjects.map(project => this.renderProjectCard(project)).join('');
        this.updateStats();
    }

    renderProjectCard(project) {
        const icon = this.getCategoryIcon(project.category);
        const categoryClass = this.getCategoryClass(project.category);
        const statusClass = this.getStatusClass(project.status);
        const hasLauncher = project.launcher_path ? 'has-launcher' : '';
        const launchDisabled = !project.launcher_path ? 'disabled' : '';
        const launchTitle = project.launcher_path
            ? `Lancer ${project.name}`
            : 'Pas de launcher configure';

        return `
            <div class="app-card ${hasLauncher}" data-project-id="${project.id}">
                <div class="app-card-header">
                    <span class="app-icon">${icon}</span>
                    <div class="app-info">
                        <h4 class="app-name">${project.name}</h4>
                        <span class="app-id">${project.id}</span>
                    </div>
                </div>
                <p class="app-description">${project.description || 'Pas de description'}</p>
                <div class="app-meta">
                    <span class="app-tag ${categoryClass}">${project.category}</span>
                    <span class="app-status ${statusClass}">${project.status}</span>
                </div>
                <div class="app-actions">
                    <button class="btn btn-launch" ${launchDisabled}
                            onclick="window.localAppsModule.launchProject('${project.id}')"
                            title="${launchTitle}">
                        <span>▶</span> Lancer
                    </button>
                    <button class="btn btn-folder"
                            onclick="window.localAppsModule.openFolder('${project.id}')"
                            title="Ouvrir le dossier">
                        <span>📁</span> Dossier
                    </button>
                </div>
            </div>
        `;
    }

    updateStats() {
        const countEl = document.getElementById('dev-apps-count');
        const categoriesEl = document.getElementById('dev-apps-categories');

        if (countEl) {
            countEl.textContent = `${this.filteredProjects.length} projet(s)`;
        }

        if (categoriesEl) {
            const categories = {};
            this.filteredProjects.forEach(p => {
                categories[p.category] = (categories[p.category] || 0) + 1;
            });
            const catText = Object.entries(categories)
                .map(([cat, count]) => `${cat}: ${count}`)
                .join(' | ');
            categoriesEl.textContent = catText;
        }
    }

    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('local-apps-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterProjects());
        }

        // Category filter
        const filterSelect = document.getElementById('local-apps-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => this.filterProjects());
        }

        // Refresh button
        const refreshBtn = document.getElementById('btn-refresh-local-apps');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.load());
        }
    }

    filterProjects() {
        const searchTerm = document.getElementById('local-apps-search')?.value.toLowerCase() || '';
        const category = document.getElementById('local-apps-filter')?.value || 'all';

        this.filteredProjects = this.projects.filter(project => {
            const matchesSearch = !searchTerm ||
                project.name.toLowerCase().includes(searchTerm) ||
                (project.description && project.description.toLowerCase().includes(searchTerm)) ||
                project.id.toLowerCase().includes(searchTerm);

            const matchesCategory = category === 'all' || project.category === category;

            return matchesSearch && matchesCategory;
        });

        this.render();
    }

    async launchProject(projectId) {
        console.log('Launching project:', projectId);

        // Chercher le projet dans les données locales
        const project = this.projects.find(p => p.id === projectId);

        // Toujours lancer via l'API backend d'abord (pour démarrer le serveur si nécessaire)
        try {
            const response = await fetch(`/api/projects/launch/${projectId}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(`${data.message}`, 'success');

                // Si le projet a une web_url, ouvrir après un court délai
                if (project && project.web_url) {
                    this.showToast(`Ouverture de ${project.name} dans 2s...`, 'info');
                    setTimeout(() => {
                        window.open(project.web_url, '_blank');
                    }, 2000);
                }
                // Cas spéciaux : projets avec interface web à ouvrir après lancement
                else if (projectId === 'PRJ-024') {
                    // location-calendar : attendre 1s que le fichier soit généré
                    setTimeout(() => {
                        window.open('/api/files/calendar', '_blank');
                    }, 1000);
                } else if (projectId === 'PRJ-014') {
                    // monitoring : attendre 5s que Docker démarre, puis ouvrir
                    this.showToast('Démarrage Docker... ouverture dans 5s', 'info');
                    setTimeout(() => {
                        window.open('http://localhost:8888', '_blank');
                    }, 5000);
                }
            } else {
                this.showToast(`Erreur: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Error launching project:', error);
            this.showToast('Erreur lors du lancement', 'error');
        }
    }

    async openFolder(projectId) {
        console.log('Opening folder for:', projectId);
        try {
            const response = await fetch(`/api/projects/open/${projectId}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.status === 'success') {
                this.showToast(`Dossier ouvert: ${data.path}`, 'success');
            } else {
                this.showToast(`Erreur: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Error opening folder:', error);
            this.showToast('Erreur lors de l\'ouverture', 'error');
        }
    }

    showToast(message, type = 'info') {
        // Use global utils if available, otherwise console
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
            // Simple fallback toast
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 9999;
                animation: fadeIn 0.3s ease;
                background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#667eea'};
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }

    showError(message) {
        const grid = document.getElementById('dev-apps-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="no-results">
                    <p style="color: #ef4444;">${message}</p>
                </div>
            `;
        }
    }

    reload() {
        this.load();
    }
}

// Create and export singleton
const localAppsModule = new LocalAppsModule();
window.localAppsModule = localAppsModule;

export default localAppsModule;
