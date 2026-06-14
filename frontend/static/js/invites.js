/**
 * Invites Module
 * Send calendar invitations (.ics) via Hostinger or Gmail
 */

import API from './api.js';

class InvitesModule {
    constructor() {
        this.history = [];
        this.loaded = false;
    }

    async load() {
        this._bindEvents();
        this._setDefaultDate();
        this.loaded = true;
    }

    _setDefaultDate() {
        const dateInput = document.getElementById('inv-date');
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        }
    }

    _bindEvents() {
        document.getElementById('inv-search-btn')?.addEventListener('click', () => this.searchContact());
        document.getElementById('inv-preview-btn')?.addEventListener('click', () => this.preview());
        document.getElementById('inv-send-btn')?.addEventListener('click', () => this.send());
        document.getElementById('inv-result-close')?.addEventListener('click', () => this._hideResult());

        // Search on Enter in name field
        document.getElementById('inv-to-name')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchContact();
            }
        });
    }

    _getFormData() {
        return {
            to_name: document.getElementById('inv-to-name')?.value.trim() || '',
            to_email: document.getElementById('inv-to-email')?.value.trim() || '',
            subject: document.getElementById('inv-subject')?.value.trim() || '',
            date: document.getElementById('inv-date')?.value || '',
            time: document.getElementById('inv-time')?.value || '',
            duration: document.getElementById('inv-duration')?.value || '60',
            location: document.getElementById('inv-location')?.value.trim() || '',
            description: document.getElementById('inv-description')?.value.trim() || '',
            account: document.getElementById('inv-account')?.value || 'hostinger',
            with_meet: document.getElementById('inv-with-meet')?.checked || false,
        };
    }

    _validate(data) {
        const missing = [];
        if (!data.to_name) missing.push('Nom');
        if (!data.to_email) missing.push('Email');
        if (!data.subject) missing.push('Objet');
        if (!data.date) missing.push('Date');
        if (!data.time) missing.push('Heure');
        return missing;
    }

    async searchContact() {
        const query = document.getElementById('inv-to-name')?.value.trim();
        if (!query || query.length < 2) {
            window.Utils?.showToast('Saisissez au moins 2 caracteres', 'warning');
            return;
        }

        try {
            const result = await API.invites.searchContact(query);
            const contacts = result.contacts || [];
            const container = document.getElementById('inv-contact-results');
            if (!container) return;

            if (contacts.length === 0) {
                container.innerHTML = '<p style="font-size: 0.85rem; opacity: 0.6; padding: 4px 0;">Aucun contact trouve</p>';
                container.style.display = 'block';
                setTimeout(() => { container.style.display = 'none'; }, 3000);
                return;
            }

            container.innerHTML = contacts.map(c => `
                <div class="inv-contact-item" data-name="${this._esc(c.name)}" data-email="${this._esc(c.email)}"
                     style="padding: 8px 12px; background: var(--surface, #181825); border-radius: 6px;
                            margin-bottom: 4px; cursor: pointer; font-size: 0.85rem; display: flex; justify-content: space-between;"
                     onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                    <span><strong>${this._esc(c.name)}</strong>${c.company ? ' - ' + this._esc(c.company) : ''}</span>
                    <span style="opacity: 0.6;">${this._esc(c.email)}</span>
                </div>
            `).join('');
            container.style.display = 'block';

            container.querySelectorAll('.inv-contact-item').forEach(item => {
                item.addEventListener('click', () => {
                    document.getElementById('inv-to-name').value = item.dataset.name;
                    document.getElementById('inv-to-email').value = item.dataset.email;
                    container.style.display = 'none';
                });
            });
        } catch (err) {
            window.Utils?.showToast('Erreur recherche contact: ' + err.message, 'error');
        }
    }

    async preview() {
        const data = this._getFormData();
        const missing = this._validate(data);
        if (missing.length) {
            window.Utils?.showToast('Champs manquants: ' + missing.join(', '), 'warning');
            return;
        }

        try {
            const result = await API.invites.preview(data);
            this._showResult('Previsualisation', result.recap + '\n\n--- ICS ---\n' + result.ics_content);
        } catch (err) {
            window.Utils?.showToast('Erreur preview: ' + err.message, 'error');
        }
    }

    async send() {
        const data = this._getFormData();
        const missing = this._validate(data);
        if (missing.length) {
            window.Utils?.showToast('Champs manquants: ' + missing.join(', '), 'warning');
            return;
        }

        if (!confirm(`Envoyer l'invitation a ${data.to_name} <${data.to_email}> ?`)) return;

        const btn = document.getElementById('inv-send-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Envoi...'; }

        try {
            const result = await API.invites.send(data);
            window.Utils?.showToast(`Invitation envoyee a ${result.to}`, 'success');
            let recap = `UID: ${result.uid}\nCompte: ${result.account}\nDestinataire: ${result.to}`;
            if (result.meet_link) recap += `\nGoogle Meet: ${result.meet_link}`;
            this._showResult('Invitation envoyee', recap);

            this.history.unshift({
                to_name: data.to_name, to_email: data.to_email,
                subject: data.subject, date: data.date, time: data.time,
                account: data.account, uid: result.uid,
                sent_at: new Date().toLocaleTimeString('fr-FR'),
            });
            this._renderHistory();
        } catch (err) {
            window.Utils?.showToast('Erreur envoi: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Envoyer'; }
        }
    }

    _showResult(title, content) {
        const zone = document.getElementById('inv-result-zone');
        if (!zone) return;
        document.getElementById('inv-result-title').textContent = title;
        document.getElementById('inv-result-content').textContent = content;
        zone.style.display = 'block';
    }

    _hideResult() {
        const zone = document.getElementById('inv-result-zone');
        if (zone) zone.style.display = 'none';
    }

    _renderHistory() {
        const card = document.getElementById('inv-history-card');
        const list = document.getElementById('inv-history-list');
        if (!card || !list || this.history.length === 0) return;

        card.style.display = 'block';
        list.innerHTML = this.history.map(h => `
            <div style="padding: 8px 12px; background: var(--surface, #181825); border-radius: 6px;
                        margin-bottom: 4px; font-size: 0.85rem; display: flex; justify-content: space-between;">
                <span><strong>${this._esc(h.subject)}</strong> &rarr; ${this._esc(h.to_name)}</span>
                <span style="opacity: 0.6;">${h.date} ${h.time} (${h.account}) - ${h.sent_at}</span>
            </div>
        `).join('');
    }

    _esc(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
}

const invitesModule = new InvitesModule();
window.InvitesModule = invitesModule;
export default invitesModule;
