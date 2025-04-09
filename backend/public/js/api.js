// API utilities
export const api = {
    async getMedia({ year = null, offset = 0, limit = 50 } = {}) {
        const params = new URLSearchParams({ offset, limit });
        if (year) params.append('year', year);
        
        const response = await fetch(`/media?${params}`);
        if (!response.ok) throw new Error('Failed to fetch media');
        return response.json();
    },

    async getYears() {
        // For now, return static years - could be API-driven later
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => currentYear - i);
    },

    async getThumbnail(hash) {
        return `/media/thumb/${hash}`;
    }
};