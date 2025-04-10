export default {
    name: 'MediaGrid',
    props: {
        items: {
            type: Array,
            required: true
        },
        filter: {
            type: String,
            default: 'all'
        }
    },
    data() {
        return {
            // Track load errors per item hash
            loadErrors: {}
        };
    },
    computed: {
        filteredItems() {
            if (this.filter === 'all') return this.items;
            return this.items.filter(item => item.type === this.filter);
        }
    },
    methods: {
        handleImageError(hash) {
            console.warn(`Thumbnail failed to load for hash: ${hash}`);
            // Use Vue.set or reactivity system for nested objects if needed,
            // but simple assignment works here for adding new keys.
            this.loadErrors[hash] = true;
        },
        getThumbnailUrl(hash) {
            return `/media/thumb/${hash}`;
        },
        shouldShowFallback(item) {
            return this.loadErrors[item.hash] || (!item.has_thumb && !item.thumb_pending);
        }
    },
    template: `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div v-for="item in filteredItems"
                :key="item.hash"
                class="relative group cursor-pointer aspect-square bg-gray-200 rounded-lg shadow-md overflow-hidden"
                @click="$emit('item-clicked', item)">

                <!-- Fallback Placeholder -->
                <div v-if="shouldShowFallback(item)"
                     class="absolute inset-0 flex items-center justify-center bg-gray-300">
                    <!-- Generic File Icon -->
                    <svg v-if="item.type !== 'video' && item.type !== 'image'" class="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h4a1 1 0 100-2H7z" clip-rule="evenodd" />
                    </svg>
                    <!-- Image Icon -->
                     <svg v-else-if="item.type === 'image'" class="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                     </svg>
                    <!-- Video Icon -->
                    <svg v-else-if="item.type === 'video'" class="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 18h11a2 2 0 002-2V8a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                </div>

                <!-- Thumbnail Image (Hidden if fallback is shown) -->
                <img v-if="!shouldShowFallback(item)"
                    :src="getThumbnailUrl(item.hash)"
                    :alt="item.path.split('/').pop()"
                    class="absolute inset-0 w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    loading="lazy"
                    @error="handleImageError(item.hash)"
                />

                <!-- Video Play Icon Overlay (Only show if thumbnail loaded successfully) -->
                <div v-if="item.type === 'video' && !shouldShowFallback(item)" class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="w-12 h-12 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>

                <!-- Filename Overlay -->
                <div class="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50 text-white text-xs rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                    {{ item.path.split('/').pop() }}
                </div>
            </div>
        </div>
    `
};