/**
 * TODO Module - Complete CRUD functionality
 * Version: 2.0 (2025-12-05)
 */

import API from './api.js';
import Utils from './utils.js';

console.log('📝 TODO Module v2.0 loading...');

class TodoModule {
    constructor() {
        this.todos = [];
        this.filters = {
            status: ['To Do', 'In Progress'],
            priority: ['P1-Urgent', 'P2-High'],
            category: [],
            objective: [],
            search: ''
        };
        this.openDropdown = null;
        // Multi-column sorting
        this.sortColumns = [{ column: 'deadline', asc: true }];

        // Column widths (percentages)
        this.columnWidths = {
            action: 26,
            status: 12,
            priority: 12,
            category: 12,
            objective: 18,
            deadline: 10,
            actions: 10
        };

        // Resize state
        this.isResizing = false;
        this.currentColumn = null;
        this.startX = 0;
        this.startWidth = 0;
    }

    /**
     * Initialize TODO module
     */
    async init() {
        await this.loadTodos();
        this.setupEventListeners();
        this.initDefaultFilters();
    }

    /**
     * Initialize default filter checkboxes and tags
     */
    initDefaultFilters() {
        // Check default status checkboxes
        this.filters.status.forEach(value => {
            const checkbox = document.querySelector(`#filter-dropdown-status input[value="${value}"]`);
            if (checkbox) checkbox.checked = true;
        });

        // Check default priority checkboxes
        this.filters.priority.forEach(value => {
            const checkbox = document.querySelector(`#filter-dropdown-priority input[value="${value}"]`);
            if (checkbox) checkbox.checked = true;
        });

        // Render filter tags
        this.renderFilterTags();
    }

    /**
     * Load todos from API
     */
    async loadTodos() {
        try {
            console.log('📡 Loading todos from API...');
            const response = await API.todos.getAll();
            console.log('📦 API Response:', response);
            console.log('✅ Todos count:', response.todos?.length);
            this.todos = response.todos || [];
            console.log('🎨 Calling render()...');
            this.render();
            console.log('✅ Render complete');
        } catch (error) {
            console.error('❌ Failed to load todos:', error);
            Utils.showToast('Erreur de chargement des tâches', 'error');
        }
    }

    /**
     * Render TODO table
     */
    render() {
        console.log('🎨 render() called with', this.todos.length, 'todos');

        // Render stats cards
        console.log('📊 Rendering stats...');
        this.renderStats();

        // Render table
        const container = document.getElementById('todo-table-container');
        if (!container) {
            console.error('❌ Container todo-table-container not found!');
            return;
        }

        console.log('🔍 Filtering todos...');
        const filteredTodos = this.getFilteredTodos();
        console.log('✅ Filtered todos:', filteredTodos.length);

        if (filteredTodos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">Aucune tâche à afficher</div>
                    <div class="empty-state-subtext">Ajoutez une nouvelle tâche ou modifiez vos filtres</div>
                </div>
            `;

            // Hide footer
            const footer = document.getElementById('todo-footer');
            if (footer) footer.style.display = 'none';
            return;
        }

        const table = `
            <table>
                <colgroup>
                    ${this.renderColGroup()}
                </colgroup>
                <thead>
                    <tr>
                        ${this.renderTableHeader('action', 'Action')}
                        ${this.renderTableHeader('status', 'Statut')}
                        ${this.renderTableHeader('priority', 'Priorité')}
                        ${this.renderTableHeader('category', 'Catégorie')}
                        ${this.renderTableHeader('objective', 'Objectif')}
                        ${this.renderTableHeader('deadline', 'Deadline')}
                        ${this.renderTableHeader('actions', 'Actions', 'center')}
                    </tr>
                </thead>
                <tbody>
                    ${filteredTodos.map(todo => this.renderTodoRow(todo)).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = table;

        // Setup resize handlers
        this.setupResizeHandlers();

        // Show and update footer
        const footer = document.getElementById('todo-footer');
        if (footer) {
            footer.style.display = 'block';
            footer.innerHTML = `
                <div style="color: var(--text-secondary); font-size: 0.875rem;">
                    <strong>${filteredTodos.length}</strong> tâche(s) affichée(s) sur <strong>${this.todos.length}</strong> au total
                </div>
            `;
        }
    }

    /**
     * Render stats cards
     */
    renderStats() {
        const statsContainer = document.getElementById('todo-stats');
        if (!statsContainer) return;

        // Calculate stats
        const total = this.todos.length;
        const byStatus = {
            'To Do': this.todos.filter(t => t.status === 'To Do').length,
            'In Progress': this.todos.filter(t => t.status === 'In Progress').length,
            'Done': this.todos.filter(t => t.status === 'Done').length,
            'Blocked': this.todos.filter(t => t.status === 'Blocked').length
        };
        const overdue = this.todos.filter(t => this.isOverdue(t.deadline) && t.status !== 'Done').length;
        const completionRate = total > 0 ? Math.round((byStatus['Done'] / total) * 100) : 0;

        statsContainer.innerHTML = `
            <div class="card">
                <div class="card-body" style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${total}</div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 4px;">Total Tâches</div>
                </div>
            </div>
            <div class="card">
                <div class="card-body" style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #f59e0b;">${byStatus['In Progress']}</div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 4px;">En Cours</div>
                </div>
            </div>
            <div class="card">
                <div class="card-body" style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: ${overdue > 0 ? '#ef4444' : '#10b981'};">${overdue}</div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 4px;">En Retard</div>
                </div>
            </div>
            <div class="card">
                <div class="card-body" style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: 700; color: #10b981;">${completionRate}%</div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 4px;">Complétées</div>
                </div>
            </div>
        `;
    }

    /**
     * Render colgroup for column widths
     */
    renderColGroup() {
        return Object.entries(this.columnWidths)
            .map(([col, width]) => `<col style="width: ${width}%;">`)
            .join('');
    }

    /**
     * Render table header with sort indicators and resize handles
     */
    renderTableHeader(column, label, align = 'left') {
        const sortIndex = this.sortColumns.findIndex(s => s.column === column);
        const sortClass = sortIndex === 0 ? 'sorted-primary' : sortIndex === 1 ? 'sorted-secondary' : '';
        const sortIndicator = sortIndex >= 0
            ? `<span class="sort-indicator">${this.sortColumns[sortIndex].asc ? '↑' : '↓'}${sortIndex > 0 ? sortIndex : ''}</span>`
            : '';

        return `
            <th class="${sortClass}"
                style="text-align: ${align};"
                data-column="${column}"
                onclick="window.TodoModule.sortMulti(event, '${column}')">
                ${label}${sortIndicator}
                <div class="resize-handle"
                     data-column="${column}"
                     onmousedown="window.TodoModule.startResize(event, '${column}')"></div>
            </th>
        `;
    }

    /**
     * Render a single todo row
     */
    renderTodoRow(todo) {
        // Map status to CSS class
        const statusClass = {
            'To Do': 'status-todo',
            'In Progress': 'status-progress',
            'Done': 'status-done',
            'Blocked': 'status-blocked',
            'Standby': 'status-standby'
        }[todo.status] || 'status-todo';

        // Map priority to CSS class
        const priorityClass = {
            'P1-Urgent': 'priority-p1',
            'P2-High': 'priority-p2',
            'P2-Important': 'priority-p2',
            'P3-Normal': 'priority-p3',
            'P4-Low': 'priority-p4',
            'P4-Bas': 'priority-p4'
        }[todo.priority] || 'priority-p3';

        return `
            <tr data-todo-id="${todo.id}">
                <td style="cursor: pointer; position: relative;"
                    ondblclick="window.TodoModule.makeActionEditable(event, ${todo.id}, '${this.escapeHtml(todo.action).replace(/'/g, "\\'")}')"
                    onmouseenter="this.querySelector('.edit-icon').style.opacity='0.6'"
                    onmouseleave="this.querySelector('.edit-icon').style.opacity='0'"
                    title="Double-cliquer pour éditer">
                    <div style="font-weight: 500; display: inline;">
                        ${this.escapeHtml(todo.action)}
                        <span class="edit-icon" style="opacity: 0; transition: opacity 0.2s; margin-left: 8px; color: var(--primary); font-size: 0.85rem;">✏️</span>
                    </div>
                    ${todo.notes ? `<div class="todo-notes">${this.escapeHtml(todo.notes)}</div>` : ''}
                </td>
                <td>
                    <select class="inline-select ${statusClass}" onchange="window.TodoModule.updateField(${todo.id}, 'status', this.value)">
                        <option value="To Do" ${todo.status === 'To Do' ? 'selected' : ''}>📝 To Do</option>
                        <option value="In Progress" ${todo.status === 'In Progress' ? 'selected' : ''}>⚡ In Progress</option>
                        <option value="Done" ${todo.status === 'Done' ? 'selected' : ''}>✅ Done</option>
                        <option value="Blocked" ${todo.status === 'Blocked' ? 'selected' : ''}>🚫 Blocked</option>
                        <option value="Standby" ${todo.status === 'Standby' ? 'selected' : ''}>⏸️ Standby</option>
                    </select>
                </td>
                <td>
                    <select class="inline-select ${priorityClass}" onchange="window.TodoModule.updateField(${todo.id}, 'priority', this.value)">
                        <option value="P1-Urgent" ${todo.priority === 'P1-Urgent' ? 'selected' : ''}>🔴 P1-Urgent</option>
                        <option value="P2-High" ${todo.priority === 'P2-High' || todo.priority === 'P2-Important' ? 'selected' : ''}>🟠 P2-High</option>
                        <option value="P3-Normal" ${todo.priority === 'P3-Normal' ? 'selected' : ''}>🟡 P3-Normal</option>
                        <option value="P4-Low" ${todo.priority === 'P4-Low' || todo.priority === 'P4-Bas' ? 'selected' : ''}>🟢 P4-Low</option>
                    </select>
                </td>
                <td>
                    <select class="inline-select" onchange="window.TodoModule.updateField(${todo.id}, 'category', this.value)" style="width: 100%; font-size: 0.8rem;">
                        <option value="Admin" ${todo.category === 'Admin' ? 'selected' : ''}>🏢 Admin</option>
                        <option value="Projet" ${todo.category === 'Projet' ? 'selected' : ''}>📁 Projet</option>
                        <option value="Perso" ${todo.category === 'Perso' ? 'selected' : ''}>👤 Perso</option>
                        <option value="Pro" ${todo.category === 'Pro' ? 'selected' : ''}>💼 Pro</option>
                        <option value="SASU" ${todo.category === 'SASU' ? 'selected' : ''}>🏭 SASU</option>
                        <option value="Maison" ${todo.category === 'Maison' ? 'selected' : ''}>🏠 Maison</option>
                        <option value="Bricolage" ${todo.category === 'Bricolage' ? 'selected' : ''}>🔧 Bricolage</option>
                        <option value="Finance" ${todo.category === 'Finance' ? 'selected' : ''}>💰 Finance</option>
                        <option value="Santé" ${todo.category === 'Santé' ? 'selected' : ''}>🏥 Santé</option>
                        <option value="Tech" ${todo.category === 'Tech' ? 'selected' : ''}>💻 Tech</option>
                        <option value="Infrastructure" ${todo.category === 'Infrastructure' ? 'selected' : ''}>🖥️ Infrastructure</option>
                        <option value="Musique" ${todo.category === 'Musique' ? 'selected' : ''}>🎵 Musique</option>
                        <option value="Auto" ${todo.category === 'Auto' ? 'selected' : ''}>🚗 Auto</option>
                        <option value="Immobilier" ${todo.category === 'Immobilier' ? 'selected' : ''}>🏘️ Immobilier</option>
                        <option value="Loisirs" ${todo.category === 'Loisirs' ? 'selected' : ''}>🎯 Loisirs</option>
                        <option value="Todo projet" ${todo.category === 'Todo projet' ? 'selected' : ''}>🤖 Todo projet</option>
                    </select>
                </td>
                <td>
                    <select class="inline-select" onchange="window.TodoModule.updateField(${todo.id}, 'objective', this.value)" style="width: 100%; font-size: 0.8rem;">
                        <option value="">-</option>
                        <option value="Revenus et Stabilité Financière" ${todo.objective === 'Revenus et Stabilité Financière' ? 'selected' : ''}>💰 Revenus et Stabilité</option>
                        <option value="Santé et Bien-être" ${todo.objective === 'Santé et Bien-être' ? 'selected' : ''}>🏃 Santé et Bien-être</option>
                        <option value="Relations Familiales et Amicales" ${todo.objective === 'Relations Familiales et Amicales' ? 'selected' : ''}>👨‍👩‍👧‍👦 Relations</option>
                        <option value="Développement Personnel" ${todo.objective === 'Développement Personnel' ? 'selected' : ''}>📚 Développement Personnel</option>
                        <option value="Projets et Créativité" ${todo.objective === 'Projets et Créativité' ? 'selected' : ''}>🎨 Projets et Créativité</option>
                        <option value="Équilibre Vie Pro-Perso" ${todo.objective === 'Équilibre Vie Pro-Perso' ? 'selected' : ''}>⚖️ Équilibre Vie Pro-Perso</option>
                    </select>
                </td>
                <td ${this.isOverdue(todo.deadline) ? 'class="deadline-overdue"' : ''}>
                    ${todo.deadline ? Utils.formatDate(todo.deadline) : '-'}
                </td>
                <td style="text-align: center;">
                    <button class="todo-action-btn btn-delete" onclick="window.TodoModule.deleteTodo(${todo.id})" title="Supprimer">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }


    /**
     * Get filtered and sorted todos
     */
    getFilteredTodos() {
        let filtered = [...this.todos];

        // Apply filters (array-based, multi-select)
        if (this.filters.status.length > 0) {
            filtered = filtered.filter(t => this.filters.status.includes(t.status));
        }
        if (this.filters.priority.length > 0) {
            filtered = filtered.filter(t => this.filters.priority.includes(t.priority) || this.filters.priority.includes('P2-High') && t.priority === 'P2-Important');
        }
        if (this.filters.category.length > 0) {
            filtered = filtered.filter(t => this.filters.category.includes(t.category));
        }
        if (this.filters.objective.length > 0) {
            filtered = filtered.filter(t => this.filters.objective.includes(t.objective));
        }
        if (this.filters.search) {
            const search = this.filters.search.toLowerCase();
            filtered = filtered.filter(t =>
                t.action.toLowerCase().includes(search) ||
                (t.notes && t.notes.toLowerCase().includes(search)) ||
                (t.objective && t.objective.toLowerCase().includes(search))
            );
        }

        // Apply multi-column sorting
        filtered.sort((a, b) => {
            for (const sortConfig of this.sortColumns) {
                const { column, asc } = sortConfig;
                let valA = a[column];
                let valB = b[column];

                // Handle deadline dates
                if (column === 'deadline') {
                    valA = valA ? new Date(valA) : new Date('9999-12-31');
                    valB = valB ? new Date(valB) : new Date('9999-12-31');
                }

                // Compare values
                if (valA < valB) return asc ? -1 : 1;
                if (valA > valB) return asc ? 1 : -1;
                // If equal, continue to next sort column
            }
            return 0;
        });

        return filtered;
    }

    /**
     * Toggle filter dropdown visibility
     */
    toggleFilterDropdown(filterType, event) {
        event.stopPropagation();
        const dropdown = document.getElementById(`filter-dropdown-${filterType}`);

        // Close other dropdowns
        if (this.openDropdown && this.openDropdown !== dropdown) {
            this.openDropdown.style.display = 'none';
        }

        // Toggle current dropdown
        if (dropdown.style.display === 'none') {
            dropdown.style.display = 'block';
            this.openDropdown = dropdown;
        } else {
            dropdown.style.display = 'none';
            this.openDropdown = null;
        }
    }

    /**
     * Toggle filter value (add/remove from array)
     */
    toggleFilterValue(filterType, value, checked) {
        if (checked) {
            if (!this.filters[filterType].includes(value)) {
                this.filters[filterType].push(value);
            }
        } else {
            this.filters[filterType] = this.filters[filterType].filter(v => v !== value);
        }
        this.renderFilterTags();
        this.render();
    }

    /**
     * Remove specific filter value
     */
    removeFilterValue(filterType, value) {
        this.filters[filterType] = this.filters[filterType].filter(v => v !== value);

        // Uncheck the checkbox
        const checkbox = document.querySelector(`#filter-dropdown-${filterType} input[value="${value}"]`);
        if (checkbox) checkbox.checked = false;

        this.renderFilterTags();
        this.render();
    }

    /**
     * Set search filter
     */
    setSearchFilter(value) {
        this.filters.search = value;
        this.renderFilterTags();
        this.render();
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        this.filters = {
            status: [],
            priority: [],
            category: [],
            objective: [],
            search: ''
        };

        // Uncheck all checkboxes
        document.querySelectorAll('.filter-dropdown input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Clear search input
        document.getElementById('search-input').value = '';

        this.renderFilterTags();
        this.render();
    }

    /**
     * Render active filter tags
     */
    renderFilterTags() {
        const container = document.getElementById('active-filters');
        if (!container) return;

        const tags = [];

        // Status tags
        this.filters.status.forEach(value => {
            const emoji = { 'To Do': '📝', 'In Progress': '⚡', 'Done': '✅', 'Blocked': '🚫', 'Standby': '⏸️' }[value] || '';
            tags.push(`
                <span class="filter-tag">
                    ${emoji} ${value}
                    <span class="remove-tag" onclick="window.TodoModule.removeFilterValue('status', '${value}')">✕</span>
                </span>
            `);
        });

        // Priority tags
        this.filters.priority.forEach(value => {
            const emoji = { 'P1-Urgent': '🔴', 'P2-High': '🟠', 'P3-Normal': '🟡', 'P4-Low': '🟢' }[value] || '';
            tags.push(`
                <span class="filter-tag">
                    ${emoji} ${value}
                    <span class="remove-tag" onclick="window.TodoModule.removeFilterValue('priority', '${value}')">✕</span>
                </span>
            `);
        });

        // Category tags
        this.filters.category.forEach(value => {
            const emoji = {
                'Admin': '🏢', 'Projet': '📁', 'Perso': '👤', 'Pro': '💼',
                'SASU': '🏭', 'Maison': '🏠', 'Bricolage': '🔧', 'Finance': '💰',
                'Santé': '🏥', 'Tech': '💻', 'Infrastructure': '🖥️', 'Musique': '🎵',
                'Auto': '🚗', 'Immobilier': '🏘️', 'Loisirs': '🎯'
            }[value] || '📂';
            tags.push(`
                <span class="filter-tag">
                    ${emoji} ${value}
                    <span class="remove-tag" onclick="window.TodoModule.removeFilterValue('category', '${value}')">✕</span>
                </span>
            `);
        });

        // Objective tags
        this.filters.objective.forEach(value => {
            const shortName = value.split(' ')[0]; // First word
            const emoji = {
                'Revenus': '💰',
                'Santé': '🏃',
                'Relations': '👨‍👩‍👧‍👦',
                'Développement': '📚',
                'Projets': '🎨',
                'Équilibre': '⚖️'
            }[shortName] || '🎯';
            tags.push(`
                <span class="filter-tag">
                    ${emoji} ${shortName}...
                    <span class="remove-tag" onclick="window.TodoModule.removeFilterValue('objective', '${value.replace(/'/g, "\\'")}')">✕</span>
                </span>
            `);
        });

        // Search tag
        if (this.filters.search) {
            tags.push(`
                <span class="filter-tag">
                    🔍 "${this.filters.search}"
                    <span class="remove-tag" onclick="window.TodoModule.setSearchFilter(''); document.getElementById('search-input').value = '';">✕</span>
                </span>
            `);
        }

        container.innerHTML = tags.join('');
    }

    /**
     * Set filter (deprecated, kept for compatibility)
     */
    setFilter(type, value) {
        if (type === 'search') {
            this.filters.search = value;
        } else {
            this.filters[type] = [value];
        }
        this.render();
    }

    /**
     * Multi-column sort (Shift+Click to add secondary sort)
     */
    sortMulti(event, column) {
        event.stopPropagation();

        const shiftKey = event.shiftKey;
        const existingIndex = this.sortColumns.findIndex(s => s.column === column);

        if (shiftKey && this.sortColumns.length < 2) {
            // Add secondary sort (max 2 columns)
            if (existingIndex >= 0) {
                // Toggle direction of existing sort
                this.sortColumns[existingIndex].asc = !this.sortColumns[existingIndex].asc;
            } else {
                // Add new secondary sort
                this.sortColumns.push({ column, asc: true });
            }
        } else {
            // Primary sort only
            if (existingIndex === 0) {
                // Toggle direction if already primary
                this.sortColumns[0].asc = !this.sortColumns[0].asc;
            } else {
                // Set as new primary sort
                this.sortColumns = [{ column, asc: true }];
            }
        }

        console.log('🔄 Sort columns:', this.sortColumns);
        this.render();
    }

    /**
     * Start column resize
     */
    startResize(event, column) {
        event.stopPropagation();
        event.preventDefault();

        this.isResizing = true;
        this.currentColumn = column;
        this.startX = event.pageX;
        this.startWidth = this.columnWidths[column];

        const th = event.target.closest('th');
        if (th) th.classList.add('resizing');

        console.log('🔧 Start resize:', column, 'at', this.startWidth + '%');
    }

    /**
     * Setup resize handlers (document-level mouse events)
     */
    setupResizeHandlers() {
        // Remove old handlers if they exist
        if (this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler);
        }
        if (this.mouseUpHandler) {
            document.removeEventListener('mouseup', this.mouseUpHandler);
        }

        // Mouse move handler
        this.mouseMoveHandler = (event) => {
            if (!this.isResizing) return;

            const diffX = event.pageX - this.startX;
            const tableWidth = document.querySelector('#todo-table-container table')?.offsetWidth || 1;
            const diffPercent = (diffX / tableWidth) * 100;

            const newWidth = Math.max(5, this.startWidth + diffPercent);
            this.columnWidths[this.currentColumn] = newWidth;

            // Update colgroup widths
            const cols = document.querySelectorAll('#todo-table-container colgroup col');
            const columnKeys = Object.keys(this.columnWidths);
            cols.forEach((col, index) => {
                col.style.width = this.columnWidths[columnKeys[index]] + '%';
            });
        };

        // Mouse up handler
        this.mouseUpHandler = () => {
            if (this.isResizing) {
                console.log('✅ Resize complete:', this.currentColumn, 'to', this.columnWidths[this.currentColumn] + '%');

                // Remove resizing class
                const th = document.querySelector('#todo-table-container th.resizing');
                if (th) th.classList.remove('resizing');

                this.isResizing = false;
                this.currentColumn = null;
            }
        };

        // Attach handlers
        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('mouseup', this.mouseUpHandler);
    }

    /**
     * Make action field editable on double-click
     */
    makeActionEditable(event, todoId, currentAction) {
        const cell = event.currentTarget;
        const currentText = currentAction;

        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.cssText = 'width: 100%; padding: 8px; border: 2px solid var(--primary); border-radius: 6px; font-size: 0.9rem; font-weight: 500; background: var(--bg-card); color: var(--text-primary);';

        // Save function
        const saveAction = async () => {
            const newValue = input.value.trim();
            if (newValue && newValue !== currentText) {
                await this.updateField(todoId, 'action', newValue);
            } else {
                this.render(); // Restore original display
            }
        };

        // Event listeners
        input.addEventListener('blur', saveAction);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                this.render(); // Cancel edit
            }
        });

        // Replace cell content with input
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
    }

    /**
     * Update todo field
     */
    async updateField(id, field, value) {
        try {
            await API.todos.update(id, field, value);

            // Update local data
            const todo = this.todos.find(t => t.id === id);
            if (todo) {
                todo[field] = value;
                this.render();
            }

            Utils.showToast('Tâche mise à jour', 'success');
        } catch (error) {
            console.error('Failed to update todo:', error);
            Utils.showToast('Erreur de mise à jour', 'error');
        }
    }

    /**
     * Delete todo
     */
    async deleteTodo(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
            return;
        }

        try {
            await API.todos.delete(id);
            this.todos = this.todos.filter(t => t.id !== id);
            this.render();
            Utils.showToast('Tâche supprimée', 'success');
        } catch (error) {
            console.error('Failed to delete todo:', error);
            Utils.showToast('Erreur de suppression', 'error');
        }
    }

    /**
     * Show add todo modal
     */
    showAddModal() {
        // Will be implemented with modal in next iteration
        const action = prompt('Action à réaliser:');
        if (!action) return;

        const todoData = {
            action: action,
            status: 'To Do',
            priority: 'P3-Normal',
            category: 'Admin',
            blocking: 'Non',
            withClaude: 'Non',
            deadline: Utils.getDefaultDeadline(),
            notes: '',
            time: 30
        };

        this.addTodo(todoData);
    }

    /**
     * Add new todo
     */
    async addTodo(todoData) {
        try {
            const response = await API.todos.create(todoData);
            this.todos.push(response.todo);
            this.render();
            Utils.showToast('Tâche ajoutée', 'success');
        } catch (error) {
            console.error('Failed to add todo:', error);
            Utils.showToast('Erreur d\'ajout', 'error');
        }
    }

    /**
     * Check if deadline is overdue
     */
    isOverdue(deadline) {
        if (!deadline) return false;
        return new Date(deadline) < new Date();
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Global function for add button
        window.showAddTodoModal = () => this.showAddModal();

        // Close dropdowns when clicking outside
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.multi-select-container') && this.openDropdown) {
                this.openDropdown.style.display = 'none';
                this.openDropdown = null;
            }
        });

        // Initial render of filter tags
        this.renderFilterTags();
    }
}

// Create singleton instance
const todoModule = new TodoModule();

// Make available globally
window.TodoModule = todoModule;

export default todoModule;
