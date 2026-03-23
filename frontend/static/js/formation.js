/**
 * Formation Module - Plan d'action DeepSignal V1 + Contenu Skool
 */

import API from './api.js';

class FormationModule {
    constructor() {
        this.actions = [];
        this.stats = {};
        this.expandedActions = new Set();
        // Skool state
        this.skoolData = null;
        this.skoolLoaded = false;
        this.currentWeek = 0;
        this.expandedVideos = new Set();
        // Apercu state
        this.apercuLoaded = false;
        this.apercuWeek = 0;
        this.apercuActiveLesson = null;
        this.apercuContentTab = 'description';
    }

    async load() {
        try {
            const data = await API.formation.getActions();
            if (data.ok) {
                this.actions = data.actions;
                this.stats = data.stats;
                this.render();
            }
        } catch (error) {
            console.error('Formation load error:', error);
            document.getElementById('formation-actions').innerHTML =
                '<p style="color: #ef4444; padding: 20px;">Erreur de chargement du plan d\'action</p>';
        }
    }

    switchSubTab(tabName) {
        document.querySelectorAll('.formation-subtab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === tabName);
        });
        document.querySelectorAll('.formation-subtab-content').forEach(content => {
            content.classList.toggle('active', content.id === 'formation-tab-' + tabName);
        });

        if (tabName === 'skool' && !this.skoolLoaded) {
            this.loadSkoolContent();
        }
        if (tabName === 'apercu' && !this.apercuLoaded) {
            this.loadApercuContent();
        }
    }

    async loadSkoolContent() {
        try {
            const data = await API.formation.getContent();
            if (data.ok) {
                this.skoolData = { formation: data.formation, weeks: data.weeks };
                this.skoolLoaded = true;
                this.currentWeek = 0;
                this.renderSkoolHeader(data.formation);
                this.renderWeekTabs(data.weeks);
                this.renderVideos(0);
            }
        } catch (error) {
            console.error('Skool content load error:', error);
            document.getElementById('skool-header').innerHTML =
                '<p style="color: #ef4444;">Erreur de chargement du contenu Skool</p>';
        }
    }

    renderSkoolHeader(formation) {
        const el = document.getElementById('skool-header');
        if (!el) return;
        el.innerHTML = `
            <div class="skool-meta">
                <h3>${formation.name || 'Micro-SaaS Studio 05'}</h3>
                <div class="skool-meta-badges">
                    <span class="skool-badge instructor">${formation.instructor || 'Marc Louvion'}</span>
                    <span class="skool-badge week">Semaine ${formation.current_week || '?'}/4</span>
                    <span class="skool-badge project">${formation.project || 'DeepSignal'}</span>
                </div>
            </div>
        `;
    }

    renderWeekTabs(weeks) {
        const el = document.getElementById('skool-week-tabs');
        if (!el) return;
        el.innerHTML = weeks.map((week, idx) => `
            <button class="skool-week-tab ${idx === this.currentWeek ? 'active' : ''}"
                    onclick="window.formationModule.switchWeek(${idx})">
                S${week.number} - ${week.title}
                <span class="skool-week-count">${week.videos.length}v</span>
            </button>
        `).join('');
    }

    switchWeek(weekIndex) {
        this.currentWeek = weekIndex;
        this.expandedVideos.clear();
        document.querySelectorAll('.skool-week-tab').forEach((tab, idx) => {
            tab.classList.toggle('active', idx === weekIndex);
        });
        this.renderVideos(weekIndex);
    }

    renderVideos(weekIndex) {
        const el = document.getElementById('skool-videos');
        if (!el || !this.skoolData) return;

        const week = this.skoolData.weeks[weekIndex];
        if (!week) return;

        el.innerHTML = week.videos.map((video, vIdx) =>
            this._renderVideoCard(video, vIdx, weekIndex)
        ).join('');
    }

    _renderVideoCard(video, vIdx, weekIndex) {
        const statusLabels = {
            text_saved: 'Texte sauve', transcribed: 'Transcrit',
            identified: 'Identifie', not_downloaded: 'Non DL', not_started: 'Non commence'
        };
        const isExpanded = this.expandedVideos.has(`${weekIndex}-${vIdx}`);
        const loomUrl = video.loom_id ? `https://www.loom.com/share/${video.loom_id}` : null;
        const hasDetails = video.description || loomUrl || (video.resources && video.resources.length > 0);
        const detailsHtml = hasDetails ? this._renderVideoDetails(video, loomUrl, isExpanded, weekIndex, vIdx) : '';
        const statusClass = (video.status || 'not_started').replace(/\s/g, '_');
        const statusText = statusLabels[statusClass] || video.status || '';

        return `
            <div class="skool-video-card ${video.type || ''}">
                <div class="skool-video-header" onclick="window.formationModule.toggleVideoExpand(${weekIndex}, ${vIdx})">
                    <div class="skool-video-order">${video.order || vIdx + 1}</div>
                    <div class="skool-video-info">
                        <div class="skool-video-title">${video.title}</div>
                    </div>
                    <span class="skool-video-type ${video.type || ''}">${video.type || ''}</span>
                    ${statusText ? `<span class="skool-video-status ${statusClass}">${statusText}</span>` : ''}
                    ${hasDetails ? `<span class="skool-expand-icon ${isExpanded ? 'expanded' : ''}">&#9654;</span>` : ''}
                </div>
                ${detailsHtml}
            </div>
        `;
    }

    _renderVideoDetails(video, loomUrl, isExpanded, weekIndex, vIdx) {
        const descHtml = video.description
            ? `<div class="skool-video-desc">${video.description}</div>`
            : '';
        let linksHtml = '';
        if (loomUrl || (video.resources && video.resources.length > 0)) {
            const links = [];
            if (loomUrl) {
                links.push(`<a href="${loomUrl}" target="_blank" class="skool-link loom">Loom</a>`);
            }
            if (video.resources) {
                video.resources.forEach((url) => {
                    const label = this._resourceLabel(url);
                    links.push(`<a href="${url}" target="_blank" class="skool-link">${label}</a>`);
                });
            }
            linksHtml = `<div class="skool-video-links">${links.join('')}</div>`;
        }
        return `
            <div class="skool-video-details ${isExpanded ? 'visible' : ''}" id="skool-detail-${weekIndex}-${vIdx}">
                ${descHtml}${linksHtml}
            </div>
        `;
    }

    toggleVideoExpand(weekIdx, videoIdx) {
        const key = `${weekIdx}-${videoIdx}`;
        const detailEl = document.getElementById(`skool-detail-${key}`);
        if (!detailEl) return;

        if (this.expandedVideos.has(key)) {
            this.expandedVideos.delete(key);
            detailEl.classList.remove('visible');
        } else {
            this.expandedVideos.add(key);
            detailEl.classList.add('visible');
        }

        const card = detailEl.closest('.skool-video-card');
        if (card) {
            const icon = card.querySelector('.skool-expand-icon');
            if (icon) icon.classList.toggle('expanded');
        }
    }

    _resourceLabel(url) {
        try {
            const hostname = new URL(url).hostname.replace('www.', '');
            if (hostname.includes('notion')) return 'Notion';
            if (hostname.includes('whimsical')) return 'Whimsical';
            if (hostname.includes('github')) return 'GitHub';
            if (hostname.includes('loom')) return 'Loom';
            if (hostname.includes('google')) return 'Google';
            if (hostname.includes('figma')) return 'Figma';
            return hostname.split('.')[0];
        } catch {
            return 'Lien';
        }
    }

    _formatSkoolText(text) {
        if (!text) return '';
        const lines = text.split('\n').filter(l => l.trim());
        return lines.map(line => {
            const trimmed = line.trim();
            if (/^\d+[\.\)]\s/.test(trimmed)) return `<p class="skool-numbered">${trimmed}</p>`;
            if (/^[•👉⚠️ℹ✅🟢📦]/.test(trimmed)) return `<p class="skool-bullet">${trimmed}</p>`;
            if (/^Resources?/.test(trimmed)) return `<p class="skool-section-title">${trimmed}</p>`;
            return `<p>${trimmed}</p>`;
        }).join('');
    }

    async loadApercuContent() {
        try {
            if (!this.skoolData) {
                const data = await API.formation.getContent();
                if (data.ok) {
                    this.skoolData = { formation: data.formation, weeks: data.weeks };
                    this.skoolLoaded = true;
                }
            }
            this.apercuLoaded = true;
            this.apercuWeek = 0;
            this.renderApercuSidebar();
        } catch (error) {
            document.getElementById('apercu-sidebar').innerHTML =
                '<p style="color: #ef4444; padding: 20px;">Erreur de chargement</p>';
        }
    }

    renderApercuSidebar() {
        const sidebar = document.getElementById('apercu-sidebar');
        if (!sidebar || !this.skoolData) return;

        const weeks = this.skoolData.weeks;
        const week = weeks[this.apercuWeek];
        if (!week) return;

        const weekOptions = weeks.map((w, i) =>
            `<option value="${i}" ${i === this.apercuWeek ? 'selected' : ''}>S${w.number} - ${w.title}</option>`
        ).join('');

        const lessons = week.videos.filter(v => v.type !== 'replay' && v.type !== 'resources' && v.type !== 'checklist');

        const lessonItems = lessons.map((v, idx) => {
            const realIdx = week.videos.indexOf(v);
            const isActive = this.apercuActiveLesson === realIdx;
            const statusClass = (v.status || '').replace(/\s/g, '_');
            return `
                <li class="apercu-lesson-item ${isActive ? 'active' : ''}"
                    onclick="window.formationModule.selectLesson(${realIdx})">
                    <span class="apercu-lesson-num">${v.order || idx + 1}</span>
                    <span class="apercu-lesson-title">${v.title}</span>
                    ${statusClass ? `<span class="apercu-lesson-status ${statusClass}">${statusClass === 'transcribed' ? 'T' : 'S'}</span>` : ''}
                </li>
            `;
        }).join('');

        sidebar.innerHTML = `
            <div class="apercu-sidebar-header">
                <h3>${this.skoolData.formation.name || 'Micro-SaaS Studio 05'}</h3>
                <span class="apercu-week-info">${lessons.length} lecons</span>
                <select class="apercu-week-select" onchange="window.formationModule.switchApercuWeek(parseInt(this.value))">
                    ${weekOptions}
                </select>
            </div>
            <ul class="apercu-lesson-list">${lessonItems}</ul>
        `;

        if (this.apercuActiveLesson === null && lessons.length > 0) {
            this.selectLesson(week.videos.indexOf(lessons[0]));
        }
    }

    switchApercuWeek(weekIdx) {
        this.apercuWeek = weekIdx;
        this.apercuActiveLesson = null;
        this.renderApercuSidebar();
    }

    selectLesson(videoIdx) {
        this.apercuActiveLesson = videoIdx;
        this.apercuContentTab = 'description';
        // Update sidebar active state
        document.querySelectorAll('.apercu-lesson-item').forEach(el => el.classList.remove('active'));
        const items = document.querySelectorAll('.apercu-lesson-item');
        items.forEach(el => {
            if (el.onclick && el.onclick.toString().includes(videoIdx)) {
                el.classList.add('active');
            }
        });
        this.renderApercuSidebar();
        this.renderLessonDetail();
    }

    renderLessonDetail() {
        const main = document.getElementById('apercu-main');
        if (!main || !this.skoolData) return;

        const week = this.skoolData.weeks[this.apercuWeek];
        if (!week) return;

        const video = week.videos[this.apercuActiveLesson];
        if (!video) return;

        const weekNum = week.number;
        const videoOrder = video.order || (this.apercuActiveLesson + 1);
        const mediaPath = `S${weekNum}/S${weekNum}_${String(videoOrder).padStart(2, '0')}_avatar.mp4`;
        const mediaUrl = API.formation.getMediaUrl(mediaPath);

        const resourcesHtml = (video.skool_links && video.skool_links.length > 0)
            ? `<div class="apercu-resources">${video.skool_links.map(link =>
                `<a href="${link.url}" target="_blank" class="apercu-resource-link">${link.text || this._resourceLabel(link.url)}</a>`
              ).join('')}</div>`
            : (video.resources && video.resources.length > 0)
                ? `<div class="apercu-resources">${video.resources.map(url =>
                    `<a href="${url}" target="_blank" class="apercu-resource-link">${this._resourceLabel(url)}</a>`
                  ).join('')}</div>`
                : '';

        const rawText = video.skool_text || video.description || 'Pas de description disponible.';
        const descText = this._formatSkoolText(rawText);

        main.innerHTML = `
            <div class="apercu-video-container">
                <video controls src="${mediaUrl}" preload="metadata">
                    <p class="apercu-no-video">Video non disponible</p>
                </video>
            </div>
            <div class="apercu-content">
                <h2>${video.title}</h2>
                <div class="apercu-content-tabs">
                    <button class="apercu-content-tab active" onclick="window.formationModule.switchContentTab('description')">Description</button>
                    <button class="apercu-content-tab" onclick="window.formationModule.switchContentTab('transcript')">Transcript</button>
                </div>
                <div class="apercu-tab-panel active" id="apercu-panel-description">
                    <div class="apercu-description">${descText}</div>
                    ${resourcesHtml}
                </div>
                <div class="apercu-tab-panel" id="apercu-panel-transcript">
                    <div class="apercu-transcript-loading">Chargement du transcript...</div>
                </div>
            </div>
        `;

        // Handle video error (file not yet generated)
        const videoEl = main.querySelector('video');
        videoEl.addEventListener('error', () => {
            videoEl.parentElement.innerHTML = `
                <div class="apercu-no-video">
                    <span class="play-icon">&#9654;</span>
                    <span>Video en cours de generation...</span>
                </div>
            `;
        });
    }

    switchContentTab(tabName) {
        this.apercuContentTab = tabName;
        document.querySelectorAll('.apercu-content-tab').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === tabName);
        });
        document.querySelectorAll('.apercu-tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === 'apercu-panel-' + tabName);
        });

        if (tabName === 'transcript') {
            this.loadTranscript();
        }
    }

    async loadTranscript() {
        const panel = document.getElementById('apercu-panel-transcript');
        if (!panel || !this.skoolData) return;

        const week = this.skoolData.weeks[this.apercuWeek];
        if (!week) return;
        const video = week.videos[this.apercuActiveLesson];
        if (!video) return;

        const weekNum = week.number;
        const videoOrder = video.order || (this.apercuActiveLesson + 1);

        try {
            const data = await API.formation.getTranscript(weekNum, videoOrder);
            if (data.ok && data.transcript) {
                panel.innerHTML = `<div class="apercu-transcript">${data.transcript}</div>`;
            } else {
                panel.innerHTML = '<div class="apercu-transcript">Transcript non disponible pour cette lecon.</div>';
            }
        } catch {
            panel.innerHTML = '<div class="apercu-transcript">Erreur de chargement du transcript.</div>';
        }
    }

    render() {
        this.updateProgress();
        this.renderActions();
    }

    updateProgress() {
        const bar = document.getElementById('formation-progress-bar');
        const text = document.getElementById('formation-progress-text');
        if (bar && text) {
            bar.style.width = this.stats.progress_percent + '%';
            text.textContent = `${this.stats.done_actions}/${this.stats.total_actions} actions`;
        }
    }

    renderActions() {
        const container = document.getElementById('formation-actions');
        if (!container) return;

        const html = this.actions.map((action, index) =>
            this._renderActionCard(action, index)
        ).join('');

        container.innerHTML = html + this._renderActionsLegend();
    }

    _renderActionCard(action, index) {
        const isExpanded = this.expandedActions.has(action.id);
        const hasChildren = action.children && action.children.length > 0;
        const doneChildren = hasChildren ? action.children.filter(c => c.status === 'done').length : 0;
        const totalChildren = hasChildren ? action.children.length : 0;
        const prereqs = JSON.parse(action.prerequisite_ids || '[]');
        const isBlocked = prereqs.length > 0 && prereqs.some(pid => {
            const parent = this.actions.find(a => a.id === pid);
            return parent && parent.status !== 'done';
        });

        const statusClass = isBlocked ? 'blocked' : action.status;
        const statusIcon = action.status === 'done' ? '&#10003;' :
                          action.status === 'in_progress' ? '&#9679;' : '';
        const childrenHtml = hasChildren ? this._renderActionChildren(action.children, action.id, isExpanded) : '';
        const prereqHtml = prereqs.length > 0
            ? `<span class="formation-action-prereq">Prerequis: Action ${prereqs.join(', ')}</span>`
            : '';
        const childProgress = hasChildren ? `<span>${doneChildren}/${totalChildren}</span>` : '';

        return `
            <div class="formation-action-card ${statusClass}" data-id="${action.id}">
                <div class="formation-action-header" onclick="window.formationModule.toggleExpand(${action.id})">
                    <div class="formation-action-number">${index + 1}</div>
                    <div class="formation-action-info">
                        <div class="formation-action-title">${action.title}</div>
                        <div class="formation-action-meta">
                            <span class="formation-action-who">${action.who}</span>
                            ${prereqHtml}
                            ${childProgress}
                        </div>
                    </div>
                    <button class="formation-status-btn ${action.status}"
                            onclick="window.formationModule.toggleAction(${action.id}, event)"
                            title="Changer le statut">${statusIcon}</button>
                    ${hasChildren ? `<span class="formation-expand-icon ${isExpanded ? 'expanded' : ''}">&#9654;</span>` : ''}
                </div>
                ${childrenHtml}
            </div>
        `;
    }

    _renderActionChildren(children, actionId, isExpanded) {
        const subItems = children.map(child => {
            const childIcon = child.status === 'done' ? '&#10003;' :
                             child.status === 'in_progress' ? '&#9679;' : '';
            const descHtml = child.description
                ? `<div class="formation-sub-desc">${child.description}</div>`
                : '';
            return `
                <div class="formation-sub-item ${child.status}">
                    <button class="formation-sub-btn ${child.status}"
                            onclick="window.formationModule.toggleAction(${child.id}, event)"
                            title="Changer le statut">${childIcon}</button>
                    <div class="formation-sub-content">
                        <div class="formation-sub-title-row">
                            <span class="formation-sub-title">${child.title}</span>
                            <span class="formation-sub-who">${child.who}</span>
                        </div>
                        ${descHtml}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="formation-sub-actions ${isExpanded ? 'visible' : ''}" id="sub-${actionId}">
                ${subItems}
            </div>
        `;
    }

    _renderActionsLegend() {
        return `
            <div class="formation-legend">
                <div class="formation-legend-item">
                    <div class="formation-legend-dot pending"></div>
                    <span>A faire</span>
                </div>
                <div class="formation-legend-item">
                    <div class="formation-legend-dot in_progress"></div>
                    <span>En cours</span>
                </div>
                <div class="formation-legend-item">
                    <div class="formation-legend-dot done"></div>
                    <span>Termine</span>
                </div>
            </div>
        `;
    }

    toggleExpand(actionId) {
        if (this.expandedActions.has(actionId)) {
            this.expandedActions.delete(actionId);
        } else {
            this.expandedActions.add(actionId);
        }

        const subEl = document.getElementById('sub-' + actionId);
        if (subEl) {
            subEl.classList.toggle('visible');
        }

        const card = document.querySelector(`.formation-action-card[data-id="${actionId}"]`);
        if (card) {
            const icon = card.querySelector('.formation-expand-icon');
            if (icon) icon.classList.toggle('expanded');
        }
    }

    async toggleAction(actionId, event) {
        if (event) event.stopPropagation();

        try {
            const data = await API.formation.toggle(actionId);
            if (data.ok) {
                this.stats = data.stats;
                // Reload full data to get updated parent statuses
                await this.load();
            }
        } catch (error) {
            console.error('Toggle error:', error);
        }
    }
}

const formationModule = new FormationModule();
window.formationModule = formationModule;

export default formationModule;
