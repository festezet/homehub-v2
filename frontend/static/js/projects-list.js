/**
 * Projects List Module - Infrastructure & Applications table
 * Sorted by category (App Dev first) then by numeric ID
 */

class ProjectsListModule {
    constructor() {
        this.projects = [];
        this.filteredProjects = [];
        this.loaded = false;

        // Override descriptions for projects with generic "Project X" descriptions
        this.descriptionOverrides = {
            'PRJ-037': {
                short: 'Profil consultant IA structure JSON-LD + notifications email/WhatsApp + portfolio public',
                detailed: 'Backend Flask exposant profil professionnel (offshore wind) en JSON-LD schema.org pour agents IA. Systeme de notifications avec scanners Gmail/IMAP/WhatsApp/LinkedIn, push ntfy. Portfolio de 19 projets en 5 categories. Endpoints API publics + auth Bearer. Deploye sur festezet.dev (Hostinger).'
            },
            'PRJ-046': {
                short: 'App Flutter pour consulter les notifications email de ai-profile sur Android',
                detailed: 'Application mobile Flutter pour visualiser les notifications du backend ai-profile (PRJ-037). Polling 30s automatique, pull-to-refresh, badge compteur, mark as read/dismissed, scan manuel, reply via mailto. Theme clair/sombre. Se connecte au port 5100 avec Bearer token.'
            },
            'PRJ-049': {
                short: 'Convertir images en ASCII art terminal avec styles retro (Matrix, Tron, hacker)',
                detailed: 'Outil CLI Python pour transformer images en ASCII art. 7 charsets (standard, detailed, blocks, hacker, binary, braille). 6 styles couleur (matrix, amber, cyan, red, blue, white). Options largeur, inversion, bordures, headers hacker. Export fichier. Support PNG/JPG/GIF/WebP/TIFF.'
            },
            'PRJ-035': {
                short: 'Structure organisee fichiers personnels en 7 categories (/data/perso)',
                detailed: 'Classement personnel hierarchise pour /data/perso : Admin (identite, vehicule, impots, assurances, diplomes, juridique), Banques, Maison (factures utilitaires, mobiles, internet), Sante, Immobilier (templates annonces avec diagnostics/notaire), Musique (partitions guitare/basse/fanfare). Scripts Bash creation arborescence.'
            },
            'PRJ-051': {
                short: 'Revue et suivi contrats SASU avec notes, extraction contexte vers ai-profile',
                detailed: 'Analyse de contrats professionnels pour SASU. Workflow : depot draft > review notes (points attention, suggestions) > metadata.json (parties, dates, montant, clauses). Propagation vers ai-profile : career_timeline, skills.json, projects.json.'
            },
            'PRJ-048': {
                short: 'Agent autonome LangChain/Claude avec CLI et API FastAPI + 13 outils',
                detailed: 'Agent reactif LangGraph (claude-sonnet) avec architecture multi-agents, routing supervisor. FastAPI port 5054 + CLI interactif. 13 outils : calculator, read/write/list files, shell commands (whitelist). SQLite historique conversations. Sandbox agent_workspace/. Securite : max 10 iterations, timeout 10s.'
            },
            'PRJ-052': {
                short: 'Recommandation films/series avec scoring pondere + Claude IA + Radarr/Sonarr',
                detailed: 'Backend Flask port 5056 synchronisant Radarr/Sonarr. Scoring pondere interactions (rate 8-10: +10, watched: +5, rejected: -8). Generation recommandations via Claude Sonnet 4.5. SQLite 6 tables (media_items, interactions, recommendations, taste_profile, preferences, sync_log). Integration HomeHub /api/media-reco/*.'
            },
            'PRJ-047': {
                short: 'Claude recommande films/series avec telechargement automatique Radarr/Sonarr',
                detailed: 'Script Python analysant preferences utilisateur (genres, franchises, acteurs, realisateurs). Claude propose 5 recommandations personnalisees. Integration Radarr (films)/Sonarr (series) pour recherche TMDB/TVDB et lancement telechargement. Modes : semi-auto, auto, type, discover.'
            },
            'PRJ-044': {
                short: 'Framework 4 disciplines prompting (craft, context, intent, spec engineering)',
                detailed: 'Implementation des 4 disciplines prompting optimisant Claude Code et agents IA. Discipline 1 (Prompt Craft) acquise. D2 (Context Engineering) : -60% SYSTEM_STATE tokens. D3 (Intent Engineering) : rules/intent.md arbre decisions. D4 (Specification Engineering) : templates specs. Resultats : -8% tokens contexte global.'
            },
            'PRJ-045': {
                short: 'Bibliotheque partagee inter-projets : OAuth2 Google, Flask helpers, SQLite, Ollama',
                detailed: 'Librairie Python centralisant services communs. Modules : google_auth (Gmail/Calendar/Photos OAuth2), flask_helpers (success/error standardises, CORS, health), db (SQLite WAL, backups rotation), ollama (client LLM local), services (decouverte via port_registry.json). Installable via pip install -e .'
            },
            'PRJ-050': {
                short: 'Site vitrine VentusNexus consulting energie eolienne offshore',
                detailed: 'One-page anglais/francais consulting offshore wind. 6 sections : hero, services (6 blocs), track record, references projets, about founder, contact. Domaine ventusnexus.com (Hostinger). Contenu data/content (markdown), media/brand (visuels, charte).'
            },
            'PRJ-039': {
                short: 'Pilotage multi-projets et monitoring productivite 5 projets prioritaires',
                detailed: 'Orchestration workflow temporaire pour 5 projets prioritaires : DeepSignal, BV Germany, AI Profile, Email Prospection, Prospection Workflow. Dashboard prioritaire. Launchers bash multi-rails (business 60%, perso 25%, quick wins 15%). Integration HomeHub. Tracking temps, historique sessions, metriques commits/code.'
            }
        };

        // Detailed descriptions for ALL projects (used in popup)
        this.detailedDescriptions = {
            'PRJ-003': 'Base de connaissance IA indexant 889+ conversations Claude/ChatGPT/Mistral. Recherche full-text, tags auto par LLM, interface web Flask port 8585. Import JSON multi-format avec deduplication. Stats par modele, par mois, par topic.',
            'PRJ-008': 'Suivi portefeuille crypto multi-exchanges (Binance, Kraken, Coinbase). Dashboard temps reel, historique P&L, strategies DCA/grid. Alertes prix, rapport fiscal annuel. Flask + SQLite + APIs exchanges.',
            'PRJ-010': 'Dashboard centralise HomeHub gerant tous les projets, Docker, monitoring systeme, liens internet, todolist, formation Skool, calendrier, emails. Backend Flask port 5000 + launcher (9998) + docker control (9999).',
            'PRJ-011': 'Infrastructure complete : scripts backup rsync, monitoring disques LVM, gestion Docker stacks, port registry, audit projets, time tracking, extraction milestones, documentation systeme.',
            'PRJ-012': 'Generateur de livres de grilles de mots meles (word search) pour Amazon KDP. Export PDF A4/Letter, difficulte configurable, themes personnalises. Pipeline generation + mise en page automatique.',
            'PRJ-014': 'Monitoring systeme temps reel : CPU, RAM, GPU NVIDIA (nvidia-smi), disques, temperatures, processus. Alertes seuils configurables. Dashboard web + API REST.',
            'PRJ-015': 'Creation de livres de partitions/chords/lyrics structures a partir de fichiers source. Export PDF formate pour impression. Support guitare, basse, piano. Templates personnalisables.',
            'PRJ-017': 'Systeme centralise gestion projets : projects.db SQLite, create_project.py, query_projects.py, health_check, changelog generator, milestones extraction. Base de tous les IDs PRJ-XXX.',
            'PRJ-019': 'Studio IA complet pour videos YouTube : transcription Whisper GPU, generation de shorts verticaux, resumes LLM. Pipeline batch avec queue. Interface web + CLI.',
            'PRJ-020': 'Pipeline complet creation wall arts (posters, prints) pour Etsy. Generation IA, post-traitement, mockups, listing automatise. Gestion catalogue et variantes.',
            'PRJ-022': 'Systeme complet gestion backups infrastructure avec interface graphique. Planification cron, rotation, verification integrite, rapport email. Support rsync + tar.',
            'PRJ-023': 'Dictee vocale Whisper GPU multi-modes : clipboard, fichier, terminal. Hotkey global, VAD silence detection. Integration Claude Code via script start_claude_voice_input.sh.',
            'PRJ-024': 'Generateur calendrier location appartement avec gestion reservations, tarifs saisonniers, export PDF/iCal. Dashboard proprietaire.',
            'PRJ-025': 'Workflow automatise prospection sites web : scraping, qualification leads, enrichissement donnees, templates email, suivi relances. Pipeline multi-etapes.',
            'PRJ-027': 'Anonymisation documents PDF hybride pdfplumber/OCR Tesseract 200dpi. Detection et masquage donnees personnelles (noms, adresses, IBAN, emails). Logs par PDF.',
            'PRJ-029': 'Prospection email automatisee pour services offshore wind. Templates personnalises, suivi ouvertures, relances programmees, scoring leads.',
            'PRJ-030': 'Serveur management centralise pour Claude Code : monitoring temps reel, tracking conversations, analytics tokens, visualisation branches et sub-tasks. Dashboard web port 3001.',
            'PRJ-031': 'Audit et amelioration sante/portabilite projets. Health Dashboard avec scores par projet, verification structure, .gitignore, README, backups DB. Rapport detaille.',
            'PRJ-033': 'Nettoyage et categorisation automatique emails Gmail. Approche conservative avec dry-run. Regles personnalisables, archivage intelligent, rapport actions.',
            'PRJ-034': 'Outil revue documents BV Germany : extraction open comments depuis Excel, analyse PDF techniques, FE comments, export PDF/HTML/CSV. Interface web Flask port 5001.',
            'PRJ-036': 'Entrainement signatures rythmiques impaires (5/4, 7/4, 5/8, 7/8, 9/8). Metronome interactif, exercices progressifs, suivi progression.',
            'PRJ-038': 'Plateforme intelligence relationnelle consultants offshore wind. Next.js + Supabase + Stripe + Resend. 28 Edge Functions, TED Europa API v3. Micro-SaaS monetisable.',
            'PRJ-040': 'Driver ESP32 pour ecran OLED SSD1333 + projet Coaster-Perso simulation Wokwi. Code C/C++ embarque.',
            'PRJ-043': 'Workspace Micro-SaaS contenant DeepSignal et Template Kodefast. Repertoire parent pour projets SaaS.',
            ...this.descriptionOverrides
        };
    }

    async load() {
        const loading = document.getElementById('projects-loading');
        const tableContainer = document.getElementById('projects-table-container');

        if (loading) loading.style.display = 'flex';
        if (tableContainer) tableContainer.style.display = 'none';

        try {
            await this.fetchProjects();
            this.sortProjects();
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
        const allProjects = [];

        // 1. Infrastructure items (static)
        allProjects.push(...this.getInfrastructureItems());

        // 2. Docker containers
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

        // 3. Applications from DB
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

    /**
     * Sort projects: App Dev (PRJ-*) first sorted by numeric ID,
     * then Infrastructure, Docker, Apps Native
     */
    sortProjects() {
        const categoryOrder = { 'dev': 0, 'infra': 1, 'docker': 2, 'apps': 3 };

        this.projects.sort((a, b) => {
            // Sort by category group first
            const catA = categoryOrder[a.categoryClass] ?? 99;
            const catB = categoryOrder[b.categoryClass] ?? 99;
            if (catA !== catB) return catA - catB;

            // Within same category, sort by numeric ID
            const numA = this._extractNumericId(a.id);
            const numB = this._extractNumericId(b.id);
            return numA - numB;
        });
    }

    _extractNumericId(id) {
        const match = id.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 999;
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
                detailedDescription: '4x SSD 1TB en LVM. Volume group vg_data avec 4 logical volumes : lv_projects (/data/projects), lv_docker (/data/docker), lv_media (/data/media), lv_swap. Monitoring via scripts infrastructure.',
                nextSteps: 'Monitoring automatique'
            },
            {
                category: 'Infrastructure',
                categoryClass: 'infra',
                id: 'INFRA-002',
                name: 'GPU NVIDIA GTX 1080',
                status: 'OK',
                statusClass: 'ok',
                description: '8GB VRAM, CUDA actif, utilise par Whisper et Ollama',
                detailedDescription: 'NVIDIA GTX 1080 8GB VRAM, Compute 6.1 (sm_61). Utilise par Whisper (transcription), Ollama (LLM local). Limitation : PyTorch CUDA 12.8 requiert sm_70+, pas de deep learning GPU. Prompts courts Ollama OK (~3-4s), longs non viables.',
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
                detailedDescription: 'Systeme de backup automatise rsync. SDA = donnees principales, SDB = backup systeme, SDC = backup donnees, SDD = systeme. Cron quotidien 17h30. Rotation backups avec verification integrite.',
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
                detailedDescription: '4 stacks Docker : AI (Whisper, Ollama), Media (Radarr, Sonarr, Plex, Overseerr), Download (qBittorrent, Prowlarr), Monitoring (Portainer port 9000). Volumes persistants dans /data/docker/volumes/.',
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
            detailedDescription: `Container: ${container.name}\nImage: ${container.image}\nStatus: ${container.status}\nPorts: ${container.ports || 'aucun'}`,
            nextSteps: container.ports || '-'
        }));
    }

    mapDatabaseProjects(projects) {
        return projects.map(project => {
            const override = this.descriptionOverrides[project.id];
            const shortDesc = override
                ? override.short
                : (project.description && !project.description.startsWith('Project ')
                    ? this._truncateDescription(project.description)
                    : '-');

            const detailedEntry = this.detailedDescriptions[project.id];
            const detailedDesc = typeof detailedEntry === 'object'
                ? detailedEntry.detailed
                : (detailedEntry || project.description || '-');

            return {
                category: 'App Dev',
                categoryClass: 'dev',
                id: project.id,
                name: project.name,
                status: project.status === 'active' ? 'Actif' : project.status,
                statusClass: project.status === 'active' ? 'ok' : 'warning',
                description: shortDesc,
                detailedDescription: detailedDesc,
                path: project.path,
                webUrl: project.web_url || null,
                tags: project.tags || '',
                dbCategory: project.category || '',
                hasPath: true
            };
        });
    }

    _truncateDescription(desc) {
        if (!desc) return '-';
        // Remove emoji prefix
        const cleaned = desc.replace(/^[\u{1F000}-\u{1FFFF}]\s*/u, '').trim();
        if (cleaned.length <= 100) return cleaned;
        return cleaned.substring(0, 97) + '...';
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
                detailedDescription: 'GNU Image Manipulation Program. Editeur images bitmap professionnel. Utilise pour retouche photos, creation visuels projets.',
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
                detailedDescription: 'Editeur video non-lineaire KDE. Montage multi-pistes, effets, transitions. Utilise pour production shorts YouTube (ai-video-studio).',
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
                detailedDescription: 'Editeur de code legers avec support multi-curseur, plugins, coloration syntaxique. Utilise pour edits rapides hors IDE.',
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
                detailedDescription: 'Navigateur web principal. Extensions : uBlock Origin, Bitwarden. Acces HomeHub (localhost:5000), services Docker.',
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

        tbody.innerHTML = this.filteredProjects.map(project => {
            const escapedDesc = this._escapeHtml(project.description || '-');
            const hasDetail = project.detailedDescription && project.detailedDescription !== '-';

            return `
            <tr>
                <td><span class="category-badge category-${project.categoryClass}">${project.category}</span></td>
                <td style="text-align: center;"><span class="id-badge">${project.id}</span></td>
                <td>${this._escapeHtml(project.name)}</td>
                <td style="text-align: center;"><span class="status-badge status-${project.statusClass}">${project.status}</span></td>
                <td class="desc-cell">
                    <span class="desc-text">${escapedDesc}</span>
                    ${hasDetail ? `<button class="detail-btn" onclick="window.projectsListModule.showDetail('${project.id}')" title="Voir details">i</button>` : ''}
                </td>
                <td style="text-align: center;">
                    ${project.hasPath && project.id.startsWith('PRJ-')
                        ? `<button class="action-btn action-btn-folder" onclick="window.projectsListModule.openFolder('${project.id}')" title="Ouvrir ${project.path}">
                            Dossier
                           </button>`
                        : '-'
                    }
                </td>
            </tr>`;
        }).join('');

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
            // Remove old listeners by replacing element
            const newSelect = filterSelect.cloneNode(true);
            filterSelect.parentNode.replaceChild(newSelect, filterSelect);
            newSelect.addEventListener('change', (e) => this.filterProjects(e.target.value));
        }

        const refreshBtn = document.getElementById('btn-refresh-projects');
        if (refreshBtn) {
            const newBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
            newBtn.addEventListener('click', () => this.load());
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

    showDetail(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        // Remove existing modal
        const existing = document.getElementById('project-detail-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'project-detail-modal';
        modal.className = 'project-modal-overlay';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const statusHtml = `<span class="status-badge status-${project.statusClass}">${project.status}</span>`;
        const categoryHtml = `<span class="category-badge category-${project.categoryClass}">${project.category}</span>`;

        let infoRows = '';
        if (project.path) {
            infoRows += `<div class="modal-info-row"><span class="modal-info-label">Chemin</span><span class="modal-info-value mono">${this._escapeHtml(project.path)}</span></div>`;
        }
        if (project.webUrl) {
            infoRows += `<div class="modal-info-row"><span class="modal-info-label">URL</span><a href="${this._escapeHtml(project.webUrl)}" target="_blank" class="modal-info-value link">${this._escapeHtml(project.webUrl)}</a></div>`;
        }
        if (project.tags) {
            const tagBadges = project.tags.split(',').filter(t => t.trim()).map(t =>
                `<span class="modal-tag">${this._escapeHtml(t.trim())}</span>`
            ).join('');
            if (tagBadges) {
                infoRows += `<div class="modal-info-row"><span class="modal-info-label">Tags</span><div class="modal-tags">${tagBadges}</div></div>`;
            }
        }
        if (project.dbCategory) {
            infoRows += `<div class="modal-info-row"><span class="modal-info-label">Type</span><span class="modal-info-value">${this._escapeHtml(project.dbCategory)}</span></div>`;
        }

        modal.innerHTML = `
            <div class="project-modal-content">
                <div class="project-modal-header">
                    <div class="modal-title-row">
                        <span class="modal-id">${project.id}</span>
                        <h3 class="modal-title">${this._escapeHtml(project.name)}</h3>
                    </div>
                    <button class="modal-close" onclick="this.closest('.project-modal-overlay').remove()">&times;</button>
                </div>
                <div class="project-modal-body">
                    <div class="modal-badges">${categoryHtml} ${statusHtml}</div>
                    <div class="modal-description">${this._escapeHtml(project.detailedDescription || project.description || '-')}</div>
                    ${infoRows ? `<div class="modal-info">${infoRows}</div>` : ''}
                </div>
                <div class="project-modal-footer">
                    ${project.hasPath ? `<button class="action-btn action-btn-folder" onclick="window.projectsListModule.openFolder('${project.id}')">Ouvrir dossier</button>` : ''}
                    <button class="action-btn modal-btn-close" onclick="this.closest('.project-modal-overlay').remove()">Fermer</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        // Focus trap
        setTimeout(() => modal.querySelector('.modal-close')?.focus(), 50);
    }

    async openFolder(projectId) {
        try {
            const response = await fetch(`/api/projects/open/${projectId}`, { method: 'POST' });
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
        if (window.Utils && window.Utils.showToast) {
            window.Utils.showToast(message, type);
        } else {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed; bottom: 20px; right: 20px;
                padding: 12px 20px; border-radius: 8px;
                color: white; font-weight: 500; z-index: 9999;
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

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    reload() {
        this.load();
    }
}

// Create and export singleton
const projectsListModule = new ProjectsListModule();
window.projectsListModule = projectsListModule;

export default projectsListModule;
