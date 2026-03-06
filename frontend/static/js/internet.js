/**
 * Internet Module - Favoris Web (Dynamic from API)
 */

import API from './api.js';

// Category icons mapping
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
    }

    async load() {
        if (this.loaded) {
            console.log('Internet already loaded, skipping');
            return;
        }
        console.log('Internet module loading...');

        try {
            const response = await API.internet.getLinks();
            if (response.status === 'ok') {
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

    render(categories) {
        const container = document.getElementById('internet-container');
        if (!container) return;

        let html = '';

        for (const cat of categories) {
            if (cat.links.length === 0) continue;

            const icon = CATEGORY_ICONS[cat.slug] || '';

            html += `
            <div class="category ${cat.slug}" data-category="${cat.slug}" style="margin-bottom: 40px;">
                <h2 style="font-size: 1.5rem; margin-bottom: 20px; color: var(--text-primary, #f8fafc); display: flex; align-items: center; gap: 12px;">
                    <span class="icon">${icon}</span> ${cat.name}
                </h2>
                <div class="sites-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">`;

            for (const link of cat.links) {
                const domain = this.extractDomain(link.url);
                const faviconDomain = domain.includes('/') ? domain.split('/')[0] : domain;

                html += `
                    <a href="${this.escapeHtml(link.url)}" class="site-card" target="_blank">
                        <div class="site-preview">
                            <div class="site-favicon">
                                <img src="https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=64"
                                     alt="${this.escapeHtml(link.favicon_alt || link.name.substring(0, 2).toUpperCase())}"
                                     onerror="this.style.display='none'; this.parentNode.innerHTML='${this.escapeHtml(link.favicon_alt || link.name.substring(0, 2).toUpperCase())}';">
                            </div>
                        </div>
                        <div class="site-info">
                            <div class="site-name">${this.escapeHtml(link.name)}</div>
                            <div class="site-url">${this.escapeHtml(domain)}</div>
                        </div>
                    </a>`;
            }

            html += `
                </div>
            </div>`;
        }

        container.innerHTML = html;
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
        const siteCards = document.querySelectorAll('.site-card');
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
