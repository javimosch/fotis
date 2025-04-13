import { api } from './api.js';
import DateSidebar from './components/DateSidebar.js';
import MediaFilter from './components/MediaFilter.js';
import MediaGrid from './components/MediaGrid.js';
import MediaPreview from './components/MediaPreview.js';
import AdminPanel from './components/AdminPanel.js';

const app = Vue.createApp({
    components: {
        DateSidebar,
        MediaFilter,
        MediaGrid,
        MediaPreview,
        AdminPanel
    },
    data() {
        return {
            yearsWithCounts: [],
            selectedYear: null,
            selectedMonth: null,
            currentFilter: 'all',
            mediaItems: [],
            offset: 0,
            limit: 50,
            hasMoreItems: true,
            isLoading: false,
            isLoadingMore: false,
            previewItem: null,
            errorLoading: null,
            scrollDebounceTimeout: null,
            currentView: 'media'
        };
    },
    methods: {
        debounce(func, delay) {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                }, delay);
            };
        },
        async loadYears() {
            console.debug("App: Loading years...");
            try {
                this.yearsWithCounts = await api.getYears();
                console.debug("App: Years loaded:", this.yearsWithCounts);
            } catch (error) {
                console.error('App: Failed to load years:', error);
                this.errorLoading = 'Could not load year filters.';
                this.yearsWithCounts = [];
            }
        },
        async loadMedia(reset = false) {
            console.debug(`App: Loading media with year: ${this.selectedYear}, month: ${this.selectedMonth}`);
            if (this.isLoading) return;

            if (reset) {
                console.debug(`App: Resetting media for year ${this.selectedYear}`);
                this.offset = 0;
                this.mediaItems = [];
                this.hasMoreItems = true;
                this.errorLoading = null;
                window.scrollTo(0, 0);
            }

            if (!this.hasMoreItems) {
                console.debug("App: No more items to load.");
                return;
            }

            console.debug(`App: Loading media (offset: ${this.offset}, limit: ${this.limit}, year: ${this.selectedYear})`);
            this.isLoading = true;
            if (this.offset > 0) this.isLoadingMore = true;

            try {
                const items = await api.getMedia({
                    year: this.selectedYear,
                    month: this.selectedMonth,
                    offset: this.offset,
                    limit: this.limit
                });

                console.debug(`App: Received ${items.length} items.`);
                this.mediaItems.push(...items);
                this.offset += items.length;
                this.hasMoreItems = items.length === this.limit;
                console.debug(`App: Media loaded. Total items: ${this.mediaItems.length}, hasMore: ${this.hasMoreItems}`);
            } catch (error) {
                console.error('App: Failed to load media:', error);
                this.errorLoading = `Failed to load media: ${error.message}`;
                this.hasMoreItems = false;
            } finally {
                this.isLoading = false;
                this.isLoadingMore = false;
            }
        },
        async selectYear(year) {
            console.debug(`App: Year selected: ${year}`);
            if (this.selectedYear === year) return;
            this.selectedYear = year;
            this.selectedMonth = null;
            await this.loadMedia(true);
        },
        async selectMonth(month) {
            console.debug(`App: Month selected: ${month}`);
            if (this.selectedMonth === month) {
                return;
            }
            this.selectedMonth = month;
            await this.loadMedia(true);
        },
        setFilter(filter) {
            console.debug(`App: Filter set to: ${filter}`);
            this.currentFilter = filter;
        },
        _handleScroll() {
            const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 500;
            if (nearBottom && !this.isLoading && this.hasMoreItems) {
                console.debug("App: Near bottom, loading more...");
                this.loadMedia();
            }
        },
        openPreview(item) {
            console.debug("App: Opening preview for item:", item.hash);
            this.previewItem = item;
        },
        closePreview() {
            console.debug("App: Closing preview");
            this.previewItem = null;
        },
        switchView(view) {
            console.debug(`App: Switching view to ${view}`);
            this.currentView = view;
            if (view === 'media') {
                this.loadMedia(true);
            }
        }
    },
    created() {
        this.debouncedScrollHandler = this.debounce(this._handleScroll, 200);
    },
    async mounted() {
        console.debug("App: Mounted.");
        await this.loadYears();
        await this.loadMedia();
        window.addEventListener('scroll', this.debouncedScrollHandler);
    },
    beforeUnmount() {
        console.debug("App: Unmounting, removing scroll listener.");
        window.removeEventListener('scroll', this.debouncedScrollHandler);
        clearTimeout(this.scrollDebounceTimeout);
    },
    template: `
        <div class="min-h-screen bg-gray-100">
            <!-- Navigation -->
            <nav class="bg-white shadow-sm">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex justify-between h-16">
                        <div class="flex">
                            <div class="flex space-x-8">
                                <button 
                                    @click="switchView('media')"
                                    :class="[
                                        'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                                        currentView === 'media' 
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                    ]">
                                    Media
                                </button>
                                <button 
                                    @click="switchView('admin')"
                                    :class="[
                                        'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                                        currentView === 'admin'
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                    ]">
                                    Admin
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <!-- Main Content -->
            <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <!-- Media View -->
                <div v-if="currentView === 'media'" class="py-6">
                    <div class="flex gap-6">
                        <DateSidebar 
                            :years-with-counts="yearsWithCounts"
                            :selected-year="selectedYear"
                            :selected-month="selectedMonth"
                            @year-selected="selectYear"
                            @month-selected="selectMonth"
                        />
                        
                        <div class="flex-1">
                            <MediaFilter 
                                :current-filter="currentFilter"
                                @filter-changed="setFilter"
                            />
                            
                            <div v-if="errorLoading" class="text-red-500 mb-4">
                                {{ errorLoading }}
                            </div>
                            
                            <div v-if="isLoading && !isLoadingMore" class="flex justify-center py-12">
                                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                            
                            <template v-else>
                                <MediaGrid 
                                    :items="mediaItems"
                                    :filter="currentFilter"
                                    @item-clicked="openPreview"
                                />
                                
                                <div v-if="isLoadingMore" class="text-center py-4">
                                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                </div>
                            </template>
                        </div>
                    </div>
                    
                    <MediaPreview 
                        v-if="previewItem"
                        :item="previewItem"
                        @close="closePreview"
                    />
                </div>

                <!-- Admin View -->
                <AdminPanel v-else />
            </main>
        </div>
    `
});

app.mount('#app');