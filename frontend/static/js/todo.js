/**
 * TODO Module - Complete CRUD functionality
 * Version: 2.0 (2025-12-05)
 */

import API from './api.js';
import Utils from './utils.js';
import TodoRenderers from './todo-renderers.js';

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
        this.renderStats();

        const container = document.getElementById('todo-table-container');
        if (!container) {
            console.error('❌ Container todo-table-container not found!');
            return;
        }

        const filteredTodos = this.getFilteredTodos();

        if (filteredTodos.length === 0) {
            this._renderEmptyState(container);
            return;
        }

        container.innerHTML = this._renderTable(filteredTodos);
        this.setupResizeHandlers();
        this._renderFooter(filteredTodos.length);
    }

    /**
     * Get filtered and sorted todos
     */
    getFilteredTodos() {
        let filtered = this._applyFilters([...this.todos]);
        return this._applySorting(filtered);
    }

    _applyFilters(filtered) {
        if (this.filters.status.length > 0) {
            filtered = filtered.filter(t => this.filters.status.includes(t.status));
        }
        if (this.filters.priority.length > 0) {
            filtered = filtered.filter(t => this.filters.priority.includes(t.priority) || this.filters.priority.includes('P2-High') && t.priority === 'P2-Important');
        }
        if (this.filters.category.length > 0) {
            filtered = filtered.filter(t => this.filters.category.includes(t.category));
        } else {
            filtered = filtered.filter(t => t.category !== 'Rapport Systeme');
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
        return filtered;
    }

    _applySorting(filtered) {
        filtered.sort((a, b) => {
            for (const sortConfig of this.sortColumns) {
                const { column, asc } = sortConfig;
                let valA = a[column];
                let valB = b[column];
                if (column === 'deadline') {
                    valA = valA ? new Date(valA) : new Date('9999-12-31');
                    valB = valB ? new Date(valB) : new Date('9999-12-31');
                }
                if (valA < valB) return asc ? -1 : 1;
                if (valA > valB) return asc ? 1 : -1;
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

// Mixin renderer methods onto prototype
Object.assign(TodoModule.prototype, TodoRenderers);

// Create singleton instance
const todoModule = new TodoModule();

// Make available globally
window.TodoModule = todoModule;

export default todoModule;
