export default {
    name: 'MediaPreview',
    props: {
        item: {
            type: Object,
            required: true
        }
    },
    template: `
        <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div class="max-w-4xl w-full mx-4 bg-white rounded-lg shadow-xl">
                <div class="p-4 border-b flex justify-between items-center">
                    <h3 class="text-lg font-semibold">{{ item.path.split('/').pop() }}</h3>
                    <button 
                        @click="$emit('close')"
                        class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div class="p-4">
                    <!-- Image Preview -->
                    <img v-if="item.type === 'image'"
                        :src="'/media/thumb/' + item.hash"
                        :alt="item.path.split('/').pop()"
                        class="max-h-[70vh] mx-auto"
                    />
                    
                    <!-- Video Preview -->
                    <video v-else-if="item.type === 'video'"
                        :src="'/media/' + item.hash"
                        class="max-h-[70vh] mx-auto"
                        controls
                        autoplay
                    >
                        Your browser does not support the video tag.
                    </video>

                    <!-- Media Info -->
                    <div class="mt-4 text-sm text-gray-600">
                        <p>Size: {{ item.size_human }}</p>
                        <p>Type: {{ item.type }}</p>
                        <p>Date: {{ new Date(item.timestamp).toLocaleString() }}</p>
                    </div>
                </div>
            </div>
        </div>
    `
};