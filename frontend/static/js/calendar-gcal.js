/**
 * Calendar Google Calendar Module - Google Calendar tab, CRUD, event form, scheduling
 * Extracted from calendar.js for modularity
 */

/**
 * Attach Google Calendar methods to a CalendarModule instance.
 * Call initGcalMixin(instance) after constructing the module.
 */
export function initGcalMixin(module) {

    // ============== Google Calendar Tab Rendering ==============

    module.renderGoogleCalendarTab = function() {
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
    };

    module.renderGcalDisconnected = function() {
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
    };

    module.renderGcalNav = function() {
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
    };

    module.renderGcalEventsByDay = function() {
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        const daysByName = this._groupEventsByDay(days);

        let html = '';
        days.forEach((day, i) => {
            html += this._renderGcalDaySection(day, i, daysByName);
        });
        return html;
    };

    module._groupEventsByDay = function(days) {
        const daysByName = {};
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
        return daysByName;
    };

    module._renderGcalDaySection = function(day, index, daysByName) {
        const dayDate = new Date(this.gcalWeekStart);
        dayDate.setDate(dayDate.getDate() + index);
        const isToday = this.isToday(dayDate);
        const dateStr = dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const events = daysByName[day] || [];

        return `
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
    };

    module.renderGcalEventCard = function(event) {
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
    };

    // ============== Event Form Modal ==============

    module._getFormPrefill = function(ev) {
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
    };

    module.renderEventFormModal = function() {
        const ev = this.editingEvent;
        const isEdit = !!ev;
        const title = isEdit ? 'Modifier evenement' : 'Nouvel evenement';
        const prefill = this._getFormPrefill(ev);

        return `
            <div id="gcal-event-modal" class="modal ${this.editingEvent !== null ? '' : 'hidden'}">
                <div class="modal-content gcal-modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button id="gcal-modal-close" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body gcal-form">
                        ${this._renderFormFields(prefill)}
                    </div>
                    <div class="modal-footer">
                        <button id="gcal-form-save" class="btn-primary">${isEdit ? 'Modifier' : 'Creer'}</button>
                        <button id="gcal-form-cancel" class="btn-secondary">Annuler</button>
                    </div>
                </div>
            </div>
        `;
    };

    module._renderFormFields = function(p) {
        return `
            <div class="form-group">
                <label>Titre *</label>
                <input type="text" id="gcal-form-summary" value="${p.summary}" placeholder="RDV medecin, reunion...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Date debut *</label>
                    <input type="date" id="gcal-form-start-date" value="${p.startDate}">
                </div>
                <div class="form-group">
                    <label>Heure debut</label>
                    <input type="time" id="gcal-form-start-time" value="${p.startTime}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Date fin</label>
                    <input type="date" id="gcal-form-end-date" value="${p.endDate}">
                </div>
                <div class="form-group">
                    <label>Heure fin</label>
                    <input type="time" id="gcal-form-end-time" value="${p.endTime}">
                </div>
            </div>
            <div class="form-group">
                <label><input type="checkbox" id="gcal-form-allday" ${p.allDay ? 'checked' : ''}> Journee entiere</label>
            </div>
            <div class="form-group">
                <label>Lieu</label>
                <input type="text" id="gcal-form-location" value="${p.location}" placeholder="Adresse ou lieu">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="gcal-form-description" rows="3" placeholder="Notes...">${p.description}</textarea>
            </div>
        `;
    };

    // ============== Google Calendar CRUD ==============

    module.gcalLoadEvents = async function() {
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
    };

    module.gcalNavigateWeek = async function(direction) {
        this.gcalWeekStart = new Date(this.gcalWeekStart.getTime() + direction * 7 * 24 * 60 * 60 * 1000);
        await this.gcalLoadEvents();
        this.render();
    };

    module.gcalGoToToday = async function() {
        this.gcalWeekStart = this.getMonday(new Date());
        await this.gcalLoadEvents();
        this.render();
    };

    module.gcalCheckConnection = async function() {
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
    };

    module.openEventForm = function(event = null) {
        this.editingEvent = event || 'new';
        this.render();
        setTimeout(() => {
            document.getElementById('gcal-form-summary')?.focus();
        }, 100);
    };

    module.closeEventForm = function() {
        this.editingEvent = null;
        this.render();
    };

    module._collectFormData = function() {
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
    };

    module._buildEventDatetime = function(fd) {
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
    };

    module._submitEvent = async function(body, isEdit) {
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
    };

    module.saveEvent = async function() {
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
    };

    module.deleteEvent = async function(eventId) {
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
    };

    // ============== Scheduling (Claude proposals) ==============

    module.proposeSchedule = async function() {
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
    };

    module.showProposalModal = function() {
        const modal = document.getElementById('proposal-modal');
        const content = document.getElementById('proposal-content');

        if (!this.proposals || this.proposals.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <p>Aucun TODO P1/P2 a planifier pour cette semaine.</p>
                </div>
            `;
        } else {
            content.innerHTML = this.proposals.map(p => this._renderProposalItem(p)).join('');
        }

        modal.classList.remove('hidden');
        document.getElementById('apply-schedule-btn').style.display =
            this.proposals && this.proposals.length > 0 ? 'inline-block' : 'none';
    };

    module._renderProposalItem = function(p) {
        return `
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
        `;
    };

    module.cancelProposal = function() {
        this.proposals = null;
        document.getElementById('proposal-modal').classList.add('hidden');
    };

    module.applySchedule = async function() {
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
    };

    module.renderProposalModal = function() {
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
    };

    // ============== Google Connection UI ==============

    module.connectGoogle = async function() {
        alert('Run: cd /data/projects/homehub-v2 && python3 scripts/google_calendar_auth.py');
    };

    module.disconnectGoogle = async function() {
        alert('To disconnect, delete credentials/google_calendar_token.json');
    };

}
