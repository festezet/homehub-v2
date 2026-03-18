/**
 * TODO Module - Row Renderers & Filter Tag Helpers
 * Extracted from todo.js for modularity (functions >50 lines)
 */

import Utils from './utils.js';

/**
 * Mixin methods for TodoModule. Assigned to prototype in todo.js.
 */
const TodoRenderers = {

    renderStats() {
        const statsContainer = document.getElementById('todo-stats');
        if (!statsContainer) return;

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
    },

    renderColGroup() {
        return Object.entries(this.columnWidths)
            .map(([col, width]) => `<col style="width: ${width}%;">`)
            .join('');
    },

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
    },

    renderTodoRow(todo) {
        const statusClass = this._getStatusClass(todo.status);
        const priorityClass = this._getPriorityClass(todo.priority);

        return `
            <tr data-todo-id="${todo.id}">
                ${this._renderActionCell(todo)}
                <td>${this._renderStatusSelect(todo, statusClass)}</td>
                <td>${this._renderPrioritySelect(todo, priorityClass)}</td>
                <td>${this._renderCategorySelect(todo)}</td>
                <td>${this._renderObjectiveSelect(todo)}</td>
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
    },

    _getStatusClass(status) {
        return {
            'To Do': 'status-todo', 'In Progress': 'status-progress',
            'Done': 'status-done', 'Blocked': 'status-blocked', 'Standby': 'status-standby'
        }[status] || 'status-todo';
    },

    _getPriorityClass(priority) {
        return {
            'P1-Urgent': 'priority-p1', 'P2-High': 'priority-p2', 'P2-Important': 'priority-p2',
            'P3-Normal': 'priority-p3', 'P4-Low': 'priority-p4', 'P4-Bas': 'priority-p4'
        }[priority] || 'priority-p3';
    },

    _renderActionCell(todo) {
        return `
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
            </td>`;
    },

    _renderStatusSelect(todo, statusClass) {
        return `
            <select class="inline-select ${statusClass}" onchange="window.TodoModule.updateField(${todo.id}, 'status', this.value)">
                <option value="To Do" ${todo.status === 'To Do' ? 'selected' : ''}>📝 To Do</option>
                <option value="In Progress" ${todo.status === 'In Progress' ? 'selected' : ''}>⚡ In Progress</option>
                <option value="Done" ${todo.status === 'Done' ? 'selected' : ''}>✅ Done</option>
                <option value="Blocked" ${todo.status === 'Blocked' ? 'selected' : ''}>🚫 Blocked</option>
                <option value="Standby" ${todo.status === 'Standby' ? 'selected' : ''}>⏸️ Standby</option>
            </select>`;
    },

    _renderPrioritySelect(todo, priorityClass) {
        return `
            <select class="inline-select ${priorityClass}" onchange="window.TodoModule.updateField(${todo.id}, 'priority', this.value)">
                <option value="P1-Urgent" ${todo.priority === 'P1-Urgent' ? 'selected' : ''}>🔴 P1-Urgent</option>
                <option value="P2-High" ${todo.priority === 'P2-High' || todo.priority === 'P2-Important' ? 'selected' : ''}>🟠 P2-High</option>
                <option value="P3-Normal" ${todo.priority === 'P3-Normal' ? 'selected' : ''}>🟡 P3-Normal</option>
                <option value="P4-Low" ${todo.priority === 'P4-Low' || todo.priority === 'P4-Bas' ? 'selected' : ''}>🟢 P4-Low</option>
            </select>`;
    },

    _renderCategorySelect(todo) {
        return `
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
                <option value="Rapport Systeme" ${todo.category === 'Rapport Systeme' ? 'selected' : ''}>📊 Rapport Systeme</option>
            </select>`;
    },

    _renderObjectiveSelect(todo) {
        return `
            <select class="inline-select" onchange="window.TodoModule.updateField(${todo.id}, 'objective', this.value)" style="width: 100%; font-size: 0.8rem;">
                <option value="">-</option>
                <option value="Revenus et Stabilité Financière" ${todo.objective === 'Revenus et Stabilité Financière' ? 'selected' : ''}>💰 Revenus et Stabilité</option>
                <option value="Santé et Bien-être" ${todo.objective === 'Santé et Bien-être' ? 'selected' : ''}>🏃 Santé et Bien-être</option>
                <option value="Relations Familiales et Amicales" ${todo.objective === 'Relations Familiales et Amicales' ? 'selected' : ''}>👨‍👩‍👧‍👦 Relations</option>
                <option value="Développement Personnel" ${todo.objective === 'Développement Personnel' ? 'selected' : ''}>📚 Développement Personnel</option>
                <option value="Projets et Créativité" ${todo.objective === 'Projets et Créativité' ? 'selected' : ''}>🎨 Projets et Créativité</option>
                <option value="Équilibre Vie Pro-Perso" ${todo.objective === 'Équilibre Vie Pro-Perso' ? 'selected' : ''}>⚖️ Équilibre Vie Pro-Perso</option>
            </select>`;
    },

    renderFilterTags() {
        const container = document.getElementById('active-filters');
        if (!container) return;

        const tags = [];
        const statusEmojis = { 'To Do': '📝', 'In Progress': '⚡', 'Done': '✅', 'Blocked': '🚫', 'Standby': '⏸️' };
        const priorityEmojis = { 'P1-Urgent': '🔴', 'P2-High': '🟠', 'P3-Normal': '🟡', 'P4-Low': '🟢' };
        const categoryEmojis = {
            'Admin': '🏢', 'Projet': '📁', 'Perso': '👤', 'Pro': '💼',
            'SASU': '🏭', 'Maison': '🏠', 'Bricolage': '🔧', 'Finance': '💰',
            'Santé': '🏥', 'Tech': '💻', 'Infrastructure': '🖥️', 'Musique': '🎵',
            'Auto': '🚗', 'Immobilier': '🏘️', 'Loisirs': '🎯',
            'Rapport Systeme': '📊', 'Todo projet': '🤖'
        };
        const objectiveEmojis = {
            'Revenus': '💰', 'Santé': '🏃', 'Relations': '👨‍👩‍👧‍👦',
            'Développement': '📚', 'Projets': '🎨', 'Équilibre': '⚖️'
        };

        this.filters.status.forEach(v => tags.push(this._buildFilterTag('status', v, statusEmojis[v] || '')));
        this.filters.priority.forEach(v => tags.push(this._buildFilterTag('priority', v, priorityEmojis[v] || '')));
        this.filters.category.forEach(v => tags.push(this._buildFilterTag('category', v, categoryEmojis[v] || '📂')));
        this.filters.objective.forEach(v => {
            const shortName = v.split(' ')[0];
            tags.push(this._buildFilterTag('objective', v, objectiveEmojis[shortName] || '🎯', `${shortName}...`));
        });

        if (this.filters.search) {
            tags.push(`
                <span class="filter-tag">
                    🔍 "${this.filters.search}"
                    <span class="remove-tag" onclick="window.TodoModule.setSearchFilter(''); document.getElementById('search-input').value = '';">✕</span>
                </span>
            `);
        }

        container.innerHTML = tags.join('');
    },

    _buildFilterTag(type, value, emoji, displayLabel) {
        const label = displayLabel || value;
        const safeValue = value.replace(/'/g, "\\'");
        return `
            <span class="filter-tag">
                ${emoji} ${label}
                <span class="remove-tag" onclick="window.TodoModule.removeFilterValue('${type}', '${safeValue}')">✕</span>
            </span>
        `;
    },

    _renderEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-text">Aucune tâche à afficher</div>
                <div class="empty-state-subtext">Ajoutez une nouvelle tâche ou modifiez vos filtres</div>
            </div>
        `;
        const footer = document.getElementById('todo-footer');
        if (footer) footer.style.display = 'none';
    },

    _renderTable(filteredTodos) {
        return `
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
    },

    _renderFooter(filteredCount) {
        const footer = document.getElementById('todo-footer');
        if (footer) {
            footer.style.display = 'block';
            footer.innerHTML = `
                <div style="color: var(--text-secondary); font-size: 0.875rem;">
                    <strong>${filteredCount}</strong> tâche(s) affichée(s) sur <strong>${this.todos.length}</strong> au total
                </div>
            `;
        }
    },

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
    },

    setupResizeHandlers() {
        if (this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler);
        }
        if (this.mouseUpHandler) {
            document.removeEventListener('mouseup', this.mouseUpHandler);
        }

        this.mouseMoveHandler = (event) => {
            if (!this.isResizing) return;

            const diffX = event.pageX - this.startX;
            const tableWidth = document.querySelector('#todo-table-container table')?.offsetWidth || 1;
            const diffPercent = (diffX / tableWidth) * 100;

            const newWidth = Math.max(5, this.startWidth + diffPercent);
            this.columnWidths[this.currentColumn] = newWidth;

            const cols = document.querySelectorAll('#todo-table-container colgroup col');
            const columnKeys = Object.keys(this.columnWidths);
            cols.forEach((col, index) => {
                col.style.width = this.columnWidths[columnKeys[index]] + '%';
            });
        };

        this.mouseUpHandler = () => {
            if (this.isResizing) {
                console.log('✅ Resize complete:', this.currentColumn, 'to', this.columnWidths[this.currentColumn] + '%');

                const th = document.querySelector('#todo-table-container th.resizing');
                if (th) th.classList.remove('resizing');

                this.isResizing = false;
                this.currentColumn = null;
            }
        };

        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('mouseup', this.mouseUpHandler);
    }
};

export default TodoRenderers;
