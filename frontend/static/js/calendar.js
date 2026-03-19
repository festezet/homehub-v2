/**
 * Calendar Module - HomeHub v2
 * Handles weekly template display, agenda grid, and TODO scheduling
 * Google Calendar integration is in calendar-gcal.js (mixin)
 */

import { initGcalMixin } from './calendar-gcal.js';

class CalendarModule {
    constructor() {
        this.currentWeekStart = this.getMonday(new Date());
        this.template = null;
        this.googleEvents = {};
        this.scheduledTodos = [];
        this.pendingTodos = [];
        this.proposals = null;
        this.googleConnected = false;
        this.categories = {};
        this.activeSubTab = 'agenda'; // 'agenda', 'actions', 'template', 'google'
        this.gcalEvents = []; // flat list for Google Calendar tab
        this.gcalWeekStart = this.getMonday(new Date());
        this.editingEvent = null; // event being edited in modal

        // Time slots for the grid (7:00 to 22:00)
        this.startHour = 7;
        this.endHour = 22;
    }

    async init() {
        console.log('[Calendar] Initializing...');
        await this.loadData();
        this.setupEventListeners();
        this.render();
    }

    async loadData() {
        try {
            const response = await fetch(`/api/calendar/combined?start=${this.formatDate(this.currentWeekStart)}`);
            const data = await response.json();
            console.log('[Calendar] Combined data received:', data);

            if (data.ok) {
                this.template = data.template;
                this.googleEvents = data.google?.events || {};
                this.googleConnected = data.google?.connected || false;
                this.scheduledTodos = data.scheduled_todos || [];
                this.categories = data.categories || {};
            } else {
                console.error('[Calendar] API returned error:', data);
            }

            const todosResponse = await fetch('/api/calendar/schedule/todos');
            const todosData = await todosResponse.json();
            if (todosData.ok) {
                this.pendingTodos = todosData.todos || [];
            }

        } catch (error) {
            console.error('[Calendar] Error loading data:', error);
        }
    }

    setupEventListeners() {
        this._bindNavListeners();
        this._bindGcalListeners();
        this._bindSchedulingListeners();
        this._bindEventFormListeners();
    }

    _bindNavListeners() {
        document.querySelectorAll('.calendar-subtab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.subtab;
                this.switchSubTab(tabName);
            });
        });
        document.getElementById('prev-week')?.addEventListener('click', () => this.navigateWeek(-1));
        document.getElementById('next-week')?.addEventListener('click', () => this.navigateWeek(1));
        document.getElementById('today-btn')?.addEventListener('click', () => this.goToToday());
    }

    _bindGcalListeners() {
        document.getElementById('google-connect-btn')?.addEventListener('click', () => this.connectGoogle());
        document.getElementById('google-disconnect-btn')?.addEventListener('click', () => this.disconnectGoogle());
        document.getElementById('gcal-prev-week')?.addEventListener('click', () => this.gcalNavigateWeek(-1));
        document.getElementById('gcal-next-week')?.addEventListener('click', () => this.gcalNavigateWeek(1));
        document.getElementById('gcal-today-btn')?.addEventListener('click', () => this.gcalGoToToday());
        document.getElementById('gcal-add-event-btn')?.addEventListener('click', () => this.openEventForm());
        document.getElementById('gcal-check-btn')?.addEventListener('click', () => this.gcalCheckConnection());
    }

    _bindSchedulingListeners() {
        document.getElementById('propose-schedule-btn')?.addEventListener('click', () => this.proposeSchedule());
        document.getElementById('apply-schedule-btn')?.addEventListener('click', () => this.applySchedule());
        document.getElementById('cancel-proposal-btn')?.addEventListener('click', () => this.cancelProposal());
    }

    _bindEventFormListeners() {
        document.getElementById('gcal-form-save')?.addEventListener('click', () => this.saveEvent());
        document.getElementById('gcal-form-cancel')?.addEventListener('click', () => this.closeEventForm());
        document.getElementById('gcal-modal-close')?.addEventListener('click', () => this.closeEventForm());

        document.querySelectorAll('.gcal-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.currentTarget.dataset.eventId;
                const event = this.gcalEvents.find(ev => ev.id === eventId);
                if (event) this.openEventForm(event);
            });
        });
        document.querySelectorAll('.gcal-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.currentTarget.dataset.eventId;
                this.deleteEvent(eventId);
            });
        });
    }

    async switchSubTab(tabName) {
        this.activeSubTab = tabName;
        if (tabName === 'google' && this.gcalEvents.length === 0) {
            await this.gcalLoadEvents();
        }
        this.render();
    }

    // ============== Utility Methods ==============

    getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    navigateWeek(direction) {
        const days = direction * 7;
        this.currentWeekStart = new Date(this.currentWeekStart.getTime() + days * 24 * 60 * 60 * 1000);
        this.loadData().then(() => this.render());
    }

    goToToday() {
        this.currentWeekStart = this.getMonday(new Date());
        this.loadData().then(() => this.render());
    }

    showToast(message) {
        if (window.showToast) {
            window.showToast(message);
        } else {
            console.log('[Calendar] Toast:', message);
        }
    }

    timeToPosition(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = (hours - this.startHour) * 60 + minutes;
        return totalMinutes;
    }

    durationToHeight(startStr, endStr) {
        const [startH, startM] = startStr.split(':').map(Number);
        const [endH, endM] = endStr.split(':').map(Number);
        return (endH * 60 + endM) - (startH * 60 + startM);
    }

    extractTime(dateTimeObj) {
        if (!dateTimeObj) return null;
        if (dateTimeObj.dateTime) {
            const dt = new Date(dateTimeObj.dateTime);
            return `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
        }
        return null;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    // ============== Rendering ==============

    render() {
        const container = document.getElementById('calendar-container');
        if (!container) return;

        container.innerHTML = `
            ${this.renderSubTabs()}
            ${this.renderSubTabContent()}
            ${this.renderProposalModal()}
        `;

        this.setupEventListeners();
    }

    renderSubTabs() {
        return `
            <div class="calendar-subtabs">
                <button class="calendar-subtab ${this.activeSubTab === 'agenda' ? 'active' : ''}" data-subtab="agenda">
                    Agenda
                </button>
                <button class="calendar-subtab ${this.activeSubTab === 'actions' ? 'active' : ''}" data-subtab="actions">
                    Actions a planifier
                </button>
                <button class="calendar-subtab ${this.activeSubTab === 'template' ? 'active' : ''}" data-subtab="template">
                    Emploi du temps type
                </button>
                <button class="calendar-subtab subtab-google ${this.activeSubTab === 'google' ? 'active' : ''}" data-subtab="google">
                    Google Calendar
                </button>
            </div>
        `;
    }

    renderSubTabContent() {
        switch (this.activeSubTab) {
            case 'agenda':
                return `
                    ${this.renderWeekNav()}
                    <div class="calendar-layout calendar-full-width">
                        <div class="calendar-main">
                            ${this.renderCalendarGrid()}
                        </div>
                    </div>
                `;
            case 'actions':
                return this.renderActionsTab();
            case 'template':
                return this.renderTemplateTab();
            case 'google':
                return this.renderGoogleCalendarTab();
            default:
                return `
                    ${this.renderWeekNav()}
                    <div class="calendar-layout calendar-full-width">
                        <div class="calendar-main">
                            ${this.renderCalendarGrid()}
                        </div>
                    </div>
                `;
        }
    }

    renderActionsTab() {
        const actionsGrid = this.pendingTodos.length === 0
            ? `<div class="empty-state">
                    <p>Aucun TODO P1/P2 en attente de planification.</p>
                    <p class="hint">Les TODOs avec priorite P1-Urgent ou P2-High apparaitront ici.</p>
               </div>`
            : `<div class="actions-grid">
                    ${this.pendingTodos.map(todo => this.renderActionCard(todo)).join('')}
               </div>`;

        return `
            <div class="actions-tab">
                <div class="actions-header">
                    <h3>Actions a planifier avec Claude</h3>
                    <p class="actions-subtitle">TODOs prioritaires (P1/P2) en attente de planification</p>
                </div>
                ${actionsGrid}
                <div class="actions-footer">
                    <button id="propose-schedule-btn" class="btn-primary btn-large">
                        Demander a Claude de planifier
                    </button>
                </div>
            </div>
        `;
    }

    renderActionCard(todo) {
        const priorityClass = todo.priority?.toLowerCase().replace('-', '') || 'p3normal';
        const deadlineText = todo.deadline ? `Deadline: ${todo.deadline}` : 'Pas de deadline';
        const timeText = todo.time ? `${todo.time} min` : '30 min';

        return `
            <div class="action-card priority-${priorityClass}">
                <div class="action-card-header">
                    <span class="action-priority">${todo.priority || 'P3'}</span>
                    <span class="action-category">${todo.category || 'Admin'}</span>
                </div>
                <div class="action-card-body">
                    <h4 class="action-title">${todo.action}</h4>
                    ${todo.notes ? `<p class="action-notes">${todo.notes}</p>` : ''}
                </div>
                <div class="action-card-footer">
                    <span class="action-time">${timeText}</span>
                    <span class="action-deadline">${deadlineText}</span>
                </div>
            </div>
        `;
    }

    renderTemplateTab() {
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

        return `
            <div class="template-tab">
                <div class="template-header">
                    <h3>Emploi du temps type</h3>
                    <p class="template-subtitle">Semaine de reference (modifiable)</p>
                </div>
                <div class="template-grid">
                    ${days.map(day => this.renderTemplateDayColumn(day)).join('')}
                </div>
            </div>
        `;
    }

    renderTemplateDayColumn(dayName) {
        const slots = this.template?.[dayName]?.slots || [];

        return `
            <div class="template-day">
                <div class="template-day-header">${dayName}</div>
                <div class="template-day-slots">
                    ${slots.map(slot => `
                        <div class="template-slot-item" style="background-color: ${slot.color};" title="${slot.activity}">
                            <span class="template-slot-time">${slot.start}-${slot.end}</span>
                            <span class="template-slot-activity">${slot.activity}</span>
                            ${slot.is_flexible ? '<span class="template-slot-flex">Flexible</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderWeekNav() {
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const options = { day: 'numeric', month: 'short' };
        const startStr = this.currentWeekStart.toLocaleDateString('fr-FR', options);
        const endStr = weekEnd.toLocaleDateString('fr-FR', options);
        const year = this.currentWeekStart.getFullYear();

        return `
            <div class="week-nav">
                <button id="prev-week" class="nav-btn" title="Semaine precedente">&#9668;</button>
                <button id="today-btn" class="nav-btn today-btn">Aujourd'hui</button>
                <span class="week-label">${startStr} - ${endStr} ${year}</span>
                <button id="next-week" class="nav-btn" title="Semaine suivante">&#9654;</button>
            </div>
        `;
    }

    renderCalendarGrid() {
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        const hours = [];
        for (let h = this.startHour; h <= this.endHour; h++) {
            hours.push(`${h.toString().padStart(2, '0')}:00`);
        }

        return `
            <div class="calendar-grid">
                <div class="grid-header">
                    <div class="time-header"></div>
                    ${days.map((day, i) => {
                        const dayDate = new Date(this.currentWeekStart);
                        dayDate.setDate(dayDate.getDate() + i);
                        const isToday = this.isToday(dayDate);
                        return `
                            <div class="day-header ${isToday ? 'today' : ''}">
                                <span class="day-name">${day}</span>
                                <span class="day-date">${dayDate.getDate()}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="grid-body">
                    <div class="time-column">
                        ${hours.map(h => `<div class="time-slot">${h}</div>`).join('')}
                    </div>
                    ${days.map((day, i) => {
                        const dayDate = new Date(this.currentWeekStart);
                        dayDate.setDate(dayDate.getDate() + i);
                        return this.renderDayColumn(day, dayDate);
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderDayColumn(dayName, dayDate) {
        const dateStr = this.formatDate(dayDate);
        const isToday = this.isToday(dayDate);
        const dayEvents = this.googleEvents[dayName] || [];
        const dayScheduled = this.scheduledTodos.filter(t => t.scheduled_date === dateStr);

        return `
            <div class="day-column ${isToday ? 'today' : ''}" data-day="${dayName}" data-date="${dateStr}">
                ${dayEvents.map(event => this.renderGoogleEvent(event)).join('')}
                ${dayScheduled.map(todo => this.renderScheduledTodo(todo)).join('')}
            </div>
        `;
    }

    renderGoogleEvent(event) {
        const startTime = this.extractTime(event.start);
        const endTime = this.extractTime(event.end);

        if (!startTime) return '';

        const top = this.timeToPosition(startTime);
        const height = endTime ? this.durationToHeight(startTime, endTime) : 30;

        return `
            <div class="google-event" style="top: ${top}px; height: ${Math.max(height, 25)}px;">
                <span class="event-title">${event.summary || 'Sans titre'}</span>
                <span class="event-time">${startTime}${endTime ? '-' + endTime : ''}</span>
            </div>
        `;
    }

    renderScheduledTodo(todo) {
        const top = this.timeToPosition(todo.start_time);
        const height = this.durationToHeight(todo.start_time, todo.end_time);
        const priorityClass = todo.priority?.toLowerCase().replace('-', '') || 'p3normal';

        return `
            <div class="scheduled-todo priority-${priorityClass}" style="top: ${top}px; height: ${Math.max(height, 25)}px;">
                <span class="todo-title">${todo.action || 'TODO'}</span>
                <span class="todo-time">${todo.start_time}-${todo.end_time}</span>
            </div>
        `;
    }
}

// Apply Google Calendar mixin
const calendarModule = new CalendarModule();
initGcalMixin(calendarModule);

export { calendarModule, CalendarModule };
