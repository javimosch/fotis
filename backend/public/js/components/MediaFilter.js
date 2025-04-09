export default {
    name: 'MediaFilter',
    props: {
        currentFilter: {
            type: String,
            default: 'all'
        }
    },
    template: `
        <div class="flex gap-2 mb-6">
            <button 
                v-for="filter in ['all', 'image', 'video']" 
                :key="filter"
                @click="$emit('filter-changed', filter)"
                class="px-4 py-2 rounded-lg transition-colors"
                :class="{
                    'bg-blue-500 text-white': currentFilter === filter,
                    'bg-gray-200 hover:bg-gray-300 text-gray-700': currentFilter !== filter
                }"
            >
                {{ filter.charAt(0).toUpperCase() + filter.slice(1) }}s
            </button>
        </div>
    `
};