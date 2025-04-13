// API utilities
export const api = {
    async getMedia({ year = null, month = null, offset = 0, limit = 50 } = {}) {
        const params = new URLSearchParams({ offset, limit, requireThumbnail: true });
        if (year) params.append('year', year);
        if (month) params.append('month', month);

        console.debug(`API: Fetching media with params: ${params.toString()}`); // Debug log
        const response = await fetch(`/media?${params}`);
        if (!response.ok) {
            console.error(`API Error: Failed to fetch media (${response.status})`, await response.text()); // Log error details
            throw new Error(`Failed to fetch media: ${response.statusText}`);
        }
        const data = await response.json();
        console.debug(`API: Received ${data.length} media items.`); // Debug log
        return data;
    },

    async getYears() {
        console.debug("API: Fetching years with counts..."); // Debug log
        const response = await fetch('/media/years'); // Use the new endpoint
        if (!response.ok) {
            console.error(`API Error: Failed to fetch years (${response.status})`, await response.text()); // Log error details
            throw new Error(`Failed to fetch years: ${response.statusText}`);
        }
        const data = await response.json();
        console.debug("API: Received years data:", data); // Debug log
        // Returns array of { year: number, count: number }
        return data;
    },

    async getThumbnailUrl(hash) { // Renamed for clarity, returns URL string
        return `/media/thumb/${hash}`;
    }
};