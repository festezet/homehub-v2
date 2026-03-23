/**
 * Claude Instructions Module
 * Tree browser for .claude/ files + D3 force-directed cross-reference graph
 */

import API from './api.js';

class ClaudeInstructionsModule {
    constructor() {
        this.treeData = null;
        this.graphData = null;
        this.currentView = 'browser';
        this.simulation = null;
    }

    async load() {
        try {
            const response = await API.claudeInstructions.getTree();
            this.treeData = response;
            this._renderStats(response.stats);
            this._renderTree(response);
        } catch (error) {
            console.error('Failed to load claude instructions:', error);
            const panel = document.getElementById('ci-tree-panel');
            if (panel) panel.innerHTML = '<p style="color:#dc2626;text-align:center;padding:20px;">Erreur de chargement</p>';
        }
    }

    setView(view) {
        this.currentView = view;
        const browserView = document.getElementById('ci-browser-view');
        const graphView = document.getElementById('ci-graph-view');
        const btnBrowser = document.getElementById('ci-btn-browser');
        const btnGraph = document.getElementById('ci-btn-graph');

        if (view === 'browser') {
            browserView.style.display = 'flex';
            graphView.style.display = 'none';
            btnBrowser.classList.add('active');
            btnGraph.classList.remove('active');
        } else {
            browserView.style.display = 'none';
            graphView.style.display = 'block';
            btnBrowser.classList.remove('active');
            btnGraph.classList.add('active');
            this._loadGraph();
        }
    }

    async _loadGraph() {
        if (this.graphData) {
            this._renderGraph(this.graphData);
            return;
        }
        try {
            const response = await API.claudeInstructions.getGraph();
            this.graphData = response;
            this._renderGraph(response);
        } catch (error) {
            console.error('Failed to load graph:', error);
        }
    }

    _renderStats(stats) {
        const el = document.getElementById('ci-stats');
        if (!el || !stats) return;
        el.textContent = `${stats.rules} rules | ${stats.skills} skills | ${stats.state_files} state files | ${stats.projects_with_claude} projets`;
    }

    _renderTree(data) {
        const panel = document.getElementById('ci-tree-panel');
        if (!panel) return;

        let html = '';

        // Master CLAUDE.md
        if (data.master) {
            html += this._treeSection('Master', '#f59e0b', [
                { name: data.master.name, path: data.master.path, size: data.master.size }
            ]);
        }

        // Rules
        if (data.rules?.length) {
            html += this._treeSection('Rules', '#8b5cf6', data.rules);
        }

        // Skills
        if (data.skills?.length) {
            html += this._treeSection('Skills', '#10b981', data.skills);
        }

        // State files
        if (data.state_files?.length) {
            html += this._treeSection('State Files', '#3b82f6', data.state_files);
        }

        // Projects
        if (data.projects?.length) {
            html += '<div style="margin-top: 12px;">';
            html += '<div style="font-weight:600;font-size:0.85em;color:#6366f1;margin-bottom:6px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">Projects (' + data.projects.length + ')</div>';
            html += '<div>';
            for (const proj of data.projects) {
                html += `<div style="margin-bottom:8px;">`;
                html += `<div style="font-size:0.8em;font-weight:500;color:#6366f1;cursor:pointer;padding:2px 0;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">${this._esc(proj.project)} (${proj.file_count})</div>`;
                html += `<div style="display:none;padding-left:12px;">`;
                for (const f of proj.files) {
                    html += `<div class="ci-tree-item" style="font-size:0.78em;padding:3px 6px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background='var(--hover-bg,#f3f4f6)'" onmouseout="this.style.background=''" onclick="window.CIModule.loadFile('${this._esc(f.path)}')">${this._esc(f.name)}</div>`;
                }
                html += '</div></div>';
            }
            html += '</div></div>';
        }

        panel.innerHTML = html;
    }

    _treeSection(title, color, items) {
        let html = `<div style="margin-bottom:12px;">`;
        html += `<div style="font-weight:600;font-size:0.85em;color:${color};margin-bottom:4px;">${title}</div>`;
        for (const item of items) {
            const sizeKb = item.size ? ` <span style="color:#9ca3af;font-size:0.75em;">${(item.size / 1024).toFixed(1)}k</span>` : '';
            html += `<div style="font-size:0.82em;padding:3px 8px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background='var(--hover-bg,#f3f4f6)'" onmouseout="this.style.background=''" onclick="window.CIModule.loadFile('${this._esc(item.path)}')">${this._esc(item.name)}${sizeKb}</div>`;
        }
        html += '</div>';
        return html;
    }

    async loadFile(path) {
        const panel = document.getElementById('ci-file-panel');
        if (!panel) return;
        panel.innerHTML = '<p style="text-align:center;padding:20px;color:#666;">Chargement...</p>';

        try {
            const response = await API.claudeInstructions.getFile(path);
            const content = response.content || '';
            const rendered = this._renderMarkdown(content);
            panel.innerHTML = `
                <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-color,#e5e7eb);">
                    <strong style="font-size:0.9em;">${this._esc(response.name)}</strong>
                    <span style="color:#9ca3af;font-size:0.8em;margin-left:8px;">${response.lines} lignes | ${(response.size / 1024).toFixed(1)}k</span>
                </div>
                <div class="ci-file-content" style="font-size:0.85em;line-height:1.6;">${rendered}</div>
            `;
        } catch (error) {
            panel.innerHTML = `<p style="color:#dc2626;text-align:center;padding:20px;">Erreur: ${this._esc(error.message || 'Impossible de lire le fichier')}</p>`;
        }
    }

    _renderMarkdown(text) {
        // Simple markdown to HTML — headings, bold, code, lists, tables, links
        let html = this._esc(text);

        // Code blocks (``` ... ```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--code-bg,#f3f4f6);padding:12px;border-radius:6px;overflow-x:auto;font-size:0.9em;"><code>$2</code></pre>');

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code style="background:var(--code-bg,#f3f4f6);padding:2px 5px;border-radius:3px;font-size:0.9em;">$1</code>');

        // Headings
        html = html.replace(/^#### (.+)$/gm, '<h4 style="margin:16px 0 8px;font-size:0.95em;">$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:1em;">$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 10px;font-size:1.1em;border-bottom:1px solid var(--border-color,#e5e7eb);padding-bottom:4px;">$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1 style="margin:20px 0 12px;font-size:1.3em;">$1</h1>');

        // Bold and italic
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Tables (basic: pipe-delimited)
        html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, (match, header, sep, body) => {
            const headers = header.split('|').filter(c => c.trim()).map(c => `<th style="padding:4px 8px;border:1px solid var(--border-color,#ddd);font-size:0.85em;">${c.trim()}</th>`).join('');
            const rows = body.trim().split('\n').map(row => {
                const cells = row.split('|').filter(c => c.trim()).map(c => `<td style="padding:4px 8px;border:1px solid var(--border-color,#ddd);font-size:0.85em;">${c.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            return `<table style="border-collapse:collapse;margin:8px 0;width:100%;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
        });

        // Lists
        html = html.replace(/^- (.+)$/gm, '<li style="margin:2px 0;list-style:disc;margin-left:20px;">$1</li>');
        html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin:2px 0;list-style:decimal;margin-left:20px;">$1</li>');

        // Line breaks (paragraphs)
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    _renderGraph(data) {
        const svg = d3.select('#ci-graph-svg');
        svg.selectAll('*').remove();

        const width = svg.node()?.getBoundingClientRect().width || 800;
        const height = 600;

        const colorMap = {
            'master': '#f59e0b',
            'rule': '#8b5cf6',
            'skill': '#10b981',
            'state': '#3b82f6',
            'project': '#6366f1',
        };

        const nodes = data.nodes.map(d => ({ ...d }));
        const edges = data.edges.map(d => ({ ...d }));

        // Stop previous simulation
        if (this.simulation) this.simulation.stop();

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));

        // Edges
        const link = svg.append('g')
            .selectAll('line')
            .data(edges)
            .join('line')
            .attr('stroke', '#d1d5db')
            .attr('stroke-width', 1.5)
            .attr('marker-end', 'url(#arrow)');

        // Arrow marker
        svg.append('defs').append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#9ca3af');

        // Nodes
        const node = svg.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) this.simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) this.simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        node.append('circle')
            .attr('r', d => d.type === 'master' ? 14 : 10)
            .attr('fill', d => colorMap[d.type] || '#6b7280')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer');

        node.append('text')
            .text(d => d.label.replace('.md', ''))
            .attr('dy', -16)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#4b5563');

        // Click to load file
        node.on('click', (event, d) => {
            if (d.path) {
                this.setView('browser');
                this.loadFile(d.path);
            }
        });

        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Legend
        const legend = svg.append('g').attr('transform', `translate(${width - 150}, 20)`);
        const types = [['master', 'Master'], ['rule', 'Rules'], ['skill', 'Skills'], ['state', 'State']];
        types.forEach(([type, label], i) => {
            legend.append('circle').attr('cx', 0).attr('cy', i * 20).attr('r', 6).attr('fill', colorMap[type]);
            legend.append('text').attr('x', 14).attr('y', i * 20 + 4).text(label).attr('font-size', '11px').attr('fill', '#4b5563');
        });
    }

    _esc(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const claudeInstructionsModule = new ClaudeInstructionsModule();
window.CIModule = claudeInstructionsModule;

export default claudeInstructionsModule;
