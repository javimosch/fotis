import { api } from './api.js';
import YearSidebar from './components/YearSidebar.js';
import MediaFilter from './components/MediaFilter.js';
import MediaGrid from './components/MediaGrid.js';
import MediaPreview from './components/MediaPreview.js';

const app = Vue.createApp({
    components: {
        YearSidebar,
        MediaFilter,
        MediaGrid,
        MediaPreview
    },
    data() {
        return {
            years: [],
            selectedYear: null,
            currentFilter: 'all',
            mediaItems: [],
            offset: 0,
            limit: 50,
            hasMoreItems: true,
            isLoading: false,
            previewItem: null
        };
    },
    methods: {
        async loadYears() {
            this.years = await api.getYears();
        },
        async loadMedia(reset = false) {
            if (reset) {
                this.offset = 0;
                this.mediaItems = [];
                this.hasMoreItems = true;
            }

            if (!this.hasMoreItems || this.isLoading) return;

            this.isLoading = true;
            try {
                const items = await api.getMedia({
                    year: this.selectedYear,
                    offset: this.offset,
                    limit: this.limit
                });

                this.mediaItems.push(...items);
                this.offset += items.length;
                this.hasMoreItems = items.length === this.limit;
            } catch (error) {
                console.error('Failed to load media:', error);
            } finally {
                this.isLoading = false;
            }
        },
        async selectYear(year) {
            this.selectedYear = year;
            await this.loadMedia(true);
        },
        setFilter(filter) {
            this.currentFilter = filter;
        },
        async loadMore() {
            await this.loadMedia();
        },
        openPreview(item) {
            this.previewItem = item;
        },
        closePreview() {
            this.previewItem = null;
        }
    },
    async mounted() {
        await this.loadYears();
        await this.loadMedia();
    }
});

app.mount('#app');