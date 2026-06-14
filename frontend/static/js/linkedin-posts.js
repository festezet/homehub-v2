/**
 * LinkedIn Posts Review Module
 * Browse, filter, and review LinkedIn posts before publication.
 */

import API from './api.js';

const STATUS_COLORS = {
    draft: '#6c7086',
    ready: '#a6e3a1',
    review: '#f9e2af',
    published: '#89b4fa',
    archived: '#585b70'
};

const QUALITY_COLORS = { good: '#a6e3a1', warning: '#f9e2af', bad: '#f38ba8' };

class LinkedInPostsModule {
    constructor() {
        this.posts = [];
        this.stats = null;
        this.loaded = false;
        this.currentAccount = 'all';
        this.currentStage = 'in_progress';
    }

    async load() {
        await Promise.all([this._loadStats(), this._loadPosts()]);
        this._bindEvents();
        this.loaded = true;
    }

    async _loadStats() {
        try {
            const res = await API.linkedin.getStats();
            this.stats = res.stats;
            this._renderStats();
        } catch (e) {
            console.error('LinkedIn stats error:', e);
        }
    }

    async _loadPosts() {
        try {
            const res = await API.linkedin.getPosts();
            this.posts = res.posts || [];
            this._populateSerieFilter();
            this._applyFilters();
        } catch (e) {
            console.error('LinkedIn posts error:', e);
            document.getElementById('linkedin-posts-grid').innerHTML =
                '<p style="color:#f38ba8; text-align:center; padding:40px; grid-column:1/-1;">Erreur chargement posts</p>';
        }
    }

    _renderStats() {
        const el = document.getElementById('linkedin-stats-row');
        if (!el || !this.stats) return;

        // Pick stats source: per_account if filtering, otherwise global
        const acc = this.currentAccount;
        let total, byStatus;
        if (acc === 'all') {
            total = this.stats.total;
            byStatus = this.stats.by_status || {};
        } else {
            const accStats = this.stats.per_account?.[acc] || { total: 0, by_status: {} };
            total = accStats.total;
            byStatus = accStats.by_status || {};
        }

        const items = [
            { label: 'Total', value: total, color: '#cdd6f4' },
            { label: 'Draft', value: byStatus.draft || 0, color: STATUS_COLORS.draft },
            { label: 'Ready', value: byStatus.ready || 0, color: STATUS_COLORS.ready },
            { label: 'Review', value: byStatus.review || 0, color: STATUS_COLORS.review },
            { label: 'Published', value: byStatus.published || 0, color: STATUS_COLORS.published }
        ];
        el.innerHTML = items.map(i => `
            <div style="background: var(--card-bg, #1e1e2e); border: 1px solid var(--border-color, #313244); border-radius: 10px; padding: 14px 20px; min-width: 100px; text-align: center;">
                <div style="font-size: 1.6rem; font-weight: 700; color: ${i.color};">${i.value}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary, #a6adc8); margin-top: 2px;">${i.label}</div>
            </div>
        `).join('');

        this._renderTabCounts();
    }

    _renderTabCounts() {
        if (!this.stats) return;
        // Account tabs use total per account (across all stages)
        const counts = {
            all: this.stats.total || 0,
            ai: this.stats.per_account?.ai?.total || 0,
            'offshore-wind': this.stats.per_account?.['offshore-wind']?.total || 0,
        };
        document.querySelectorAll('.linkedin-tab').forEach(btn => {
            const acc = btn.dataset.account;
            const span = btn.querySelector('.tab-count');
            if (span) span.textContent = `(${counts[acc] ?? 0})`;
        });

        // Stage tabs: scoped to current account
        const acc = this.currentAccount;
        const byStage = (acc === 'all')
            ? (this.stats.by_stage || {})
            : (this.stats.per_account?.[acc]?.by_stage || {});
        document.querySelectorAll('.linkedin-stage-tab').forEach(btn => {
            const stage = btn.dataset.stage;
            const span = btn.querySelector('.stage-count');
            if (span) span.textContent = `(${byStage[stage] || 0})`;
        });
    }

    _setActiveTab(account) {
        this.currentAccount = account;
        document.querySelectorAll('.linkedin-tab').forEach(btn => {
            const isActive = btn.dataset.account === account;
            btn.style.color = isActive ? 'var(--text-primary, #cdd6f4)' : 'var(--text-secondary, #a6adc8)';
            btn.style.borderBottomColor = isActive ? 'var(--accent-primary, #89b4fa)' : 'transparent';
            btn.classList.toggle('active', isActive);
        });
        this._renderStats();
        this._applyFilters();
    }

    _setActiveStage(stage) {
        this.currentStage = stage;
        document.querySelectorAll('.linkedin-stage-tab').forEach(btn => {
            const isActive = btn.dataset.stage === stage;
            btn.style.color = isActive ? 'var(--text-primary, #cdd6f4)' : 'var(--text-secondary, #a6adc8)';
            btn.style.borderColor = isActive ? 'var(--accent-primary, #89b4fa)' : 'var(--border-color, #313244)';
            btn.classList.toggle('active', isActive);
        });
        this._applyFilters();
    }

    _renderPosts(posts) {
        const grid = document.getElementById('linkedin-posts-grid');
        if (!grid) return;

        if (!posts.length) {
            grid.innerHTML = '<p style="color:#a6adc8; text-align:center; padding:40px; grid-column:1/-1;">Aucun post trouve</p>';
            return;
        }

        grid.innerHTML = posts.map(p => this._renderCard(p)).join('');
    }

    _episodeNumber(p) {
        if (p.type !== 'episode') return null;
        const m = (p.id || '').match(/-ep(\d+)$/i);
        if (!m) return null;
        const n = parseInt(m[1], 10);
        return n === 0 ? 'TEASER' : `EP${String(n).padStart(2, '0')}`;
    }

    _renderCard(p) {
        const q = p.quality || {};
        const statusColor = STATUS_COLORS[p.review_status] || '#6c7086';
        const hook = (p.quality?.hook || p.body || '').substring(0, 120);
        const epNum = this._episodeNumber(p);
        const epBadge = epNum
            ? `<span style="background:#fab387; color:#1e1e2e; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:700;">${epNum}</span>`
            : '';
        const typeBadge = p.type === 'article'
            ? '<span style="background:#89b4fa22; color:#89b4fa; padding:2px 8px; border-radius:4px; font-size:0.7rem;">Article</span>'
            : `<span style="background:#cba6f722; color:#cba6f7; padding:2px 8px; border-radius:4px; font-size:0.7rem;">${p.serie || 'Episode'}</span>`;

        const dateLabel = this._formatDateLabel(p);
        const placeholderLabel = epNum || (p.type === 'article' ? 'ARTICLE' : '—');
        const thumbnail = p.has_image
            ? `<div style="position: relative; margin-bottom: 10px;">
                 <img src="/api/linkedin/posts/${encodeURIComponent(p.id)}/image" alt="" style="width: 100%; height: 140px; object-fit: cover; border-radius: 6px; background: #11111b; display: block;" onerror="this.style.display='none'" />
                 <a href="/api/linkedin/posts/${encodeURIComponent(p.id)}/image" download="${encodeURIComponent(p.id)}.png" title="Telecharger l'image"
                    onclick="event.stopPropagation();"
                    style="position: absolute; top: 8px; right: 8px; background: rgba(30,30,46,0.85); color: #cdd6f4; padding: 4px 8px; border-radius: 5px; text-decoration: none; font-size: 0.7rem; font-weight: 600; border: 1px solid #45475a;">
                   ⬇
                 </a>
               </div>`
            : `<div style="width: 100%; height: 140px; border-radius: 6px; margin-bottom: 10px; background: #000; display: flex; align-items: center; justify-content: center; color: #a6e3a1; font-size: 3rem; font-weight: 900; letter-spacing: 4px; text-shadow: 0 0 14px #a6e3a166; font-family: 'Courier New', monospace;">${placeholderLabel}</div>`;

        return `
        <div class="linkedin-card" data-id="${p.id}" style="background: var(--card-bg, #1e1e2e); border: 1px solid var(--border-color, #313244); border-radius: 10px; padding: 18px; cursor: pointer; transition: border-color 0.2s;">
            ${thumbnail}
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                    ${epBadge}
                    ${typeBadge}
                    <span style="background: ${statusColor}22; color: ${statusColor}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${p.review_status}</span>
                    ${dateLabel}
                </div>
                <span style="font-size: 0.7rem; color: var(--text-secondary, #a6adc8);">${q.word_count || 0} mots</span>
            </div>
            <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: var(--text-primary, #cdd6f4); line-height: 1.3;">${this._escapeHtml(p.title || p.id)}</h4>
            <p style="margin: 0 0 10px 0; font-size: 0.8rem; color: var(--text-secondary, #a6adc8); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${this._escapeHtml(hook)}...</p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${this._qualityBadge('Chars', q.char_count, q.char_status)}
                ${this._qualityBadge('Hashtags', q.hashtag_count, q.hashtag_status)}
                ${this._qualityBadge('Emojis', q.emoji_count, q.emoji_status)}
                ${q.has_cta ? '<span style="background:#a6e3a122; color:#a6e3a1; padding:2px 6px; border-radius:4px; font-size:0.65rem;">CTA</span>' : ''}
            </div>
        </div>`;
    }

    _formatDateLabel(p) {
        // Priority: published_at > scheduled_at
        if (p.published_at) {
            const d = this._formatDate(p.published_at);
            return `<span style="background:#89b4fa22; color:#89b4fa; padding:2px 8px; border-radius:4px; font-size:0.7rem;">📅 Envoye ${d}</span>`;
        }
        if (p.scheduled_at) {
            const d = this._formatDate(p.scheduled_at);
            return `<span style="background:#f9e2af22; color:#f9e2af; padding:2px 8px; border-radius:4px; font-size:0.7rem;">⏰ Prevu ${d}</span>`;
        }
        return '';
    }

    _formatDate(iso) {
        if (!iso) return '';
        // Accept "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"
        const datePart = iso.substring(0, 10);
        const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return iso;
        return `${m[3]}/${m[2]}/${m[1]}`;
    }

    _toDateInputValue(iso) {
        if (!iso) return '';
        return iso.substring(0, 10);
    }

    _qualityBadge(label, value, status) {
        const color = QUALITY_COLORS[status] || '#6c7086';
        return `<span style="background:${color}22; color:${color}; padding:2px 6px; border-radius:4px; font-size:0.65rem;">${label}: ${value ?? '-'}</span>`;
    }

    _populateSerieFilter() {
        const sel = document.getElementById('linkedin-filter-serie');
        if (!sel) return;
        const series = [...new Set(this.posts.filter(p => p.serie).map(p => p.serie))].sort();
        const current = sel.value;
        sel.innerHTML = '<option value="">Toutes les series</option>' +
            series.map(s => `<option value="${s}">${s}</option>`).join('');
        sel.value = current;
    }

    _applyFilters() {
        const type = document.getElementById('linkedin-filter-type')?.value || '';
        const status = document.getElementById('linkedin-filter-status')?.value || '';
        const serie = document.getElementById('linkedin-filter-serie')?.value || '';

        let filtered = this.posts;
        if (this.currentAccount !== 'all') filtered = filtered.filter(p => p.account === this.currentAccount);
        filtered = filtered.filter(p => (p.stage || 'idea') === this.currentStage);
        if (type) filtered = filtered.filter(p => p.type === type);
        if (status) filtered = filtered.filter(p => p.review_status === status);
        if (serie) filtered = filtered.filter(p => p.serie === serie);

        // Sort: by serie then episode number (ep00 first), articles after
        filtered = [...filtered].sort((a, b) => {
            const sA = a.serie || 'zzz';
            const sB = b.serie || 'zzz';
            if (sA !== sB) return sA.localeCompare(sB);
            const nA = parseInt((a.id.match(/-ep(\d+)$/i) || [0, 9999])[1], 10);
            const nB = parseInt((b.id.match(/-ep(\d+)$/i) || [0, 9999])[1], 10);
            if (nA !== nB) return nA - nB;
            return a.id.localeCompare(b.id);
        });

        this._renderPosts(filtered);
    }

    _bindEvents() {
        document.querySelectorAll('.linkedin-tab').forEach(btn => {
            btn.addEventListener('click', () => this._setActiveTab(btn.dataset.account));
        });

        document.querySelectorAll('.linkedin-stage-tab').forEach(btn => {
            btn.addEventListener('click', () => this._setActiveStage(btn.dataset.stage));
        });

        ['linkedin-filter-type', 'linkedin-filter-status', 'linkedin-filter-serie'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this._applyFilters());
        });

        document.getElementById('linkedin-btn-sync')?.addEventListener('click', async () => {
            const btn = document.getElementById('linkedin-btn-sync');
            btn.textContent = 'Syncing...';
            btn.disabled = true;
            try {
                await API.linkedin.sync();
                await this.load();
            } finally {
                btn.textContent = 'Sync';
                btn.disabled = false;
            }
        });

        document.getElementById('linkedin-posts-grid')?.addEventListener('click', (e) => {
            const card = e.target.closest('.linkedin-card');
            if (card) this._openDetail(card.dataset.id);
        });

        document.getElementById('linkedin-modal-close')?.addEventListener('click', () => this._closeModal());
        document.getElementById('linkedin-modal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this._closeModal();
        });
    }

    async _openDetail(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        const q = post.quality || {};
        const hookEnd = 210;
        const body = post.body || '';
        const hookPart = this._escapeHtml(body.substring(0, hookEnd));
        const restPart = this._escapeHtml(body.substring(hookEnd));

        const stage = post.stage || 'idea';
        const stageLabel = stage === 'idea' ? '💡 Idee' : '⚡ En cours';
        const stageToggleLabel = stage === 'idea' ? '⚡ Passer en cours' : '💡 Repasser en idee';
        const stageToggleTarget = stage === 'idea' ? 'in_progress' : 'idea';
        const imageBlock = post.has_image
            ? `<div style="margin-bottom: 16px; text-align: center; background: #11111b; border-radius: 8px; padding: 8px; position: relative;">
                 <img src="/api/linkedin/posts/${encodeURIComponent(post.id)}/image" alt="${this._escapeHtml(post.title)}" style="max-width: 100%; max-height: 320px; border-radius: 6px;" onerror="this.parentElement.style.display='none'" />
                 <a href="/api/linkedin/posts/${encodeURIComponent(post.id)}/image" download="${encodeURIComponent(post.id)}.png" title="Telecharger l'image"
                    style="position: absolute; top: 14px; right: 14px; background: rgba(30,30,46,0.85); color: #cdd6f4; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.8rem; font-weight: 600; border: 1px solid #45475a; backdrop-filter: blur(4px);">
                   ⬇ Download
                 </a>
               </div>`
            : '';

        const epNum = this._episodeNumber(post);
        const epBadgeBig = epNum
            ? `<span style="background:#fab387; color:#1e1e2e; padding:4px 12px; border-radius:6px; font-size:0.8rem; font-weight:700;">${epNum}</span>`
            : '';

        const content = document.getElementById('linkedin-modal-content');
        content.innerHTML = `
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;">
                ${epBadgeBig}
                <span style="background: ${STATUS_COLORS[post.review_status] || '#6c7086'}33; color: ${STATUS_COLORS[post.review_status] || '#6c7086'}; padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">${post.review_status}</span>
                <span style="background: #f9e2af22; color: #f9e2af; padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">${stageLabel}</span>
                <span style="font-size: 0.8rem; color: var(--text-secondary, #a6adc8);">${post.type} ${post.serie ? '/ ' + post.serie : ''} ${post.account ? '/ ' + post.account : ''}</span>
            </div>
            ${imageBlock}
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary, #cdd6f4);">${this._escapeHtml(post.title || post.id)}</h3>

            <!-- Quality indicators -->
            <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;">
                ${this._qualityBadge('Caracteres', q.char_count, q.char_status)}
                ${this._qualityBadge('Mots', q.word_count, 'good')}
                ${this._qualityBadge('Hashtags', q.hashtag_count, q.hashtag_status)}
                ${this._qualityBadge('Emojis', q.emoji_count, q.emoji_status)}
                ${q.has_cta ? '<span style="background:#a6e3a122; color:#a6e3a1; padding:4px 10px; border-radius:6px; font-size:0.75rem;">CTA detecte</span>' : '<span style="background:#f38ba822; color:#f38ba8; padding:4px 10px; border-radius:6px; font-size:0.75rem;">Pas de CTA</span>'}
            </div>

            <!-- Post body with hook highlight -->
            <div style="background: var(--bg-primary, #11111b); border-radius: 8px; padding: 16px; margin-bottom: 16px; max-height: 400px; overflow-y: auto; font-size: 0.85rem; line-height: 1.6; white-space: pre-wrap; color: var(--text-primary, #cdd6f4);">
                <span style="background: #f9e2af22; border-left: 3px solid #f9e2af; padding-left: 8px;">${hookPart}</span>${restPart}
            </div>

            <!-- Review form -->
            <div style="border-top: 1px solid var(--border-color, #313244); padding-top: 16px;">
                <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <label style="font-size: 0.85rem; color: var(--text-secondary, #a6adc8);">Statut :</label>
                    <select id="linkedin-review-status" style="background: var(--bg-primary, #11111b); color: var(--text-primary, #cdd6f4); border: 1px solid var(--border-color, #313244); border-radius: 6px; padding: 6px 10px; font-size: 0.85rem;">
                        ${['draft', 'ready', 'review', 'published', 'archived'].map(s =>
                            `<option value="${s}" ${s === post.review_status ? 'selected' : ''}>${s}</option>`
                        ).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 0.8rem; color: var(--text-secondary, #a6adc8); margin-bottom: 4px;">⏰ Date prevue d'envoi</label>
                        <input type="date" id="linkedin-review-scheduled" value="${this._toDateInputValue(post.scheduled_at)}" style="width: 100%; background: var(--bg-primary, #11111b); color: var(--text-primary, #cdd6f4); border: 1px solid var(--border-color, #313244); border-radius: 6px; padding: 6px 10px; font-size: 0.85rem; box-sizing: border-box;" />
                    </div>
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 0.8rem; color: var(--text-secondary, #a6adc8); margin-bottom: 4px;">📅 Date d'envoi (publication)</label>
                        <input type="date" id="linkedin-review-published" value="${this._toDateInputValue(post.published_at)}" style="width: 100%; background: var(--bg-primary, #11111b); color: var(--text-primary, #cdd6f4); border: 1px solid var(--border-color, #313244); border-radius: 6px; padding: 6px 10px; font-size: 0.85rem; box-sizing: border-box;" />
                    </div>
                </div>
                <textarea id="linkedin-review-notes" rows="3" placeholder="Notes de review..." style="width: 100%; background: var(--bg-primary, #11111b); color: var(--text-primary, #cdd6f4); border: 1px solid var(--border-color, #313244); border-radius: 6px; padding: 10px; font-size: 0.85rem; resize: vertical; box-sizing: border-box;">${this._escapeHtml(post.review_notes || '')}</textarea>
                <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                    <button id="linkedin-toggle-stage" data-id="${post.id}" data-target="${stageToggleTarget}" style="background: transparent; color: var(--text-primary, #cdd6f4); border: 1px solid var(--border-color, #313244); border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 0.85rem;">${stageToggleLabel}</button>
                    <button id="linkedin-save-review" data-id="${post.id}" style="background: var(--accent-primary, #89b4fa); color: #1e1e2e; border: none; border-radius: 8px; padding: 8px 20px; cursor: pointer; font-weight: 600; font-size: 0.85rem;">Sauvegarder</button>
                </div>
            </div>
        `;

        document.getElementById('linkedin-save-review')?.addEventListener('click', () => this._saveReview(post.id));
        document.getElementById('linkedin-toggle-stage')?.addEventListener('click', (e) => this._toggleStage(post.id, e.currentTarget.dataset.target));
        document.getElementById('linkedin-modal').style.display = 'block';
    }

    async _toggleStage(postId, targetStage) {
        const btn = document.getElementById('linkedin-toggle-stage');
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = '...';
        try {
            await API.linkedin.updateReview(postId, { stage: targetStage });
            this._closeModal();
            await this.load();
        } catch (e) {
            console.error('Toggle stage error:', e);
            btn.textContent = original;
            btn.disabled = false;
        }
    }

    async _saveReview(postId) {
        const status = document.getElementById('linkedin-review-status')?.value;
        const notes = document.getElementById('linkedin-review-notes')?.value;
        const scheduled_at = document.getElementById('linkedin-review-scheduled')?.value || '';
        const published_at = document.getElementById('linkedin-review-published')?.value || '';
        const btn = document.getElementById('linkedin-save-review');

        btn.textContent = 'Saving...';
        btn.disabled = true;
        try {
            await API.linkedin.updateReview(postId, { status, notes, scheduled_at, published_at });
            this._closeModal();
            await this.load();
        } catch (e) {
            console.error('Save review error:', e);
            btn.textContent = 'Erreur!';
            setTimeout(() => { btn.textContent = 'Sauvegarder'; btn.disabled = false; }, 2000);
        }
    }

    _closeModal() {
        document.getElementById('linkedin-modal').style.display = 'none';
    }

    _escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

const linkedinPostsModule = new LinkedInPostsModule();
window.LinkedInPostsModule = linkedinPostsModule;
export default linkedinPostsModule;
