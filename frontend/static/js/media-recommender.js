/**
 * Media Recommender Module - Bibliotheque, Recommandations IA, Profil de Gout, Preferences
 */
import API from './api.js';

class MediaRecommenderModule {
    constructor() {
        this.library = [];
        this.recommendations = [];
        this.preferences = null;
        this.taste = null;
        this.stats = null;
        this.interactions = [];
        this.loaded = false;
        this.allGenres = [];
    }

    async load() {
        if (!this.loaded) {
            await this.loadLibrary();
            this.loaded = true;
        }
    }

    switchSubTab(tabName) {
        document.querySelectorAll('.media-reco-subtab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === tabName);
        });
        document.querySelectorAll('.media-reco-subtab-content').forEach(c => {
            c.classList.toggle('active', c.id === 'media-reco-tab-' + tabName);
        });
        if (tabName === 'preferences' && !this.preferences) {
            this.loadPreferences();
        }
        if (tabName === 'taste' && !this.taste) {
            this.loadTaste();
        }
    }

    // -- Helpers --

    _parseGenres(genres) {
        if (!genres) return [];
        if (Array.isArray(genres)) return genres;
        try { return JSON.parse(genres); } catch { return []; }
    }

    _mediaType(item) {
        return item.media_type || item.type || 'movie';
    }

    _esc(str) {
        return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    // -- Library --

    async loadLibrary() {
        const grid = document.getElementById('media-reco-library-grid');
        if (grid) grid.innerHTML = '<div class="media-reco-loading">Chargement...</div>';
        try {
            const data = await API.mediaReco.getLibrary();
            if (data.status === 'ok') {
                this.library = data.library;
                this._buildGenreFilter();
                this.renderLibrary();
            }
        } catch (err) {
            if (grid) grid.innerHTML = '<div class="media-reco-empty"><p>Erreur de chargement</p></div>';
        }
    }

    _buildGenreFilter() {
        const genreSet = new Set();
        this.library.forEach(item => {
            this._parseGenres(item.genres).forEach(g => genreSet.add(g));
        });
        this.allGenres = [...genreSet].sort();
        const sel = document.getElementById('media-reco-filter-genre');
        if (!sel) return;
        sel.innerHTML = '<option value="all">Tous les genres</option>' +
            this.allGenres.map(g => `<option value="${g}">${g}</option>`).join('');
    }

    applyFilters() {
        this.renderLibrary();
    }

    _getFiltered() {
        const type = document.getElementById('media-reco-filter-type')?.value || 'all';
        const genre = document.getElementById('media-reco-filter-genre')?.value || 'all';
        const status = document.getElementById('media-reco-filter-status')?.value || 'all';
        return this.library.filter(item => {
            if (type !== 'all' && this._mediaType(item) !== type) return false;
            if (genre !== 'all' && !this._parseGenres(item.genres).includes(genre)) return false;
            if (status === 'available' && !item.has_file) return false;
            if (status === 'monitored' && item.has_file) return false;
            return true;
        });
    }

    renderLibrary() {
        const grid = document.getElementById('media-reco-library-grid');
        if (!grid) return;
        const items = this._getFiltered();
        const count = document.getElementById('media-reco-library-count');
        if (count) count.textContent = `${items.length} titre${items.length > 1 ? 's' : ''}`;
        if (!items.length) {
            grid.innerHTML = '<div class="media-reco-empty"><p>Aucun titre trouve</p></div>';
            return;
        }
        grid.innerHTML = items.map(item => this._renderCard(item, 'library')).join('');
    }

    _renderCard(item, mode) {
        const poster = item.poster_url || item.poster;
        const mediaType = this._mediaType(item);
        const genres = this._parseGenres(item.genres);
        const rating = item.rating_imdb || item.rating;
        const hasFile = item.has_file ?? item.hasFile;

        const posterHtml = poster
            ? `<img class="media-reco-card-poster" src="${poster}" alt="${item.title}" loading="lazy">`
            : `<div class="media-reco-card-placeholder">${item.title.charAt(0)}</div>`;
        const genresHtml = genres.slice(0, 3)
            .map(g => `<span class="media-reco-genre-badge">${g}</span>`).join('');
        const ratingHtml = rating ? `<div class="media-reco-card-rating">IMDB ${rating}</div>` : '';
        const statusClass = hasFile ? 'available' : 'monitored';
        const statusText = hasFile ? 'Disponible' : 'En attente';
        const trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' ' + (item.year || '') + ' trailer')}`;

        if (mode === 'recommendation') {
            const overview = item.overview
                ? `<div class="media-reco-card-overview">${item.overview}</div>` : '';
            const reason = item.reason
                ? `<div class="media-reco-card-reason">${item.reason}</div>` : '';
            let actions = `<a href="${trailerUrl}" target="_blank" class="media-reco-btn media-reco-btn-trailer">Trailer</a>`;
            actions += `<button class="media-reco-btn media-reco-btn-add" onclick="window.mediaRecommenderModule.acceptRecommendation(${item.id}, '${this._esc(item.title)}', ${item.year || 0}, '${mediaType}')">Ajouter</button>`;
            actions += `<button class="media-reco-btn media-reco-btn-reject" onclick="window.mediaRecommenderModule.rejectRecommendation(${item.id})">Pas interesse</button>`;
            return `<div class="media-reco-card">
                <div class="media-reco-card-poster-wrap">
                    ${posterHtml}
                    <span class="media-reco-type-badge ${mediaType}">${mediaType}</span>
                </div>
                <div class="media-reco-card-body">
                    <div class="media-reco-card-title">${item.title}</div>
                    <div class="media-reco-card-year">${item.year || ''}</div>
                    ${overview}
                    <div class="media-reco-card-genres">${genresHtml}</div>
                    ${reason}
                    <div class="media-reco-card-actions">${actions}</div>
                </div>
            </div>`;
        }

        let actions = `<a href="${trailerUrl}" target="_blank" class="media-reco-btn media-reco-btn-trailer">Trailer</a>`;
        actions += `<button class="media-reco-btn media-reco-btn-seen" onclick="window.mediaRecommenderModule.markSeen('${this._esc(item.title)}', '${mediaType}')">Vu</button>`;

        return `<div class="media-reco-card">
            <div class="media-reco-card-poster-wrap">
                ${posterHtml}
                <span class="media-reco-type-badge ${mediaType}">${mediaType}</span>
            </div>
            <div class="media-reco-card-body">
                <div class="media-reco-card-title">${item.title}</div>
                <div class="media-reco-card-year">${item.year || ''}</div>
                <span class="media-reco-status ${statusClass}">${statusText}</span>
                <div class="media-reco-card-genres">${genresHtml}</div>
                ${ratingHtml}
                <div class="media-reco-card-actions">${actions}</div>
            </div>
        </div>`;
    }

    // -- Recommendations --

    async generateRecommendations() {
        const btn = document.getElementById('media-reco-btn-gen');
        const grid = document.getElementById('media-reco-suggestions');
        const type = document.getElementById('media-reco-gen-type')?.value || 'both';
        if (btn) { btn.disabled = true; btn.textContent = 'Generation en cours...'; }
        if (grid) grid.innerHTML = '<div class="media-reco-loading">Claude reflechit...</div>';
        try {
            const data = await API.mediaReco.generateRecommendations(type, 5);
            if (data.status === 'ok' && data.recommendations?.length) {
                this.recommendations = data.recommendations;
                grid.innerHTML = data.recommendations
                    .map(r => this._renderCard(r, 'recommendation')).join('');
            } else {
                grid.innerHTML = '<div class="media-reco-empty"><p>Aucune recommandation</p></div>';
            }
        } catch (err) {
            if (grid) grid.innerHTML = '<div class="media-reco-empty"><p>Erreur de generation</p></div>';
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Generer des recommandations'; }
    }

    async acceptRecommendation(id, title, year, type) {
        try {
            const [addResult] = await Promise.all([
                API.mediaReco.addTitle({ title, year, type }),
                API.mediaReco.resolveRecommendation(id, 'added')
            ]);
            if (addResult.status === 'ok') {
                window.Utils?.showToast?.(`${title} ajoute dans ${type === 'series' ? 'Sonarr' : 'Radarr'}`, 'success');
            } else {
                window.Utils?.showToast?.(addResult.message || 'Erreur', 'error');
            }
            this._removeRecommendationCard(id);
        } catch (err) {
            window.Utils?.showToast?.('Erreur lors de l\'ajout', 'error');
        }
    }

    async rejectRecommendation(id) {
        try {
            await API.mediaReco.resolveRecommendation(id, 'rejected');
            this._removeRecommendationCard(id);
            window.Utils?.showToast?.('Recommandation rejetee', 'info');
        } catch (err) {
            // silent
        }
    }

    _removeRecommendationCard(id) {
        this.recommendations = this.recommendations.filter(r => r.id !== id);
        const grid = document.getElementById('media-reco-suggestions');
        if (grid && this.recommendations.length) {
            grid.innerHTML = this.recommendations
                .map(r => this._renderCard(r, 'recommendation')).join('');
        } else if (grid) {
            grid.innerHTML = '<div class="media-reco-empty"><p>Toutes les recommandations ont ete traitees</p></div>';
        }
    }

    async addTitle(title, year, type) {
        try {
            const data = await API.mediaReco.addTitle({ title, year, type });
            if (data.status === 'ok') {
                window.Utils?.showToast?.(`${title} ajoute dans ${type === 'series' ? 'Sonarr' : 'Radarr'}`, 'success');
            } else {
                window.Utils?.showToast?.(data.message || 'Erreur', 'error');
            }
        } catch (err) {
            window.Utils?.showToast?.('Erreur lors de l\'ajout', 'error');
        }
    }

    async markSeen(title, type) {
        try {
            await API.mediaReco.createInteraction({ title, media_type: type, action: 'watched' });
            window.Utils?.showToast?.(`${title} marque comme vu`, 'success');
        } catch (err) {
            // silent
        }
    }

    // -- Taste Profile --

    async loadTaste() {
        const container = document.getElementById('media-reco-taste');
        if (!container) return;
        container.innerHTML = '<div class="media-reco-loading">Chargement...</div>';
        try {
            const [tasteData, statsData, interData] = await Promise.all([
                API.mediaReco.getTaste(),
                API.mediaReco.getStats(),
                API.mediaReco.getInteractions()
            ]);
            if (tasteData.status === 'ok') this.taste = tasteData.profile;
            if (statsData.status === 'ok') this.stats = statsData.stats;
            if (interData.status === 'ok') this.interactions = interData.interactions || [];
            this.renderTaste();
        } catch (err) {
            container.innerHTML = '<div class="media-reco-empty"><p>Erreur de chargement</p></div>';
        }
    }

    renderTaste() {
        const container = document.getElementById('media-reco-taste');
        if (!container) return;
        let html = '';

        if (this.stats) {
            const s = this.stats;
            html += `<div class="media-reco-stats-grid">
                <div class="media-reco-stat-card"><div class="media-reco-stat-value">${s.media_items || 0}</div><div class="media-reco-stat-label">Titres en bibliotheque</div></div>
                <div class="media-reco-stat-card"><div class="media-reco-stat-value">${s.interactions || 0}</div><div class="media-reco-stat-label">Interactions</div></div>
                <div class="media-reco-stat-card"><div class="media-reco-stat-value">${s.recommendations || 0}</div><div class="media-reco-stat-label">Recommandations</div></div>
                <div class="media-reco-stat-card"><div class="media-reco-stat-value">${s.taste_dimensions || 0}</div><div class="media-reco-stat-label">Dimensions gout</div></div>
            </div>`;
        }

        if (this.taste) {
            const dimensions = [
                { key: 'genre', label: 'Genres' },
                { key: 'decade', label: 'Decades' },
                { key: 'media_type', label: 'Type de media' },
                { key: 'runtime_range', label: 'Duree' }
            ];
            for (const dim of dimensions) {
                const entries = this.taste[dim.key];
                if (!entries || !entries.length) continue;
                const sorted = [...entries].sort((a, b) => b.score - a.score);
                const maxAbs = Math.max(...sorted.map(e => Math.abs(e.score)), 1);
                html += `<div class="media-reco-taste-section"><h4>${dim.label}</h4><div class="media-reco-taste-bars">`;
                for (const e of sorted) {
                    const pct = Math.round((Math.abs(e.score) / maxAbs) * 100);
                    const cls = e.score >= 0 ? 'positive' : 'negative';
                    html += `<div class="media-reco-taste-bar-row">
                        <span class="media-reco-taste-label">${e.value}</span>
                        <div class="media-reco-taste-bar-track"><div class="media-reco-taste-bar ${cls}" style="width:${pct}%"></div></div>
                        <span class="media-reco-taste-score ${cls}">${e.score > 0 ? '+' : ''}${e.score}</span>
                    </div>`;
                }
                html += `</div></div>`;
            }
        }

        if (this.interactions.length) {
            const recent = this.interactions.slice(0, 15);
            const actionLabels = { watched: 'Vu', rated: 'Note', rejected: 'Rejete', added: 'Ajoute', abandoned: 'Abandonne', interested: 'Interesse' };
            const actionCls = { watched: 'positive', rated: 'neutral', rejected: 'negative', added: 'positive', abandoned: 'negative', interested: 'neutral' };
            html += `<div class="media-reco-taste-section"><h4>Dernieres interactions</h4><div class="media-reco-interactions-list">`;
            for (const i of recent) {
                const label = actionLabels[i.action] || i.action;
                const cls = actionCls[i.action] || 'neutral';
                const ratingStr = i.rating ? ` (${i.rating}/10)` : '';
                const date = i.created_at ? new Date(i.created_at).toLocaleDateString('fr-FR') : '';
                html += `<div class="media-reco-interaction-item">
                    <span class="media-reco-interaction-title">${i.title}</span>
                    <span class="media-reco-interaction-action ${cls}">${label}${ratingStr}</span>
                    <span class="media-reco-interaction-date">${date}</span>
                </div>`;
            }
            html += `</div></div>`;
        }

        if (!html) {
            html = '<div class="media-reco-empty"><p>Aucune donnee de profil. Interagissez avec votre bibliotheque pour construire votre profil de gout.</p></div>';
        }
        container.innerHTML = html;
    }

    // -- Sync --

    async triggerSync() {
        const btn = document.getElementById('media-reco-btn-sync');
        if (btn) { btn.disabled = true; btn.textContent = 'Sync...'; }
        try {
            const data = await API.mediaReco.triggerSync();
            if (data.status === 'ok') {
                window.Utils?.showToast?.('Bibliotheque synchronisee', 'success');
                await this.loadLibrary();
            }
        } catch (err) {
            window.Utils?.showToast?.('Erreur de synchronisation', 'error');
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Sync Radarr/Sonarr'; }
    }

    // -- Preferences --

    async loadPreferences() {
        const container = document.getElementById('media-reco-preferences');
        if (!container) return;
        try {
            const data = await API.mediaReco.getPreferences();
            if (data.status === 'ok') {
                this.preferences = data.preferences;
                this.renderPreferences();
            }
        } catch (err) {
            container.innerHTML = '<div class="media-reco-empty"><p>Erreur</p></div>';
        }
    }

    renderPreferences() {
        const container = document.getElementById('media-reco-preferences');
        if (!container || !this.preferences) return;
        const p = this.preferences;
        const sections = [
            { key: 'genres_liked', label: 'Genres aimes', cls: 'liked' },
            { key: 'genres_disliked', label: 'Genres exclus', cls: 'disliked' },
            { key: 'franchises', label: 'Franchises', cls: 'liked' },
            { key: 'mood_preferences', label: 'Ambiances', cls: 'liked' },
            { key: 'directors_liked', label: 'Realisateurs', cls: 'liked' },
            { key: 'actors_liked', label: 'Acteurs', cls: 'liked' },
            { key: 'series_styles', label: 'Styles de series', cls: 'liked' },
        ];
        container.innerHTML = sections.map(s => {
            const chips = (p[s.key] || []).map(v =>
                `<span class="media-reco-chip ${s.cls}">${v} <span class="remove" onclick="window.mediaRecommenderModule.removePref('${s.key}', '${this._esc(v)}')">&times;</span></span>`
            ).join('');
            return `<div class="media-reco-pref-section">
                <h4>${s.label}</h4>
                <div class="media-reco-chips">${chips}</div>
                <div class="media-reco-add-input">
                    <input type="text" id="pref-input-${s.key}" placeholder="Ajouter...">
                    <button onclick="window.mediaRecommenderModule.addPref('${s.key}')">+</button>
                </div>
            </div>`;
        }).join('');
    }

    async addPref(category) {
        const input = document.getElementById(`pref-input-${category}`);
        const value = input?.value?.trim();
        if (!value) return;
        try {
            await API.mediaReco.updatePreference({ action: 'add', category, value });
            input.value = '';
            this.preferences = null;
            await this.loadPreferences();
        } catch (err) {
            // silent
        }
    }

    async removePref(category, value) {
        try {
            await API.mediaReco.updatePreference({ action: 'remove', category, value });
            this.preferences = null;
            await this.loadPreferences();
        } catch (err) {
            // silent
        }
    }
}

const mediaRecommenderModule = new MediaRecommenderModule();
window.mediaRecommenderModule = mediaRecommenderModule;

export default mediaRecommenderModule;
