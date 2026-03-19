/**
 * Internet Module - Favoris Web (Dynamic from API)
 * Edit mode: click card to delete, + card to add
 */

import API from './api.js';

const CATEGORY_ICONS = {
    'frequent-sites': '\u{1F550}',
    'crypto': '\u20BF',
    'news': '\u{1F4F0}',
    'ai': '\u{1F916}',
    'tools': '\u{1F6E0}\uFE0F',
    'search': '\u{1F50D}',
    'banks': '\u{1F3E6}',
    'weather': '\u{1F4C6}',
    'social': '\u{1F465}',
    'music': '\u{1F3B5}',
    'real-estate': '\u{1F3E0}',
    'admin': '\u{1F4CB}',
    'business': '\u{1F3E2}',
    'car': '\u{1F697}',
    'leisure': '\u{1F3AF}',
    'wind-energy': '\u{1F300}'
};

class InternetModule {
    constructor() {
        this.loaded = false;
        this.data = null;
        this.editMode = false;
        this._deleting = false;
    }

    async load() {
        if (this.loaded) {
            console.log('Internet already loaded, skipping');
            return;
        }
        console.log('Internet module loading...');

        try {
            const response = await API.internet.getLinks();
            if (response.ok) {
                this.data = response.categories;
                this.render(response.categories);
                this.loaded = true;
                console.log(`Internet: ${response.total_links} links in ${response.categories.length} categories`);
            }
        } catch (error) {
            console.error('Failed to load internet links:', error);
            document.getElementById('internet-container').innerHTML =
                '<div style="text-align:center;padding:40px;color:#ef4444;">Erreur de chargement des liens</div>';
        }
    }

    toggleEditMode() {
        this.editMode = !this.editMode;
        const container = document.getElementById('internet-container');
        if (!container) return;

        container.classList.toggle('edit-mode', this.editMode);

        const btn = document.getElementById('edit-mode-btn');
        if (btn) {
            btn.textContent = this.editMode ? 'Terminer' : 'Editer';
            btn.classList.toggle('active', this.editMode);
        }

        const banner = document.getElementById('edit-mode-banner');
        if (banner) {
            banner.style.display = this.editMode ? 'flex' : 'none';
        }
    }

    render(categories) {
        const container = document.getElementById('internet-container');
        if (!container) return;

        let html = `
        <div class="internet-toolbar">
            <button id="edit-mode-btn" class="edit-mode-btn">Editer</button>
        </div>
        <div id="edit-mode-banner" class="edit-mode-banner" style="display:none;">
            Mode Edition — Cliquez sur un lien pour le supprimer, + pour ajouter
        </div>`;

        for (const cat of categories) {
            if (cat.links.length === 0 && !this.editMode) continue;
            html += this._renderCategory(cat);
        }

        container.innerHTML = html;
        this.bindEvents(container);
    }

    _renderCategory(cat) {
        const icon = CATEGORY_ICONS[cat.slug] || '';
        let html = `
        <div class="category ${cat.slug}" data-category="${cat.slug}" style="margin-bottom: 40px;">
            <h2 style="font-size: 1.5rem; margin-bottom: 20px; color: var(--text-primary, #f8fafc); display: flex; align-items: center; gap: 12px;">
                <span class="icon">${icon}</span> ${this.escapeHtml(cat.name)}
            </h2>
            <div class="sites-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">`;

        for (const link of cat.links) {
            html += this._renderLinkCard(link);
        }

        html += `
                <div class="site-card add-link-card" data-category-slug="${this.escapeHtml(cat.slug)}">
                    <div class="add-link-content">
                        <span class="add-link-icon">+</span>
                        <span class="add-link-text">Ajouter</span>
                    </div>
                </div>
            </div>
        </div>`;
        return html;
    }

    _renderLinkCard(link) {
        const domain = this.extractDomain(link.url);
        const faviconDomain = domain.includes('/') ? domain.split('/')[0] : domain;
        const fallback = this.escapeHtml(link.favicon_alt || link.name.substring(0, 2).toUpperCase());
        return `
            <a href="${this.escapeHtml(link.url)}" class="site-card" target="_blank"
               data-link-id="${link.id}" data-link-name="${this.escapeHtml(link.name)}">
                <div class="site-preview">
                    <div class="site-favicon">
                        <img src="https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=64"
                             alt="${fallback}"
                             onerror="this.style.display='none'; this.parentNode.textContent='${fallback}';">
                    </div>
                </div>
                <div class="site-info">
                    <div class="site-name">${this.escapeHtml(link.name)}</div>
                    <div class="site-url">${this.escapeHtml(domain)}</div>
                </div>
            </a>`;
    }

    bindEvents(container) {
        document.getElementById('edit-mode-btn')?.addEventListener('click', () => this.toggleEditMode());

        container.addEventListener('click', (e) => {
            // Add card
            const addCard = e.target.closest('.add-link-card');
            if (addCard && this.editMode) {
                e.preventDefault();
                this.showAddModal(addCard.dataset.categorySlug);
                return;
            }

            // Site card: in edit mode, intercept click for deletion
            const siteCard = e.target.closest('.site-card:not(.add-link-card)');
            if (siteCard && this.editMode) {
                e.preventDefault();
                const id = parseInt(siteCard.dataset.linkId);
                const name = siteCard.dataset.linkName;
                this.deleteLink(id, name, siteCard);
            }
        });
    }

    async deleteLink(id, name, card) {
        if (this._deleting) return;
        if (!confirm(`Supprimer "${name}" ?`)) return;

        this._deleting = true;

        try {
            const resp = await API.internet.deleteLink(id);
            if (resp.ok) {
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.8)';
                setTimeout(() => card.remove(), 300);
                for (const cat of this.data) {
                    cat.links = cat.links.filter(l => l.id !== id);
                }
            } else {
                alert(resp.error || 'Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Erreur lors de la suppression');
        } finally {
            this._deleting = false;
        }
    }

    showAddModal(categorySlug) {
        const existing = document.getElementById('add-link-modal');
        if (existing) existing.remove();

        const catName = this.data.find(c => c.slug === categorySlug)?.name || categorySlug;
        const modal = document.createElement('div');
        modal.id = 'add-link-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = this._buildAddModalHtml(catName, categorySlug);

        document.body.appendChild(modal);
        this._bindAddModalEvents(modal);
    }

    _buildAddModalHtml(catName, categorySlug) {
        const options = this.data.map(c =>
            `<option value="${this.escapeHtml(c.slug)}" ${c.slug === categorySlug ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`
        ).join('');

        return `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Ajouter un lien dans "${this.escapeHtml(catName)}"</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <form id="add-link-form" class="modal-form">
                    <div class="form-group">
                        <label for="link-name">Nom</label>
                        <input type="text" id="link-name" placeholder="Ex: GitHub" required autofocus>
                    </div>
                    <div class="form-group">
                        <label for="link-url">URL</label>
                        <input type="url" id="link-url" placeholder="https://github.com" required>
                    </div>
                    <div class="form-group">
                        <label for="link-category">Categorie</label>
                        <select id="link-category">${options}</select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-cancel">Annuler</button>
                        <button type="submit" class="btn-save">Ajouter</button>
                    </div>
                </form>
            </div>`;
    }

    _bindAddModalEvents(modal) {
        const removeModal = () => {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        };
        const handleEscape = (e) => { if (e.key === 'Escape') removeModal(); };

        document.addEventListener('keydown', handleEscape);
        modal.addEventListener('click', (e) => { if (e.target === modal) removeModal(); });
        modal.querySelector('.modal-close').addEventListener('click', removeModal);
        modal.querySelector('.btn-cancel').addEventListener('click', removeModal);

        document.getElementById('add-link-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addLink(removeModal);
        });
    }

    async addLink(removeModal) {
        const name = document.getElementById('link-name').value.trim();
        const url = document.getElementById('link-url').value.trim();
        const category = document.getElementById('link-category').value;

        if (!name || !url) return;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            alert('URL invalide : doit commencer par http:// ou https://');
            return;
        }

        const saveBtn = document.querySelector('#add-link-form .btn-save');
        saveBtn.textContent = '...';
        saveBtn.disabled = true;

        try {
            const resp = await API.internet.createLink({ name, url, category });
            if (resp.ok) {
                removeModal();
                this.loaded = false;
                this.editMode = false;
                await this.load();
                this.toggleEditMode();
            } else {
                alert(resp.error?.message || 'Erreur lors de la creation');
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

    extractDomain(url) {
        try {
            const u = new URL(url);
            let host = u.hostname;
            if (host.startsWith('www.')) host = host.substring(4);
            return host;
        } catch {
            return url;
        }
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    filterSites(searchTerm) {
        const siteCards = document.querySelectorAll('.site-card:not(.add-link-card)');
        const term = searchTerm.toLowerCase();

        siteCards.forEach(card => {
            const siteName = card.querySelector('.site-name')?.textContent.toLowerCase() || '';
            const siteUrl = card.querySelector('.site-url')?.textContent.toLowerCase() || '';

            if (siteName.includes(term) || siteUrl.includes(term)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    toggleCategory(categoryName) {
        const category = document.querySelector(`[data-category="${categoryName}"]`);
        if (category) {
            const grid = category.querySelector('.sites-grid');
            if (grid.style.display === 'none') {
                grid.style.display = 'grid';
            } else {
                grid.style.display = 'none';
            }
        }
    }
}

export default new InternetModule();
