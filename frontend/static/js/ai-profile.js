/**
 * AI Profile Module - Draft generation + Notifications
 */

import API from './api.js';
import './api-features.js';
import Utils from './utils.js';

const aiProfileModule = {
    loaded: false,
    contacts: [],

    async load() {
        if (!this.loaded) {
            await this.loadContacts();
            this.loaded = true;
        }
        this.loadNotificationStats();
    },

    switchSubTab(tabName) {
        document.querySelectorAll('.ai-profile-subtab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === tabName);
        });
        document.querySelectorAll('.ai-profile-subtab-content').forEach(el => {
            el.classList.toggle('active', el.id === `ai-profile-tab-${tabName}`);
        });
        if (tabName === 'notifications') {
            this.loadNotifications();
        }
    },

    // --- Draft Generation ---

    async loadContacts() {
        const select = document.getElementById('ai-profile-contact');
        try {
            const result = await API.aiProfile.getContacts();
            this.contacts = result.data || [];
            select.innerHTML = '<option value="">-- Choisir un contact --</option>';
            this.contacts.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.contact_id;
                opt.textContent = `${c.contact_id} (${c.email_count} emails)`;
                select.appendChild(opt);
            });
            select.addEventListener('change', () => this._onContactChange());
        } catch {
            select.innerHTML = '<option value="">Service indisponible</option>';
        }
    },

    async _onContactChange() {
        const contactId = document.getElementById('ai-profile-contact').value;
        const infoDiv = document.getElementById('ai-profile-contact-info');
        if (!contactId) {
            infoDiv.style.display = 'none';
            return;
        }
        try {
            const result = await API.aiProfile.getContactContext(contactId);
            const ctx = result.data;
            const contact = this.contacts.find(c => c.contact_id === contactId);
            document.getElementById('ai-profile-contact-lang').textContent =
                ctx.language === 'en' ? 'EN' : 'FR';
            document.getElementById('ai-profile-contact-account').textContent = ctx.account;
            document.getElementById('ai-profile-contact-count').textContent =
                `${contact?.email_count || '?'} emails`;
            infoDiv.style.display = 'flex';
        } catch {
            infoDiv.style.display = 'none';
        }
    },

    async generateDraft() {
        const contactId = document.getElementById('ai-profile-contact').value;
        const subject = document.getElementById('ai-profile-subject').value.trim();
        const context = document.getElementById('ai-profile-context').value.trim();

        if (!contactId || !subject || !context) {
            Utils.showToast('Remplir tous les champs', 'error');
            return;
        }

        const btn = document.getElementById('ai-profile-btn-generate');
        btn.disabled = true;
        btn.textContent = 'Generation en cours...';

        try {
            const result = await API.aiProfile.generateDraft({ contact_id: contactId, subject, context });
            const data = result.data;

            document.getElementById('ai-profile-draft-text').textContent = data.draft;
            document.getElementById('ai-profile-draft-lang').textContent =
                data.language === 'en' ? 'EN' : 'FR';
            document.getElementById('ai-profile-draft-examples').textContent =
                `${data.examples_used} exemples`;
            document.getElementById('ai-profile-draft-tokens').textContent =
                `${data.usage.input_tokens}+${data.usage.output_tokens} tokens`;
            document.getElementById('ai-profile-draft-result').style.display = 'block';

            Utils.showToast('Brouillon genere', 'success');
        } catch (err) {
            Utils.showToast(`Erreur: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Generer le brouillon';
        }
    },

    copyDraft() {
        const text = document.getElementById('ai-profile-draft-text').textContent;
        navigator.clipboard.writeText(text).then(() => {
            Utils.showToast('Copie dans le presse-papier', 'success');
        });
    },

    // --- Notifications ---

    async loadNotificationStats() {
        try {
            const result = await API.aiProfile.getNotificationStats();
            const stats = result.data;
            const badge = document.getElementById('ai-profile-notif-badge');
            const unread = stats?.unread || 0;
            if (unread > 0) {
                badge.textContent = unread;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        } catch {
            // Service may be down
        }
    },

    async loadNotifications() {
        const listEl = document.getElementById('ai-profile-notif-list');
        const source = document.getElementById('ai-profile-notif-source')?.value || '';
        const status = document.getElementById('ai-profile-notif-status')?.value || '';

        listEl.innerHTML = '<div class="ai-profile-loading">Chargement...</div>';

        try {
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            if (source) params.set('contact_id', source);
            params.set('limit', '50');

            const result = await API.aiProfile.getNotifications(params.toString());
            const notifications = result.data || [];

            document.getElementById('ai-profile-notif-count').textContent =
                `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`;

            if (notifications.length === 0) {
                listEl.innerHTML = '<div class="ai-profile-empty">Aucune notification</div>';
                return;
            }

            listEl.innerHTML = notifications.map(n => this._renderNotification(n)).join('');
        } catch {
            listEl.innerHTML = '<div class="ai-profile-empty">Service indisponible</div>';
        }
    },

    _renderNotification(n) {
        const sourceIcon = {
            whatsapp: '💬', linkedin: '💼', gmail: '📧', hostinger: '📨'
        }[n.source] || '🔔';
        const isNew = n.status === 'new';
        const date = n.created_at ? new Date(n.created_at).toLocaleString('fr-FR') : '';

        return `
            <div class="ai-profile-notif-item ${isNew ? 'ai-profile-notif-new' : ''}" data-id="${n.id}">
                <div class="ai-profile-notif-icon">${sourceIcon}</div>
                <div class="ai-profile-notif-body">
                    <div class="ai-profile-notif-title">
                        <strong>${this._escapeHtml(n.contact_name || n.contact_id || 'Inconnu')}</strong>
                        <span class="ai-profile-notif-source">${n.source || ''}</span>
                    </div>
                    <div class="ai-profile-notif-preview">${this._escapeHtml(n.preview || n.subject || '')}</div>
                    <div class="ai-profile-notif-date">${date}</div>
                </div>
                ${isNew ? `<button class="ai-profile-btn-mark-read" onclick="window.aiProfileModule.markAsRead(${n.id})">Lu</button>` : ''}
            </div>
        `;
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    async markAsRead(id) {
        try {
            await API.aiProfile.markAsRead(id);
            this.loadNotifications();
            this.loadNotificationStats();
        } catch (err) {
            Utils.showToast(`Erreur: ${err.message}`, 'error');
        }
    },

    async triggerScan() {
        try {
            Utils.showToast('Scan en cours...', 'info');
            await API.aiProfile.triggerScan();
            Utils.showToast('Scan termine', 'success');
            this.loadNotifications();
            this.loadNotificationStats();
        } catch (err) {
            Utils.showToast(`Erreur scan: ${err.message}`, 'error');
        }
    }
};

window.aiProfileModule = aiProfileModule;

export default aiProfileModule;
