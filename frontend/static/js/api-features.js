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

    async listRecommendations() {
        return await API.fetch(`${API.BASE_URL}/media-reco/recommendations`);
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
        return await API.fetch(`${API.BASE_URL}/media-reco/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
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
