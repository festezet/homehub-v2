/**
 * Dynamic Pages Module - Load and display on-the-fly HTML pages created by Claude
 */

import API from './api.js';

const dynamicPages = {
    pages: {},

    /**
     * Initialize: fetch active pages and inject sidebar tabs
     */
    async init() {
        try {
            const response = await API.dynamicPages.list();
            if (response.ok && response.pages) {
                response.pages.forEach(page => this.injectSidebarTab(page));
            }
        } catch (err) {
            console.warn('Dynamic pages: could not load pages', err);
        }
    },

    /**
     * Inject a tab into the sidebar for a dynamic page
     */
    injectSidebarTab(page) {
        const navMenu = document.getElementById('nav-menu');
        if (!navMenu) return;

        // Find existing section: first by data-section-name (dynamic), then by title text (DB-driven)
        let section = navMenu.querySelector(`.nav-section[data-section-name="${page.section}"]`);
        if (!section) {
            // Search DB-driven sections by their title text
            navMenu.querySelectorAll('.nav-section[data-section-id]').forEach(s => {
                const titleEl = s.querySelector('.nav-section-title');
                if (titleEl && titleEl.textContent.trim() === page.section) {
                    section = s;
                }
            });
        }
        if (!section) {
            section = document.createElement('div');
            section.className = 'nav-section';
            section.dataset.sectionName = page.section;
            const title = document.createElement('div');
            title.className = 'nav-section-title';
            title.textContent = page.section;
            section.appendChild(title);
            navMenu.appendChild(section);
        }

        // Don't duplicate
        if (section.querySelector(`[data-page="${page.id}"]`)) return;

        const li = document.createElement('li');
        li.className = 'nav-item dp-item';
        li.dataset.page = page.id;
        const safeTitle = page.title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
        li.innerHTML = `
            <a href="#${page.id}" title="${safeTitle}">
                <span class="icon">${page.icon || '📄'}</span>
                <span class="label">${page.title}</span>
            </a>
        `;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            window.switchPage(page.id);
        });
        section.appendChild(li);

        // Register in pageTitles
        if (window._pageTitles) {
            window._pageTitles[page.id] = {
                title: page.title,
                subtitle: page.subtitle || ''
            };
        }
    },

    /**
     * Load and display a dynamic page content
     */
    async loadPage(pageId) {
        const container = document.getElementById('dynamic-page-container');
        if (!container) return;

        container.innerHTML = '<div class="dp-loading">Chargement...</div>';

        try {
            const response = await API.dynamicPages.get(pageId);
            if (!response.ok || !response.page) {
                container.innerHTML = '<div class="dp-error">Page non trouvée</div>';
                return;
            }

            const page = response.page;
            this.pages[pageId] = page;

            // Update title bar
            document.getElementById('page-title-text').textContent = page.title;
            document.getElementById('page-subtitle').textContent = page.subtitle || '';

            // Render content + toolbar
            let html = `<div class="dp-content">${page.html_content}</div>`;
            html += `<div class="dp-toolbar">`;
            html += `<span class="dp-created">Créée le ${new Date(page.created_at).toLocaleString('fr-FR')}</span>`;
            html += `<div class="dp-toolbar-actions">`;
            if (!page.pinned) {
                html += `<button class="dp-keep-btn" data-page-id="${pageId}">📌 Garder</button>`;
            } else {
                html += `<span class="dp-badge dp-badge-pinned">📌 Gardée</span>`;
            }
            html += `<button class="dp-delete-btn" data-page-id="${pageId}">🗑️ Supprimer</button>`;
            html += `</div>`;
            html += `</div>`;

            container.innerHTML = html;

            // Bind keep button
            container.querySelector('.dp-keep-btn')?.addEventListener('click', () => {
                this.keepPage(pageId);
            });

            // Bind delete button
            container.querySelector('.dp-delete-btn')?.addEventListener('click', () => {
                this.deletePage(pageId);
            });

            // Apply custom CSS
            let styleEl = document.getElementById(`dp-style-${pageId}`);
            if (styleEl) styleEl.remove();
            if (page.css_content) {
                styleEl = document.createElement('style');
                styleEl.id = `dp-style-${pageId}`;
                styleEl.textContent = page.css_content;
                document.head.appendChild(styleEl);
            }

        } catch (err) {
            console.error('Error loading dynamic page:', err);
            container.innerHTML = '<div class="dp-error">Erreur de chargement</div>';
        }
    },

    /**
     * Pin a dynamic page (keep permanently)
     */
    async keepPage(pageId) {
        try {
            await API.dynamicPages.pin(pageId);
            // Reload to refresh toolbar
            this.loadPage(pageId);
        } catch (err) {
            console.error('Error pinning dynamic page:', err);
        }
    },

    /**
     * Delete a dynamic page
     */
    async deletePage(pageId) {
        if (!confirm('Supprimer cette page ?')) return;

        try {
            await API.dynamicPages.delete(pageId);

            // Remove sidebar tab
            const tab = document.querySelector(`.nav-item[data-page="${pageId}"]`);
            if (tab) tab.remove();

            // Remove from pageTitles
            if (window._pageTitles) {
                delete window._pageTitles[pageId];
            }

            // Remove style tag
            const styleEl = document.getElementById(`dp-style-${pageId}`);
            if (styleEl) styleEl.remove();

            // Navigate to internet
            window.switchPage('internet');
        } catch (err) {
            console.error('Error deleting dynamic page:', err);
        }
    }
};

window.dynamicPages = dynamicPages;

document.addEventListener('DOMContentLoaded', () => {
    dynamicPages.init();
});

export default dynamicPages;
