/**
 * API Module - Centralized API calls (core)
 * Phase 3: Unified API through HomeHub v2 backend
 * Extended namespaces (specs, formation, threads, mediaReco, modularity) in api-features.js
 */

const API = {
    // Unified base URL for HomeHub v2 API
    BASE_URL: 'http://localhost:5000/api',

    /**
     * Generic fetch wrapper with error handling
     */
    async fetch(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    /**
     * TODO API methods
     */
    todos: {
        async getAll() {
            return await API.fetch(`${API.BASE_URL}/todos`);
        },

        async create(todoData) {
            return await API.fetch(`${API.BASE_URL}/todos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(todoData)
            });
        },

        async update(id, field, value) {
            return await API.fetch(`${API.BASE_URL}/todos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field, value })
            });
        },

        async delete(id) {
            return await API.fetch(`${API.BASE_URL}/todos/${id}`, {
                method: 'DELETE'
            });
        }
    },

    /**
     * Docker API methods
     */
    docker: {
        async getContainers() {
            return await API.fetch(`${API.BASE_URL}/docker/containers`);
        },

        async controlContainer(name, action) {
            return await API.fetch(`${API.BASE_URL}/docker/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, action })
            });
        }
    },

    /**
     * Local Apps API methods
     */
    localApps: {
        async getApps() {
            return await API.fetch(`${API.BASE_URL}/local-apps/apps`);
        },

        async createApp(appData) {
            return await API.fetch(`${API.BASE_URL}/local-apps/apps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appData)
            });
        },

        async updateApp(id, data) {
            return await API.fetch(`${API.BASE_URL}/local-apps/apps/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        },

        async deleteApp(id) {
            return await API.fetch(`${API.BASE_URL}/local-apps/apps/${id}`, {
                method: 'DELETE'
            });
        },

        async launchApp(id) {
            return await API.fetch(`${API.BASE_URL}/local-apps/apps/${id}/launch`, {
                method: 'POST'
            });
        },

        async getCategories() {
            return await API.fetch(`${API.BASE_URL}/local-apps/categories`);
        }
    },

    /**
     * Infrastructure API methods
     */
    infrastructure: {
        async getDashboard() {
            return await API.fetch(`${API.BASE_URL}/infrastructure/dashboard`);
        }
    },

    /**
     * Activity Timeline API methods
     */
    activity: {
        async getTimeline(params = {}) {
            const qs = new URLSearchParams();
            if (params.limit) qs.set('limit', params.limit);
            if (params.project_id) qs.set('project_id', params.project_id);
            if (params.type) qs.set('type', params.type);
            const query = qs.toString();
            return await API.fetch(`${API.BASE_URL}/activity/timeline${query ? '?' + query : ''}`);
        },

        async getProjectActivity(projectId, limit = 5) {
            return await API.fetch(`${API.BASE_URL}/activity/project/${projectId}?limit=${limit}`);
        },

        async getStats() {
            return await API.fetch(`${API.BASE_URL}/activity/stats`);
        },

        async getRecentSessions(limit = 10) {
            return await API.fetch(`${API.BASE_URL}/projects/recent-sessions?limit=${limit}`);
        },

        async getTopProjects(limit = 10) {
            return await API.fetch(`${API.BASE_URL}/activity/top-projects?limit=${limit}`);
        },

        async log(data) {
            return await API.fetch(`${API.BASE_URL}/activity/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
    },

    /**
     * Internet Links API methods
     */
    internet: {
        async getLinks() {
            return await API.fetch(`${API.BASE_URL}/internet/links`);
        },

        async createLink(linkData) {
            return await API.fetch(`${API.BASE_URL}/internet/links`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(linkData)
            });
        },

        async updateLink(id, data) {
            return await API.fetch(`${API.BASE_URL}/internet/links/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        },

        async deleteLink(id) {
            return await API.fetch(`${API.BASE_URL}/internet/links/${id}`, {
                method: 'DELETE'
            });
        },

        async getCategories() {
            return await API.fetch(`${API.BASE_URL}/internet/categories`);
        }
    },

    /**
     * Services & Ports API methods
     */
    services: {
        async getPorts() {
            return await API.fetch(`${API.BASE_URL}/services/ports`);
        }
    },

    /**
     * Specs API methods
     */
    specs: {
        async getAll() {
            return await API.fetch(`${API.BASE_URL}/specs`);
        },

        async update(id, field, value) {
            return await API.fetch(`${API.BASE_URL}/specs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field, value })
            });
        },

        async scan() {
            return await API.fetch(`${API.BASE_URL}/specs/scan`, {
                method: 'POST'
            });
        },

        async healthScan() {
            return await API.fetch(`${API.BASE_URL}/specs/health-scan`, {
                method: 'POST'
            });
        }
    }
};

export default API;
