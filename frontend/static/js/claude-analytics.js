/**
 * Claude Analytics Module
 * Analyzes Claude Code interaction history with charts and insights
 */

import API from './api.js';

// Helper functions for API calls
const apiGet = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }
    return await response.json();
};

const apiPost = async (url, data) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }
    return await response.json();
};

const showMessage = (message, type) => {
    console.log(`[${type}] ${message}`);
    // Could integrate with a toast notification system here
};

class ClaudeAnalyticsModule {
    constructor() {
        this.currentGranularity = 'day';
        this.currentPage = 0;
        this.pageSize = 50;
        this.sessionsPage = 0;
        this.patternsPage = 0;
        this.skillsPage = 0;
        this.currentPattern = null;
        this.currentSkill = null;
    }

    async load() {
        this._bindEvents();
        await this.loadDashboard();
    }

    _bindEvents() {
        const container = document.getElementById('claude-analytics-container');
        if (!container) return;

        // Sub-tab switching (scoped to this container to avoid conflicts with claude-skills)
        container.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subtab = e.target.dataset.subtab;
                this.switchTab(subtab);
            });
        });

        // Import button
        document.getElementById('import-btn')?.addEventListener('click', () => {
            this.importHistory();
        });

        // Timeline granularity buttons
        document.querySelectorAll('.granularity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.granularity-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentGranularity = e.target.dataset.granularity;
                this.loadTimelineChart();
            });
        });

        // Search controls
        document.getElementById('search-btn')?.addEventListener('click', () => {
            this.currentPage = 0;
            this.searchMessages();
        });

        document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
            this.clearFilters();
        });

        // Sessions filter
        document.getElementById('sessions-filter-btn')?.addEventListener('click', () => {
            this.sessionsPage = 0;
            this.loadSessions();
        });

        // Pattern detection
        document.getElementById('detect-patterns-btn')?.addEventListener('click', () => {
            this.detectPatterns();
        });

        // Pattern filter
        document.getElementById('pattern-filter-btn')?.addEventListener('click', () => {
            this.patternsPage = 0;
            this.loadPatterns();
        });

        document.getElementById('pattern-clear-btn')?.addEventListener('click', () => {
            this.clearPatternFilters();
        });

        // Pattern modal (scoped to container)
        container.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closePatternModal();
            });
        });

        document.getElementById('pattern-save-btn')?.addEventListener('click', () => {
            this.savePattern();
        });

        // Quality analysis
        document.getElementById('analyze-quality-btn')?.addEventListener('click', () => {
            this.analyzeSessionQuality();
        });

        // Skills analysis
        document.getElementById('analyze-skills-btn')?.addEventListener('click', () => {
            this.analyzeAllSkills();
        });

        document.getElementById('skills-type-filter')?.addEventListener('change', () => {
            this.skillsPage = 0;
            this.loadSkills();
        });

        document.getElementById('skills-score-filter')?.addEventListener('change', () => {
            this.skillsPage = 0;
            this.loadSkills();
        });

        document.getElementById('skills-clear-filters-btn')?.addEventListener('click', () => {
            this.clearSkillFilters();
        });

        document.getElementById('skill-reanalyze-btn')?.addEventListener('click', () => {
            this.reanalyzeSkill();
        });

        // Reprise tab
        document.getElementById('reprise-refresh-btn')?.addEventListener('click', () => {
            this.loadRepriseTab();
        });
        document.getElementById('reprise-days-filter')?.addEventListener('change', () => {
            this.loadRepriseTab();
        });
    }

    switchTab(tabName) {
        const container = document.getElementById('claude-analytics-container');
        if (!container) return;

        // Hide all sub-tabs (scoped to this container)
        container.querySelectorAll('.sub-tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active from all buttons (scoped to this container)
        container.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected sub-tab (scoped to this container)
        const selectedTab = container.querySelector(`#${tabName}-subtab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // Activate button (scoped to this container)
        const selectedBtn = container.querySelector(`[data-subtab="${tabName}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        // Load content for tab
        if (tabName === 'dashboard') {
            this.loadDashboard();
        } else if (tabName === 'search') {
            this.loadSearchTab();
        } else if (tabName === 'sessions') {
            this.loadSessionsTab();
        } else if (tabName === 'quality') {
            this.loadQualityTab();
        } else if (tabName === 'skills') {
            this.loadSkillsTab();
        } else if (tabName === 'reprise') {
            this.loadRepriseTab();
        }
    }

    async loadDashboard() {
        try {
            const stats = await apiGet('/api/claude-analytics/stats');

            // Update stats cards
            document.getElementById('total-messages').textContent = stats.total_messages.toLocaleString();
            document.getElementById('total-sessions').textContent = stats.total_sessions.toLocaleString();
            document.getElementById('total-projects').textContent = stats.total_projects.toLocaleString();
            document.getElementById('days-active').textContent = stats.days_active.toLocaleString();

            // Auto-import if no data
            if (stats.total_messages === 0) {
                await this.importHistory();
                return;
            }

            // Load charts
            await this.loadTimelineChart();
            await this.loadProjectsChart();

        } catch (error) {
            console.error('Error loading dashboard:', error);
            showMessage('Error loading dashboard', 'error');
        }
    }

    async importHistory() {
        const btn = document.getElementById('import-btn');
        if (!btn) return;

        try {
            btn.disabled = true;
            btn.textContent = 'Importing...';

            const result = await apiPost('/api/claude-analytics/import', { incremental: true });

            showMessage(`Imported ${result.imported} messages (${result.skipped} already existed)`, 'success');

            // Reload dashboard
            await this.loadDashboard();

        } catch (error) {
            console.error('Error importing history:', error);
            showMessage('Error importing history: ' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Import History';
            }
        }
    }

    async loadTimelineChart() {
        try {
            const data = await apiGet(`/api/claude-analytics/timeline?granularity=${this.currentGranularity}`);

            this._renderTimelineChart(data.timeline);

        } catch (error) {
            console.error('Error loading timeline chart:', error);
        }
    }

    _renderTimelineChart(data) {
        const container = document.getElementById('timeline-chart');
        if (!container) return;

        // Clear previous chart
        container.innerHTML = '';

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="no-data">No data available</p>';
            return;
        }

        // Set up dimensions
        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Parse dates and values
        const parseDate = d3.timeParse('%Y-%m-%d');
        data.forEach(d => {
            d.parsedDate = parseDate(d.date);
            d.count = +d.count;
        });

        // Scales
        const x = d3.scaleTime()
            .domain(d3.extent(data, d => d.parsedDate))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .range([height, 0]);

        // Line generator
        const line = d3.line()
            .x(d => x(d.parsedDate))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Add X axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .style('text-anchor', 'end')
            .style('fill', '#8b949e')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        // Style axis lines
        svg.selectAll('.domain').style('stroke', '#30363d');
        svg.selectAll('.tick line').style('stroke', '#30363d');

        // Add Y axis
        svg.append('g')
            .call(d3.axisLeft(y))
            .selectAll('text')
            .style('fill', '#8b949e');

        // Add line
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', '#58a6ff')
            .attr('stroke-width', 2)
            .attr('d', line);

        // Add dots
        svg.selectAll('dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', d => x(d.parsedDate))
            .attr('cy', d => y(d.count))
            .attr('r', 3)
            .attr('fill', '#58a6ff');
    }

    async loadProjectsChart() {
        try {
            const data = await apiGet('/api/claude-analytics/projects');

            this._renderProjectsChart(data.projects);

        } catch (error) {
            console.error('Error loading projects chart:', error);
        }
    }

    _renderProjectsChart(data) {
        const container = document.getElementById('projects-chart');
        if (!container) return;

        // Clear previous chart
        container.innerHTML = '';

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="no-data">No data available</p>';
            return;
        }

        // Extract short project names (last path segment)
        data.forEach(d => {
            d.shortName = d.project ? d.project.replace(/^.*\//, '').replace(/^-+/, '') : d.project;
        });

        // Set up dimensions
        const margin = { top: 20, right: 30, bottom: 120, left: 60 };
        const width = container.clientWidth - margin.left - margin.right;
        const height = 350 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Tooltip
        const tooltip = d3.select(container)
            .append('div')
            .style('position', 'absolute')
            .style('background', '#21262d')
            .style('border', '1px solid #30363d')
            .style('color', '#e6edf3')
            .style('padding', '6px 10px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 10);

        // Scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.shortName))
            .range([0, width])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .range([height, 0]);

        // Add X axis with rotated labels
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .style('text-anchor', 'end')
            .style('fill', '#8b949e')
            .style('font-size', '12px')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        // Style X axis line and ticks
        svg.selectAll('.domain').style('stroke', '#30363d');
        svg.selectAll('.tick line').style('stroke', '#30363d');

        // Add Y axis
        svg.append('g')
            .call(d3.axisLeft(y))
            .selectAll('text')
            .style('fill', '#8b949e');

        // Add bars with tooltip
        svg.selectAll('bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', d => x(d.shortName))
            .attr('y', d => y(d.count))
            .attr('width', x.bandwidth())
            .attr('height', d => height - y(d.count))
            .attr('fill', '#238636')
            .attr('rx', 3)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                tooltip.style('opacity', 1)
                    .html(`<strong>${d.project}</strong><br/>${d.count} messages`);
                d3.select(event.target).attr('fill', '#2ea043');
            })
            .on('mousemove', (event) => {
                const rect = container.getBoundingClientRect();
                tooltip.style('left', (event.clientX - rect.left + 10) + 'px')
                    .style('top', (event.clientY - rect.top - 30) + 'px');
            })
            .on('mouseout', (event) => {
                tooltip.style('opacity', 0);
                d3.select(event.target).attr('fill', '#238636');
            });

        // Add count labels on bars
        svg.selectAll('.bar-label')
            .data(data)
            .enter()
            .append('text')
            .attr('x', d => x(d.shortName) + x.bandwidth() / 2)
            .attr('y', d => y(d.count) - 5)
            .attr('text-anchor', 'middle')
            .style('fill', '#8b949e')
            .style('font-size', '11px')
            .text(d => d.count);
    }

    async loadSearchTab() {
        // Populate project filter
        try {
            const data = await apiGet('/api/claude-analytics/projects');
            const select = document.getElementById('project-filter');

            if (select) {
                // Clear existing options (except "All Projects")
                select.innerHTML = '<option value="">All Projects</option>';

                data.projects.forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.project;
                    option.textContent = p.project;
                    select.appendChild(option);
                });
            }

            // Load initial results
            this.searchMessages();

        } catch (error) {
            console.error('Error loading search tab:', error);
        }
    }

    async searchMessages() {
        try {
            // Build filters
            const params = new URLSearchParams();

            const search = document.getElementById('search-input')?.value;
            if (search) params.append('search', search);

            const project = document.getElementById('project-filter')?.value;
            if (project) params.append('project', project);

            const startDate = document.getElementById('start-date-filter')?.value;
            if (startDate) params.append('start_date', startDate);

            const endDate = document.getElementById('end-date-filter')?.value;
            if (endDate) params.append('end_date', endDate);

            params.append('limit', this.pageSize);
            params.append('offset', this.currentPage * this.pageSize);

            const data = await apiGet(`/api/claude-analytics/messages?${params}`);

            this._renderMessages(data);

        } catch (error) {
            console.error('Error searching messages:', error);
            showMessage('Error searching messages', 'error');
        }
    }

    _renderMessages(data) {
        const infoDiv = document.getElementById('results-info');
        const listDiv = document.getElementById('messages-list');
        const paginationDiv = document.getElementById('pagination');

        if (!listDiv) return;

        // Update info
        if (infoDiv) {
            infoDiv.textContent = `Showing ${data.messages.length} of ${data.total} messages`;
        }

        // Render messages
        listDiv.innerHTML = '';

        if (data.messages.length === 0) {
            listDiv.innerHTML = '<p class="no-data">No messages found</p>';
            if (paginationDiv) paginationDiv.innerHTML = '';
            return;
        }

        data.messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message-item';

            const timestamp = new Date(msg.timestamp).toLocaleString();
            const displayText = msg.display.substring(0, 200) + (msg.display.length > 200 ? '...' : '');

            msgDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-timestamp">${timestamp}</span>
                    <span class="message-project">${msg.project || 'Unknown'}</span>
                </div>
                <div class="message-content">${this._escapeHtml(displayText)}</div>
            `;

            listDiv.appendChild(msgDiv);
        });

        // Render pagination
        this._renderPagination(paginationDiv, data.total, this.currentPage, this.pageSize, (page) => {
            this.currentPage = page;
            this.searchMessages();
        });
    }

    async loadSessionsTab() {
        // Populate project filter
        try {
            const data = await apiGet('/api/claude-analytics/projects');
            const select = document.getElementById('sessions-project-filter');

            if (select) {
                select.innerHTML = '<option value="">All Projects</option>';

                data.projects.forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.project;
                    option.textContent = p.project;
                    select.appendChild(option);
                });
            }

            // Load sessions
            this.loadSessions();

        } catch (error) {
            console.error('Error loading sessions tab:', error);
        }
    }

    async loadSessions() {
        try {
            const params = new URLSearchParams();

            const project = document.getElementById('sessions-project-filter')?.value;
            if (project) params.append('project', project);

            params.append('limit', this.pageSize);
            params.append('offset', this.sessionsPage * this.pageSize);

            const data = await apiGet(`/api/claude-analytics/sessions?${params}`);

            this._renderSessions(data);

        } catch (error) {
            console.error('Error loading sessions:', error);
            showMessage('Error loading sessions', 'error');
        }
    }

    _renderSessions(data) {
        const infoDiv = document.getElementById('sessions-info');
        const listDiv = document.getElementById('sessions-list');
        const paginationDiv = document.getElementById('sessions-pagination');

        if (!listDiv) return;

        // Update info
        if (infoDiv) {
            infoDiv.textContent = `Showing ${data.sessions.length} of ${data.total} sessions`;
        }

        // Render sessions
        listDiv.innerHTML = '';

        if (data.sessions.length === 0) {
            listDiv.innerHTML = '<p class="no-data">No sessions found</p>';
            if (paginationDiv) paginationDiv.innerHTML = '';
            return;
        }

        const table = document.createElement('table');
        table.className = 'sessions-table';

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Session ID</th>
                    <th>Project</th>
                    <th>Messages</th>
                    <th>First Message</th>
                    <th>Last Message</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');

        data.sessions.forEach(session => {
            const row = document.createElement('tr');

            const firstTime = new Date(session.first_timestamp).toLocaleString();
            const lastTime = new Date(session.last_timestamp).toLocaleString();

            row.innerHTML = `
                <td><code>${session.session_id.substring(0, 8)}...</code></td>
                <td>${session.project || 'Unknown'}</td>
                <td>${session.message_count}</td>
                <td>${firstTime}</td>
                <td>${lastTime}</td>
            `;

            tbody.appendChild(row);
        });

        listDiv.appendChild(table);

        // Render pagination
        this._renderPagination(paginationDiv, data.total, this.sessionsPage, this.pageSize, (page) => {
            this.sessionsPage = page;
            this.loadSessions();
        });
    }

    _renderPagination(container, total, currentPage, pageSize, onPageChange) {
        if (!container) return;

        const totalPages = Math.ceil(total / pageSize);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = '';

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Previous';
        prevBtn.className = 'btn btn-secondary';
        prevBtn.disabled = currentPage === 0;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 0) {
                onPageChange(currentPage - 1);
            }
        });
        container.appendChild(prevBtn);

        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.textContent = ` Page ${currentPage + 1} of ${totalPages} `;
        pageInfo.className = 'page-info';
        container.appendChild(pageInfo);

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next →';
        nextBtn.className = 'btn btn-secondary';
        nextBtn.disabled = currentPage >= totalPages - 1;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages - 1) {
                onPageChange(currentPage + 1);
            }
        });
        container.appendChild(nextBtn);
    }

    clearFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('project-filter').value = '';
        document.getElementById('start-date-filter').value = '';
        document.getElementById('end-date-filter').value = '';
        this.currentPage = 0;
        this.searchMessages();
    }

    // ------------------------------------------------------------------
    // Quality Analysis Methods
    // ------------------------------------------------------------------

    async loadQualityTab() {
        // Tab loaded, ready for user to click analyze
    }

    async analyzeSessionQuality() {
        const btn = document.getElementById('analyze-quality-btn');
        if (!btn) return;

        try {
            btn.disabled = true;
            btn.textContent = 'Analyzing...';

            const sampleSize = parseInt(document.getElementById('quality-sample-size')?.value || '100');

            const result = await apiPost('/api/claude-analytics/session-quality', {
                sample_size: sampleSize
            });

            if (result.error) {
                showMessage('Error analyzing session quality: ' + result.error, 'error');
                return;
            }

            showMessage(`Analyzed ${result.stats.total_sessions} sessions`, 'success');

            // Display results
            this._renderQualityResults(result);

        } catch (error) {
            console.error('Error analyzing session quality:', error);
            showMessage('Error analyzing session quality: ' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Analyze Session Quality';
            }
        }
    }

    _renderQualityResults(result) {
        const stats = result.stats;
        const worstSessions = result.worst_sessions || [];
        const bestSessions = result.best_sessions || [];

        // Show stats section
        document.getElementById('quality-stats').style.display = 'grid';
        document.getElementById('quality-total-sessions').textContent = stats.total_sessions;
        document.getElementById('quality-problematic').textContent = stats.problematic;
        document.getElementById('quality-needs-improvement').textContent = stats.needs_improvement;
        document.getElementById('quality-good').textContent = stats.good;

        // Show metrics
        document.getElementById('quality-metrics').style.display = 'block';
        document.getElementById('quality-avg-problem-score').textContent = stats.avg_problem_score;
        document.getElementById('quality-avg-corrections').textContent = stats.avg_corrections_per_session;
        document.getElementById('quality-avg-messages').textContent = stats.avg_messages_per_session;

        // Render worst sessions
        this._renderWorstSessions(worstSessions);

        // Render best sessions
        this._renderBestSessions(bestSessions);
    }

    _renderWorstSessions(sessions) {
        const container = document.getElementById('quality-worst-sessions');
        const listDiv = document.getElementById('worst-sessions-list');

        if (!container || !listDiv) return;

        container.style.display = 'block';

        if (sessions.length === 0) {
            listDiv.innerHTML = '<p class="no-data">No problematic sessions found</p>';
            return;
        }

        listDiv.innerHTML = sessions.map(session => {
            const severityColor = this._getSeverityColor(session.severity);
            const categoryLabel = this._getCategoryLabel(session.category);

            return `
                <div class="session-quality-card" style="border-left: 4px solid ${severityColor}; margin-bottom: 20px; padding: 15px; background: white; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="margin: 0;">Session ${session.session_id.substring(0, 8)}...</h4>
                        <span class="status-badge" style="background: ${severityColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                            ${categoryLabel} - Score: ${session.problem_score}
                        </span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px;">
                        <div><strong>Projet:</strong> ${this._escapeHtml(session.project || 'Unknown')}</div>
                        <div><strong>Messages:</strong> ${session.message_count}</div>
                        <div><strong>Corrections:</strong> ${session.metrics.correction_count} (${session.metrics.correction_rate}%)</div>
                        <div><strong>Clarifications:</strong> ${session.metrics.clarification_count} (${session.metrics.clarification_rate}%)</div>
                    </div>

                    ${session.indicators && session.indicators.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <strong>Indicateurs de Problème:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px;">
                                ${session.indicators.map(ind => `<li>${this._escapeHtml(ind)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                        <strong>Prompt Initial:</strong>
                        <div style="margin-top: 5px; font-family: monospace; font-size: 13px;">
                            ${this._escapeHtml(session.initial_prompt.text)}
                        </div>
                        <div style="margin-top: 5px; font-size: 12px; color: #666;">
                            <strong>Analyse:</strong> Score ${session.initial_prompt.analysis.score}/100
                            ${session.initial_prompt.analysis.issues && session.initial_prompt.analysis.issues.length > 0 ?
                                ` - Problèmes: ${session.initial_prompt.analysis.issues.join(', ')}` : ''}
                        </div>
                    </div>

                    ${session.recommendations && session.recommendations.length > 0 ? `
                        <div>
                            <strong>Recommandations:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; color: #1976d2;">
                                ${session.recommendations.map(rec => `<li>${this._escapeHtml(rec)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    _renderBestSessions(sessions) {
        const container = document.getElementById('quality-best-sessions');
        const listDiv = document.getElementById('best-sessions-list');

        if (!container || !listDiv) return;

        container.style.display = 'block';

        if (sessions.length === 0) {
            listDiv.innerHTML = '<p class="no-data">No good sessions found</p>';
            return;
        }

        listDiv.innerHTML = sessions.map(session => {
            return `
                <div class="session-quality-card" style="border-left: 4px solid #2e7d32; margin-bottom: 15px; padding: 15px; background: #f1f8f4; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="margin: 0;">Session ${session.session_id.substring(0, 8)}...</h4>
                        <span class="status-badge" style="background: #2e7d32; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                            ${this._getCategoryLabel(session.category)} - Score: ${session.problem_score}
                        </span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px;">
                        <div><strong>Projet:</strong> ${this._escapeHtml(session.project || 'Unknown')}</div>
                        <div><strong>Messages:</strong> ${session.message_count}</div>
                        <div><strong>Corrections:</strong> ${session.metrics.correction_count}</div>
                    </div>

                    <div style="padding: 10px; background: white; border-radius: 4px;">
                        <strong>Prompt Initial (bon exemple):</strong>
                        <div style="margin-top: 5px; font-family: monospace; font-size: 13px;">
                            ${this._escapeHtml(session.initial_prompt.text)}
                        </div>
                        ${session.initial_prompt.analysis.strengths && session.initial_prompt.analysis.strengths.length > 0 ? `
                            <div style="margin-top: 5px; font-size: 12px; color: #2e7d32;">
                                ✓ Forces: ${session.initial_prompt.analysis.strengths.join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    _getSeverityColor(severity) {
        switch (severity) {
            case 'high': return '#c62828';
            case 'medium': return '#f57c00';
            case 'low': return '#ffa726';
            default: return '#2e7d32';
        }
    }

    _getCategoryLabel(category) {
        const labels = {
            'problematic': 'Problématique',
            'needs_improvement': 'À Améliorer',
            'minor_issues': 'Problèmes Mineurs',
            'good': 'Bon'
        };
        return labels[category] || category;
    }

    // ------------------------------------------------------------------
    // Pattern Detection Methods
    // ------------------------------------------------------------------

    async detectPatterns() {
        try {
            const btn = document.getElementById('detect-patterns-btn');
            btn.disabled = true;
            btn.textContent = 'Detecting...';

            const response = await apiPost('/api/claude-analytics/patterns/detect', {
                min_frequency: 3
            });

            if (response.success) {
                showMessage(`Detected ${response.patterns_found} patterns (${response.patterns_new} new, ${response.patterns_updated} updated)`, 'success');
                await this.loadPatterns();
            }
        } catch (error) {
            console.error('Error detecting patterns:', error);
            showMessage('Failed to detect patterns', 'error');
        } finally {
            const btn = document.getElementById('detect-patterns-btn');
            btn.disabled = false;
            btn.textContent = 'Detect Patterns';
        }
    }

    async loadPatterns() {
        try {
            const filters = {};

            const status = document.getElementById('pattern-status-filter')?.value;
            if (status) filters.status = status;

            const category = document.getElementById('pattern-category-filter')?.value;
            if (category) filters.category = category;

            const minFreq = document.getElementById('pattern-min-frequency')?.value;
            if (minFreq) filters.min_frequency = minFreq;

            const params = new URLSearchParams({
                ...filters,
                limit: this.pageSize,
                offset: this.patternsPage * this.pageSize
            });

            const response = await apiGet(`/api/claude-analytics/patterns?${params}`);

            if (response.success) {
                this._renderPatterns(response.patterns, response.total);
            }
        } catch (error) {
            console.error('Error loading patterns:', error);
            showMessage('Failed to load patterns', 'error');
        }
    }

    _renderPatterns(patterns, total) {
        const infoDiv = document.getElementById('patterns-info');
        const listDiv = document.getElementById('patterns-list');
        const paginationDiv = document.getElementById('patterns-pagination');

        // Info
        const start = this.patternsPage * this.pageSize + 1;
        const end = Math.min((this.patternsPage + 1) * this.pageSize, total);
        infoDiv.textContent = `Showing ${start}-${end} of ${total} patterns`;

        // List
        if (patterns.length === 0) {
            listDiv.innerHTML = '<p class="no-results">No patterns found. Click "Detect Patterns" to analyze messages.</p>';
        } else {
            const table = document.createElement('table');
            table.className = 'data-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Pattern</th>
                        <th>Frequency</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>First Seen</th>
                        <th>Last Seen</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${patterns.map(p => `
                        <tr>
                            <td class="pattern-text">${this._escapeHtml(p.pattern_text)}</td>
                            <td>${p.frequency}</td>
                            <td><span class="category-badge">${p.category || 'N/A'}</span></td>
                            <td><span class="status-badge status-${p.status}">${p.status}</span></td>
                            <td>${this._formatDate(p.first_seen)}</td>
                            <td>${this._formatDate(p.last_seen)}</td>
                            <td>
                                <button class="btn btn-small" onclick="claudeAnalyticsModule.viewPattern(${p.id})">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            listDiv.innerHTML = '';
            listDiv.appendChild(table);
        }

        // Pagination
        const totalPages = Math.ceil(total / this.pageSize);
        this._renderPagination(paginationDiv, this.patternsPage, totalPages, (page) => {
            this.patternsPage = page;
            this.loadPatterns();
        });
    }

    async viewPattern(patternId) {
        try {
            const params = new URLSearchParams({ limit: 1, offset: 0 });
            const response = await apiGet(`/api/claude-analytics/patterns?${params}`);

            if (response.success && response.patterns.length > 0) {
                // Find the pattern (in a real scenario, we'd fetch by ID)
                // For now, we'll refetch all and find it
                const allResponse = await apiGet(`/api/claude-analytics/patterns?limit=1000&offset=0`);
                const pattern = allResponse.patterns.find(p => p.id === patternId);

                if (pattern) {
                    this.currentPattern = pattern;
                    this._showPatternModal(pattern);
                }
            }
        } catch (error) {
            console.error('Error loading pattern:', error);
            showMessage('Failed to load pattern details', 'error');
        }
    }

    _showPatternModal(pattern) {
        const modal = document.getElementById('pattern-modal');

        document.getElementById('pattern-detail-text').textContent = pattern.pattern_text;
        document.getElementById('pattern-detail-frequency').textContent = pattern.frequency;
        document.getElementById('pattern-detail-category').textContent = pattern.category || 'N/A';
        document.getElementById('pattern-detail-first').textContent = this._formatDate(pattern.first_seen);
        document.getElementById('pattern-detail-last').textContent = this._formatDate(pattern.last_seen);
        document.getElementById('pattern-detail-status').value = pattern.status;
        document.getElementById('pattern-detail-notes').value = pattern.notes || '';

        // Skill suggestion
        const skillDiv = document.getElementById('pattern-detail-skill');
        if (pattern.skill_suggestion) {
            skillDiv.textContent = pattern.skill_suggestion.reason || 'No suggestion';
        } else {
            skillDiv.textContent = 'None';
        }

        // Examples
        const examplesDiv = document.getElementById('pattern-detail-examples');
        examplesDiv.innerHTML = pattern.example_messages.map(msg => `
            <div class="example-message">
                <div class="example-timestamp">${this._formatDate(msg.timestamp)}</div>
                <div class="example-text">${this._escapeHtml(msg.display)}</div>
            </div>
        `).join('');

        modal.style.display = 'block';
    }

    closePatternModal() {
        document.getElementById('pattern-modal').style.display = 'none';
        this.currentPattern = null;
    }

    async savePattern() {
        if (!this.currentPattern) return;

        try {
            const status = document.getElementById('pattern-detail-status').value;
            const notes = document.getElementById('pattern-detail-notes').value;

            const response = await fetch(`/api/claude-analytics/patterns/${this.currentPattern.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, notes })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Pattern updated successfully', 'success');
                this.closePatternModal();
                await this.loadPatterns();
            } else {
                showMessage('Failed to update pattern', 'error');
            }
        } catch (error) {
            console.error('Error saving pattern:', error);
            showMessage('Failed to save pattern', 'error');
        }
    }

    clearPatternFilters() {
        document.getElementById('pattern-status-filter').value = '';
        document.getElementById('pattern-category-filter').value = '';
        document.getElementById('pattern-min-frequency').value = '3';
        this.patternsPage = 0;
        this.loadPatterns();
    }

    // ========================================================================
    // Skills Analysis Methods
    // ========================================================================

    async loadSkillsTab() {
        await this.loadSkills();
    }

    async analyzeAllSkills() {
        const btn = document.getElementById('analyze-skills-btn');
        if (!btn) return;

        try {
            btn.disabled = true;
            btn.textContent = 'Analyzing...';

            const result = await apiPost('/api/claude-analytics/skills/analyze', {});

            showMessage(`Analyzed ${result.analyzed} skills, updated ${result.updated}`, 'success');

            // Reload skills list
            await this.loadSkills();

        } catch (error) {
            console.error('Error analyzing skills:', error);
            showMessage('Error analyzing skills: ' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Analyze All Skills';
            }
        }
    }

    async loadSkills() {
        try {
            const typeFilter = document.getElementById('skills-type-filter').value;
            const scoreFilter = document.getElementById('skills-score-filter').value;

            const params = new URLSearchParams();
            if (typeFilter) params.append('skill_type', typeFilter);

            // Handle score range filter
            if (scoreFilter) {
                const [min, max] = scoreFilter.split('-').map(Number);
                params.append('min_overall_score', min);
                params.append('max_overall_score', max);
            }

            params.append('limit', this.pageSize);
            params.append('offset', this.skillsPage * this.pageSize);

            const result = await apiGet(`/api/claude-analytics/skills?${params}`);

            this._renderSkills(result.skills);

            // Update results info
            const resultsInfo = document.getElementById('skills-results-info');
            if (resultsInfo) {
                resultsInfo.textContent = `Showing ${result.skills.length} of ${result.total} skills`;
            }

            // Update pagination
            const pagination = document.getElementById('skills-pagination');
            if (pagination) {
                pagination.style.display = result.total > this.pageSize ? 'flex' : 'none';

                const pageInfo = document.getElementById('skills-page-info');
                if (pageInfo) {
                    pageInfo.textContent = `Page ${this.skillsPage + 1} of ${Math.ceil(result.total / this.pageSize)}`;
                }

                const prevBtn = document.getElementById('skills-prev-btn');
                const nextBtn = document.getElementById('skills-next-btn');

                if (prevBtn) {
                    prevBtn.disabled = this.skillsPage === 0;
                    prevBtn.onclick = () => {
                        this.skillsPage--;
                        this.loadSkills();
                    };
                }

                if (nextBtn) {
                    nextBtn.disabled = (this.skillsPage + 1) * this.pageSize >= result.total;
                    nextBtn.onclick = () => {
                        this.skillsPage++;
                        this.loadSkills();
                    };
                }
            }

        } catch (error) {
            console.error('Error loading skills:', error);
            showMessage('Error loading skills', 'error');
        }
    }

    _renderSkills(skills) {
        const tbody = document.getElementById('skills-table-body');
        if (!tbody) return;

        if (skills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-results">No skills found matching filters.</td></tr>';
            return;
        }

        tbody.innerHTML = skills.map(skill => {
            const overallColor = this._getScoreColor(skill.overall_score);

            return `
                <tr>
                    <td style="color: #333; font-weight: 500;">${this._escapeHtml(skill.skill_name)}</td>
                    <td><span class="category-badge">${skill.skill_type}</span></td>
                    <td style="color: ${this._getScoreColor(skill.d1_score)}; font-weight: bold;">${skill.d1_score}</td>
                    <td style="color: ${this._getScoreColor(skill.d2_score)}; font-weight: bold;">${skill.d2_score}</td>
                    <td style="color: ${this._getScoreColor(skill.d3_score)}; font-weight: bold;">${skill.d3_score}</td>
                    <td style="color: ${this._getScoreColor(skill.d4_score)}; font-weight: bold;">${skill.d4_score}</td>
                    <td style="color: ${overallColor}; font-weight: bold; font-size: 16px;">${skill.overall_score}</td>
                    <td>
                        <button class="btn btn-primary btn-small" onclick="window.claudeAnalyticsModule.viewSkill(${skill.id})">Details</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    _getScoreColor(score) {
        if (score >= 80) return '#2e7d32'; // green
        if (score >= 60) return '#f57c00'; // orange
        return '#c62828'; // red
    }

    async viewSkill(skillId) {
        try {
            const params = new URLSearchParams({ limit: 1000 });
            const result = await apiGet(`/api/claude-analytics/skills?${params}`);

            const skill = result.skills.find(s => s.id === skillId);
            if (!skill) {
                showMessage('Skill not found', 'error');
                return;
            }

            this.currentSkill = skill;
            this._showSkillModal(skill);

        } catch (error) {
            console.error('Error viewing skill:', error);
            showMessage('Error loading skill details', 'error');
        }
    }

    _showSkillModal(skill) {
        const modal = document.getElementById('skill-modal');
        if (!modal) return;

        // Populate modal fields
        document.getElementById('skill-detail-name').textContent = skill.skill_name;
        document.getElementById('skill-detail-type').textContent = skill.skill_type;
        document.getElementById('skill-detail-path').textContent = skill.skill_path;

        const overallColor = this._getScoreColor(skill.overall_score);
        const overallEl = document.getElementById('skill-detail-overall');
        overallEl.textContent = skill.overall_score;
        overallEl.style.color = overallColor;
        overallEl.style.fontWeight = 'bold';
        overallEl.style.fontSize = '18px';

        // D scores
        document.getElementById('skill-detail-d1').textContent = skill.d1_score;
        document.getElementById('skill-detail-d2').textContent = skill.d2_score;
        document.getElementById('skill-detail-d3').textContent = skill.d3_score;
        document.getElementById('skill-detail-d4').textContent = skill.d4_score;

        // Recommendations
        const recommendationsEl = document.getElementById('skill-detail-recommendations');
        if (skill.recommendations && skill.recommendations.length > 0) {
            recommendationsEl.innerHTML = `<ul>${skill.recommendations.map(r => `<li>${this._escapeHtml(r)}</li>`).join('')}</ul>`;
        } else {
            recommendationsEl.innerHTML = '<p style="color: #2e7d32;">No recommendations - skill looks great!</p>';
        }

        // Details
        const detailsEl = document.getElementById('skill-detail-details');
        detailsEl.textContent = JSON.stringify(skill.details, null, 2);

        // Analyzed at
        const analyzedAt = new Date(skill.analyzed_at);
        document.getElementById('skill-detail-analyzed').textContent = analyzedAt.toLocaleString();

        // Show modal
        modal.style.display = 'flex';

        // Close handlers
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.onclick = () => {
                modal.style.display = 'none';
            };
        });

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    async reanalyzeSkill() {
        if (!this.currentSkill) return;

        const btn = document.getElementById('skill-reanalyze-btn');
        if (!btn) return;

        try {
            btn.disabled = true;
            btn.textContent = 'Reanalyzing...';

            const result = await apiPost('/api/claude-analytics/skills/reanalyze', {
                skill_path: this.currentSkill.skill_path
            });

            if (result.error) {
                showMessage('Error reanalyzing skill: ' + result.error, 'error');
            } else {
                showMessage('Skill reanalyzed successfully', 'success');

                // Close modal
                document.getElementById('skill-modal').style.display = 'none';

                // Reload skills list
                await this.loadSkills();
            }

        } catch (error) {
            console.error('Error reanalyzing skill:', error);
            showMessage('Error reanalyzing skill', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Reanalyze';
            }
        }
    }

    // ------------------------------------------------------------------
    // Reprise Tab
    // ------------------------------------------------------------------

    async loadRepriseTab() {
        const loading = document.getElementById('reprise-loading');
        const results = document.getElementById('reprise-results');
        const days = document.getElementById('reprise-days-filter')?.value || 2;

        loading.style.display = 'block';
        results.style.display = 'none';

        try {
            const data = await apiGet(`/api/claude-analytics/resume-sessions?days=${days}`);
            this.renderRepriseResults(data.sessions || []);
        } catch (error) {
            console.error('Error loading reprise tab:', error);
            document.getElementById('reprise-list').innerHTML =
                '<div style="color: #f85149; padding: 20px;">Erreur chargement sessions</div>';
        } finally {
            loading.style.display = 'none';
            results.style.display = 'block';
        }
    }

    renderRepriseResults(sessions) {
        const info = document.getElementById('reprise-info');
        const list = document.getElementById('reprise-list');

        if (!sessions.length) {
            info.textContent = 'Aucune session trouvee';
            list.innerHTML = '';
            return;
        }

        info.textContent = `${sessions.length} session${sessions.length > 1 ? 's' : ''} disponible${sessions.length > 1 ? 's' : ''}`;

        // Group by date
        const byDate = {};
        sessions.forEach(s => {
            const d = s.date || 'Unknown';
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(s);
        });

        let html = '';
        for (const [date, dateSessions] of Object.entries(byDate)) {
            const dateLabel = date === new Date().toISOString().slice(0, 10) ? "Aujourd'hui" : date;
            html += `<h3 style="color: #e6edf3; margin: 16px 0 8px; font-size: 0.95em;">${dateLabel}</h3>`;

            dateSessions.forEach(s => {
                const project = s.project || s.project_id || 'Unknown';
                const duration = s.duration || '?';
                const msgs = s.msg_count || 0;
                const status = s.status || 'unknown';
                const summary = this._escapeHtml(s.summary || 'Pas de resume');
                const sessionId = s.sessionId;
                const cmd = `claude --resume ${sessionId}`;
                const statusColor = status === 'crashed' ? '#f85149' : '#8b949e';
                const statusIcon = status === 'crashed' ? '💥' : '✅';
                const start = s.start ? s.start.slice(11, 16) : '??:??';

                html += `
                <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div>
                            <span style="color: #58a6ff; font-weight: 600;">${this._escapeHtml(project)}</span>
                            <span style="color: #8b949e; margin-left: 8px;">${start} · ${duration} · ${msgs} msgs</span>
                            <span style="color: ${statusColor}; margin-left: 8px;">${statusIcon} ${status}</span>
                        </div>
                    </div>
                    <div style="color: #c9d1d9; font-size: 0.85em; margin-bottom: 8px;">${summary}</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <code style="background: #0d1117; border: 1px solid #30363d; padding: 4px 10px; border-radius: 4px; color: #7ee787; font-size: 0.85em; flex: 1;">${cmd}</code>
                        <button onclick="navigator.clipboard.writeText('${cmd}').then(() => this.textContent='Copie!').catch(() => {}); setTimeout(() => this.textContent='Copier', 1500);"
                            style="background: #238636; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Copier</button>
                    </div>
                </div>`;
            });
        }

        list.innerHTML = html;
    }

    clearSkillFilters() {
        document.getElementById('skills-type-filter').value = '';
        document.getElementById('skills-score-filter').value = '';
        this.skillsPage = 0;
        this.loadSkills();
    }

    _formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export module instance
const claudeAnalyticsModule = new ClaudeAnalyticsModule();

// Make module globally accessible for onclick handlers
window.claudeAnalyticsModule = claudeAnalyticsModule;

export default claudeAnalyticsModule;
