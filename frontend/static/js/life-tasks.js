/**
 * Life Tasks Module
 * Manage ephemeral life tasks (repair, travel, admin, health, purchase, event)
 */

import API from './api.js';

const CATEGORY_ICONS = {
    repair: { icon: '\u{1F527}', label: 'Reparation/SAV' },
    travel: { icon: '\u{2708}\uFE0F', label: 'Voyage' },
    admin: { icon: '\u{1F4C4}', label: 'Demarche admin' },
    health: { icon: '\u{2764}\uFE0F', label: 'Sante' },
    purchase: { icon: '\u{1F6D2}', label: 'Achat' },
    event: { icon: '\u{1F4C5}', label: 'Evenement' }
};

const PRIORITY_COLORS = {
    'P1-Urgent': '#f38ba8',
    'P2-High': '#fab387',
    'P3-Normal': '#89b4fa',
    'P4-Low': '#6c7086'
};

class LifeTasksModule {
    constructor() {
        this.tasks = [];
        this.templates = {};
        this.loaded = false;
    }

    async load() {
        await Promise.all([
            this._loadTemplates(),
            this._loadTasks(),
            this._loadStats()
        ]);
        this._bindEvents();
        this.loaded = true;
    }

    // ---- Data loading ----

    async _loadTemplates() {
        try {
            const res = await API.lifeTasks.getTemplates();
            this.templates = res.templates || {};
        } catch (e) {
            console.error('Life tasks templates error:', e);
        }
    }

    async _loadTasks() {
        try {
            const category = document.getElementById('lt-filter-category')?.value || '';
            const status = document.getElementById('lt-filter-status')?.value || 'active';
            const res = await API.lifeTasks.list({ status, category });
            this.tasks = res.tasks || [];
            this._renderTasks();
        } catch (e) {
            console.error('Life tasks load error:', e);
            const container = document.getElementById('lt-tasks-container');
            if (container) container.innerHTML = '<p style="color:#f38ba8; text-align:center; padding:40px;">Erreur chargement</p>';
        }
    }

    async _loadStats() {
        try {
            const res = await API.lifeTasks.getStats();
            const s = res.stats || {};
            this._setText('lt-stat-active', s.active || 0);
            this._setText('lt-stat-overdue', s.overdue || 0);
            this._setText('lt-stat-completed', s.completed || 0);
            this._setText('lt-stat-total', s.total || 0);
        } catch (e) {
            console.error('Life tasks stats error:', e);
        }
    }

    // ---- Rendering ----

    _renderTasks() {
        const container = document.getElementById('lt-tasks-container');
        if (!container) return;

        if (!this.tasks.length) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#888;">Aucune tache trouvee</p>';
            return;
        }

        container.innerHTML = this.tasks.map(t => this._renderCard(t)).join('');
    }

    _renderCard(t) {
        const cat = CATEGORY_ICONS[t.category] || { icon: '\u{1F4CB}', label: t.category };
        const pColor = PRIORITY_COLORS[t.priority] || '#89b4fa';
        const steps = t.steps || [];
        const doneCount = steps.filter(s => s.done).length;
        const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

        let deadlineBadge = '';
        if (t.due_date) {
            const due = new Date(t.due_date);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const diff = Math.ceil((due - now) / 86400000);
            if (diff < 0) {
                deadlineBadge = `<span class="lt-badge lt-badge-overdue">${Math.abs(diff)}j en retard</span>`;
            } else if (diff <= 7) {
                deadlineBadge = `<span class="lt-badge lt-badge-due">J-${diff}</span>`;
            } else {
                deadlineBadge = `<span class="lt-badge lt-badge-due">${t.due_date}</span>`;
            }
        }

        const stepsHtml = steps.map((s, i) => `
            <li class="lt-step ${s.done ? 'done' : ''}" data-task="${t.unique_id}" data-step="${i}">
                <span class="lt-step-check">${s.done ? '\u2713' : ''}</span>
                <span>${this._esc(s.text)}</span>
            </li>
        `).join('');

        const contextHtml = this._renderContext(t);

        return `
        <div class="lt-task-card" data-id="${t.unique_id}">
            <div class="lt-task-header">
                <div class="lt-task-icon">${cat.icon}</div>
                <div class="lt-task-title">${this._esc(t.title)}</div>
                <span class="lt-badge lt-badge-priority" style="color:${pColor}">${t.priority}</span>
                ${deadlineBadge}
                <span class="lt-task-id">${t.unique_id}</span>
            </div>
            ${t.description ? `<div style="font-size:0.8rem; opacity:0.7; margin-bottom:8px;">${this._esc(t.description)}</div>` : ''}
            ${steps.length ? `
                <div class="lt-progress-bar"><div class="lt-progress-fill" style="width:${progress}%"></div></div>
                <div style="font-size:0.75rem; opacity:0.6; margin-bottom:4px;">${doneCount}/${steps.length} etapes (${progress}%)</div>
                <ul class="lt-steps">${stepsHtml}</ul>
            ` : ''}
            <div class="lt-expanded">
                ${contextHtml}
                <div class="lt-actions">
                    <button class="btn btn-sm" onclick="window.LifeTasksModule.editTask('${t.unique_id}')">Modifier</button>
                    ${t.status === 'active' ? `<button class="btn btn-sm btn-primary" onclick="window.LifeTasksModule.resolveTask('${t.unique_id}')">Clore</button>` : ''}
                    <button class="btn btn-sm" style="color:#f38ba8" onclick="window.LifeTasksModule.deleteTask('${t.unique_id}')">Supprimer</button>
                </div>
            </div>
        </div>`;
    }

    _renderContext(t) {
        const ctx = t.context_data || {};
        const fields = Object.entries(ctx);
        if (!fields.length) return '';

        return `
        <div class="lt-context-grid">
            ${fields.map(([k, v]) => `
                <div class="lt-context-field">
                    <label>${k}</label>
                    <input type="text" value="${this._esc(v || '')}" data-task="${t.unique_id}" data-ctx="${k}" onchange="window.LifeTasksModule.updateContext(this)">
                </div>
            `).join('')}
        </div>`;
    }

    // ---- Events ----

    _bindEvents() {
        document.getElementById('lt-filter-category')?.addEventListener('change', () => this._loadTasks());
        document.getElementById('lt-filter-status')?.addEventListener('change', () => this._loadTasks());

        document.getElementById('lt-tasks-container')?.addEventListener('click', (e) => {
            // Toggle expand
            const card = e.target.closest('.lt-task-card');
            if (card && !e.target.closest('.lt-step') && !e.target.closest('button') && !e.target.closest('input')) {
                card.classList.toggle('expanded');
            }

            // Toggle step
            const step = e.target.closest('.lt-step');
            if (step) {
                this._toggleStep(step.dataset.task, parseInt(step.dataset.step));
            }
        });
    }

    // ---- CRUD actions ----

    showCreateModal() {
        document.getElementById('lt-edit-id').value = '';
        document.getElementById('lt-input-title').value = '';
        document.getElementById('lt-input-priority').value = 'P3-Normal';
        document.getElementById('lt-input-due-date').value = '';
        document.getElementById('lt-input-description').value = '';
        document.getElementById('lt-modal-title').textContent = 'Nouvelle Life Task';
        document.querySelector('#lt-modal .lt-modal-footer .btn-primary').textContent = 'Creer';

        // Build category grid
        const grid = document.getElementById('lt-category-grid');
        grid.innerHTML = Object.entries(CATEGORY_ICONS).map(([key, val]) => `
            <div class="lt-cat-option" data-cat="${key}">
                <span class="lt-cat-icon">${val.icon}</span>
                ${val.label}
            </div>
        `).join('');

        grid.querySelectorAll('.lt-cat-option').forEach(opt => {
            opt.addEventListener('click', () => {
                grid.querySelectorAll('.lt-cat-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });

        document.getElementById('lt-modal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('lt-modal').style.display = 'none';
    }

    async submitTask() {
        const editId = document.getElementById('lt-edit-id').value;
        const title = document.getElementById('lt-input-title').value.trim();
        const selectedCat = document.querySelector('#lt-category-grid .lt-cat-option.selected');
        const category = selectedCat?.dataset.cat;
        const priority = document.getElementById('lt-input-priority').value;
        const due_date = document.getElementById('lt-input-due-date').value;
        const description = document.getElementById('lt-input-description').value.trim();

        if (!title) return alert('Titre requis');
        if (!category && !editId) return alert('Categorie requise');

        const data = { title, priority, description };
        if (category) data.category = category;
        if (due_date) data.due_date = due_date;

        try {
            if (editId) {
                await API.lifeTasks.update(editId, data);
            } else {
                await API.lifeTasks.create(data);
            }
            this.closeModal();
            await this._refresh();
        } catch (e) {
            console.error('Submit task error:', e);
            alert('Erreur: ' + (e.message || 'inconnue'));
        }
    }

    async editTask(taskId) {
        const task = this.tasks.find(t => t.unique_id === taskId);
        if (!task) return;

        this.showCreateModal();
        document.getElementById('lt-edit-id').value = taskId;
        document.getElementById('lt-input-title').value = task.title;
        document.getElementById('lt-input-priority').value = task.priority;
        document.getElementById('lt-input-due-date').value = task.due_date || '';
        document.getElementById('lt-input-description').value = task.description || '';
        document.getElementById('lt-modal-title').textContent = `Modifier ${taskId}`;
        document.querySelector('#lt-modal .lt-modal-footer .btn-primary').textContent = 'Sauvegarder';

        // Select category
        const catOpt = document.querySelector(`#lt-category-grid .lt-cat-option[data-cat="${task.category}"]`);
        if (catOpt) catOpt.classList.add('selected');
    }

    async resolveTask(taskId) {
        const resolution = prompt('Resolution (optionnel) :');
        if (resolution === null) return; // cancelled

        try {
            await API.lifeTasks.resolve(taskId, resolution || 'completed');
            await this._refresh();
        } catch (e) {
            console.error('Resolve error:', e);
        }
    }

    async deleteTask(taskId) {
        if (!confirm(`Supprimer ${taskId} ?`)) return;
        try {
            await API.lifeTasks.delete(taskId);
            await this._refresh();
        } catch (e) {
            console.error('Delete error:', e);
        }
    }

    async _toggleStep(taskId, stepIndex) {
        const task = this.tasks.find(t => t.unique_id === taskId);
        if (!task) return;

        const steps = [...(task.steps || [])];
        if (steps[stepIndex]) {
            steps[stepIndex] = { ...steps[stepIndex], done: !steps[stepIndex].done };
        }

        try {
            await API.lifeTasks.updateSteps(taskId, steps);
            await this._refresh();
        } catch (e) {
            console.error('Toggle step error:', e);
        }
    }

    async updateContext(input) {
        const taskId = input.dataset.task;
        const field = input.dataset.ctx;
        const task = this.tasks.find(t => t.unique_id === taskId);
        if (!task) return;

        const context_data = { ...(task.context_data || {}), [field]: input.value };
        try {
            await API.lifeTasks.update(taskId, { context_data });
        } catch (e) {
            console.error('Update context error:', e);
        }
    }

    async _refresh() {
        await Promise.all([this._loadTasks(), this._loadStats()]);
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

const lifeTasksModule = new LifeTasksModule();
window.LifeTasksModule = lifeTasksModule;
export default lifeTasksModule;
