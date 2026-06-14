/**
 * Veille IA Module
 * Browse and filter scored AI news from content_intelligence.db
 */

import API from './api.js';

const PAGE_SIZE = 20;

const SOURCE_ICONS = {
    article: 'Art',
    rss: 'RSS',
    youtube: 'YT',
    podcast: 'Pod',
    linkedin_post: 'LI',
    twitter_post: 'X',
    research_paper: 'Paper'
};

class VeilleIAModule {
    constructor() {
        this.items = [];
        this.offset = 0;
        this.totalCount = 0;
        this.loaded = false;
        this.searchMode = false;
    }

    async load() {
        await Promise.all([
            this._loadItems(),
            this._loadStats()
        ]);
        this._bindEvents();
        this.loaded = true;
    }

    // ---- Data loading ----

    async _loadItems() {
        try {
            const relevance = document.getElementById('vi-filter-relevance')?.value || '';
            const status = document.getElementById('vi-filter-status')?.value || '';
            const source = document.getElementById('vi-filter-source')?.value || '';

            const params = { limit: PAGE_SIZE, offset: this.offset };
            if (relevance) params.min_relevance = relevance;
            if (status) params.status = status;
            if (source) params.type = source;

            const res = await API.veille.getItems(params);
            this.items = res.data || res.items || [];
            this.searchMode = false;
            this._renderItems();
        } catch (e) {
            console.error('Veille IA load error:', e);
            const container = document.getElementById('vi-items-container');
            if (container) container.innerHTML = '<p style="color:#f38ba8; text-align:center; padding:40px;">Erreur chargement (ai-profile port 5100 actif ?)</p>';
        }
    }

    async _loadStats() {
        try {
            const res = await API.veille.getStats();
            const s = res.data || res;

            this._setText('vi-stat-total', s.total || 0);
            this._setText('vi-stat-high', s.high_score || 0);
            this._setText('vi-stat-themes', s.ideas_total || 0);

            const byType = s.by_type || {};
            const count = Object.keys(byType).length;
            const detail = Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(', ');
            const el = document.getElementById('vi-stat-sources');
            if (el) {
                el.textContent = count;
                el.title = detail;
            }
        } catch (e) {
            console.error('Veille stats error:', e);
        }
    }

    async _search(query) {
        try {
            const res = await API.veille.search(query);
            this.items = res.data || res.items || [];
            this.searchMode = true;
            this._renderItems();
        } catch (e) {
            console.error('Veille search error:', e);
        }
    }

    // ---- Rendering ----

    _renderItems() {
        const container = document.getElementById('vi-items-container');
        if (!container) return;

        if (!this.items.length) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#888;">Aucun item trouve</p>';
            this._renderPagination(0);
            return;
        }

        container.innerHTML = this.items.map(item => this._renderCard(item)).join('');
        this._renderPagination(this.items.length);
    }

    _renderCard(item) {
        const score = item.relevance_score || 0;
        const scoreClass = score >= 7 ? 'vi-score-high' : score >= 4 ? 'vi-score-mid' : 'vi-score-low';
        const sourceLabel = SOURCE_ICONS[item.source_type] || item.source_type;

        // Thumbnail: YouTube has reliable thumbnails, others get a type icon
        let thumbHtml;
        if (item.youtube_video_id) {
            thumbHtml = `<img class="vi-thumb" src="https://img.youtube.com/vi/${this._esc(item.youtube_video_id)}/mqdefault.jpg" alt="" loading="lazy">`;
        } else {
            const icon = { article: '\u{1F4F0}', rss: '\u{1F4E1}', podcast: '\u{1F3A7}', linkedin_post: '\u{1F4BC}', twitter_post: '\u{1F426}', research_paper: '\u{1F4D1}' };
            thumbHtml = `<div class="vi-thumb vi-thumb-placeholder">${icon[item.source_type] || '\u{1F4C4}'}</div>`;
        }

        // Parse themes (stored as JSON string or comma-separated)
        let themes = [];
        if (item.themes) {
            try {
                themes = JSON.parse(item.themes);
            } catch {
                themes = item.themes.split(',').map(t => t.trim()).filter(Boolean);
            }
        }

        const titleHtml = item.source_url
            ? `<a href="${this._esc(item.source_url)}" target="_blank" onclick="event.stopPropagation()">${this._esc(item.title)}</a>`
            : this._esc(item.title);

        const date = item.published_at || item.created_at || '';
        const dateShort = date ? date.substring(0, 10) : '';
        const author = item.author ? ` — ${this._esc(item.author)}` : '';
        const publication = item.publication ? ` (${this._esc(item.publication)})` : '';

        const summaryText = item.summary || '';
        const keyPoints = item.key_points || '';
        let keyPointsHtml = '';
        if (keyPoints) {
            try {
                const points = JSON.parse(keyPoints);
                if (Array.isArray(points) && points.length) {
                    keyPointsHtml = `<ul class="vi-key-points">${points.map(p => `<li>${this._esc(p)}</li>`).join('')}</ul>`;
                }
            } catch {
                keyPointsHtml = `<p style="opacity:0.7">${this._esc(keyPoints)}</p>`;
            }
        }

        return `
        <div class="vi-item-card" data-id="${item.id}">
            <div class="vi-card-layout">
                ${thumbHtml}
                <div class="vi-card-content">
                    <div class="vi-item-header">
                        <span class="vi-source-badge">${sourceLabel}</span>
                        <div class="vi-item-title">${titleHtml}</div>
                        <span class="vi-score-badge ${scoreClass}">${score}</span>
                    </div>
                    <div class="vi-meta">${dateShort}${author}${publication} — ${this._esc(item.status || 'new')}${summaryText ? ' <span class="vi-has-summary">Summary</span>' : ''}</div>
                    ${themes.length ? `<div class="vi-themes">${themes.map(t => `<span class="vi-theme-tag">${this._esc(t)}</span>`).join('')}</div>` : ''}
                </div>
            </div>
            <div class="vi-expanded-content">
                ${summaryText ? `<div class="vi-summary">${this._esc(summaryText)}</div>` : ''}
                ${keyPointsHtml}
                ${item.notes ? `<p style="opacity:0.6; margin-top:8px;"><strong>Notes:</strong> ${this._esc(item.notes)}</p>` : ''}
                ${item.discovery_context ? `<p style="opacity:0.6;"><strong>Contexte:</strong> ${this._esc(item.discovery_context)}</p>` : ''}
            </div>
        </div>`;
    }

    _renderPagination(currentCount) {
        const pag = document.getElementById('vi-pagination');
        if (!pag) return;

        if (this.searchMode) {
            pag.innerHTML = '';
            return;
        }

        const hasPrev = this.offset > 0;
        const hasNext = currentCount >= PAGE_SIZE;

        const page = Math.floor(this.offset / PAGE_SIZE) + 1;

        let html = '';
        if (hasPrev) {
            html += `<button class="btn btn-sm" id="vi-prev">Precedent</button>`;
        }
        html += `<span style="padding: 6px 12px; opacity: 0.6; font-size: 0.85rem;">Page ${page}</span>`;
        if (hasNext) {
            html += `<button class="btn btn-sm" id="vi-next">Suivant</button>`;
        }
        pag.innerHTML = html;

        document.getElementById('vi-prev')?.addEventListener('click', () => {
            this.offset = Math.max(0, this.offset - PAGE_SIZE);
            this._loadItems();
        });
        document.getElementById('vi-next')?.addEventListener('click', () => {
            this.offset += PAGE_SIZE;
            this._loadItems();
        });
    }

    // ---- Events ----

    _bindEvents() {
        const reload = () => { this.offset = 0; this._loadItems(); };
        document.getElementById('vi-filter-relevance')?.addEventListener('change', reload);
        document.getElementById('vi-filter-status')?.addEventListener('change', reload);
        document.getElementById('vi-filter-source')?.addEventListener('change', reload);

        // Search
        const searchInput = document.getElementById('vi-search');
        const searchBtn = document.getElementById('vi-btn-search');
        const doSearch = () => {
            const q = searchInput?.value.trim();
            if (q) {
                this._search(q);
            } else {
                this.offset = 0;
                this._loadItems();
            }
        };
        searchBtn?.addEventListener('click', doSearch);
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch();
        });

        // Toggle expand on card click
        document.getElementById('vi-items-container')?.addEventListener('click', (e) => {
            const card = e.target.closest('.vi-item-card');
            if (card && !e.target.closest('a') && !e.target.closest('button')) {
                card.classList.toggle('expanded');
            }
        });
    }

    // ---- Utilities ----

    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    _esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

const veilleIAModule = new VeilleIAModule();
window.VeilleIAModule = veilleIAModule;
export default veilleIAModule;
