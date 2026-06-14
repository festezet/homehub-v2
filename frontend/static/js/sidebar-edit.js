/**
 * Sidebar Edit Mode - Reorder, rename, add and delete sections/tabs
 */

import API from './api.js';

const sidebarEdit = {
    editMode: false,

    init() {
        this.addEditButton();
    },

    addEditButton() {
        const footer = document.querySelector('.sidebar-footer');
        if (!footer) return;

        const btn = document.createElement('button');
        btn.id = 'sidebar-edit-btn';
        btn.className = 'sidebar-edit-btn';
        btn.textContent = '\u270f\ufe0f \u00c9diter';
        btn.addEventListener('click', () => this.toggleEditMode());
        footer.insertBefore(btn, footer.firstChild);
    },

    toggleEditMode() {
        this.editMode = !this.editMode;
        const sidebar = document.querySelector('.sidebar');
        const btn = document.getElementById('sidebar-edit-btn');

        if (this.editMode) {
            sidebar.classList.add('sidebar-edit-mode');
            btn.textContent = '\u2705 Termin\u00e9';
            this.addMoveButtons();
            this.addAddSectionButton();
        } else {
            sidebar.classList.remove('sidebar-edit-mode');
            btn.textContent = '\u270f\ufe0f \u00c9diter';
            this.removeMoveButtons();
            this.removeAddSectionButton();
        }
    },

    addMoveButtons() {
        // Section move + rename + delete buttons
        document.querySelectorAll('.nav-section[data-section-id]').forEach(section => {
            const titleEl = section.querySelector('.nav-section-title');
            if (!titleEl || titleEl.querySelector('.move-btns')) return;

            const sectionId = section.dataset.sectionId;

            // Make title clickable for rename
            const nameSpan = document.createElement('span');
            nameSpan.className = 'section-name-text';
            nameSpan.textContent = titleEl.textContent;
            nameSpan.title = 'Cliquer pour renommer';
            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startRenameSection(sectionId, nameSpan);
            });
            titleEl.textContent = '';
            titleEl.appendChild(nameSpan);

            const btns = document.createElement('span');
            btns.className = 'move-btns';
            btns.innerHTML = `
                <button class="move-btn" data-dir="up" title="Monter">\u25b2</button>
                <button class="move-btn" data-dir="down" title="Descendre">\u25bc</button>
                <button class="move-btn delete-btn" data-action="delete" title="Supprimer la section">\u2716</button>
            `;
            btns.querySelectorAll('.move-btn[data-dir]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.moveSection(sectionId, btn.dataset.dir);
                });
            });
            btns.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSection(sectionId, nameSpan.textContent);
            });
            titleEl.appendChild(btns);
        });

        // Tab move + delete buttons
        document.querySelectorAll('.nav-item[data-tab-id]').forEach(item => {
            if (item.querySelector('.move-btns')) return;
            if (item.classList.contains('dp-item')) return;

            const tabId = item.dataset.tabId;
            const btns = document.createElement('span');
            btns.className = 'move-btns tab-move-btns';
            btns.innerHTML = `
                <button class="move-btn" data-dir="up" title="Monter">\u25b2</button>
                <button class="move-btn" data-dir="down" title="Descendre">\u25bc</button>
                <button class="move-btn delete-btn tab-delete-btn" title="Retirer l'onglet">\u2716</button>
            `;
            btns.querySelectorAll('.move-btn[data-dir]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.moveTab(tabId, btn.dataset.dir);
                });
            });
            btns.querySelector('.tab-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.deleteTab(tabId, item.querySelector('.label')?.textContent || '');
            });
            item.appendChild(btns);
        });

        // Dynamic page tabs: delete button only (no move — order not stored)
        document.querySelectorAll('.nav-item.dp-item').forEach(item => {
            if (item.querySelector('.move-btns')) return;

            const pageId = item.dataset.page;
            const btns = document.createElement('span');
            btns.className = 'move-btns tab-move-btns';
            btns.innerHTML = `
                <button class="move-btn delete-btn tab-delete-btn" title="Supprimer la page">\u2716</button>
            `;
            btns.querySelector('.tab-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (window.dynamicPages) {
                    window.dynamicPages.deletePage(pageId);
                }
            });
            item.appendChild(btns);
        });

        // Add tab button per section
        document.querySelectorAll('.nav-section[data-section-id]').forEach(section => {
            if (section.querySelector('.add-tab-btn')) return;
            const sectionId = section.dataset.sectionId;
            const btn = document.createElement('button');
            btn.className = 'add-tab-btn';
            btn.innerHTML = '+ Ajouter un onglet';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showTabPicker(sectionId, btn);
            });
            section.appendChild(btn);
        });
    },

    removeMoveButtons() {
        document.querySelectorAll('.move-btns').forEach(el => el.remove());
        document.querySelectorAll('.add-tab-btn').forEach(el => el.remove());
        document.querySelectorAll('.tab-picker-dropdown').forEach(el => el.remove());
        // Restore plain text titles (remove rename spans)
        document.querySelectorAll('.section-name-text').forEach(span => {
            const parent = span.parentElement;
            if (parent) {
                parent.textContent = span.textContent;
            }
        });
    },

    // --- Rename Section ---

    startRenameSection(sectionId, nameSpan) {
        if (nameSpan.querySelector('input')) return; // already editing

        const currentName = nameSpan.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'section-name-input';

        const save = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                try {
                    const response = await API.sidebar.updateSection(sectionId, { name: newName });
                    if (response.ok) {
                        nameSpan.textContent = newName;
                    } else {
                        nameSpan.textContent = currentName;
                    }
                } catch (err) {
                    console.error('Error renaming section:', err);
                    nameSpan.textContent = currentName;
                }
            } else {
                nameSpan.textContent = currentName;
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            }
            if (e.key === 'Escape') {
                input.value = currentName;
                input.blur();
            }
        });
        input.addEventListener('blur', save);

        nameSpan.textContent = '';
        nameSpan.appendChild(input);
        input.focus();
        input.select();
    },

    // --- Add Section ---

    addAddSectionButton() {
        const navMenu = document.getElementById('nav-menu');
        if (!navMenu || navMenu.querySelector('.add-section-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'add-section-btn';
        btn.innerHTML = '+ Nouvelle section';
        btn.addEventListener('click', () => this.promptAddSection());
        navMenu.appendChild(btn);
    },

    removeAddSectionButton() {
        document.querySelectorAll('.add-section-btn').forEach(el => el.remove());
    },

    async promptAddSection() {
        const name = prompt('Nom de la nouvelle section :');
        if (!name || !name.trim()) return;

        try {
            const response = await API.sidebar.createSection({ name: name.trim() });
            if (response.ok && response.layout) {
                this.rebuildSidebar(response.layout);
            }
        } catch (err) {
            console.error('Error creating section:', err);
        }
    },

    // --- Delete Section ---

    async deleteSection(sectionId, sectionName) {
        if (!confirm(`Supprimer la section "${sectionName}" et tous ses onglets ?`)) return;

        try {
            const response = await API.sidebar.deleteSection(sectionId);
            if (response.ok && response.layout) {
                this.rebuildSidebar(response.layout);
            }
        } catch (err) {
            console.error('Error deleting section:', err);
        }
    },

    // --- Move ---

    async moveSection(sectionId, direction) {
        try {
            const response = await API.sidebar.moveSection(sectionId, direction);
            if (response.ok && response.layout) {
                this.rebuildSidebar(response.layout);
            }
        } catch (err) {
            console.error('Error moving section:', err);
        }
    },

    async moveTab(tabId, direction) {
        try {
            const layoutResp = await API.sidebar.getLayout();
            if (!layoutResp.ok) return;

            // Find tab by id, its section, and position within section
            let sectionIdx = -1, tabIdx = -1;
            const layout = layoutResp.layout;
            for (let si = 0; si < layout.length; si++) {
                for (let ti = 0; ti < layout[si].tabs.length; ti++) {
                    if (String(layout[si].tabs[ti].id) === String(tabId)) {
                        sectionIdx = si;
                        tabIdx = ti;
                        break;
                    }
                }
                if (sectionIdx >= 0) break;
            }
            if (sectionIdx < 0) return;

            const section = layout[sectionIdx];
            const atTop = tabIdx === 0;
            const atBottom = tabIdx === section.tabs.length - 1;

            // Cross-section move: up from top → end of previous section
            if (direction === 'up' && atTop && sectionIdx > 0) {
                const prevSection = layout[sectionIdx - 1];
                const response = await API.sidebar.reassignTab(tabId, { section_id: prevSection.id });
                if (response.ok && response.layout) {
                    this.rebuildSidebar(response.layout);
                }
                return;
            }

            // Cross-section move: down from bottom → start of next section
            if (direction === 'down' && atBottom && sectionIdx < layout.length - 1) {
                const nextSection = layout[sectionIdx + 1];
                const response = await API.sidebar.reassignTab(tabId, { section_id: nextSection.id, position: 0 });
                if (response.ok && response.layout) {
                    this.rebuildSidebar(response.layout);
                }
                return;
            }

            // Normal within-section move
            const response = await API.sidebar.moveTab(tabId, direction);
            if (response.ok && response.layout) {
                this.rebuildSidebar(response.layout);
            }
        } catch (err) {
            console.error('Error moving tab:', err);
        }
    },

    // --- Delete Tab ---

    async deleteTab(tabId, tabLabel) {
        if (!confirm(`Retirer l'onglet "${tabLabel}" de cette section ?`)) return;

        try {
            const response = await API.sidebar.deleteTab(tabId);
            if (response.ok && response.layout) {
                this.rebuildSidebar(response.layout);
            }
        } catch (err) {
            console.error('Error deleting tab:', err);
        }
    },

    // --- Add Tab Picker ---

    async showTabPicker(sectionId, anchorBtn) {
        // Close any existing picker
        document.querySelectorAll('.tab-picker-dropdown').forEach(el => el.remove());

        try {
            const [allTabsResp, layoutResp] = await Promise.all([
                API.sidebar.getAllTabs(),
                API.sidebar.getLayout()
            ]);
            if (!allTabsResp.ok || !layoutResp.ok) return;

            // Find which page_keys already exist in this section
            const section = layoutResp.layout.find(s => String(s.id) === String(sectionId));
            const existingKeys = new Set(section ? section.tabs.map(t => t.page_key) : []);

            // Filter to tabs not already in this section
            const available = allTabsResp.tabs.filter(t => !existingKeys.has(t.page_key));

            if (available.length === 0) {
                alert('Tous les onglets sont déjà dans cette section.');
                return;
            }

            const dropdown = document.createElement('div');
            dropdown.className = 'tab-picker-dropdown';
            available.forEach(tab => {
                const item = document.createElement('div');
                item.className = 'tab-picker-item';
                item.innerHTML = `<span class="icon">${tab.icon}</span> ${tab.label}`;
                item.addEventListener('click', async () => {
                    dropdown.remove();
                    const response = await API.sidebar.addTabToSection(sectionId, tab.page_key);
                    if (response.ok && response.layout) {
                        this.rebuildSidebar(response.layout);
                    }
                });
                dropdown.appendChild(item);
            });

            // Position below the button
            anchorBtn.parentElement.appendChild(dropdown);

            // Close on outside click
            const closeHandler = (e) => {
                if (!dropdown.contains(e.target) && e.target !== anchorBtn) {
                    dropdown.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 0);
        } catch (err) {
            console.error('Error showing tab picker:', err);
        }
    },

    rebuildSidebar(layout) {
        const navMenu = document.getElementById('nav-menu');
        if (!navMenu) return;

        const activePage = document.querySelector('.nav-item.active')?.dataset.page;

        // Remove DB-driven sections only (keep dynamic page sections)
        navMenu.querySelectorAll('.nav-section[data-section-id]').forEach(el => el.remove());
        // Remove add-section button (will be re-added if in edit mode)
        navMenu.querySelectorAll('.add-section-btn').forEach(el => el.remove());

        // Rebuild before dynamic-page sections
        const dpSection = navMenu.querySelector('.nav-section[data-section-name]');
        layout.forEach(section => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'nav-section';
            sectionEl.dataset.sectionId = section.id;

            const titleEl = document.createElement('div');
            titleEl.className = 'nav-section-title';
            titleEl.textContent = section.name;
            sectionEl.appendChild(titleEl);

            section.tabs.forEach(tab => {
                const li = document.createElement('li');
                li.className = 'nav-item';
                if (tab.page_key === activePage) li.classList.add('active');
                li.dataset.page = tab.page_key;
                li.dataset.tabId = tab.id;
                li.innerHTML = `
                    <a href="#${tab.page_key}">
                        <span class="icon">${tab.icon}</span>
                        <span class="label">${tab.label}</span>
                    </a>
                `;
                li.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.switchPage(tab.page_key);
                });
                sectionEl.appendChild(li);
            });

            if (dpSection) {
                navMenu.insertBefore(sectionEl, dpSection);
            } else {
                navMenu.appendChild(sectionEl);
            }
        });

        // Re-add edit controls if still in edit mode
        if (this.editMode) {
            this.addMoveButtons();
            this.addAddSectionButton();
        }

        // Update pageTitles
        if (window._pageTitles) {
            layout.forEach(section => {
                section.tabs.forEach(tab => {
                    window._pageTitles[tab.page_key] = {
                        title: tab.title || tab.label,
                        subtitle: tab.subtitle || ''
                    };
                });
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    sidebarEdit.init();
});

export default sidebarEdit;
