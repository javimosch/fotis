import { api } from '../api.js';

export default {
    name: 'ThumbnailStatusModal',
    props: {
        show: {
            type: Boolean,
            required: true
        }
    },
    data() {
        return {
            status: null,
            error: null,
            updateInterval: null
        };
    },
    methods: {
        async fetchStatus() {
            try {
                this.status = await api.getThumbnailStatus();
                console.debug('Thumbnail status:', this.status);
            } catch (error) {
                console.error('Failed to fetch thumbnail status:', error);
                this.error = error.message;
            }
        },
        startStatusUpdates() {
            this.updateInterval = setInterval(() => {
                this.fetchStatus();
            }, 5000); // Update every 5 seconds
        },
        stopStatusUpdates() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
        },
        close() {
            this.$emit('close');
        }
    },
    watch: {
        show(newVal) {
            if (newVal) {
                this.fetchStatus();
                this.startStatusUpdates();
            } else {
                this.stopStatusUpdates();
            }
        }
    },
    unmounted() {
        this.stopStatusUpdates();
    },
    template: `
        <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-lg w-full m-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold">Thumbnail Generation Status</h3>
                    <button @click="close" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div v-if="error" class="bg-red-50 text-red-500 p-4 rounded mb-4">
                    {{ error }}
                </div>

                <div v-else-if="status" class="space-y-4">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full"
                             :class="status.isGenerating ? 'bg-green-500 animate-pulse' : 'bg-gray-300'">
                        </div>
                        <span>{{ status.isGenerating ? 'Generation in Progress' : 'Idle' }}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-sm text-gray-500">Pending</div>
                            <div class="text-lg font-semibold">{{ status.pendingCount }}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Failed</div>
                            <div class="text-lg font-semibold">{{ status.failedCount }}</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">CPU Usage</div>
                            <div class="text-lg font-semibold">{{ Math.round(status.cpuUsage) }}%</div>
                        </div>
                        <div>
                            <div class="text-sm text-gray-500">Work Rate</div>
                            <div class="text-lg font-semibold">{{ status.workRatio }} /sec</div>
                        </div>
                    </div>

                    <div v-if="status.isGenerating" class="space-y-2">
                        <div>
                            <div class="text-sm text-gray-500">Progress</div>
                            <div class="text-lg font-semibold">{{ status.processedCount }} processed</div>
                        </div>
                        <div v-if="status.remainingTime">
                            <div class="text-sm text-gray-500">Estimated Time Remaining</div>
                            <div class="text-lg font-semibold">{{ status.remainingTime }}</div>
                        </div>
                        <div v-if="status.estimatedCompletionTime">
                            <div class="text-sm text-gray-500">Estimated Completion</div>
                            <div class="text-lg font-semibold">{{ status.estimatedCompletionTime }}</div>
                        </div>
                    </div>

                    <div v-if="status.lastEvent" class="text-sm text-gray-500">
                        Last Event: {{ new Date(status.lastEvent).toLocaleString() }}
                    </div>
                </div>

                <div v-else class="flex justify-center py-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            </div>
        </div>
    `
};