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
    computed: {
        filteredItems() {
            if (this.filter === 'all') return this.items;
            return this.items.filter(item => item.type === this.filter);
        }
    },
    template: `
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div v-for="item in filteredItems" 
                :key="item.hash" 
                class="relative group cursor-pointer"
                @click="$emit('item-clicked', item)">
                
                <!-- Thumbnail -->
                <img v-if="item.type === 'image'"
                    :src="'/media/thumb/' + item.hash"
                    :alt="item.path.split('/').pop()"
                    class="w-full h-48 object-cover rounded-lg shadow-md group-hover:opacity-90"
                    loading="lazy"
                />
                
                <!-- Video Thumbnail with Play Icon -->
                <div v-else-if="item.type === 'video'" class="relative">
                    <img 
                        :src="'/media/thumb/' + item.hash"
                        :alt="item.path.split('/').pop()"
                        class="w-full h-48 object-cover rounded-lg shadow-md group-hover:opacity-90"
                        loading="lazy"
                    />
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-12 h-12 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Filename Overlay -->
                <div class="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50 text-white text-sm rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    {{ item.path.split('/').pop() }}
                </div>
            </div>
        </div>
    `
};