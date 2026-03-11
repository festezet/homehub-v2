/**
 * API Module - Centralized API calls
 * Phase 3: Unified API through HomeHub v2 backend
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
     * Applications API methods
     */
    apps: {
        async getAll() {
            return await API.fetch(`${API.BASE_URL}/apps`);
        },

        async launch(appId) {
            return await API.fetch(`${API.BASE_URL}/apps/launch/${appId}`, {
                method: 'POST'
            });
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
        async getTimeline() {
            return await API.fetch(`${API.BASE_URL}/activity/timeline`);
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
     * Formation API methods
     */
    formation: {
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
    }
};

export default API;
