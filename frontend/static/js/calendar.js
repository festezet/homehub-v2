/**
 * Calendar Module - HomeHub v2
 * Handles weekly template display, Google Calendar integration, and TODO scheduling
 */

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
            // Load combined view (template + google + scheduled)
            const response = await fetch(`/api/calendar/combined?start=${this.formatDate(this.currentWeekStart)}`);
            const data = await response.json();
            console.log('[Calendar] Combined data received:', data);

            if (data.status === 'ok') {
                this.template = data.template;
                this.googleEvents = data.google?.events || {};
                this.googleConnected = data.google?.connected || false;
                this.scheduledTodos = data.scheduled_todos || [];
                this.categories = data.categories || {};
                console.log('[Calendar] Template days:', Object.keys(this.template || {}));
                console.log('[Calendar] Lundi slots:', this.template?.Lundi?.slots?.length || 0);
            } else {
                console.error('[Calendar] API returned error:', data);
            }

            // Load schedulable todos
            const todosResponse = await fetch('/api/calendar/schedule/todos');
            const todosData = await todosResponse.json();
            if (todosData.status === 'ok') {
                this.pendingTodos = todosData.todos || [];
                console.log('[Calendar] Pending todos:', this.pendingTodos.length);
            }

        } catch (error) {
            console.error('[Calendar] Error loading data:', error);
        }
    }

    setupEventListeners() {
        // Sub-tabs navigation
        document.querySelectorAll('.calendar-subtab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.subtab;
                this.switchSubTab(tabName);
            });
        });

        // Navigation buttons
        document.getElementById('prev-week')?.addEventListener('click', () => this.navigateWeek(-1));
        document.getElementById('next-week')?.addEventListener('click', () => this.navigateWeek(1));
        document.getElementById('today-btn')?.addEventListener('click', () => this.goToToday());

        // Google Calendar connection
        document.getElementById('google-connect-btn')?.addEventListener('click', () => this.connectGoogle());
        document.getElementById('google-disconnect-btn')?.addEventListener('click', () => this.disconnectGoogle());

        // Scheduling
        document.getElementById('propose-schedule-btn')?.addEventListener('click', () => this.proposeSchedule());
        document.getElementById('apply-schedule-btn')?.addEventListener('click', () => this.applySchedule());
        document.getElementById('cancel-proposal-btn')?.addEventListener('click', () => this.cancelProposal());

        // Google Calendar tab
        document.getElementById('gcal-prev-week')?.addEventListener('click', () => this.gcalNavigateWeek(-1));
        document.getElementById('gcal-next-week')?.addEventListener('click', () => this.gcalNavigateWeek(1));
        document.getElementById('gcal-today-btn')?.addEventListener('click', () => this.gcalGoToToday());
        document.getElementById('gcal-add-event-btn')?.addEventListener('click', () => this.openEventForm());
        document.getElementById('gcal-check-btn')?.addEventListener('click', () => this.gcalCheckConnection());

        // Event form modal
        document.getElementById('gcal-form-save')?.addEventListener('click', () => this.saveEvent());
        document.getElementById('gcal-form-cancel')?.addEventListener('click', () => this.closeEventForm());
        document.getElementById('gcal-modal-close')?.addEventListener('click', () => this.closeEventForm());

        // Edit/delete buttons on event cards
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

    async connectGoogle() {
        alert('Run: cd /data/projects/homehub-v2 && python3 scripts/google_calendar_auth.py');
    }

    async disconnectGoogle() {
        alert('To disconnect, delete credentials/google_calendar_token.json');
    }

    async proposeSchedule() {
        const btn = document.getElementById('propose-schedule-btn');
        if (btn) btn.disabled = true;
        btn.textContent = 'Analyse en cours...';

        try {
            const response = await fetch(`/api/calendar/schedule/propose?start=${this.formatDate(this.currentWeekStart)}`);
            const data = await response.json();

            if (data.status === 'ok') {
                this.proposals = data.proposals;
                this.showProposalModal();
            }
        } catch (error) {
            console.error('[Calendar] Error proposing schedule:', error);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Demander a Claude';
            }
        }
    }

    showProposalModal() {
        const modal = document.getElementById('proposal-modal');
        const content = document.getElementById('proposal-content');

        if (!this.proposals || this.proposals.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <p>Aucun TODO P1/P2 a planifier pour cette semaine.</p>
                </div>
            `;
        } else {
            content.innerHTML = this.proposals.map(p => `
                <div class="proposal-item" data-todo-id="${p.todo_id}">
                    <div class="proposal-header">
                        <span class="priority priority-${p.todo_priority.toLowerCase().replace('-', '')}">${p.todo_priority}</span>
                        <span class="todo-action">${p.todo_action}</span>
                    </div>
                    <div class="proposal-schedule">
                        <span class="day">${p.day}</span>
                        <span class="date">${p.scheduled_date}</span>
                        <span class="time">${p.start_time} - ${p.end_time}</span>
                    </div>
                    <div class="proposal-reasoning">${p.reasoning}</div>
                    ${p.todo_deadline ? `<div class="deadline">Deadline: ${p.todo_deadline}</div>` : ''}
                </div>
            `).join('');
        }

        modal.classList.remove('hidden');
        document.getElementById('apply-schedule-btn').style.display =
            this.proposals && this.proposals.length > 0 ? 'inline-block' : 'none';
    }

    cancelProposal() {
        this.proposals = null;
        document.getElementById('proposal-modal').classList.add('hidden');
    }

    async applySchedule() {
        if (!this.proposals || this.proposals.length === 0) return;

        try {
            const response = await fetch('/api/calendar/schedule/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposals: this.proposals })
            });

            const data = await response.json();

            if (data.status === 'ok') {
                this.cancelProposal();
                await this.loadData();
                this.render();
                this.showToast(`${data.applied} tache(s) planifiee(s)`);
            }
        } catch (error) {
            console.error('[Calendar] Error applying schedule:', error);
        }
    }

    showToast(message) {
        // Use existing toast system if available
        if (window.showToast) {
            window.showToast(message);
        } else {
            console.log('[Calendar] Toast:', message);
        }
    }

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
                return this.renderAgendaTab();
            case 'actions':
                return this.renderActionsTab();
            case 'template':
                return this.renderTemplateTab();
            case 'google':
                return this.renderGoogleCalendarTab();
            default:
                return this.renderAgendaTab();
        }
    }

    renderAgendaTab() {
        return `
            ${this.renderWeekNav()}
            <div class="calendar-layout calendar-full-width">
                <div class="calendar-main">
                    ${this.renderCalendarGrid()}
                </div>
            </div>
        `;
    }

    renderActionsTab() {
        return `
            <div class="actions-tab">
                <div class="actions-header">
                    <h3>Actions a planifier avec Claude</h3>
                    <p class="actions-subtitle">TODOs prioritaires (P1/P2) en attente de planification</p>
                </div>
                ${this.renderActionsGrid()}
                <div class="actions-footer">
                    <button id="propose-schedule-btn" class="btn-primary btn-large">
                        Demander a Claude de planifier
                    </button>
                </div>
            </div>
        `;
    }

    renderActionsGrid() {
        if (this.pendingTodos.length === 0) {
            return `
                <div class="empty-state">
                    <p>Aucun TODO P1/P2 en attente de planification.</p>
                    <p class="hint">Les TODOs avec priorite P1-Urgent ou P2-High apparaitront ici.</p>
                </div>
            `;
        }

        return `
            <div class="actions-grid">
                ${this.pendingTodos.map(todo => this.renderActionCard(todo)).join('')}
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
        return `
            <div class="template-tab">
                <div class="template-header">
                    <h3>Emploi du temps type</h3>
                    <p class="template-subtitle">Semaine de reference (modifiable)</p>
                </div>
                ${this.renderTemplateGrid()}
            </div>
        `;
    }

    renderTemplateGrid() {
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

        return `
            <div class="template-grid">
                ${days.map(day => this.renderTemplateDayColumn(day)).join('')}
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

    renderHeader() {
        return `
            <div class="calendar-header">
                <h2>Agenda</h2>
                <div class="calendar-legend">
                    <span class="legend-item event-legend">Google Calendar</span>
                    <span class="legend-item todo-legend">TODO planifie</span>
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
                <button id="prev-week" class="nav-btn" title="Semaine precedente">◀</button>
                <button id="today-btn" class="nav-btn today-btn">Aujourd'hui</button>
                <span class="week-label">${startStr} - ${endStr} ${year}</span>
                <button id="next-week" class="nav-btn" title="Semaine suivante">▶</button>
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
                <!-- Header row -->
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

                <!-- Grid body -->
                <div class="grid-body">
                    <!-- Time column -->
                    <div class="time-column">
                        ${hours.map(h => `<div class="time-slot">${h}</div>`).join('')}
                    </div>

                    <!-- Day columns -->
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

        // Get Google events for this day
        const dayEvents = this.googleEvents[dayName] || [];

        // Get scheduled todos for this day
        const dayScheduled = this.scheduledTodos.filter(t => t.scheduled_date === dateStr);

        return `
            <div class="day-column ${isToday ? 'today' : ''}" data-day="${dayName}" data-date="${dateStr}">
                <!-- Google Calendar events -->
                ${dayEvents.map(event => this.renderGoogleEvent(event)).join('')}

                <!-- Scheduled TODOs -->
                ${dayScheduled.map(todo => this.renderScheduledTodo(todo)).join('')}
            </div>
        `;
    }

    renderTemplateSlot(slot) {
        const top = this.timeToPosition(slot.start);
        const height = this.durationToHeight(slot.start, slot.end);
        const category = this.categories[slot.category] || {};

        // Determine size class based on duration
        let sizeClass = 'slot-large';
        if (height <= 20) {
            sizeClass = 'slot-small';
        } else if (height <= 45) {
            sizeClass = 'slot-medium';
        }

        // Truncate activity name for small slots
        let activityText = slot.activity || '';
        if (sizeClass === 'slot-small' && activityText.length > 15) {
            activityText = activityText.substring(0, 12) + '...';
        } else if (sizeClass === 'slot-medium' && activityText.length > 25) {
            activityText = activityText.substring(0, 22) + '...';
        }

        return `
            <div class="template-slot ${sizeClass}" style="top: ${top}px; height: ${height}px; background-color: ${slot.color};" title="${slot.activity} (${slot.start}-${slot.end})">
                <span class="slot-activity">${activityText}</span>
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

    timeToPosition(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = (hours - this.startHour) * 60 + minutes;
        return totalMinutes; // 1px per minute
    }

    durationToHeight(startStr, endStr) {
        const [startH, startM] = startStr.split(':').map(Number);
        const [endH, endM] = endStr.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        return endMinutes - startMinutes;
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

    renderGoogleStatus() {
        if (this.googleConnected) {
            return `
                <div class="google-status connected">
                    <span class="status-icon">&#10003;</span>
                    <span>Google Calendar connecte</span>
                    <button id="google-disconnect-btn" class="btn-small">Deconnecter</button>
                </div>
            `;
        } else {
            return `
                <div class="google-status disconnected">
                    <span class="status-icon">!</span>
                    <span>Google Calendar non connecte</span>
                    <button id="google-connect-btn" class="btn-primary">Connecter</button>
                </div>
            `;
        }
    }

    renderPendingTodos() {
        if (this.pendingTodos.length === 0) {
            return `
                <div class="pending-todos">
                    <h3>TODOs a planifier</h3>
                    <p class="empty-state">Aucun TODO P1/P2 en attente</p>
                </div>
            `;
        }

        return `
            <div class="pending-todos">
                <h3>TODOs a planifier (${this.pendingTodos.length})</h3>
                <ul class="todo-list">
                    ${this.pendingTodos.slice(0, 10).map(todo => `
                        <li class="todo-item priority-${todo.priority?.toLowerCase().replace('-', '')}">
                            <span class="priority-badge">${todo.priority}</span>
                            <span class="todo-action">${todo.action}</span>
                            ${todo.deadline ? `<span class="deadline">${todo.deadline}</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
                ${this.pendingTodos.length > 10 ? `<p class="more">+${this.pendingTodos.length - 10} autres...</p>` : ''}
                <button id="propose-schedule-btn" class="btn-primary">Demander a Claude</button>
            </div>
        `;
    }

    // ============== Google Calendar Tab ==============

    renderGoogleCalendarTab() {
        if (!this.googleConnected) {
            return this.renderGcalDisconnected();
        }
        return `
            <div class="google-tab">
                ${this.renderGcalNav()}
                <div class="gcal-toolbar">
                    <button id="gcal-add-event-btn" class="btn-primary btn-small">+ Nouvel evenement</button>
                    <button id="gcal-check-btn" class="btn-secondary btn-small">Verifier connexion</button>
                </div>
                <div class="gcal-events-list">
                    ${this.renderGcalEventsByDay()}
                </div>
                ${this.renderEventFormModal()}
            </div>
        `;
    }

    renderGcalDisconnected() {
        return `
            <div class="google-tab">
                <div class="gcal-disconnected">
                    <div class="gcal-disconnected-icon">G</div>
                    <h3>Google Calendar non connecte</h3>
                    <p>Pour connecter votre compte Google Calendar, executez :</p>
                    <pre class="gcal-cmd">cd /data/projects/homehub-v2 && python3 scripts/google_calendar_auth.py</pre>
                    <p class="gcal-hint">Cela ouvrira le navigateur pour autoriser l'acces au calendrier.</p>
                    <button id="gcal-check-btn" class="btn-primary">Verifier la connexion</button>
                </div>
            </div>
        `;
    }

    renderGcalNav() {
        const weekEnd = new Date(this.gcalWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const options = { day: 'numeric', month: 'short' };
        const startStr = this.gcalWeekStart.toLocaleDateString('fr-FR', options);
        const endStr = weekEnd.toLocaleDateString('fr-FR', options);
        const year = this.gcalWeekStart.getFullYear();

        return `
            <div class="week-nav">
                <button id="gcal-prev-week" class="nav-btn" title="Semaine precedente">&#9664;</button>
                <button id="gcal-today-btn" class="nav-btn today-btn">Aujourd'hui</button>
                <span class="week-label">${startStr} - ${endStr} ${year}</span>
                <button id="gcal-next-week" class="nav-btn" title="Semaine suivante">&#9654;</button>
            </div>
        `;
    }

    renderGcalEventsByDay() {
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        const daysByName = {};

        // Group events by day
        this.gcalEvents.forEach(event => {
            const start = event.start;
            let eventDate;
            if (start?.dateTime) {
                eventDate = new Date(start.dateTime);
            } else if (start?.date) {
                eventDate = new Date(start.date + 'T00:00:00');
            } else {
                return;
            }
            const dayIndex = eventDate.getDay();
            const dayName = days[dayIndex === 0 ? 6 : dayIndex - 1];
            if (!daysByName[dayName]) daysByName[dayName] = [];
            daysByName[dayName].push(event);
        });

        let html = '';
        days.forEach((day, i) => {
            const dayDate = new Date(this.gcalWeekStart);
            dayDate.setDate(dayDate.getDate() + i);
            const isToday = this.isToday(dayDate);
            const dateStr = dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const events = daysByName[day] || [];

            html += `
                <div class="gcal-day ${isToday ? 'gcal-day-today' : ''}">
                    <div class="gcal-day-header">
                        <span class="gcal-day-name">${dateStr}</span>
                        <span class="gcal-day-count">${events.length} evt</span>
                    </div>
                    <div class="gcal-day-events">
                        ${events.length === 0
                            ? '<div class="gcal-no-events">Aucun evenement</div>'
                            : events.map(ev => this.renderGcalEventCard(ev)).join('')}
                    </div>
                </div>
            `;
        });
        return html;
    }

    renderGcalEventCard(event) {
        const startTime = this.extractTime(event.start);
        const endTime = this.extractTime(event.end);
        const isAllDay = !event.start?.dateTime;
        const timeStr = isAllDay ? 'Journee entiere' : `${startTime || '?'}${endTime ? ' - ' + endTime : ''}`;

        return `
            <div class="gcal-event-card" data-event-id="${event.id}">
                <div class="gcal-event-main">
                    <div class="gcal-event-time">${timeStr}</div>
                    <div class="gcal-event-title">${event.summary || 'Sans titre'}</div>
                    ${event.location ? `<div class="gcal-event-location">${event.location}</div>` : ''}
                    ${event.description ? `<div class="gcal-event-desc">${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}</div>` : ''}
                </div>
                <div class="gcal-event-actions">
                    <button class="gcal-edit-btn btn-icon" data-event-id="${event.id}" title="Modifier">&#9998;</button>
                    <button class="gcal-delete-btn btn-icon btn-danger" data-event-id="${event.id}" title="Supprimer">&#10005;</button>
                </div>
            </div>
        `;
    }

    _getFormPrefill(ev) {
        const data = { summary: ev?.summary || '', description: ev?.description || '',
            location: ev?.location || '', startDate: '', startTime: '', endDate: '', endTime: '', allDay: false };
        if (!ev) return data;
        if (ev.start?.dateTime) {
            const sd = new Date(ev.start.dateTime);
            data.startDate = this.formatDate(sd);
            data.startTime = `${sd.getHours().toString().padStart(2,'0')}:${sd.getMinutes().toString().padStart(2,'0')}`;
        } else if (ev.start?.date) { data.startDate = ev.start.date; data.allDay = true; }
        if (ev.end?.dateTime) {
            const ed = new Date(ev.end.dateTime);
            data.endDate = this.formatDate(ed);
            data.endTime = `${ed.getHours().toString().padStart(2,'0')}:${ed.getMinutes().toString().padStart(2,'0')}`;
        } else if (ev.end?.date) { data.endDate = ev.end.date; }
        return data;
    }

    renderEventFormModal() {
        const ev = this.editingEvent;
        const isEdit = !!ev;
        const title = isEdit ? 'Modifier evenement' : 'Nouvel evenement';
        const { summary, description, location, startDate, startTime, endDate, endTime, allDay } = this._getFormPrefill(ev);

        return `
            <div id="gcal-event-modal" class="modal ${this.editingEvent !== null ? '' : 'hidden'}">
                <div class="modal-content gcal-modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button id="gcal-modal-close" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body gcal-form">
                        <div class="form-group">
                            <label>Titre *</label>
                            <input type="text" id="gcal-form-summary" value="${summary}" placeholder="RDV medecin, reunion...">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Date debut *</label>
                                <input type="date" id="gcal-form-start-date" value="${startDate}">
                            </div>
                            <div class="form-group">
                                <label>Heure debut</label>
                                <input type="time" id="gcal-form-start-time" value="${startTime}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Date fin</label>
                                <input type="date" id="gcal-form-end-date" value="${endDate}">
                            </div>
                            <div class="form-group">
                                <label>Heure fin</label>
                                <input type="time" id="gcal-form-end-time" value="${endTime}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label><input type="checkbox" id="gcal-form-allday" ${allDay ? 'checked' : ''}> Journee entiere</label>
                        </div>
                        <div class="form-group">
                            <label>Lieu</label>
                            <input type="text" id="gcal-form-location" value="${location}" placeholder="Adresse ou lieu">
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="gcal-form-description" rows="3" placeholder="Notes...">${description}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="gcal-form-save" class="btn-primary">${isEdit ? 'Modifier' : 'Creer'}</button>
                        <button id="gcal-form-cancel" class="btn-secondary">Annuler</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ---- Google Calendar CRUD methods ----

    async gcalLoadEvents() {
        const start = this.formatDate(this.gcalWeekStart);
        const end = new Date(this.gcalWeekStart);
        end.setDate(end.getDate() + 7);
        const endStr = this.formatDate(end);

        try {
            const response = await fetch(`/api/calendar/events?start=${start}&end=${endStr}`);
            const data = await response.json();
            if (data.status === 'ok') {
                this.googleConnected = data.connected !== false;
                this.gcalEvents = data.events || [];
            }
        } catch (error) {
            console.error('[Calendar] Error loading gcal events:', error);
        }
    }

    async gcalNavigateWeek(direction) {
        this.gcalWeekStart = new Date(this.gcalWeekStart.getTime() + direction * 7 * 24 * 60 * 60 * 1000);
        await this.gcalLoadEvents();
        this.render();
    }

    async gcalGoToToday() {
        this.gcalWeekStart = this.getMonday(new Date());
        await this.gcalLoadEvents();
        this.render();
    }

    async gcalCheckConnection() {
        try {
            const response = await fetch('/api/calendar/google/status');
            const data = await response.json();
            if (data.connected) {
                this.googleConnected = true;
                await this.gcalLoadEvents();
                this.showToast('Google Calendar connecte');
            } else {
                this.googleConnected = false;
                this.showToast('Non connecte: ' + (data.reason || 'token manquant'));
            }
            this.render();
        } catch (error) {
            console.error('[Calendar] Error checking connection:', error);
            this.showToast('Erreur de connexion');
        }
    }

    openEventForm(event = null) {
        this.editingEvent = event || 'new';
        this.render();
        // Focus on title field
        setTimeout(() => {
            document.getElementById('gcal-form-summary')?.focus();
        }, 100);
    }

    closeEventForm() {
        this.editingEvent = null;
        this.render();
    }

    _collectFormData() {
        return {
            summary: document.getElementById('gcal-form-summary')?.value?.trim(),
            startDate: document.getElementById('gcal-form-start-date')?.value,
            startTime: document.getElementById('gcal-form-start-time')?.value,
            endDate: document.getElementById('gcal-form-end-date')?.value,
            endTime: document.getElementById('gcal-form-end-time')?.value,
            allDay: document.getElementById('gcal-form-allday')?.checked,
            location: document.getElementById('gcal-form-location')?.value?.trim() || '',
            description: document.getElementById('gcal-form-description')?.value?.trim() || ''
        };
    }

    _buildEventDatetime(fd) {
        const endDate = fd.endDate || fd.startDate;
        if (fd.allDay) return { start: fd.startDate, end: endDate || fd.startDate };
        const startStr = `${fd.startDate}T${fd.startTime || '09:00'}:00`;
        let endStr;
        if (endDate && fd.endTime) {
            endStr = `${endDate}T${fd.endTime}:00`;
        } else if (fd.startTime) {
            const [h, m] = fd.startTime.split(':').map(Number);
            endStr = `${fd.startDate}T${(h+1).toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:00`;
        } else {
            endStr = `${fd.startDate}T10:00:00`;
        }
        return { start: startStr, end: endStr };
    }

    async _submitEvent(body, isEdit) {
        const url = isEdit
            ? `/api/calendar/google/events/${this.editingEvent.id}`
            : '/api/calendar/google/events';
        const method = isEdit ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await response.json();
        if (data.status === 'ok') {
            this.showToast(isEdit ? 'Evenement modifie' : 'Evenement cree');
            this.editingEvent = null;
            await this.gcalLoadEvents();
            this.render();
        } else {
            this.showToast('Erreur: ' + (data.message || 'echec'));
        }
    }

    async saveEvent() {
        const fd = this._collectFormData();
        if (!fd.summary) { this.showToast('Le titre est obligatoire'); return; }
        if (!fd.startDate) { this.showToast('La date de debut est obligatoire'); return; }
        const dt = this._buildEventDatetime(fd);
        const body = { summary: fd.summary, start: dt.start, end: dt.end,
            description: fd.description, location: fd.location, all_day: fd.allDay };
        try {
            const isEdit = this.editingEvent && this.editingEvent !== 'new' && this.editingEvent.id;
            await this._submitEvent(body, isEdit);
        } catch (error) {
            console.error('[Calendar] Error saving event:', error);
            this.showToast('Erreur reseau');
        }
    }

    async deleteEvent(eventId) {
        if (!confirm('Supprimer cet evenement ?')) return;

        try {
            const response = await fetch(`/api/calendar/google/events/${eventId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.status === 'ok') {
                this.showToast('Evenement supprime');
                await this.gcalLoadEvents();
                this.render();
            } else {
                this.showToast('Erreur: ' + (data.message || 'echec'));
            }
        } catch (error) {
            console.error('[Calendar] Error deleting event:', error);
            this.showToast('Erreur reseau');
        }
    }

    renderProposalModal() {
        return `
            <div id="proposal-modal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Proposition de planning</h3>
                        <button id="cancel-proposal-btn" class="close-btn">&times;</button>
                    </div>
                    <div id="proposal-content" class="modal-body">
                        <!-- Proposals will be inserted here -->
                    </div>
                    <div class="modal-footer">
                        <button id="apply-schedule-btn" class="btn-primary">Valider ce planning</button>
                        <button id="cancel-proposal-btn" class="btn-secondary">Annuler</button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Export module
const calendarModule = new CalendarModule();
export { calendarModule, CalendarModule };
