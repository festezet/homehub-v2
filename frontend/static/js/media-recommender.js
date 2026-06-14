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
        this.interactionStates = {};  // title (lowercased) -> Set of {'liked','seen','disliked'}
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
        if (tabName === 'recommendations') {
            this.loadRecommendations();
        }
    }

    async loadRecommendations() {
        const grid = document.getElementById('media-reco-suggestions');
        if (!grid) return;
        if (!this.recommendations.length) {
            grid.innerHTML = '<div class="media-reco-loading">Chargement...</div>';
        }
        try {
            const data = await API.mediaReco.listRecommendations('pending', 20);
            if (data.ok && data.recommendations?.length) {
                this.recommendations = data.recommendations;
                grid.innerHTML = data.recommendations
                    .map(r => this._renderCard(r, 'recommendation')).join('');
            } else {
                this.recommendations = [];
                grid.innerHTML = '<div class="media-reco-empty"><p>Aucune recommandation en attente. Clique sur "Generer des recommandations".</p></div>';
            }
        } catch (err) {
            grid.innerHTML = '<div class="media-reco-empty"><p>Erreur de chargement</p></div>';
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
            const [libData, interData] = await Promise.all([
                API.mediaReco.getLibrary(),
                API.mediaReco.getInteractions()
            ]);
            if (libData.ok) {
                this.library = libData.library;
                this._buildGenreFilter();
            }
            if (interData.ok) {
                this.interactions = interData.interactions || [];
                this._rebuildInteractionStates();
            }
            this.renderLibrary();
        } catch (err) {
            if (grid) grid.innerHTML = '<div class="media-reco-empty"><p>Erreur de chargement</p></div>';
        }
    }

    _rebuildInteractionStates() {
        // Accumulate ALL states per title (non-exclusive).
        const states = {};
        for (const i of this.interactions) {
            const key = (i.title || '').toLowerCase();
            if (!key) continue;
            if (!states[key]) states[key] = new Set();
            const s = this._stateFromInteraction(i);
            if (s) states[key].add(s);
        }
        this.interactionStates = states;
    }

    _stateFromInteraction(i) {
        if (i.action === 'rated' && i.rating != null) {
            if (i.rating >= 8) return 'liked';
            if (i.rating <= 4) return 'disliked';
            return 'seen';
        }
        if (i.action === 'watched') return 'seen';
        if (i.action === 'rejected' || i.action === 'abandoned') return 'disliked';
        return null;
    }

    _addLocalState(title, state) {
        const key = (title || '').toLowerCase();
        if (!key) return;
        if (!this.interactionStates[key]) this.interactionStates[key] = new Set();
        this.interactionStates[key].add(state);
        this.renderLibrary();
    }

    _hasState(title, state) {
        const set = this.interactionStates[(title || '').toLowerCase()];
        return set ? set.has(state) : false;
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
        const feedback = document.getElementById('media-reco-filter-feedback')?.value || 'hide-disliked';
        return this.library.filter(item => {
            if (type !== 'all' && this._mediaType(item) !== type) return false;
            if (genre !== 'all' && !this._parseGenres(item.genres).includes(genre)) return false;
            if (status === 'available' && !item.has_file) return false;
            if (status === 'monitored' && item.has_file) return false;
            const liked = this._hasState(item.title, 'liked');
            const disliked = this._hasState(item.title, 'disliked');
            if (feedback === 'hide-disliked' && disliked) return false;
            if (feedback === 'liked' && !liked) return false;
            if (feedback === 'disliked' && !disliked) return false;
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
        const mediaType = this._mediaType(item);
        const posterHtml = this._renderCardPoster(item);
        const genresHtml = this._parseGenres(item.genres).slice(0, 3)
            .map(g => `<span class="media-reco-genre-badge">${g}</span>`).join('');
        const trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' ' + (item.year || '') + ' trailer')}`;

        if (mode === 'recommendation') {
            return this._renderRecommendationCard(item, mediaType, posterHtml, genresHtml, trailerUrl);
        }
        return this._renderLibraryCard(item, mediaType, posterHtml, genresHtml, trailerUrl);
    }

    _renderCardPoster(item) {
        const poster = item.poster_url || item.poster;
        return poster
            ? `<img class="media-reco-card-poster" src="${poster}" alt="${item.title}" loading="lazy">`
            : `<div class="media-reco-card-placeholder">${item.title.charAt(0)}</div>`;
    }

    _renderRecommendationCard(item, mediaType, posterHtml, genresHtml, trailerUrl) {
        const overview = item.overview
            ? `<div class="media-reco-card-overview">${item.overview}</div>` : '';
        const reason = item.reason
            ? `<div class="media-reco-card-reason">${item.reason}</div>` : '';
        const escTitle = this._esc(item.title);
        let actions = `<a href="${trailerUrl}" target="_blank" class="media-reco-btn media-reco-btn-trailer">Trailer</a>`;
        actions += `<button class="media-reco-btn media-reco-btn-add" onclick="window.mediaRecommenderModule.acceptRecommendation(${item.id}, '${escTitle}', ${item.year || 0}, '${mediaType}')">Ajouter</button>`;
        actions += `<button class="media-reco-btn media-reco-btn-reject" onclick="window.mediaRecommenderModule.rejectRecommendation(${item.id})">Pas interesse</button>`;
        actions += `<button class="media-reco-btn media-reco-btn-seen-liked" onclick="window.mediaRecommenderModule.markSeenLikedExternal(${item.id}, '${escTitle}', '${mediaType}')" title="Deja vu et aime">Deja vu, j'aime</button>`;
        actions += `<button class="media-reco-btn media-reco-btn-seen-disliked" onclick="window.mediaRecommenderModule.markSeenDislikedExternal(${item.id}, '${escTitle}', '${mediaType}')" title="Deja vu et pas aime">Deja vu, pas aime</button>`;
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

    _renderLibraryCard(item, mediaType, posterHtml, genresHtml, trailerUrl) {
        const rating = item.rating_imdb || item.rating;
        const hasFile = item.has_file ?? item.hasFile;
        const ratingHtml = rating ? `<div class="media-reco-card-rating">IMDB ${rating}</div>` : '';
        const statusClass = hasFile ? 'available' : 'monitored';
        const statusText = hasFile ? 'Disponible' : 'En attente';
        const escTitle = this._esc(item.title);
        const cls = (s) => this._hasState(item.title, s) ? ' active' : '';
        let actions = `<a href="${trailerUrl}" target="_blank" class="media-reco-btn media-reco-btn-trailer">Trailer</a>`;
        actions += `<button class="media-reco-btn media-reco-btn-like${cls('liked')}" onclick="window.mediaRecommenderModule.markLiked('${escTitle}', '${mediaType}')" title="J'aime">J'aime</button>`;
        actions += `<button class="media-reco-btn media-reco-btn-seen${cls('seen')}" onclick="window.mediaRecommenderModule.markSeen('${escTitle}', '${mediaType}')" title="Vu">Vu</button>`;
        actions += `<button class="media-reco-btn media-reco-btn-dislike${cls('disliked')}" onclick="window.mediaRecommenderModule.markDisliked('${escTitle}', '${mediaType}')" title="J'aime pas">J'aime pas</button>`;

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
        const type = document.getElementById('media-reco-gen-type')?.value || 'both';
        if (btn) { btn.disabled = true; btn.textContent = 'Construction du prompt...'; }
        try {
            const data = await API.mediaReco.generateRecommendations(type, 5);
            if (data.ok && data.prompt) {
                this._openClaudeCodeModal(data.prompt, data.batch_id);
            } else {
                window.Utils?.showToast?.('Echec de generation du prompt', 'error');
            }
        } catch (err) {
            window.Utils?.showToast?.('Erreur reseau', 'error');
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Generer des recommandations'; }
    }

    _openClaudeCodeModal(prompt, batchId) {
        let modal = document.getElementById('media-reco-cc-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'media-reco-cc-modal';
            modal.className = 'media-reco-modal';
            modal.innerHTML = `
                <div class="media-reco-modal-content">
                    <div class="media-reco-modal-header">
                        <h3>Generer via Claude Code</h3>
                        <button class="media-reco-modal-close" onclick="window.mediaRecommenderModule._closeClaudeCodeModal()">x</button>
                    </div>
                    <div class="media-reco-modal-body">
                        <p class="media-reco-modal-step"><strong>1.</strong> Copie ce prompt et colle-le dans une session Claude Code :</p>
                        <textarea id="media-reco-cc-prompt" readonly></textarea>
                        <button class="media-reco-btn media-reco-btn-add" onclick="window.mediaRecommenderModule._copyPrompt()">Copier le prompt</button>
                        <p class="media-reco-modal-step"><strong>2.</strong> Colle ici la reponse JSON de Claude Code :</p>
                        <textarea id="media-reco-cc-response" placeholder='[{"title":"...","year":2024,"type":"movie",...}]'></textarea>
                        <button class="media-reco-btn media-reco-btn-add" onclick="window.mediaRecommenderModule._submitClaudeCodeResponse()">Soumettre</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }
        document.getElementById('media-reco-cc-prompt').value = prompt;
        document.getElementById('media-reco-cc-response').value = '';
        modal.dataset.batchId = batchId || '';
        modal.classList.add('open');
    }

    _closeClaudeCodeModal() {
        const modal = document.getElementById('media-reco-cc-modal');
        if (modal) modal.classList.remove('open');
    }

    async _copyPrompt() {
        const ta = document.getElementById('media-reco-cc-prompt');
        if (!ta) return;
        try {
            await navigator.clipboard.writeText(ta.value);
            window.Utils?.showToast?.('Prompt copie', 'success');
        } catch (e) {
            ta.select();
            document.execCommand('copy');
        }
    }

    async _submitClaudeCodeResponse() {
        const modal = document.getElementById('media-reco-cc-modal');
        const ta = document.getElementById('media-reco-cc-response');
        const grid = document.getElementById('media-reco-suggestions');
        const text = (ta?.value || '').trim();
        if (!text) {
            window.Utils?.showToast?.('Colle la reponse JSON', 'error');
            return;
        }
        try {
            const data = await API.mediaReco.submitRecommendations(text, modal?.dataset.batchId);
            if (data.ok && data.recommendations?.length) {
                this.recommendations = data.recommendations;
                if (grid) grid.innerHTML = data.recommendations
                    .map(r => this._renderCard(r, 'recommendation')).join('');
                this._closeClaudeCodeModal();
                window.Utils?.showToast?.(`${data.recommendations.length} recos sauvegardees`, 'success');
            } else {
                window.Utils?.showToast?.(data.message || 'Echec parsing', 'error');
            }
        } catch (err) {
            window.Utils?.showToast?.('Erreur reseau', 'error');
        }
    }

    async acceptRecommendation(id, title, year, type) {
        try {
            const addResult = await API.mediaReco.addTitle({ title, year, type });
            const target = type === 'series' ? 'Sonarr' : 'Radarr';
            if (addResult.ok) {
                window.Utils?.showToast?.(`${title} ajoute dans ${target}`, 'success');
                await API.mediaReco.resolveRecommendation(id, 'added');
                this._removeRecommendationCard(id);
                // Refresh library so the new title appears
                this.loadLibrary();
            } else if (addResult._status === 409) {
                // Already in Radarr/Sonarr — treat as "added" (idempotent)
                window.Utils?.showToast?.(`${title} deja present dans ${target}`, 'info');
                await API.mediaReco.resolveRecommendation(id, 'added');
                this._removeRecommendationCard(id);
            } else {
                window.Utils?.showToast?.(addResult.error?.message || 'Erreur lors de l\'ajout', 'error');
            }
        } catch (err) {
            window.Utils?.showToast?.('Erreur reseau lors de l\'ajout', 'error');
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
            if (data.ok) {
                window.Utils?.showToast?.(`${title} ajoute dans ${type === 'series' ? 'Sonarr' : 'Radarr'}`, 'success');
            } else {
                window.Utils?.showToast?.(data.error?.message || 'Erreur', 'error');
            }
        } catch (err) {
            window.Utils?.showToast?.('Erreur lors de l\'ajout', 'error');
        }
    }

    async markSeen(title, type) {
        if (this._hasState(title, 'seen')) return;
        this._addLocalState(title, 'seen');
        try {
            await API.mediaReco.createInteraction({ title, media_type: type, action: 'watched' });
            window.Utils?.showToast?.(`${title} marque comme vu`, 'success');
        } catch (err) {
            // silent
        }
    }

    async markLiked(title, type) {
        if (this._hasState(title, 'liked')) return;
        this._addLocalState(title, 'liked');
        try {
            await API.mediaReco.createInteraction({ title, media_type: type, action: 'rated', rating: 9 });
            window.Utils?.showToast?.(`${title} : aime`, 'success');
        } catch (err) {
            // silent
        }
    }

    async markDisliked(title, type) {
        if (this._hasState(title, 'disliked')) return;
        this._addLocalState(title, 'disliked');
        try {
            await API.mediaReco.createInteraction({ title, media_type: type, action: 'rated', rating: 3 });
            window.Utils?.showToast?.(`${title} : pas aime`, 'info');
        } catch (err) {
            // silent
        }
    }

    async markSeenLikedExternal(id, title, type) {
        try {
            await Promise.all([
                API.mediaReco.createInteraction({ title, media_type: type, action: 'rated', rating: 9 }),
                API.mediaReco.resolveRecommendation(id, 'ignored')
            ]);
            window.Utils?.showToast?.(`${title} : deja vu, aime`, 'success');
            this._removeRecommendationCard(id);
        } catch (err) {
            window.Utils?.showToast?.('Erreur', 'error');
        }
    }

    async markSeenDislikedExternal(id, title, type) {
        try {
            await Promise.all([
                API.mediaReco.createInteraction({ title, media_type: type, action: 'rated', rating: 3 }),
                API.mediaReco.resolveRecommendation(id, 'ignored')
            ]);
            window.Utils?.showToast?.(`${title} : deja vu, pas aime`, 'info');
            this._removeRecommendationCard(id);
        } catch (err) {
            window.Utils?.showToast?.('Erreur', 'error');
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
            if (tasteData.ok) this.taste = tasteData.profile;
            if (statsData.ok) this.stats = statsData.stats;
            if (interData.ok) this.interactions = interData.interactions || [];
            this.renderTaste();
        } catch (err) {
            container.innerHTML = '<div class="media-reco-empty"><p>Erreur de chargement</p></div>';
        }
    }

    renderTaste() {
        const container = document.getElementById('media-reco-taste');
        if (!container) return;

        let html = '';
        if (this.stats) html += this._renderTasteStats();
        if (this.taste) html += this._renderTasteDimensions();
        if (this.interactions.length) html += this._renderTasteInteractions();

        if (!html) {
            html = '<div class="media-reco-empty"><p>Aucune donnee de profil. Interagissez avec votre bibliotheque pour construire votre profil de gout.</p></div>';
        }
        container.innerHTML = html;
    }

    _sortDimension(key, entries) {
        if (key === 'decade') {
            // Chronologique descendant (plus recent en haut). value: "2010s", "2000s"...
            return [...entries].sort((a, b) => parseInt(b.value) - parseInt(a.value));
        }
        if (key === 'runtime_range') {
            // Du plus long au plus court (physique).
            const order = {
                'very_long (150min+)': 0,
                'long (120-150min)': 1,
                'medium (90-120min)': 2,
                'short (<90min)': 3,
            };
            return [...entries].sort((a, b) => (order[a.value] ?? 99) - (order[b.value] ?? 99));
        }
        // Defaut : par score decroissant
        return [...entries].sort((a, b) => b.score - a.score);
    }

    _renderTasteStats() {
        const s = this.stats;
        return `<div class="media-reco-stats-grid">
            <div class="media-reco-stat-card"><div class="media-reco-stat-value">${s.media_items || 0}</div><div class="media-reco-stat-label">Titres en bibliotheque</div></div>
            <div class="media-reco-stat-card"><div class="media-reco-stat-value">${s.interactions || 0}</div><div class="media-reco-stat-label">Interactions</div></div>
            <div class="media-reco-stat-card"><div class="media-reco-stat-value">${s.recommendations || 0}</div><div class="media-reco-stat-label">Recommandations</div></div>
            <div class="media-reco-stat-card"><div class="media-reco-stat-value">${s.taste_dimensions || 0}</div><div class="media-reco-stat-label">Dimensions gout</div></div>
        </div>`;
    }

    _renderTasteDimensions() {
        const dimensions = [
            { key: 'genre', label: 'Genres' },
            { key: 'decade', label: 'Decades' },
            { key: 'media_type', label: 'Type de media' },
            { key: 'runtime_range', label: 'Duree' }
        ];
        let html = '';
        for (const dim of dimensions) {
            const entries = this.taste[dim.key];
            if (!entries || !entries.length) continue;
            const sorted = this._sortDimension(dim.key, entries);
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
        return html;
    }

    _renderTasteInteractions() {
        const recent = this.interactions.slice(0, 15);
        const actionLabels = { watched: 'Vu', rated: 'Note', rejected: 'Rejete', added: 'Ajoute', abandoned: 'Abandonne', interested: 'Interesse' };
        const actionCls = { watched: 'positive', rated: 'neutral', rejected: 'negative', added: 'positive', abandoned: 'negative', interested: 'neutral' };
        let html = `<div class="media-reco-taste-section"><h4>Dernieres interactions</h4><div class="media-reco-interactions-list">`;
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
        return html;
    }

    // -- Sync --

    async triggerSync() {
        const btn = document.getElementById('media-reco-btn-sync');
        if (btn) { btn.disabled = true; btn.textContent = 'Sync...'; }
        try {
            const data = await API.mediaReco.triggerSync();
            if (data.ok) {
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
            if (data.ok) {
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
                `<span class="media-reco-chip ${s.cls}">${v} <span class="remove" onclick="window.mediaRecommenderModule.updatePref('${s.key}', 'remove', '${this._esc(v)}')">&times;</span></span>`
            ).join('');
            return `<div class="media-reco-pref-section">
                <h4>${s.label}</h4>
                <div class="media-reco-chips">${chips}</div>
                <div class="media-reco-add-input">
                    <input type="text" id="pref-input-${s.key}" placeholder="Ajouter...">
                    <button onclick="window.mediaRecommenderModule.updatePref('${s.key}', 'add')">+</button>
                </div>
            </div>`;
        }).join('');
    }

    async updatePref(category, action, value) {
        if (action === 'add') {
            const input = document.getElementById(`pref-input-${category}`);
            value = input?.value?.trim();
            if (!value) return;
            try {
                await API.mediaReco.updatePreference({ action: 'add', category, value });
                input.value = '';
            } catch (err) { return; }
        } else {
            try {
                await API.mediaReco.updatePreference({ action: 'remove', category, value });
            } catch (err) { return; }
        }
        this.preferences = null;
        await this.loadPreferences();
    }
}

const mediaRecommenderModule = new MediaRecommenderModule();
window.mediaRecommenderModule = mediaRecommenderModule;

export default mediaRecommenderModule;
