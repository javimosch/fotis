// API utilities
export const api = {
    async getMedia({ year = null, month = null, offset = 0, limit = 50 } = {}) {
        const params = new URLSearchParams({ offset, limit, requireThumbnail: true });
        if (year) params.append('year', year);
        if (month) params.append('month', month);

        console.debug(`API: Fetching media with params: ${params.toString()}`);
        const response = await fetch(`/media?${params}`);
        if (!response.ok) {
            console.error(`API Error: Failed to fetch media (${response.status})`, await response.text());
            throw new Error(`Failed to fetch media: ${response.statusText}`);
        }
        const data = await response.json();
        console.debug(`API: Received ${data.length} media items.`);
        return data;
    },

    async getYears() {
        console.debug("API: Fetching years with counts...");
        const response = await fetch('/media/years');
        if (!response.ok) {
            console.error(`API Error: Failed to fetch years (${response.status})`, await response.text());
            throw new Error(`Failed to fetch years: ${response.statusText}`);
        }
        const data = await response.json();
        console.debug("API: Received years data:", data);
        return data;
    },

    async getThumbnailUrl(hash) {
        return `/media/thumb/${hash}`;
    },

    async generateThumbnails(sourceId = null, year = null) {
        console.debug('API: Triggering thumbnail generation', { sourceId, year });
        const response = await fetch('/admin/thumbnails/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId, year })
        });
        if (!response.ok) {
            throw new Error(`Failed to trigger thumbnail generation: ${response.statusText}`);
        }
        return response.json();
    },

    async getThumbnailStatus() {
        console.debug('API: Fetching thumbnail status');
        const response = await fetch('/admin/thumbnails/status');
        if (!response.ok) {
            throw new Error(`Failed to get thumbnail status: ${response.statusText}`);
        }
        return response.json();
    },

    async getThumbnailStats() {
        console.debug('API: Fetching thumbnail stats');
        const response = await fetch('/admin/thumbnails/stats');
        if (!response.ok) {
            throw new Error(`Failed to get thumbnail stats: ${response.statusText}`);
        }
        return response.json();
    }
};