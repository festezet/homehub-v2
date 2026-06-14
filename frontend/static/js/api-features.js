/**
 * API Features Module - Extended API namespaces
 * Split from api.js for modularity (specs, formation, threads, mediaReco, modularity)
 */

import API from './api.js';

/**
 * Formation API methods
 */
API.formation = {
    async getActions() {
        return await API.fetch(`${API.BASE_URL}/formation/actions`);
    },

    async toggle(actionId) {
        return await API.fetch(`${API.BASE_URL}/formation/actions/${actionId}/toggle`, {
            method: 'POST'
        });
    },

    async setStatus(actionId, status) {
        return await API.fetch(`${API.BASE_URL}/formation/actions/${actionId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
    },

    async getStats() {
        return await API.fetch(`${API.BASE_URL}/formation/stats`);
    },

    async getContent() {
        return await API.fetch(`${API.BASE_URL}/formation/content`);
    },

    async getTranscript(week, video) {
        return await API.fetch(`${API.BASE_URL}/formation/transcript/${week}/${video}`);
    },

    getMediaUrl(filepath) {
        return `${API.BASE_URL}/formation/media/${filepath}`;
    }
};

/**
 * Thread Digest API methods
 */
API.threads = {
    async getAll() {
        return await API.fetch(`${API.BASE_URL}/threads`);
    },

    async create(data) {
        return await API.fetch(`${API.BASE_URL}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async update(id, data) {
        return await API.fetch(`${API.BASE_URL}/threads/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async delete(id) {
        return await API.fetch(`${API.BASE_URL}/threads/${id}`, {
            method: 'DELETE'
        });
    },

    async getStatus() {
        return await API.fetch(`${API.BASE_URL}/threads/status`);
    },

    async getLatestDigests() {
        return await API.fetch(`${API.BASE_URL}/threads/digests/latest`);
    },

    async getMessages(threadId, params = {}) {
        const qs = new URLSearchParams();
        if (params.limit) qs.set('limit', params.limit);
        if (params.since) qs.set('since', params.since);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/threads/${threadId}/messages${query ? '?' + query : ''}`);
    },

    async storeDigest(threadId, data) {
        return await API.fetch(`${API.BASE_URL}/threads/${threadId}/digest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async getDigests(threadId) {
        return await API.fetch(`${API.BASE_URL}/threads/${threadId}/digests`);
    },

    async moveThread(id, direction) {
        return await API.fetch(`${API.BASE_URL}/threads/${id}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction })
        });
    },

    async discoverChats() {
        return await API.fetch(`${API.BASE_URL}/threads/chats`);
    }
};

/**
 * Media Recommender API methods
 */
API.mediaReco = {
    async getLibrary() {
        return await API.fetch(`${API.BASE_URL}/media-reco/library`);
    },

    async generateRecommendations(type = 'both', count = 5) {
        return await API.fetch(`${API.BASE_URL}/media-reco/recommendations/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, count })
        });
    },

    async submitRecommendations(text, batch_id) {
        return await API.fetch(`${API.BASE_URL}/media-reco/recommendations/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, batch_id })
        });
    },

    async listRecommendations(outcome, limit = 20) {
        const params = new URLSearchParams();
        if (outcome) params.set('outcome', outcome);
        if (limit) params.set('limit', limit);
        const qs = params.toString();
        return await API.fetch(`${API.BASE_URL}/media-reco/recommendations${qs ? '?' + qs : ''}`);
    },

    async resolveRecommendation(id, outcome) {
        return await API.fetch(`${API.BASE_URL}/media-reco/recommendations/${id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome })
        });
    },

    async getPreferences() {
        return await API.fetch(`${API.BASE_URL}/media-reco/preferences`);
    },

    async updatePreference(data) {
        return await API.fetch(`${API.BASE_URL}/media-reco/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async addTitle(data) {
        // Custom fetch to expose 409 (already exists) and error messages without throwing
        const resp = await fetch(`${API.BASE_URL}/media-reco/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const body = await resp.json().catch(() => ({}));
        return { ...body, _status: resp.status };
    },

    async createInteraction(data) {
        return await API.fetch(`${API.BASE_URL}/media-reco/interactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async getInteractions() {
        return await API.fetch(`${API.BASE_URL}/media-reco/interactions`);
    },

    async getTaste() {
        return await API.fetch(`${API.BASE_URL}/media-reco/taste`);
    },

    async getStats() {
        return await API.fetch(`${API.BASE_URL}/media-reco/stats`);
    },

    async triggerSync() {
        return await API.fetch(`${API.BASE_URL}/media-reco/sync`, {
            method: 'POST'
        });
    }
};

/**
 * Modularity Audit API methods
 */
API.modularity = {
    async getAudit() {
        return await API.fetch(`${API.BASE_URL}/modularity/audit`);
    },

    async runScan() {
        return await API.fetch(`${API.BASE_URL}/modularity/scan`, {
            method: 'POST'
        });
    }
};

/**
 * Claude Skills API methods
 */
API.claude = {
    async getSkills() {
        return await API.fetch(`${API.BASE_URL}/claude/skills`);
    }
};

/**
 * AI Profile API methods (drafts + notifications)
 */
/**
 * Session Close API methods
 */
API.sessionClose = {
    async create(data) {
        return await API.fetch(`${API.BASE_URL}/session-close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async list(params = {}) {
        const qs = new URLSearchParams();
        if (params.project_id) qs.set('project_id', params.project_id);
        if (params.limit) qs.set('limit', params.limit);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/session-close${query ? '?' + query : ''}`);
    },

    async getLatest(projectId) {
        return await API.fetch(`${API.BASE_URL}/session-close/latest/${projectId}`);
    },

    async getRecent(days = 7) {
        return await API.fetch(`${API.BASE_URL}/session-close/recent?days=${days}`);
    }
};

/**
 * Project Actions API methods
 */
API.projectActions = {
    async list(params = {}) {
        const qs = new URLSearchParams();
        if (params.project_id) qs.set('project_id', params.project_id);
        if (params.status) qs.set('status', params.status);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/project-actions${query ? '?' + query : ''}`);
    },

    async create(data) {
        return await API.fetch(`${API.BASE_URL}/project-actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async update(id, data) {
        return await API.fetch(`${API.BASE_URL}/project-actions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async delete(id) {
        return await API.fetch(`${API.BASE_URL}/project-actions/${id}`, {
            method: 'DELETE'
        });
    },

    async getStats() {
        return await API.fetch(`${API.BASE_URL}/project-actions/stats`);
    }
};

/**
 * AI Profile API methods (drafts + notifications)
 */
API.aiProfile = {
    async getChannels() {
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/channels`);
    },

    async getContacts(channel) {
        const params = channel ? `?channel=${channel}` : '';
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/contacts${params}`);
    },

    async getContactContext(contactId) {
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/contacts/${contactId}/context`);
    },

    async generateDraft(data) {
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async getQueue(status) {
        const params = status ? `?status=${status}` : '';
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/queue${params}`);
    },

    async addToQueue(data) {
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async deleteFromQueue(id) {
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/queue/${id}`, {
            method: 'DELETE'
        });
    },

    async getNotifications(params = '') {
        const url = params
            ? `${API.BASE_URL}/ai-profile/notifications?${params}`
            : `${API.BASE_URL}/ai-profile/notifications`;
        return await API.fetch(url);
    },

    async getNotificationStats() {
        return await API.fetch(`${API.BASE_URL}/ai-profile/notifications/stats`);
    },

    async markAsRead(id) {
        return await API.fetch(`${API.BASE_URL}/ai-profile/notifications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'read' })
        });
    },

    async triggerScan() {
        return await API.fetch(`${API.BASE_URL}/ai-profile/notifications/scan`, {
            method: 'POST'
        });
    },

    async getMapData() {
        return await API.fetch(`${API.BASE_URL}/ai-profile/introspect/map-data`);
    },

    async sendMessage(data) {
        return await API.fetch(`${API.BASE_URL}/ai-profile/messaging/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }
};

/**
 * Life Tasks API methods
 */
API.lifeTasks = {
    async list(params = {}) {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.category) qs.set('category', params.category);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/life-tasks${query ? '?' + query : ''}`);
    },

    async get(id) {
        return await API.fetch(`${API.BASE_URL}/life-tasks/${id}`);
    },

    async create(data) {
        return await API.fetch(`${API.BASE_URL}/life-tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async update(id, data) {
        return await API.fetch(`${API.BASE_URL}/life-tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async updateSteps(id, steps) {
        return await API.fetch(`${API.BASE_URL}/life-tasks/${id}/steps`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps })
        });
    },

    async resolve(id, resolution) {
        return await API.fetch(`${API.BASE_URL}/life-tasks/${id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution })
        });
    },

    async delete(id) {
        return await API.fetch(`${API.BASE_URL}/life-tasks/${id}`, {
            method: 'DELETE'
        });
    },

    async getTemplates() {
        return await API.fetch(`${API.BASE_URL}/life-tasks/templates`);
    },

    async getStats() {
        return await API.fetch(`${API.BASE_URL}/life-tasks/stats`);
    }
};

/**
 * LinkedIn Posts Review API methods
 */
/**
 * Claude Instructions API methods
 */
API.claudeInstructions = {
    async getTree() {
        return await API.fetch(`${API.BASE_URL}/claude-instructions/tree`);
    },

    async getFile(path) {
        return await API.fetch(`${API.BASE_URL}/claude-instructions/file?path=${encodeURIComponent(path)}`);
    },

    async getGraph() {
        return await API.fetch(`${API.BASE_URL}/claude-instructions/graph`);
    }
};

/**
 * HH Design API methods
 */
API.hhDesign = {
    async getArchitecture() {
        return await API.fetch(`${API.BASE_URL}/hh-design/architecture`);
    },

    async getFeatures(status, category) {
        const qs = new URLSearchParams();
        if (status) qs.set('status', status);
        if (category) qs.set('category', category);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/hh-design/features${query ? '?' + query : ''}`);
    },

    async createFeature(data) {
        return await API.fetch(`${API.BASE_URL}/hh-design/features`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async updateFeature(id, data) {
        return await API.fetch(`${API.BASE_URL}/hh-design/features/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async deleteFeature(id) {
        return await API.fetch(`${API.BASE_URL}/hh-design/features/${id}`, {
            method: 'DELETE'
        });
    }
};

/**
 * Gmail Knowledge API methods
 */
API.gmailKnowledge = {
    async getStats() {
        return await API.fetch(`${API.BASE_URL}/gmail-knowledge/stats`);
    },

    async getAccounts(params = '') {
        return await API.fetch(`${API.BASE_URL}/gmail-knowledge/accounts${params}`);
    },

    async getContacts(params = '') {
        return await API.fetch(`${API.BASE_URL}/gmail-knowledge/contacts${params}`);
    },

    async getAnnuaire(params = '') {
        return await API.fetch(`${API.BASE_URL}/gmail-knowledge/annuaire${params}`);
    },

    async getDocuments(params = '') {
        return await API.fetch(`${API.BASE_URL}/gmail-knowledge/documents${params}`);
    },

    async getEvents(params = '') {
        return await API.fetch(`${API.BASE_URL}/gmail-knowledge/events${params}`);
    },

    async getFinancial(params = '') {
        return await API.fetch(`${API.BASE_URL}/gmail-knowledge/financial${params}`);
    },

    async search(q) {
        return await API.fetch(`${API.BASE_URL}/gmail-knowledge/search?q=${encodeURIComponent(q)}`);
    }
};

/**
 * Invites API methods
 */
API.invites = {
    async send(data) {
        return await API.fetch(`${API.BASE_URL}/invites/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async preview(data) {
        return await API.fetch(`${API.BASE_URL}/invites/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async searchContact(query) {
        return await API.fetch(`${API.BASE_URL}/invites/search-contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
    }
};

/**
 * Veille IA (Content Intelligence) API methods
 */
API.veille = {
    async getItems(params = {}) {
        const qs = new URLSearchParams();
        if (params.min_relevance) qs.set('min_relevance', params.min_relevance);
        if (params.status) qs.set('status', params.status);
        if (params.type) qs.set('type', params.type);
        if (params.theme) qs.set('theme', params.theme);
        if (params.limit) qs.set('limit', params.limit);
        if (params.offset) qs.set('offset', params.offset);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/ai-profile/content/items${query ? '?' + query : ''}`);
    },

    async getStats() {
        return await API.fetch(`${API.BASE_URL}/ai-profile/content/stats`);
    },

    async search(q) {
        return await API.fetch(`${API.BASE_URL}/ai-profile/content/search?q=${encodeURIComponent(q)}`);
    }
};

/**
 * Session Bookmarks API methods
 */
API.sessionBookmarks = {
    async list(params = {}) {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.project_id) qs.set('project_id', params.project_id);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/session-bookmarks${query ? '?' + query : ''}`);
    },

    async get(id) {
        return await API.fetch(`${API.BASE_URL}/session-bookmarks/${id}`);
    },

    async create(data) {
        return await API.fetch(`${API.BASE_URL}/session-bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async update(id, data) {
        return await API.fetch(`${API.BASE_URL}/session-bookmarks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async delete(id) {
        return await API.fetch(`${API.BASE_URL}/session-bookmarks/${id}`, {
            method: 'DELETE'
        });
    },

    async stats() {
        return await API.fetch(`${API.BASE_URL}/session-bookmarks/stats`);
    }
};

/**
 * Claude Analytics API methods
 */
API.claudeAnalytics = {
    async importHistory(incremental = true) {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incremental })
        });
    },

    async getStats() {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/stats`);
    },

    async getMessages(params = {}) {
        const qs = new URLSearchParams();
        if (params.project) qs.set('project', params.project);
        if (params.session_id) qs.set('session_id', params.session_id);
        if (params.start_date) qs.set('start_date', params.start_date);
        if (params.end_date) qs.set('end_date', params.end_date);
        if (params.search) qs.set('search', params.search);
        if (params.limit) qs.set('limit', params.limit);
        if (params.offset) qs.set('offset', params.offset);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/claude-analytics/messages${query ? '?' + query : ''}`);
    },

    async getSessions(params = {}) {
        const qs = new URLSearchParams();
        if (params.project) qs.set('project', params.project);
        if (params.limit) qs.set('limit', params.limit);
        if (params.offset) qs.set('offset', params.offset);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/claude-analytics/sessions${query ? '?' + query : ''}`);
    },

    async getTimeline(granularity = 'day') {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/timeline?granularity=${granularity}`);
    },

    async getProjects() {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/projects`);
    }
};

API.linkedin = {
    async getPosts(params = {}) {
        const qs = new URLSearchParams();
        if (params.type) qs.set('type', params.type);
        if (params.status) qs.set('status', params.status);
        if (params.serie) qs.set('serie', params.serie);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/linkedin/posts${query ? '?' + query : ''}`);
    },

    async getPost(id) {
        return await API.fetch(`${API.BASE_URL}/linkedin/posts/${id}`);
    },

    async updateReview(id, data) {
        return await API.fetch(`${API.BASE_URL}/linkedin/posts/${id}/review`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async getStats() {
        return await API.fetch(`${API.BASE_URL}/linkedin/stats`);
    },

    async sync() {
        return await API.fetch(`${API.BASE_URL}/linkedin/sync`, {
            method: 'POST'
        });
    }
};

// ---- Patrimoine ----
API.patrimoine = {
    async getTable() {
        return await API.fetch(`${API.BASE_URL}/patrimoine/table`);
    },
    async getSummary() {
        return await API.fetch(`${API.BASE_URL}/patrimoine/summary`);
    },
    async getCategories() {
        return await API.fetch(`${API.BASE_URL}/patrimoine/categories`);
    },
    async getAccounts(categoryId) {
        const qs = categoryId ? `?category_id=${categoryId}` : '';
        return await API.fetch(`${API.BASE_URL}/patrimoine/accounts${qs}`);
    },
    async createAccount(data) {
        return await API.fetch(`${API.BASE_URL}/patrimoine/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async updateAccount(id, data) {
        return await API.fetch(`${API.BASE_URL}/patrimoine/accounts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async deleteAccount(id) {
        return await API.fetch(`${API.BASE_URL}/patrimoine/accounts/${id}`, {
            method: 'DELETE'
        });
    },
    async getSnapshots() {
        return await API.fetch(`${API.BASE_URL}/patrimoine/snapshots`);
    },
    async createSnapshot(data) {
        return await API.fetch(`${API.BASE_URL}/patrimoine/snapshots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async deleteSnapshot(id) {
        return await API.fetch(`${API.BASE_URL}/patrimoine/snapshots/${id}`, {
            method: 'DELETE'
        });
    },
    async getBalances(snapshotId) {
        const qs = snapshotId ? `?snapshot_id=${snapshotId}` : '';
        return await API.fetch(`${API.BASE_URL}/patrimoine/balances${qs}`);
    },
    async upsertBalance(data) {
        return await API.fetch(`${API.BASE_URL}/patrimoine/balances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async batchUpsertBalances(balances) {
        return await API.fetch(`${API.BASE_URL}/patrimoine/balances/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balances })
        });
    },
    async getAnalysis() {
        return await API.fetch(`${API.BASE_URL}/patrimoine/analysis`);
    }
};

// ---- Claude Analytics ----
API.claudeAnalytics = {
    async importHistory(incremental = true) {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incremental })
        });
    },

    async getStats() {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/stats`);
    },

    async getMessages(params = {}) {
        const qs = new URLSearchParams();
        if (params.project) qs.set('project', params.project);
        if (params.session_id) qs.set('session_id', params.session_id);
        if (params.start_date) qs.set('start_date', params.start_date);
        if (params.end_date) qs.set('end_date', params.end_date);
        if (params.search) qs.set('search', params.search);
        if (params.limit) qs.set('limit', params.limit);
        if (params.offset) qs.set('offset', params.offset);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/claude-analytics/messages${query ? '?' + query : ''}`);
    },

    async getSessions(params = {}) {
        const qs = new URLSearchParams();
        if (params.project) qs.set('project', params.project);
        if (params.limit) qs.set('limit', params.limit);
        if (params.offset) qs.set('offset', params.offset);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/claude-analytics/sessions${query ? '?' + query : ''}`);
    },

    async getTimeline(granularity = 'day') {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/timeline?granularity=${granularity}`);
    },

    async getProjects() {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/projects`);
    },

    async detectPatterns(min_frequency = 3) {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/patterns/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ min_frequency })
        });
    },

    async getPatterns(params = {}) {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.min_frequency) qs.set('min_frequency', params.min_frequency);
        if (params.category) qs.set('category', params.category);
        if (params.limit) qs.set('limit', params.limit);
        if (params.offset) qs.set('offset', params.offset);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/claude-analytics/patterns${query ? '?' + query : ''}`);
    },

    async updatePattern(id, updates) {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/patterns/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    },

    async analyzeAllSkills() {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/skills/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
    },

    async getSkills(params = {}) {
        const qs = new URLSearchParams();
        if (params.min_overall_score) qs.set('min_overall_score', params.min_overall_score);
        if (params.max_overall_score) qs.set('max_overall_score', params.max_overall_score);
        if (params.skill_type) qs.set('skill_type', params.skill_type);
        if (params.limit) qs.set('limit', params.limit);
        if (params.offset) qs.set('offset', params.offset);
        const query = qs.toString();
        return await API.fetch(`${API.BASE_URL}/claude-analytics/skills${query ? '?' + query : ''}`);
    },

    async reanalyzeSkill(skill_path) {
        return await API.fetch(`${API.BASE_URL}/claude-analytics/skills/reanalyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skill_path })
        });
    }
};

// ---- Sidebar ----
API.sidebar = {
    async getLayout() {
        return await API.fetch(`${API.BASE_URL}/sidebar/layout`);
    },
    async updateSection(id, data) {
        return await API.fetch(`${API.BASE_URL}/sidebar/sections/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async updateTab(id, data) {
        return await API.fetch(`${API.BASE_URL}/sidebar/tabs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async moveSection(id, direction) {
        return await API.fetch(`${API.BASE_URL}/sidebar/sections/${id}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction })
        });
    },
    async moveTab(id, direction) {
        return await API.fetch(`${API.BASE_URL}/sidebar/tabs/${id}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction })
        });
    },
    async createSection(data) {
        return await API.fetch(`${API.BASE_URL}/sidebar/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async deleteSection(id) {
        return await API.fetch(`${API.BASE_URL}/sidebar/sections/${id}`, {
            method: 'DELETE'
        });
    },
    async reassignTab(tabId, data) {
        return await API.fetch(`${API.BASE_URL}/sidebar/tabs/${tabId}/reassign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async getAllTabs() {
        return await API.fetch(`${API.BASE_URL}/sidebar/tabs`);
    },
    async addTabToSection(sectionId, pageKey) {
        return await API.fetch(`${API.BASE_URL}/sidebar/sections/${sectionId}/add-tab`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page_key: pageKey })
        });
    },
    async deleteTab(tabId) {
        return await API.fetch(`${API.BASE_URL}/sidebar/tabs/${tabId}`, {
            method: 'DELETE'
        });
    },
    async reset() {
        return await API.fetch(`${API.BASE_URL}/sidebar/reset`, {
            method: 'POST'
        });
    }
};

// ---- Dynamic Pages ----
API.dynamicPages = {
    async list() {
        return await API.fetch(`${API.BASE_URL}/dynamic-pages`);
    },
    async get(id) {
        return await API.fetch(`${API.BASE_URL}/dynamic-pages/${id}`);
    },
    async create(data) {
        return await API.fetch(`${API.BASE_URL}/dynamic-pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },
    async pin(id) {
        return await API.fetch(`${API.BASE_URL}/dynamic-pages/${id}/pin`, {
            method: 'POST'
        });
    },
    async delete(id) {
        return await API.fetch(`${API.BASE_URL}/dynamic-pages/${id}`, {
            method: 'DELETE'
        });
    }
};
