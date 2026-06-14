/**
 * Session Bookmarks Module
 * Save and restore Claude session context
 */

import API from './api.js';

const STATUS_CONFIG = {
    pending: { icon: '\u{1F4D1}', label: 'Pending', badgeClass: 'sb-badge-pending' },
    resumed: { icon: '\u{2705}', label: 'Resumed', badgeClass: 'sb-badge-resumed' },
    archived: { icon: '\u{1F4E6}', label: 'Archived', badgeClass: 'sb-badge-archived' }
};

class SessionBookmarksModule {
    constructor() {
        this.bookmarks = [];
        this.loaded = false;
    }

    async load() {
        await Promise.all([
            this._loadBookmarks(),
            this._loadStats()
        ]);
        this._bindEvents();
        this.loaded = true;
    }

    // ---- Data loading ----

    async _loadBookmarks() {
        try {
            const status = document.getElementById('sb-filter-status')?.value || '';
            const project_id = document.getElementById('sb-filter-project')?.value.trim() || '';
            const params = {};
            if (status) params.status = status;
            if (project_id) params.project_id = project_id;
            const res = await API.sessionBookmarks.list(params);
            this.bookmarks = res.bookmarks || [];
            this._renderBookmarks();
        } catch (e) {
            console.error('Session bookmarks load error:', e);
            const container = document.getElementById('sb-bookmarks-container');
            if (container) container.innerHTML = '<p style="color:#f38ba8; text-align:center; padding:40px;">Erreur chargement</p>';
        }
    }

    async _loadStats() {
        try {
            const res = await API.sessionBookmarks.stats();
            const s = res.stats || {};
            this._setText('sb-stat-pending', s.pending || 0);
            this._setText('sb-stat-resumed', s.resumed || 0);
            this._setText('sb-stat-archived', s.archived || 0);
            this._setText('sb-stat-total', s.total || 0);
        } catch (e) {
            console.error('Session bookmarks stats error:', e);
        }
    }

    // ---- Rendering ----

    _renderBookmarks() {
        const container = document.getElementById('sb-bookmarks-container');
        if (!container) return;

        if (!this.bookmarks.length) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#888;">Aucun bookmark trouve</p>';
            return;
        }

        container.innerHTML = this.bookmarks.map(b => this._renderCard(b)).join('');
    }

    _renderCard(b) {
        const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
        const files = Array.isArray(b.files_to_read) ? b.files_to_read : [];

        const filesHtml = files.length ? `
            <div class="sb-files">
                ${files.map(f => `<span class="sb-file-chip" title="${this._esc(f)}">${this._esc(this._shortPath(f))}</span>`).join('')}
            </div>
        ` : '';

        const projectBadge = b.project_id
            ? `<span class="sb-badge" style="background: rgba(203, 166, 247, 0.15); color: #cba6f7;">${this._esc(b.project_id)}</span>`
            : '';

        return `
        <div class="sb-card" data-id="${b.id}">
            <div class="sb-card-header">
                <div class="sb-card-icon">${cfg.icon}</div>
                <div class="sb-card-subject">${this._esc(b.subject)}</div>
                <span class="sb-badge ${cfg.badgeClass}">${cfg.label}</span>
                ${projectBadge}
                <span class="sb-card-id">#${b.id}</span>
            </div>
            <div style="display:flex; gap:12px; font-size:0.8rem; opacity:0.6;">
                <span>${b.date}</span>
                ${b.session_id ? `<span style="font-family:monospace;">sid:${this._esc(b.session_id.substring(0, 8))}...</span>` : ''}
            </div>
            ${filesHtml}
            <div class="sb-expanded">
                ${b.notes ? `<div class="sb-notes">${this._esc(b.notes)}</div>` : ''}
                <div class="sb-meta">Cree le ${b.created_at || '-'}</div>
                <div class="sb-actions">
                    <button class="btn btn-sm" onclick="window.SessionBookmarksModule.editBookmark(${b.id})">Modifier</button>
                    ${b.status === 'pending' ? `<button class="btn btn-sm btn-primary" onclick="window.SessionBookmarksModule.markResumed(${b.id})">Marquer Resumed</button>` : ''}
                    ${b.status !== 'archived' ? `<button class="btn btn-sm" onclick="window.SessionBookmarksModule.archiveBookmark(${b.id})">Archiver</button>` : ''}
                    <button class="btn btn-sm" style="color:#f38ba8" onclick="window.SessionBookmarksModule.deleteBookmark(${b.id})">Supprimer</button>
                </div>
            </div>
        </div>`;
    }

    // ---- Events ----

    _bindEvents() {
        document.getElementById('sb-filter-status')?.addEventListener('change', () => this._loadBookmarks());

        let projectTimer;
        document.getElementById('sb-filter-project')?.addEventListener('input', () => {
            clearTimeout(projectTimer);
            projectTimer = setTimeout(() => this._loadBookmarks(), 400);
        });

        document.getElementById('sb-bookmarks-container')?.addEventListener('click', (e) => {
            const card = e.target.closest('.sb-card');
            if (card && !e.target.closest('button') && !e.target.closest('input')) {
                card.classList.toggle('expanded');
            }
        });
    }

    // ---- CRUD actions ----

    showCreateModal() {
        document.getElementById('sb-edit-id').value = '';
        document.getElementById('sb-input-subject').value = '';
        document.getElementById('sb-input-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('sb-input-project').value = '';
        document.getElementById('sb-input-session-id').value = '';
        document.getElementById('sb-input-files').value = '';
        document.getElementById('sb-input-notes').value = '';
        document.getElementById('sb-input-status').value = 'pending';
        document.getElementById('sb-modal-title').textContent = 'Nouveau Session Bookmark';
        document.querySelector('#sb-modal .sb-modal-footer .btn-primary').textContent = 'Creer';
        document.getElementById('sb-modal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('sb-modal').style.display = 'none';
    }

    async submitBookmark() {
        const editId = document.getElementById('sb-edit-id').value;
        const subject = document.getElementById('sb-input-subject').value.trim();
        const date = document.getElementById('sb-input-date').value;
        const project_id = document.getElementById('sb-input-project').value.trim() || null;
        const session_id = document.getElementById('sb-input-session-id').value.trim() || null;
        const notes = document.getElementById('sb-input-notes').value.trim() || null;
        const status = document.getElementById('sb-input-status').value;

        const filesRaw = document.getElementById('sb-input-files').value.trim();
        const files_to_read = filesRaw ? filesRaw.split('\n').map(f => f.trim()).filter(Boolean) : null;

        if (!subject) return alert('Sujet requis');
        if (!date) return alert('Date requise');

        const data = { subject, date, status };
        if (project_id) data.project_id = project_id;
        if (session_id) data.session_id = session_id;
        if (notes) data.notes = notes;
        if (files_to_read) data.files_to_read = files_to_read;

        try {
            if (editId) {
                await API.sessionBookmarks.update(parseInt(editId), data);
            } else {
                await API.sessionBookmarks.create(data);
            }
            this.closeModal();
            await this._refresh();
        } catch (e) {
            console.error('Submit bookmark error:', e);
            alert('Erreur: ' + (e.message || 'inconnue'));
        }
    }

    async editBookmark(bookmarkId) {
        const b = this.bookmarks.find(x => x.id === bookmarkId);
        if (!b) return;

        this.showCreateModal();
        document.getElementById('sb-edit-id').value = bookmarkId;
        document.getElementById('sb-input-subject').value = b.subject;
        document.getElementById('sb-input-date').value = b.date;
        document.getElementById('sb-input-project').value = b.project_id || '';
        document.getElementById('sb-input-session-id').value = b.session_id || '';
        document.getElementById('sb-input-notes').value = b.notes || '';
        document.getElementById('sb-input-status').value = b.status || 'pending';

        const files = Array.isArray(b.files_to_read) ? b.files_to_read : [];
        document.getElementById('sb-input-files').value = files.join('\n');

        document.getElementById('sb-modal-title').textContent = `Modifier Bookmark #${bookmarkId}`;
        document.querySelector('#sb-modal .sb-modal-footer .btn-primary').textContent = 'Sauvegarder';
    }

    async markResumed(bookmarkId) {
        try {
            await API.sessionBookmarks.update(bookmarkId, { status: 'resumed' });
            await this._refresh();
        } catch (e) {
            console.error('Mark resumed error:', e);
        }
    }

    async archiveBookmark(bookmarkId) {
        try {
            await API.sessionBookmarks.update(bookmarkId, { status: 'archived' });
            await this._refresh();
        } catch (e) {
            console.error('Archive error:', e);
        }
    }

    async deleteBookmark(bookmarkId) {
        if (!confirm(`Supprimer bookmark #${bookmarkId} ?`)) return;
        try {
            await API.sessionBookmarks.delete(bookmarkId);
            await this._refresh();
        } catch (e) {
            console.error('Delete error:', e);
        }
    }

    async _refresh() {
        await Promise.all([this._loadBookmarks(), this._loadStats()]);
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

    _shortPath(path) {
        if (!path) return '';
        const parts = path.split('/');
        if (parts.length > 4) {
            return '.../' + parts.slice(-3).join('/');
        }
        return path;
    }
}

const sessionBookmarksModule = new SessionBookmarksModule();
window.SessionBookmarksModule = sessionBookmarksModule;
export default sessionBookmarksModule;
