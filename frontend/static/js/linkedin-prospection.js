/**
 * LinkedIn Prospection Module — port HomeHub
 * Source : /data/projects/linkedin-prospection/frontend/static/js/app.js
 * Backend : /api/linkedin-prospection/*
 */

const LP_API_BASE = '/api/linkedin-prospection';
const LP_PER_PAGE = 20;

const LP_PIPELINE_STAGES = [
    { n: 1,  title: 'Sources',              sub: 'Phantombuster phantoms',          tool: 'Phantombuster',     icon: '🔍',
      dbs: [{ t: 'scraping_sources', k: 'scraping_sources' }, { t: 'phantombuster_runs', k: 'pb_runs' }] },
    { n: 2,  title: 'Import contacts',      sub: 'Normalisation + dedup',           tool: 'pb_import.py',      icon: '⬇',
      dbs: [{ t: 'contacts', k: 'contacts_total' }] },
    { n: 3,  title: 'Scoring Tier 1',       sub: 'Algorithmique 0–100',             tool: 'score_leads.py',    icon: '⚙',
      dbs: [{ t: 'contacts.linkedin_score', k: 'tier1_scored' }] },
    { n: 4,  title: 'Signal Radar',         sub: 'RSS feeds offshore wind / IA',    tool: 'signal_radar.py',   icon: '📡',
      dbs: [{ t: 'signals', k: 'signals' }, { t: 'signal_matches', k: 'signal_matches' }] },
    { n: 5,  title: 'Enrichissement',       sub: 'PB Profile Scraper',              tool: 'Phantombuster',     icon: '✨',
      dbs: [{ t: 'contacts (about, tenure)', k: 'enriched' }] },
    { n: 6,  title: 'Scoring Tier 2',       sub: 'Claude Sonnet (5 subagents)',     tool: 'score_leads_pierre',icon: '🤖',
      dbs: [{ t: 'contacts.pierre_score', k: 'tier2_scored' }],
      badges: [{ l: 'HOT', k: 'tier2_hot', c: 'hot' }, { l: 'WARM', k: 'tier2_warm', c: 'warm' }, { l: 'COLD', k: 'tier2_cold', c: 'cold' }] },
    { n: 7,  title: 'Generation icebreakers', sub: 'Claude Sonnet — fr/en, <300 char', tool: 'Claude Sonnet',  icon: '✉',
      highlight: true,
      dbs: [{ t: 'contacts.icebreaker_message', k: 'icebreakers' }] },
    { n: 8,  title: 'Review manuel',        sub: 'Frontend → page Icebreakers',     tool: 'Toi (humain)',      icon: '👁',
      dbs: [{ t: 'linkedin_messages.draft', k: 'msg_draft' }] },
    { n: 9,  title: 'Envoi LinkedIn',       sub: 'en-offshore — mardi/mercredi 8–10h', tool: 'LinkedIn',       icon: '📤',
      dbs: [{ t: 'linkedin_messages.sent', k: 'msg_sent' }] },
    { n: 10, title: 'Tracking pipeline',    sub: 'connected → replied → meeting',   tool: 'airtable_sync.py',  icon: '🎯',
      dbs: [{ t: 'connected', k: 'connected' }, { t: 'replied', k: 'replied' }, { t: 'meeting', k: 'meeting' }] },
];

class LinkedInProspectionModule {
    constructor() {
        this.loaded = false;
        this.state = {
            currentPage: 'dashboard',
            leadsPage: 1,
            leadsTotal: 0,
            accountFilter: '',
            leadsSort: 'deepsignal',
            leadsOrder: 'desc',
        };
        this._icebreakersCache = { contacts: [], batches: [] };
    }

    async load() {
        if (!this.loaded) {
            this._bindEvents();
            this.loaded = true;
        }
        // Naviguer vers la page courante (par defaut dashboard) a chaque load
        this.navigate(this.state.currentPage);
    }

    // ── API helpers ────────────────────────────────────────────────

    async _apiFetch(path, opts = {}) {
        try {
            const resp = await fetch(LP_API_BASE + path, opts);
            const json = await resp.json();
            if (!resp.ok || !json.ok) throw new Error(json.error || resp.statusText);
            return json.data;
        } catch (err) {
            console.error('LP API error:', path, err);
            return null;
        }
    }

    _scoreBadge(score) {
        if (score == null) return '<span class="lp-score-badge lp-cold">—</span>';
        const tier = score >= 70 ? 'lp-hot' : score >= 40 ? 'lp-warm' : 'lp-cold';
        return `<span class="lp-score-badge ${tier}">${score}</span>`;
    }

    _pierreBadge(score, classification) {
        if (score == null) return '<span class="lp-score-badge lp-none">—</span>';
        const cls = (classification || '').toLowerCase();
        const tier = cls === 'hot' || cls === 'warm' || cls === 'cold'
            ? 'lp-' + cls
            : (score >= 7 ? 'lp-hot' : score >= 4 ? 'lp-warm' : 'lp-cold');
        return `<span class="lp-score-badge ${tier}">${score}/10</span>`;
    }

    _statusBadge(status) {
        const s = (status || 'none').toLowerCase();
        return `<span class="lp-status-badge lp-${s}">${s}</span>`;
    }

    _truncate(text, len = 120) {
        if (!text) return '';
        return text.length > len ? text.slice(0, len) + '...' : text;
    }

    _fullName(lead) {
        return [lead.prenom, lead.nom].filter(Boolean).join(' ') || '—';
    }

    _formatDate(d) {
        if (!d) return '—';
        return d.slice(0, 10);
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // ── Events ─────────────────────────────────────────────────────

    _bindEvents() {
        // Mini-nav interne
        document.querySelectorAll('.lp-nav-links a').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                this.navigate(link.dataset.lpPage);
            });
        });

        // Filtre compte
        const acctFilter = document.getElementById('lp-accountFilter');
        if (acctFilter) {
            acctFilter.addEventListener('change', e => {
                this.state.accountFilter = e.target.value;
                if (this.state.currentPage === 'dashboard') this.loadDashboard();
                if (this.state.currentPage === 'leads') this.loadLeads();
            });
        }

        // Leads
        const btnSearchLeads = document.getElementById('lp-btnSearchLeads');
        if (btnSearchLeads) btnSearchLeads.addEventListener('click', () => {
            this.state.leadsPage = 1;
            this.loadLeads();
        });
        const leadSearch = document.getElementById('lp-leadSearch');
        if (leadSearch) leadSearch.addEventListener('keydown', e => {
            if (e.key === 'Enter') { this.state.leadsPage = 1; this.loadLeads(); }
        });
        document.querySelectorAll('#lp-leadsTable th.lp-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this.state.leadsSort === col) {
                    this.state.leadsOrder = this.state.leadsOrder === 'desc' ? 'asc' : 'desc';
                } else {
                    this.state.leadsSort = col;
                    this.state.leadsOrder = 'desc';
                }
                this.state.leadsPage = 1;
                this.loadLeads();
            });
        });

        // Lead detail back
        const btnBack = document.getElementById('lp-btnBackLeads');
        if (btnBack) btnBack.addEventListener('click', () => this.navigate('leads'));

        // Signals refresh
        const btnSignals = document.getElementById('lp-btnRefreshSignals');
        if (btnSignals) btnSignals.addEventListener('click', () => this.loadSignals());

        // Messages refresh
        const btnMsgs = document.getElementById('lp-btnRefreshMessages');
        if (btnMsgs) btnMsgs.addEventListener('click', () => this.loadMessages());

        // Content refresh
        const btnContent = document.getElementById('lp-btnRefreshContent');
        if (btnContent) btnContent.addEventListener('click', () => this.loadContent());

        // Prospection
        const btnToggleSrc = document.getElementById('lp-btnToggleSourceForm');
        if (btnToggleSrc) btnToggleSrc.addEventListener('click', () => {
            document.getElementById('lp-sourceForm').classList.toggle('lp-hidden');
        });
        const btnCancelSrc = document.getElementById('lp-btnCancelSource');
        if (btnCancelSrc) btnCancelSrc.addEventListener('click', () => {
            document.getElementById('lp-sourceForm').classList.add('lp-hidden');
        });
        const btnCreateSrc = document.getElementById('lp-btnCreateSource');
        if (btnCreateSrc) btnCreateSrc.addEventListener('click', () => this.createSource());
        const btnRefreshRuns = document.getElementById('lp-btnRefreshRuns');
        if (btnRefreshRuns) btnRefreshRuns.addEventListener('click', () => this.loadRuns());

        // Icebreakers batch filter
        const ibFilter = document.getElementById('lp-icebreakerBatchFilter');
        if (ibFilter) ibFilter.addEventListener('change', e => this.renderIcebreakers(e.target.value));
    }

    // ── Navigation ─────────────────────────────────────────────────

    navigate(page) {
        this.state.currentPage = page;
        document.querySelectorAll('.lp-app .lp-page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.lp-nav-links a').forEach(a => a.classList.remove('active'));

        const target = document.getElementById('lp-page-' + page);
        const link = document.querySelector(`.lp-nav-links a[data-lp-page="${page}"]`);
        if (target) target.classList.add('active');
        if (link) link.classList.add('active');

        if (page === 'dashboard') this.loadDashboard();
        else if (page === 'leads') this.loadLeads();
        else if (page === 'signals') this.loadSignals();
        else if (page === 'messages') this.loadMessages();
        else if (page === 'content') this.loadContent();
        else if (page === 'icebreakers') this.loadIcebreakers();
        else if (page === 'pipeline') this.loadPipeline();
        else if (page === 'prospection') this.loadProspection();
    }

    // ── Pipeline diagram (SVG) ─────────────────────────────────────

    _renderPipelineSVG(stats) {
        const STAGE_W = 320, STAGE_H = 70;
        const ROW_GAP = 110;
        const TOOL_X = 20, TOOL_W = 240;
        const STAGE_X = 290;
        const DB_X = 660, DB_W = 280;
        const W = 960;
        const H = LP_PIPELINE_STAGES.length * ROW_GAP + 40;

        const cnt = k => (stats[k] !== undefined && stats[k] !== null) ? stats[k] : '—';

        let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="lp-pipe-svg" preserveAspectRatio="xMidYMin meet">`;
        svg += `<defs>
            <marker id="lp-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#6b7280"/>
            </marker>
            <marker id="lp-arrAcc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#a78bfa"/>
            </marker>
            <linearGradient id="lp-hotBox" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="0.20"/>
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.04"/>
            </linearGradient>
            <linearGradient id="lp-normBox" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#1a1d27"/>
                <stop offset="100%" stop-color="#222632"/>
            </linearGradient>
        </defs>`;

        LP_PIPELINE_STAGES.forEach((s, i) => {
            const y = 20 + i * ROW_GAP;
            const cy = y + STAGE_H / 2;
            const fill = s.highlight ? 'url(#lp-hotBox)' : 'url(#lp-normBox)';
            const stroke = s.highlight ? '#4f8ff7' : '#2a2e3a';

            svg += `
                <g class="lp-pipe-tool-g">
                    <rect x="${TOOL_X}" y="${y + 14}" width="${TOOL_W}" height="42" rx="6" class="lp-pipe-tool-box"/>
                    <text x="${TOOL_X + 14}" y="${y + 38}" class="lp-pipe-tool-icon">${s.icon}</text>
                    <text x="${TOOL_X + 42}" y="${y + 33}" class="lp-pipe-tool-name">${s.tool}</text>
                    <text x="${TOOL_X + 42}" y="${y + 50}" class="lp-pipe-tool-sub">tool</text>
                    <line x1="${TOOL_X + TOOL_W}" y1="${cy}" x2="${STAGE_X - 2}" y2="${cy}" stroke="#6b7280" stroke-width="1.5" marker-end="url(#lp-arr)"/>
                </g>`;

            svg += `
                <g class="lp-pipe-stage-g">
                    <rect x="${STAGE_X}" y="${y}" width="${STAGE_W}" height="${STAGE_H}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${s.highlight ? 2 : 1}"/>
                    <circle cx="${STAGE_X + 28}" cy="${cy}" r="18" fill="${s.highlight ? '#ef4444' : '#4f8ff7'}"/>
                    <text x="${STAGE_X + 28}" y="${cy + 6}" text-anchor="middle" class="lp-pipe-num-svg">${s.n}</text>
                    <text x="${STAGE_X + 58}" y="${y + 28}" class="lp-pipe-title-svg">${s.title}</text>
                    <text x="${STAGE_X + 58}" y="${y + 48}" class="lp-pipe-sub">${s.sub}</text>`;
            if (s.badges) {
                let bx = STAGE_X + 58;
                s.badges.forEach(b => {
                    const txt = `${b.l} ${cnt(b.k)}`;
                    const w = txt.length * 7 + 14;
                    svg += `<rect x="${bx}" y="${y + 56}" width="${w}" height="14" rx="3" class="lp-pipe-badge ${b.c}"/>`;
                    svg += `<text x="${bx + w/2}" y="${y + 66}" text-anchor="middle" class="lp-pipe-badge-txt">${txt}</text>`;
                    bx += w + 6;
                });
            }
            svg += `</g>`;

            if (i < LP_PIPELINE_STAGES.length - 1) {
                svg += `<line x1="${STAGE_X + STAGE_W/2}" y1="${y + STAGE_H + 2}" x2="${STAGE_X + STAGE_W/2}" y2="${y + ROW_GAP - 4}" stroke="#6b7280" stroke-width="2" marker-end="url(#lp-arr)"/>`;
            }

            const dbCount = s.dbs.length;
            const slotH = STAGE_H / dbCount;
            s.dbs.forEach((d, di) => {
                const dy = y + di * slotH + (slotH - 32) / 2;
                svg += `<path d="M ${STAGE_X + STAGE_W} ${cy} C ${STAGE_X + STAGE_W + 50} ${cy}, ${DB_X - 50} ${dy + 16}, ${DB_X - 2} ${dy + 16}" fill="none" stroke="#a78bfa" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#lp-arrAcc)"/>`;
                svg += `
                    <g class="lp-pipe-db-g">
                        <ellipse cx="${DB_X + 18}" cy="${dy + 4}" rx="18" ry="5" fill="#3a2f5a" stroke="#a78bfa" stroke-width="1"/>
                        <rect x="${DB_X}" y="${dy + 4}" width="36" height="22" fill="#2a2245" stroke="#a78bfa" stroke-width="1"/>
                        <ellipse cx="${DB_X + 18}" cy="${dy + 26}" rx="18" ry="5" fill="#2a2245" stroke="#a78bfa" stroke-width="1"/>
                        <text x="${DB_X + 44}" y="${dy + 14}" class="lp-pipe-db-name">${d.t}</text>
                        <text x="${DB_X + 44}" y="${dy + 28}" class="lp-pipe-db-cnt">${cnt(d.k)} rows</text>
                    </g>`;
            });
        });

        svg += `<text x="${TOOL_X + TOOL_W/2}" y="14" text-anchor="middle" class="lp-pipe-col-hdr">Outils</text>`;
        svg += `<text x="${STAGE_X + STAGE_W/2}" y="14" text-anchor="middle" class="lp-pipe-col-hdr">Etapes du pipeline</text>`;
        svg += `<text x="${DB_X + DB_W/2}" y="14" text-anchor="middle" class="lp-pipe-col-hdr">Tables crm.db</text>`;

        svg += '</svg>';
        return svg;
    }

    async loadPipeline() {
        try {
            const res = await fetch(LP_API_BASE + '/pipeline-stats');
            const json = await res.json();
            const data = json.data || json;
            const stats = data.stats || {};

            const container = document.getElementById('lp-pipelineDiagram');
            if (container) container.innerHTML = this._renderPipelineSVG(stats);

            const dbEl = document.getElementById('lp-pipelineDbPath');
            if (dbEl && data.db_path) dbEl.textContent = data.db_path;
        } catch (err) {
            console.error('loadPipeline failed', err);
            const container = document.getElementById('lp-pipelineDiagram');
            if (container) container.innerHTML = '<p style="color:#ef4444">Erreur chargement pipeline-stats</p>';
        }
    }

    // ── Dashboard ──────────────────────────────────────────────────

    async loadDashboard() {
        const data = await this._apiFetch('/dashboard');
        if (!data) return;

        const sc = data.scores;
        const ps = data.pierre_scores;
        document.getElementById('lp-scoreCards').innerHTML = `
            <div class="lp-scores-dual">
                <div class="lp-scores-section">
                    <h4 class="lp-scores-title">DeepSignal <small>(/100)</small></h4>
                    <div class="lp-metrics-row">
                        <div class="lp-metric-card lp-hot"><div class="lp-value">${sc.hot}</div><div class="lp-label">HOT (&ge;70)</div></div>
                        <div class="lp-metric-card lp-warm"><div class="lp-value">${sc.warm}</div><div class="lp-label">WARM</div></div>
                        <div class="lp-metric-card lp-cold"><div class="lp-value">${sc.cold}</div><div class="lp-label">COLD</div></div>
                        <div class="lp-metric-card lp-total"><div class="lp-value">${sc.total}</div><div class="lp-label">Total</div></div>
                    </div>
                </div>
                <div class="lp-scores-section">
                    <h4 class="lp-scores-title">Pierre <small>(/10)</small></h4>
                    <div class="lp-metrics-row">
                        <div class="lp-metric-card lp-hot"><div class="lp-value">${ps.hot}</div><div class="lp-label">HOT (&ge;7)</div></div>
                        <div class="lp-metric-card lp-warm"><div class="lp-value">${ps.warm}</div><div class="lp-label">WARM</div></div>
                        <div class="lp-metric-card lp-cold"><div class="lp-value">${ps.cold}</div><div class="lp-label">COLD</div></div>
                        <div class="lp-metric-card lp-total"><div class="lp-value">${ps.total}</div><div class="lp-label">Total</div></div>
                    </div>
                </div>
            </div>
        `;

        const stages = ['none', 'pending', 'connected'];
        const maxCnt = Math.max(1, ...stages.map(s => data.pipeline[s] || 0));
        document.getElementById('lp-pipelineFunnel').innerHTML = stages.map(s => {
            const cnt = data.pipeline[s] || 0;
            const pct = Math.round(cnt / maxCnt * 100);
            return `<div class="lp-funnel-row">
                <span class="lp-funnel-label">${s}</span>
                <div class="lp-funnel-bar-wrap"><div class="lp-funnel-bar" style="width:${pct}%"></div></div>
                <span class="lp-funnel-count">${cnt}</span>
            </div>`;
        }).join('');

        const ms = data.messages || {};
        document.getElementById('lp-messageStats').innerHTML = Object.entries(ms).map(([k, v]) =>
            `<div class="lp-stat-row"><span class="lp-stat-label">${k}</span><span class="lp-stat-value">${v}</span></div>`
        ).join('') || '<div class="lp-empty-state">No messages yet</div>';

        const cs = data.content || {};
        document.getElementById('lp-contentStats').innerHTML = Object.entries(cs).map(([k, v]) =>
            `<div class="lp-stat-row"><span class="lp-stat-label">${k}</span><span class="lp-stat-value">${v}</span></div>`
        ).join('') || '<div class="lp-empty-state">No content yet</div>';

        document.getElementById('lp-signalStat').innerHTML =
            `<div class="lp-stat-row"><span class="lp-stat-label">New signals</span><span class="lp-stat-value">${data.signals_7d}</span></div>
             <div class="lp-stat-row"><span class="lp-stat-label">Airtable synced</span><span class="lp-stat-value">${data.airtable_synced}</span></div>`;

        const tbody = document.querySelector('#lp-topLeadsTable tbody');
        tbody.innerHTML = data.top_leads.map(l => `
            <tr class="lp-clickable" data-id="${l.id}">
                <td>${this._fullName(l)}</td>
                <td>${l.entreprise || '—'}</td>
                <td>${this._scoreBadge(l.linkedin_score)}</td>
                <td>${this._pierreBadge(l.pierre_score, l.pierre_classification)}</td>
                <td>${this._statusBadge(l.linkedin_connection_status)}</td>
            </tr>`).join('');

        tbody.querySelectorAll('tr.lp-clickable').forEach(tr => {
            tr.addEventListener('click', () => this.openLeadDetail(tr.dataset.id));
        });
    }

    // ── Leads ──────────────────────────────────────────────────────

    _updateSortIndicators() {
        document.querySelectorAll('#lp-leadsTable th.lp-sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
            if (th.dataset.sort === this.state.leadsSort) {
                th.classList.add(this.state.leadsOrder);
            }
        });
    }

    async loadLeads() {
        const q = document.getElementById('lp-leadSearch').value.trim();
        const tier = document.getElementById('lp-tierFilter').value;
        const params = new URLSearchParams({
            limit: LP_PER_PAGE,
            offset: (this.state.leadsPage - 1) * LP_PER_PAGE,
            sort: this.state.leadsSort,
            order: this.state.leadsOrder,
        });
        if (q) params.set('q', q);
        if (tier) params.set('tier', tier);
        if (this.state.accountFilter) params.set('account', this.state.accountFilter);

        const data = await this._apiFetch('/leads?' + params);
        if (!data) return;

        this.state.leadsTotal = data.total;
        document.getElementById('lp-leadsCount').textContent = `${data.total} leads`;

        const tbody = document.querySelector('#lp-leadsTable tbody');
        tbody.innerHTML = data.leads.map(l => `
            <tr class="lp-clickable" data-id="${l.id}">
                <td>${this._fullName(l)}</td>
                <td>${l.entreprise || '—'}</td>
                <td>${this._truncate(l.poste, 40)}</td>
                <td>${this._scoreBadge(l.linkedin_score)}</td>
                <td>${this._pierreBadge(l.pierre_score, l.pierre_classification)}</td>
                <td>${this._statusBadge(l.linkedin_connection_status)}</td>
                <td>${l.linkedin_account || '—'}</td>
                <td>${l.linkedin_url ? '<a href="' + l.linkedin_url + '" target="_blank" class="lp-link">LI</a>' : ''}</td>
            </tr>`).join('');

        tbody.querySelectorAll('tr.lp-clickable').forEach(tr => {
            tr.addEventListener('click', () => this.openLeadDetail(tr.dataset.id));
        });

        this._updateSortIndicators();
        this._renderPagination('lp-leadsPagination', this.state.leadsTotal, this.state.leadsPage, p => {
            this.state.leadsPage = p;
            this.loadLeads();
        });
    }

    _renderPagination(containerId, total, current, onPage) {
        const pages = Math.ceil(total / LP_PER_PAGE);
        const el = document.getElementById(containerId);
        if (pages <= 1) { el.innerHTML = ''; return; }

        let html = `<button ${current <= 1 ? 'disabled' : ''} data-p="${current - 1}">&laquo;</button>`;

        const start = Math.max(1, current - 2);
        const end = Math.min(pages, current + 2);
        for (let i = start; i <= end; i++) {
            html += `<button class="${i === current ? 'active' : ''}" data-p="${i}">${i}</button>`;
        }
        html += `<span class="lp-page-info">${current}/${pages}</span>`;
        html += `<button ${current >= pages ? 'disabled' : ''} data-p="${current + 1}">&raquo;</button>`;

        el.innerHTML = html;
        el.querySelectorAll('button:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => onPage(parseInt(btn.dataset.p)));
        });
    }

    // ── Lead Detail ────────────────────────────────────────────────

    async openLeadDetail(id) {
        const data = await this._apiFetch('/leads/' + id);
        if (!data) return;

        const l = data.lead;

        document.querySelectorAll('.lp-app .lp-page').forEach(p => p.classList.remove('active'));
        document.getElementById('lp-page-lead-detail').classList.add('active');

        document.getElementById('lp-leadDetailHeader').innerHTML = `
            <div class="lp-lead-name">${this._fullName(l)}</div>
            <div class="lp-lead-meta">${l.poste || ''} ${l.entreprise ? '@ ' + l.entreprise : ''}</div>
            <div class="lp-lead-details">
                <div class="lp-detail-item"><span class="lp-detail-label">DeepSignal</span>${this._scoreBadge(l.linkedin_score)}</div>
                <div class="lp-detail-item"><span class="lp-detail-label">Pierre</span>${this._pierreBadge(l.pierre_score, l.pierre_classification)}</div>
                <div class="lp-detail-item"><span class="lp-detail-label">Status</span>${this._statusBadge(l.linkedin_connection_status)}</div>
                <div class="lp-detail-item"><span class="lp-detail-label">Account</span>${l.linkedin_account || '—'}</div>
                <div class="lp-detail-item"><span class="lp-detail-label">Messages</span>${l.linkedin_message_count || 0}</div>
                <div class="lp-detail-item"><span class="lp-detail-label">Last msg</span>${this._formatDate(l.linkedin_last_message_at)}</div>
                ${l.linkedin_url ? `<div class="lp-detail-item"><span class="lp-detail-label">Profile</span><a href="${l.linkedin_url}" target="_blank" class="lp-link">LinkedIn</a></div>` : ''}
                ${l.email ? `<div class="lp-detail-item"><span class="lp-detail-label">Email</span>${l.email}</div>` : ''}
            </div>`;

        const msgEl = document.getElementById('lp-leadMessages');
        if (data.messages.length === 0) {
            msgEl.innerHTML = '<div class="lp-empty-state">No messages yet</div>';
        } else {
            msgEl.innerHTML = data.messages.map(m => `
                <div class="lp-msg-entry">
                    <div class="lp-msg-entry-header">
                        <span class="lp-msg-entry-type">${m.type || 'message'}</span>
                        <span class="lp-msg-entry-date">${this._formatDate(m.created_at)} ${this._statusBadge(m.status)}</span>
                    </div>
                    <div class="lp-msg-entry-content">${this._truncate(m.content, 300)}</div>
                </div>`).join('');
        }

        const sigEl = document.getElementById('lp-leadSignals');
        if (data.signals.length === 0) {
            sigEl.innerHTML = '<div class="lp-empty-state">No signal matches</div>';
        } else {
            sigEl.innerHTML = data.signals.map(s => `
                <div class="lp-signal-entry">
                    <div class="lp-signal-title">${s.title}</div>
                    <div class="lp-signal-meta">${this._formatDate(s.signal_date)} &middot; ${s.source || ''} &middot; relevance: ${s.relevance_score || '—'}</div>
                </div>`).join('');
        }
    }

    // ── Signals ────────────────────────────────────────────────────

    async loadSignals() {
        const days = document.getElementById('lp-signalDays').value;
        const data = await this._apiFetch('/signals?days=' + days);
        if (!data) return;

        document.getElementById('lp-signalsCount').textContent = `${data.total} signals (last ${days} days)`;

        const tbody = document.querySelector('#lp-signalsTable tbody');
        tbody.innerHTML = data.signals.map(s => `
            <tr>
                <td>${this._formatDate(s.signal_date)}</td>
                <td>${this._truncate(s.title, 60)}</td>
                <td>${s.company || '—'}</td>
                <td>${this._truncate(s.project_name, 40)}</td>
                <td>${s.capacity_mw || '—'}</td>
                <td>${s.signal_type || '—'}</td>
                <td>${s.source || '—'}</td>
            </tr>`).join('');

        if (data.signals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="lp-empty-state">No signals found</td></tr>';
        }
    }

    // ── Messages Queue ─────────────────────────────────────────────

    async loadMessages() {
        const status = document.getElementById('lp-msgStatusFilter').value;
        const data = await this._apiFetch('/messages/queue?status=' + status);
        if (!data) return;

        const container = document.getElementById('lp-messagesList');
        if (data.messages.length === 0) {
            container.innerHTML = `<div class="lp-empty-state">No ${status} messages</div>`;
            return;
        }

        container.innerHTML = data.messages.map(m => `
            <div class="lp-msg-item" data-id="${m.id}">
                <div class="lp-msg-header">
                    <div>
                        <span class="lp-msg-to">${m.contact_name || 'Unknown'}</span>
                        <span class="lp-msg-type">${m.type || 'message'} &middot; ${m.contact_company || ''}</span>
                    </div>
                    ${this._statusBadge(m.status)}
                </div>
                <div class="lp-msg-body">${m.content || ''}</div>
                <div class="lp-msg-actions">
                    ${m.status === 'draft' ? `
                        <button class="lp-btn lp-btn-approve lp-btn-sm" data-action="approve" data-id="${m.id}">Approve</button>
                        <button class="lp-btn lp-btn-reject lp-btn-sm" data-action="reject" data-id="${m.id}">Reject</button>
                    ` : ''}
                    <span class="lp-msg-date">${this._formatDate(m.created_at)}</span>
                </div>
            </div>`).join('');

        container.querySelectorAll('.lp-msg-body').forEach(body => {
            body.addEventListener('click', () => body.classList.toggle('expanded'));
        });
        container.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (btn.dataset.action === 'approve') {
                    await this._apiFetch('/messages/' + id + '/approve', { method: 'POST' });
                } else {
                    await this._apiFetch('/messages/' + id + '/reject', { method: 'POST' });
                }
                this.loadMessages();
            });
        });
    }

    // ── Content Queue ──────────────────────────────────────────────

    async loadContent() {
        const status = document.getElementById('lp-contentStatusFilter').value;
        const data = await this._apiFetch('/content/queue?status=' + status);
        if (!data) return;

        const container = document.getElementById('lp-contentList');
        if (data.content.length === 0) {
            container.innerHTML = `<div class="lp-empty-state">No ${status} content</div>`;
            return;
        }

        container.innerHTML = data.content.map(c => `
            <div class="lp-content-item" data-id="${c.id}">
                <div class="lp-content-header">
                    <div>
                        <span class="lp-msg-to">${c.type || 'post'}</span>
                        <span class="lp-msg-type">${c.account || ''}</span>
                    </div>
                    ${this._statusBadge(c.status)}
                </div>
                <div class="lp-content-body">${c.content || ''}</div>
                <div class="lp-content-actions">
                    ${c.status !== 'published' ? `
                        <button class="lp-btn lp-btn-publish lp-btn-sm" data-publish="${c.id}">Publish</button>
                    ` : ''}
                    <span class="lp-content-date">${this._formatDate(c.published_at || c.created_at)}</span>
                </div>
            </div>`).join('');

        container.querySelectorAll('.lp-content-body').forEach(body => {
            body.addEventListener('click', () => body.classList.toggle('expanded'));
        });
        container.querySelectorAll('button[data-publish]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await this._apiFetch('/content/' + btn.dataset.publish + '/publish', { method: 'POST' });
                this.loadContent();
            });
        });
    }

    // ── Prospection ───────────────────────────────────────────────

    async loadProspection() {
        await Promise.all([this.loadSources(), this.loadRuns()]);
    }

    async loadSources() {
        const params = this.state.accountFilter ? `?account=${this.state.accountFilter}` : '';
        const data = await this._apiFetch('/sources' + params);
        if (!data) return;

        const tbody = document.querySelector('#lp-sourcesTable tbody');
        if (data.sources.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="lp-empty-state">No sources configured</td></tr>';
            return;
        }

        tbody.innerHTML = data.sources.map(s => `
            <tr>
                <td>${s.name}</td>
                <td><span class="lp-type-badge">${s.source_type}</span></td>
                <td>${s.account}</td>
                <td class="lp-url-cell">${this._truncate(s.url, 50)}</td>
                <td>${s.runs_count || 0}</td>
                <td>${this._formatDate(s.last_run_at)}</td>
                <td class="lp-actions-cell">
                    ${s.phantom_id ? `<button class="lp-btn lp-btn-primary lp-btn-xs" data-launch="${s.id}">Launch</button>` : ''}
                    <button class="lp-btn lp-btn-danger lp-btn-xs" data-del="${s.id}">Del</button>
                </td>
            </tr>`).join('');

        tbody.querySelectorAll('button[data-launch]').forEach(btn => {
            btn.addEventListener('click', () => this.launchSource(parseInt(btn.dataset.launch)));
        });
        tbody.querySelectorAll('button[data-del]').forEach(btn => {
            btn.addEventListener('click', () => this.deleteSource(parseInt(btn.dataset.del)));
        });
    }

    async createSource() {
        const name = document.getElementById('lp-srcName').value.trim();
        const source_type = document.getElementById('lp-srcType').value;
        const account = document.getElementById('lp-srcAccount').value;
        const url = document.getElementById('lp-srcUrl').value.trim();
        const phantom_id = document.getElementById('lp-srcPhantomId').value.trim();

        if (!name || !url) return alert('Name and URL required');

        const body = { name, source_type, url, account };
        if (phantom_id) body.phantom_id = phantom_id;

        const data = await this._apiFetch('/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (data) {
            document.getElementById('lp-sourceForm').classList.add('lp-hidden');
            document.getElementById('lp-srcName').value = '';
            document.getElementById('lp-srcUrl').value = '';
            document.getElementById('lp-srcPhantomId').value = '';
            this.loadSources();
        }
    }

    async deleteSource(id) {
        if (!confirm('Delete this source?')) return;
        await this._apiFetch('/sources/' + id, { method: 'DELETE' });
        this.loadSources();
    }

    async launchSource(sourceId) {
        const data = await this._apiFetch('/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: sourceId }),
        });
        if (data) {
            alert(`Phantom launched! Run #${data.run_id}`);
            this.loadRuns();
        }
    }

    _runStatusBadge(status) {
        const cls = { launched: 'lp-warm', finished: 'lp-hot', error: 'lp-cold' }[status] || 'lp-none';
        return `<span class="lp-score-badge ${cls}">${status}</span>`;
    }

    async loadRuns() {
        const data = await this._apiFetch('/runs?limit=20');
        if (!data) return;

        const tbody = document.querySelector('#lp-runsTable tbody');
        if (data.runs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="lp-empty-state">No runs yet</td></tr>';
            return;
        }

        tbody.innerHTML = data.runs.map(r => `
            <tr>
                <td>#${r.id}</td>
                <td><span class="lp-type-badge">${r.phantom_type}</span></td>
                <td>${r.account}</td>
                <td>${this._runStatusBadge(r.status)}</td>
                <td>${this._formatDate(r.launched_at)}</td>
                <td>${r.results_count != null ? r.results_count : '—'}</td>
                <td>${r.contacts_imported != null ? r.contacts_imported : '—'}</td>
                <td class="lp-actions-cell">
                    ${r.status === 'launched' ? `<button class="lp-btn lp-btn-secondary lp-btn-xs" data-check="${r.id}">Check</button>` : ''}
                    ${r.status === 'finished' && r.contacts_imported == null ? `<button class="lp-btn lp-btn-primary lp-btn-xs" data-import="${r.id}">Import</button>` : ''}
                </td>
            </tr>`).join('');

        tbody.querySelectorAll('button[data-check]').forEach(btn => {
            btn.addEventListener('click', () => this.checkRunStatus(parseInt(btn.dataset.check)));
        });
        tbody.querySelectorAll('button[data-import]').forEach(btn => {
            btn.addEventListener('click', () => this.importRunResults(parseInt(btn.dataset.import)));
        });
    }

    async checkRunStatus(runId) {
        const data = await this._apiFetch('/runs/' + runId + '/status');
        if (data) this.loadRuns();
    }

    async importRunResults(runId) {
        const data = await this._apiFetch('/runs/' + runId + '/import', { method: 'POST' });
        if (data) {
            alert(`Imported ${data.imported} contacts (${data.skipped} skipped)`);
            this.loadRuns();
        }
    }

    // ── Icebreakers ──────────────────────────────────────────────

    async loadIcebreakers() {
        const data = await this._apiFetch('/icebreakers');
        if (!data) return;

        this._icebreakersCache.contacts = data.contacts || [];
        this._icebreakersCache.batches = data.batches || [];

        document.getElementById('lp-icebreakerCount').textContent = data.total;

        const select = document.getElementById('lp-icebreakerBatchFilter');
        if (select) {
            const currentValue = select.value || 'all';
            select.innerHTML = '<option value="all">Tous les batchs (' + data.total + ')</option>'
                + this._icebreakersCache.batches.map(b =>
                    `<option value="${b.date}">${b.date} (${b.count})</option>`
                  ).join('');
            select.value = currentValue;
        }

        this.renderIcebreakers('all');
    }

    renderIcebreakers(batchDate) {
        const all = this._icebreakersCache.contacts;
        const filtered = batchDate === 'all'
            ? all
            : all.filter(c => ((c.icebreaker_generated_at || '').slice(0, 10) || 'unknown') === batchDate);

        const summary = document.getElementById('lp-icebreakerBatchSummary');
        if (summary) {
            summary.textContent = batchDate === 'all'
                ? ''
                : `${filtered.length} contact${filtered.length > 1 ? 's' : ''} dans le batch ${batchDate}`;
        }

        const container = document.getElementById('lp-icebreakerList');
        container.innerHTML = filtered.map(c => {
            const charCount = (c.icebreaker_message || '').length;
            const charClass = charCount > 300 ? 'lp-over-limit' : charCount > 270 ? 'lp-near-limit' : '';
            const batchD = (c.icebreaker_generated_at || '').slice(0, 10);
            const batchBadge = batchD
                ? `<span class="lp-ib-batch-badge" title="Batch genere le ${batchD}">📅 ${batchD}</span>`
                : '<span class="lp-ib-batch-badge lp-ib-batch-unknown" title="Date non renseignee">📅 ?</span>';
            const sourceBadge = c.source === 'linkedin_messages'
                ? `<span class="lp-ib-source-badge lp-ib-source-msg" title="Pipeline: linkedin_messages, status=${c.status || 'draft'}">${c.status || 'draft'}</span>`
                : `<span class="lp-ib-source-badge lp-ib-source-pierre" title="Pipeline: contacts.icebreaker_message (Pierre HOT)">HOT</span>`;
            return `
            <div class="lp-icebreaker-card" data-batch="${batchD || 'unknown'}">
                <div class="lp-ib-header">
                    <div class="lp-ib-name">
                        ${c.linkedin_url
                            ? `<a href="${c.linkedin_url}" target="_blank" class="lp-ib-name-link"><strong>${c.prenom} ${c.nom}</strong></a>`
                            : `<strong>${c.prenom} ${c.nom}</strong>`}
                        ${this._pierreBadge(c.pierre_score, c.pierre_classification)}
                        ${sourceBadge}
                        ${batchBadge}
                    </div>
                    <div class="lp-ib-meta">${c.poste || ''} ${c.entreprise ? '@ ' + c.entreprise : ''}</div>
                    ${c.linkedin_url ? `<div class="lp-ib-linkedin-url"><a href="${c.linkedin_url}" target="_blank">${c.linkedin_url}</a></div>` : ''}
                </div>
                <div class="lp-ib-message">${this._escapeHtml(c.icebreaker_message)}</div>
                <div class="lp-ib-footer">
                    <span class="lp-char-count ${charClass}">${charCount}/300</span>
                    <div class="lp-ib-actions">
                        ${c.linkedin_url ? `<a href="${c.linkedin_url}" target="_blank" class="lp-btn-sm">Profile</a>` : ''}
                        <button class="lp-btn-sm lp-btn-copy" data-copy-id="${c.id}">Copy</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('button[data-copy-id]').forEach(btn => {
            btn.addEventListener('click', () => this._copyIcebreaker(btn));
        });
    }

    _copyIcebreaker(btn) {
        const card = btn.closest('.lp-icebreaker-card');
        const msg = card.querySelector('.lp-ib-message').textContent;
        navigator.clipboard.writeText(msg).then(() => {
            btn.textContent = 'Copied!';
            btn.classList.add('lp-copied');
            setTimeout(() => {
                btn.textContent = 'Copy';
                btn.classList.remove('lp-copied');
            }, 2000);
        });
    }
}

const linkedinProspectionModule = new LinkedInProspectionModule();
window.linkedinProspectionModule = linkedinProspectionModule;

export default linkedinProspectionModule;
