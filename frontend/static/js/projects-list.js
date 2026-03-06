/**
 * Projects List Module - Infrastructure & Applications table
 */

class ProjectsListModule {
    constructor() {
        this.projects = [];
        this.filteredProjects = [];
        this.loaded = false;
    }

    async load() {
        console.log('📋 Loading Projects List module...');

        const loading = document.getElementById('projects-loading');
        const tableContainer = document.getElementById('projects-table-container');

        if (loading) loading.style.display = 'flex';
        if (tableContainer) tableContainer.style.display = 'none';

        try {
            await this.fetchProjects();
            this.filteredProjects = [...this.projects];
            this.render();
            this.setupEventListeners();
            this.loaded = true;
        } catch (error) {
            console.error('Error loading projects list:', error);
            this.showError('Erreur lors du chargement');
        } finally {
            if (loading) loading.style.display = 'none';
            if (tableContainer) tableContainer.style.display = 'block';
        }
    }

    async fetchProjects() {
        // Combine different sources into infrastructure view
        const allProjects = [];

        // 1. Fetch infrastructure items (static)
        allProjects.push(...this.getInfrastructureItems());

        // 2. Fetch Docker containers
        try {
            const dockerResponse = await fetch('/api/docker/containers');
            if (dockerResponse.ok) {
                const dockerData = await dockerResponse.json();
                if (dockerData.containers) {
                    allProjects.push(...this.mapDockerContainers(dockerData.containers));
                }
            }
        } catch (e) {
            console.log('Docker API not available');
        }

        // 3. Fetch applications from DB
        try {
            const projectsResponse = await fetch('/api/projects');
            if (projectsResponse.ok) {
                const projectsData = await projectsResponse.json();
                if (projectsData.projects) {
                    allProjects.push(...this.mapDatabaseProjects(projectsData.projects));
                }
            }
        } catch (e) {
            console.log('Projects API not available');
        }

        // 4. Native applications (static)
        allProjects.push(...this.getNativeApps());

        this.projects = allProjects;
    }

    getInfrastructureItems() {
        return [
            {
                category: 'Infrastructure',
                categoryClass: 'infra',
                id: 'INFRA-001',
                name: 'LVM Data Storage',
                status: 'OK',
                statusClass: 'ok',
                description: 'vg_data: 4 volumes logiques (projects, docker, media, swap)',
                nextSteps: 'Monitoring automatique'
            },
            {
                category: 'Infrastructure',
                categoryClass: 'infra',
                id: 'INFRA-002',
                name: 'GPU NVIDIA GTX 1080',
                status: 'OK',
                statusClass: 'ok',
                description: '8GB VRAM, CUDA actif, utilise par Whisper',
                nextSteps: 'Optimisation VRAM'
            },
            {
                category: 'Infrastructure',
                categoryClass: 'infra',
                id: 'INFRA-003',
                name: 'Backup System (rsync)',
                status: 'OK',
                statusClass: 'ok',
                description: '4 SSD: SDA (data), SDB (backup sys), SDC (backup data), SDD (system)',
                nextSteps: 'Cron quotidien 17h30'
            },
            {
                category: 'Infrastructure',
                categoryClass: 'infra',
                id: 'INFRA-004',
                name: 'Docker Engine',
                status: 'OK',
                statusClass: 'ok',
                description: 'Stacks: AI, Media, Download, Monitoring',
                nextSteps: 'Portainer sur port 9000'
            }
        ];
    }

    mapDockerContainers(containers) {
        return containers.slice(0, 10).map((container, index) => ({
            category: 'Docker',
            categoryClass: 'docker',
            id: `DOCKER-${String(index + 1).padStart(3, '0')}`,
            name: container.name,
            status: container.status === 'running' ? 'Running' : 'Stopped',
            statusClass: container.status === 'running' ? 'running' : 'stopped',
            description: container.image,
            nextSteps: container.ports || '-'
        }));
    }

    mapDatabaseProjects(projects) {
        return projects.slice(0, 15).map(project => ({
            category: 'App Dev',
            categoryClass: 'dev',
            id: project.id,
            name: project.name,
            status: project.status === 'active' ? 'Actif' : project.status,
            statusClass: project.status === 'active' ? 'ok' : 'warning',
            description: project.description || '-',
            path: project.path,
            hasPath: true
        }));
    }

    getNativeApps() {
        return [
            {
                category: 'Apps Native',
                categoryClass: 'apps',
                id: 'APP-001',
                name: 'GIMP',
                status: 'Installe',
                statusClass: 'ok',
                description: 'Edition images professionnelle',
                nextSteps: '-'
            },
            {
                category: 'Apps Native',
                categoryClass: 'apps',
                id: 'APP-002',
                name: 'Kdenlive',
                status: 'Installe',
                statusClass: 'ok',
                description: 'Montage video',
                nextSteps: '-'
            },
            {
                category: 'Apps Native',
                categoryClass: 'apps',
                id: 'APP-003',
                name: 'Sublime Text',
                status: 'Installe',
                statusClass: 'ok',
                description: 'Editeur de code',
                nextSteps: '-'
            },
            {
                category: 'Apps Native',
                categoryClass: 'apps',
                id: 'APP-004',
                name: 'Firefox',
                status: 'Installe',
                statusClass: 'ok',
                description: 'Navigateur principal',
                nextSteps: '-'
            }
        ];
    }

    render() {
        const tbody = document.getElementById('projects-tbody');
        if (!tbody) return;

        if (this.filteredProjects.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                        Aucun projet trouve
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredProjects.map(project => `
            <tr>
                <td><span class="category-badge category-${project.categoryClass}">${project.category}</span></td>
                <td style="text-align: center;"><span class="id-badge">${project.id}</span></td>
                <td>${project.name}</td>
                <td style="text-align: center;"><span class="status-badge status-${project.statusClass}">${project.status}</span></td>
                <td>${project.description || '-'}</td>
                <td style="text-align: center;">
                    ${project.hasPath && project.id.startsWith('PRJ-')
                        ? `<button class="action-btn action-btn-folder" onclick="window.projectsListModule.openFolder('${project.id}')" title="Ouvrir ${project.path}">
                            📁 Dossier
                           </button>`
                        : '-'
                    }
                </td>
            </tr>
        `).join('');

        this.updateStats();
    }

    updateStats() {
        const statsContent = document.getElementById('projects-stats-content');
        if (!statsContent) return;

        const categories = {};
        this.filteredProjects.forEach(p => {
            categories[p.category] = (categories[p.category] || 0) + 1;
        });

        const statsText = Object.entries(categories)
            .map(([cat, count]) => `${cat}: ${count}`)
            .join(' | ');

        statsContent.textContent = `Total: ${this.filteredProjects.length} elements | ${statsText}`;
    }

    setupEventListeners() {
        const filterSelect = document.getElementById('projects-category-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => this.filterProjects(e.target.value));
        }

        const refreshBtn = document.getElementById('btn-refresh-projects');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.load());
        }
    }

    filterProjects(category) {
        if (category === 'all') {
            this.filteredProjects = [...this.projects];
        } else {
            const categoryMap = {
                'infrastructure': 'infra',
                'docker': 'docker',
                'apps': 'apps',
                'dev': 'dev'
            };
            const catClass = categoryMap[category] || category;
            this.filteredProjects = this.projects.filter(p => p.categoryClass === catClass);
        }
        this.render();
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
            this.showToast('Erreur lors de l\'ouverture du dossier', 'error');
        }
    }

    showToast(message, type = 'info') {
        // Use global utils if available, otherwise create simple toast
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
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
        const tbody = document.getElementById('projects-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">
                        ${message}
                    </td>
                </tr>
            `;
        }
    }

    reload() {
        this.load();
    }
}

// Create and export singleton
const projectsListModule = new ProjectsListModule();
window.projectsListModule = projectsListModule;

export default projectsListModule;
