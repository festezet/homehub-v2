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
API.aiProfile = {
    async getChannels() {
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/channels`);
    },

    async getContacts() {
        return await API.fetch(`${API.BASE_URL}/ai-profile/drafts/contacts`);
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
    }
};
