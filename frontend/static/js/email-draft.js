/**
 * Email Draft Module - Direct email composer with optional AI assistance
 * Account selector (Gmail/Hostinger) + autocomplete recipient field
 */

import API from './api.js';
import './api-features.js';
import Utils from './utils.js';

const emailDraftModule = {
    loaded: false,
    contacts: [],
    selectedContactId: null,
    selectedEmail: null,
    acIndex: -1,

    async load() {
        if (!this.loaded) {
            await this.loadContacts();
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#email-draft-contact') &&
                    !e.target.closest('#email-draft-autocomplete')) {
                    this._hideAc();
                }
            });
            this.loaded = true;
        }
    },

    async loadContacts() {
        try {
            const result = await API.aiProfile.getContacts('email');
            this.contacts = result.data || [];
        } catch {
            this.contacts = [];
        }
    },

    _getAccount() {
        const checked = document.querySelector('input[name="email-draft-account"]:checked');
        return checked ? checked.value : 'gmail';
    },

    _onInput() {
        const input = document.getElementById('email-draft-contact');
        const query = input.value.trim().toLowerCase();
        this.selectedContactId = null;
        this.selectedEmail = null;
        this.acIndex = -1;

        if (!query) {
            this._hideAc();
            document.getElementById('email-draft-contact-info').style.display = 'none';
            return;
        }

        const matches = this.contacts.filter(c => {
            const name = (c.display_name || '').toLowerCase();
            const id = (c.contact_id || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            return name.includes(query) || id.includes(query) || email.includes(query);
        }).slice(0, 8);

        const dropdown = document.getElementById('email-draft-autocomplete');
        if (matches.length === 0) {
            this._hideAc();
            return;
        }

        dropdown.innerHTML = matches.map((c, i) => {
            const label = this._escapeHtml(c.display_name || c.contact_id);
            const emailAddr = c.email ? this._escapeHtml(c.email) : '';
            const meta = [emailAddr, c.account || '', c.email_count ? `${c.email_count} emails` : '']
                .filter(Boolean).join(' | ');
            return `<div class="email-draft-ac-item" data-index="${i}" data-id="${c.contact_id}"
                         onmousedown="window.emailDraftModule._selectAc('${c.contact_id}')">
                <span class="ac-name">${label}</span>
                <span class="ac-meta">${meta}</span>
            </div>`;
        }).join('');
        dropdown.style.display = 'block';
    },

    _onKeydown(e) {
        const dropdown = document.getElementById('email-draft-autocomplete');
        if (dropdown.style.display === 'none') return;

        const items = dropdown.querySelectorAll('.email-draft-ac-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.acIndex = Math.min(this.acIndex + 1, items.length - 1);
            this._highlightAc(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.acIndex = Math.max(this.acIndex - 1, 0);
            this._highlightAc(items);
        } else if (e.key === 'Enter' && this.acIndex >= 0) {
            e.preventDefault();
            const id = items[this.acIndex].dataset.id;
            this._selectAc(id);
        } else if (e.key === 'Escape') {
            this._hideAc();
        }
    },

    _highlightAc(items) {
        items.forEach((el, i) => el.classList.toggle('active', i === this.acIndex));
    },

    _selectAc(contactId) {
        const contact = this.contacts.find(c => c.contact_id === contactId);
        if (!contact) return;

        const input = document.getElementById('email-draft-contact');
        input.value = contact.display_name || contact.contact_id;
        this.selectedContactId = contactId;
        this.selectedEmail = contact.email || contactId;
        this._hideAc();
        this._showContactInfo(contact);

        // Auto-select account matching the contact
        if (contact.account) {
            const radio = document.querySelector(
                `input[name="email-draft-account"][value="${contact.account}"]`
            );
            if (radio) radio.checked = true;
        }
    },

    async _showContactInfo(contact) {
        const infoDiv = document.getElementById('email-draft-contact-info');
        try {
            const result = await API.aiProfile.getContactContext(contact.contact_id);
            const ctx = result.data;
            document.getElementById('email-draft-contact-lang').textContent =
                ctx.language === 'en' ? 'EN' : 'FR';
            document.getElementById('email-draft-contact-account').textContent =
                ctx.account || contact.account || '';
            document.getElementById('email-draft-contact-count').textContent =
                `${contact.email_count || '?'} emails`;
            infoDiv.style.display = 'flex';
        } catch {
            infoDiv.style.display = 'none';
        }
    },

    _hideAc() {
        document.getElementById('email-draft-autocomplete').style.display = 'none';
        this.acIndex = -1;
    },

    async sendEmail() {
        const to = this.selectedEmail ||
            document.getElementById('email-draft-contact').value.trim();
        const subject = document.getElementById('email-draft-subject').value.trim();
        const body = document.getElementById('email-draft-body').value.trim();
        const account = this._getAccount();

        if (!to || !body) {
            Utils.showToast('Choisir un destinataire et rediger le mail', 'error');
            return;
        }

        const label = this.selectedContactId
            ? (this.contacts.find(c => c.contact_id === this.selectedContactId)?.display_name || to)
            : to;
        if (!confirm(`Envoyer via ${account} a ${label} ?`)) return;

        const btn = document.getElementById('email-draft-btn-send');
        btn.disabled = true;
        btn.textContent = 'Envoi...';

        try {
            const payload = { channel: 'email', to, body, account };
            if (subject) payload.subject = subject;
            await API.aiProfile.sendMessage(payload);
            Utils.showToast(`Email envoye via ${account}`, 'success');
            document.getElementById('email-draft-body').value = '';
            document.getElementById('email-draft-subject').value = '';
        } catch (err) {
            Utils.showToast(`Erreur envoi: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Envoyer';
        }
    },

    copyBody() {
        const text = document.getElementById('email-draft-body').value;
        if (!text) {
            Utils.showToast('Rien a copier', 'error');
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            Utils.showToast('Copie dans le presse-papier', 'success');
        });
    },

    async generateWithAI() {
        const contactId = this.selectedContactId;
        const subject = document.getElementById('email-draft-subject').value.trim();
        const context = document.getElementById('email-draft-context').value.trim();

        if (!contactId || !subject || !context) {
            Utils.showToast('Remplir destinataire (contact), sujet et contexte', 'error');
            return;
        }

        const btn = document.getElementById('email-draft-btn-ai');
        btn.disabled = true;
        btn.textContent = 'Generation...';

        try {
            const result = await API.aiProfile.generateDraft({
                contact_id: contactId, subject, context, channel: 'email'
            });
            const data = result.data;
            document.getElementById('email-draft-body').value = data.draft;

            const meta = [];
            if (data.language) meta.push(data.language === 'en' ? 'EN' : 'FR');
            if (data.examples_used) meta.push(`${data.examples_used} ex.`);
            if (data.usage) meta.push(`${data.usage.input_tokens}+${data.usage.output_tokens} tok`);
            document.getElementById('email-draft-ai-meta').textContent = meta.join(' | ');

            Utils.showToast('Brouillon genere — verifiez avant envoi', 'success');
        } catch (err) {
            Utils.showToast(`Erreur: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Generer avec IA';
        }
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

window.emailDraftModule = emailDraftModule;
export default emailDraftModule;
