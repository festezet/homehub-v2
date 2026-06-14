/**
 * Patrimoine Module
 * Editable patrimoine table with snapshots, accounts, balances
 */

import API from './api.js';

class PatrimoineModule {
    constructor() {
        this.data = null;
        this.editMode = false;
        this.changes = {};
        this.loaded = false;
    }

    async load() {
        await Promise.all([
            this._loadTable(),
            this._loadSummary()
        ]);
        this._bindEvents();
        this.loaded = true;
    }

    // ---- Data loading ----

    async _loadTable() {
        try {
            const res = await API.patrimoine.getTable();
            this.data = res;
            this._renderTable();
        } catch (e) {
            console.error('Patrimoine table error:', e);
            const tbody = document.getElementById('pat-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#f38ba8; padding:40px;">Erreur chargement</td></tr>';
        }
    }

    async _loadSummary() {
        try {
            const res = await API.patrimoine.getSummary();
            this._setText('pat-total', this._fmtEur(res.total || 0));
            if (res.snapshot_date) {
                const label = res.snapshot_label || res.snapshot_date;
                this._setText('pat-snapshot-date', `Snapshot: ${label}`);
            }
            // Category breakdown
            const catDiv = document.getElementById('pat-cats-summary');
            if (catDiv && res.by_category) {
                catDiv.innerHTML = res.by_category.map(c =>
                    `<div class="pat-summary-label">${this._esc(c.name)}</div>
                     <div style="font-size:1.1rem; font-weight:600;">${this._fmtEur(c.total)}</div>`
                ).join('');
            }
        } catch (e) {
            console.error('Patrimoine summary error:', e);
        }
    }

    // ---- Rendering ----

    _renderTable() {
        if (!this.data) return;
        const { snapshots, categories, grand_totals } = this.data;

        // Header
        const thead = document.getElementById('pat-thead');
        if (thead) {
            thead.innerHTML = `<tr>
                <th>Compte</th>
                ${snapshots.map(s => `<th>${this._esc(s.label || s.snapshot_date)}${this.editMode ? `<br><button class="pat-delete-btn" onclick="window.PatrimoineModule.deleteSnapshot(${s.id})" title="Supprimer">x</button>` : ''}</th>`).join('')}
            </tr>`;
        }

        // Body
        const tbody = document.getElementById('pat-tbody');
        if (!tbody) return;

        let html = '';
        for (const cat of categories) {
            // Category header row
            html += `<tr class="pat-cat-row"><td colspan="${snapshots.length + 1}">${this._esc(cat.name)}</td></tr>`;

            // Account rows
            for (const acc of cat.accounts) {
                html += `<tr class="pat-acct-row">`;
                html += `<td>${this._esc(acc.name)}${this.editMode ? `<button class="pat-delete-btn" onclick="window.PatrimoineModule.deleteAccount(${acc.id})" title="Supprimer">x</button>` : ''}</td>`;
                for (let i = 0; i < snapshots.length; i++) {
                    const snap = snapshots[i];
                    const amount = acc.balances[String(snap.id)] || 0;
                    const key = `${acc.id}_${snap.id}`;
                    const changed = this.changes[key] !== undefined;

                    if (this.editMode) {
                        const val = changed ? this.changes[key] : amount;
                        html += `<td><input class="pat-cell-input${changed ? ' pat-cell-changed' : ''}"
                            type="number" step="0.01" value="${val}"
                            data-account="${acc.id}" data-snapshot="${snap.id}"
                            onchange="window.PatrimoineModule.onCellChange(this)"></td>`;
                    } else {
                        // Show delta vs previous snapshot
                        let delta = '';
                        if (i > 0 && amount !== 0) {
                            const prevAmount = acc.balances[String(snapshots[i - 1].id)] || 0;
                            if (prevAmount !== 0) {
                                const diff = amount - prevAmount;
                                if (diff > 0) delta = `<span class="pat-delta-pos">+${this._fmtNum(diff)}</span>`;
                                else if (diff < 0) delta = `<span class="pat-delta-neg">${this._fmtNum(diff)}</span>`;
                            }
                        }
                        html += `<td>${this._fmtEur(amount)}${delta ? '<br>' + delta : ''}</td>`;
                    }
                }
                html += `</tr>`;
            }

            // Category total row
            html += `<tr class="pat-cat-row"><td><strong>Total ${this._esc(cat.name)}</strong></td>`;
            for (const snap of snapshots) {
                const total = cat.totals[String(snap.id)] || 0;
                html += `<td style="text-align:right; font-weight:700;">${this._fmtEur(total)}</td>`;
            }
            html += `</tr>`;
        }
        tbody.innerHTML = html;

        // Footer (grand total)
        const tfoot = document.getElementById('pat-tfoot');
        if (tfoot) {
            let footHtml = `<tr class="pat-total-row"><td><strong>TOTAL PATRIMOINE</strong></td>`;
            for (const snap of snapshots) {
                footHtml += `<td style="text-align:right;">${this._fmtEur(grand_totals[String(snap.id)] || 0)}</td>`;
            }
            footHtml += `</tr>`;
            tfoot.innerHTML = footHtml;
        }
    }

    // ---- Edit mode ----

    toggleEditMode() {
        this.editMode = !this.editMode;
        this.changes = {};
        this._setText('pat-edit-toggle', this.editMode ? 'Annuler modif' : 'Modifier');
        const saveBar = document.getElementById('pat-save-bar');
        if (saveBar) saveBar.style.display = this.editMode ? 'flex' : 'none';
        this._updateChangesCount();
        this._renderTable();
    }

    onCellChange(input) {
        const accId = input.dataset.account;
        const snapId = input.dataset.snapshot;
        const key = `${accId}_${snapId}`;
        const newVal = parseFloat(input.value) || 0;

        // Compare to original
        const original = this._getOriginalAmount(parseInt(accId), parseInt(snapId));
        if (newVal === original) {
            delete this.changes[key];
            input.classList.remove('pat-cell-changed');
        } else {
            this.changes[key] = newVal;
            input.classList.add('pat-cell-changed');
        }
        this._updateChangesCount();
    }

    _getOriginalAmount(accountId, snapshotId) {
        if (!this.data) return 0;
        for (const cat of this.data.categories) {
            for (const acc of cat.accounts) {
                if (acc.id === accountId) {
                    return acc.balances[String(snapshotId)] || 0;
                }
            }
        }
        return 0;
    }

    _updateChangesCount() {
        const count = Object.keys(this.changes).length;
        this._setText('pat-changes-count', `${count} modification(s)`);
    }

    async saveChanges() {
        const entries = Object.entries(this.changes);
        if (!entries.length) return;

        const balances = entries.map(([key, amount]) => {
            const [account_id, snapshot_id] = key.split('_').map(Number);
            return { account_id, snapshot_id, amount };
        });

        try {
            await API.patrimoine.batchUpsertBalances(balances);
            this.editMode = false;
            this.changes = {};
            this._setText('pat-edit-toggle', 'Modifier');
            const saveBar = document.getElementById('pat-save-bar');
            if (saveBar) saveBar.style.display = 'none';
            await this._refresh();
        } catch (e) {
            console.error('Save error:', e);
            alert('Erreur sauvegarde: ' + (e.message || 'inconnue'));
        }
    }

    cancelChanges() {
        this.changes = {};
        this._renderTable();
        this._updateChangesCount();
    }

    // ---- Snapshot CRUD ----

    showAddSnapshot() {
        const dateInput = document.getElementById('pat-snap-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        document.getElementById('pat-snap-label').value = '';
        document.getElementById('pat-snap-modal').style.display = 'flex';
    }

    async submitSnapshot() {
        const date = document.getElementById('pat-snap-date')?.value;
        const label = document.getElementById('pat-snap-label')?.value || '';
        if (!date) return alert('Date requise');

        try {
            await API.patrimoine.createSnapshot({ snapshot_date: date, label });
            this.closeModals();
            await this._refresh();
        } catch (e) {
            console.error('Create snapshot error:', e);
            alert('Erreur: ' + (e.message || 'inconnue'));
        }
    }

    async deleteSnapshot(id) {
        if (!confirm('Supprimer ce snapshot et toutes ses balances ?')) return;
        try {
            await API.patrimoine.deleteSnapshot(id);
            await this._refresh();
        } catch (e) {
            console.error('Delete snapshot error:', e);
        }
    }

    // ---- Account CRUD ----

    async showAddAccount() {
        document.getElementById('pat-acct-name').value = '';
        document.getElementById('pat-acct-type').value = '';
        document.getElementById('pat-acct-notes').value = '';

        // Load categories into select
        const select = document.getElementById('pat-acct-category');
        if (select) {
            try {
                const res = await API.patrimoine.getCategories();
                select.innerHTML = (res.categories || []).map(c =>
                    `<option value="${c.id}">${this._esc(c.name)}</option>`
                ).join('');
            } catch (e) {
                console.error('Load categories error:', e);
            }
        }
        document.getElementById('pat-acct-modal').style.display = 'flex';
    }

    async submitAccount() {
        const name = document.getElementById('pat-acct-name')?.value?.trim();
        const category_id = parseInt(document.getElementById('pat-acct-category')?.value);
        const account_type = document.getElementById('pat-acct-type')?.value?.trim() || '';
        const notes = document.getElementById('pat-acct-notes')?.value?.trim() || '';

        if (!name) return alert('Nom requis');
        if (!category_id) return alert('Categorie requise');

        try {
            await API.patrimoine.createAccount({ name, category_id, account_type, notes });
            this.closeModals();
            await this._refresh();
        } catch (e) {
            console.error('Create account error:', e);
            alert('Erreur: ' + (e.message || 'inconnue'));
        }
    }

    async deleteAccount(id) {
        if (!confirm('Supprimer ce compte et toutes ses balances ?')) return;
        try {
            await API.patrimoine.deleteAccount(id);
            await this._refresh();
        } catch (e) {
            console.error('Delete account error:', e);
        }
    }

    // ---- Helpers ----

    closeModals() {
        document.getElementById('pat-snap-modal').style.display = 'none';
        document.getElementById('pat-acct-modal').style.display = 'none';
    }

    async _refresh() {
        await Promise.all([this._loadTable(), this._loadSummary()]);
    }

    _bindEvents() {
        // Close modals on background click
        ['pat-snap-modal', 'pat-acct-modal'].forEach(id => {
            const modal = document.getElementById(id);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) this.closeModals();
                });
            }
        });
    }

    _fmtEur(n) {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
    }

    _fmtNum(n) {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
    }

    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    _esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

const patrimoineModule = new PatrimoineModule();
window.PatrimoineModule = patrimoineModule;
export default patrimoineModule;
