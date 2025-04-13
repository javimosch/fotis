import { api } from '../api.js';
import ThumbnailStatusModal from './ThumbnailStatusModal.js';

export default {
    name: 'AdminPanel',
    components: {
        ThumbnailStatusModal
    },
    data() {
        return {
            sources: [],
            isLoading: false,
            error: null,
            showAddSourceModal: false,
            showThumbnailStatusModal: false,
            newSource: {
                type: 'local',
                config: {
                    path: '',
                    host: '',
                    port: '22',
                    user: '',
                    pass: ''
                }
            },
            thumbnailStats: null,
            isLoadingStats: false
        };
    },
    methods: {
        async loadSources() {
            this.isLoading = true;
            this.error = null;
            try {
                const response = await fetch('/admin/sources');
                if (!response.ok) throw new Error('Failed to fetch sources');
                this.sources = await response.json();
            } catch (error) {
                console.error('Failed to load sources:', error);
                this.error = 'Failed to load sources. Please try again.';
            } finally {
                this.isLoading = false;
            }
        },
        async addSource() {
            try {
                const response = await fetch('/admin/sources', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: this.newSource.type,
                        config: this.getSourceConfig()
                    })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to add source');
                }

                await this.loadSources();
                this.showAddSourceModal = false;
                this.resetNewSource();
            } catch (error) {
                console.error('Failed to add source:', error);
                this.error = error.message;
            }
        },
        async testSource(sourceId) {
            try {
                const response = await fetch('/admin/sources/test', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ sourceId })
                });
                
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Test failed');
                }

                alert(result.details || 'Connection test successful!');
            } catch (error) {
                console.error('Test failed:', error);
                alert(error.message);
            }
        },
        getSourceConfig() {
            if (this.newSource.type === 'local') {
                return { path: this.newSource.config.path };
            } else {
                return {
                    host: this.newSource.config.host,
                    port: parseInt(this.newSource.config.port),
                    user: this.newSource.config.user,
                    pass: this.newSource.config.pass,
                    path: this.newSource.config.path
                };
            }
        },
        resetNewSource() {
            this.newSource = {
                type: 'local',
                config: {
                    path: '',
                    host: '',
                    port: '22',
                    user: '',
                    pass: ''
                }
            };
        },
        async loadThumbnailStats() {
            this.isLoadingStats = true;
            try {
                this.thumbnailStats = await api.getThumbnailStats();
            } catch (error) {
                console.error('Failed to load thumbnail stats:', error);
                this.error = 'Failed to load thumbnail statistics.';
            } finally {
                this.isLoadingStats = false;
            }
        },
        async generateThumbnails(sourceId = null) {
            try {
                await api.generateThumbnails(sourceId);
                this.showThumbnailStatusModal = true;
                await this.loadThumbnailStats();
            } catch (error) {
                console.error('Failed to trigger thumbnail generation:', error);
                this.error = error.message;
            }
        }
    },
    mounted() {
        this.loadSources();
        this.loadThumbnailStats();
    },
    template: `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Admin Panel</h2>
                <button 
                    @click="showAddSourceModal = true"
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                    Add Source
                </button>
            </div>

            <!-- Thumbnail Stats Section -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold">Thumbnail Statistics</h3>
                    <button 
                        @click="generateThumbnails()"
                        class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                        Generate All Thumbnails
                    </button>
                </div>

                <div v-if="isLoadingStats" class="text-center py-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                </div>

                <div v-else-if="thumbnailStats" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="text-sm text-gray-500">Total Media</div>
                            <div class="text-2xl font-bold">{{ thumbnailStats.overall.total }}</div>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="text-sm text-gray-500">With Thumbnails</div>
                            <div class="text-2xl font-bold text-green-600">
                                {{ thumbnailStats.overall.withThumbs }}
                                <span class="text-sm font-normal">
                                    ({{ ((thumbnailStats.overall.withThumbs / thumbnailStats.overall.total) * 100).toFixed(1) }}%)
                                </span>
                            </div>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="text-sm text-gray-500">Pending</div>
                            <div class="text-2xl font-bold text-yellow-600">{{ thumbnailStats.overall.pending }}</div>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <div class="text-sm text-gray-500">Failed</div>
                            <div class="text-2xl font-bold text-red-600">{{ thumbnailStats.overall.failed }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sources List -->
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-xl font-semibold mb-4">Media Sources</h3>
                
                <div v-if="isLoading" class="text-center py-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                </div>
                
                <div v-else-if="error" class="text-red-500 p-4 bg-red-50 rounded-lg">
                    {{ error }}
                </div>
                
                <div v-else-if="sources.length === 0" class="text-gray-500 text-center py-4">
                    No sources configured yet.
                </div>
                
                <div v-else class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Path</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            <tr v-for="source in sources" :key="source._id">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono">{{ source._id }}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">{{ source.type }}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">{{ source.config.path }}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">{{ new Date(source.createdAt).toLocaleString() }}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                    <button 
                                        @click="testSource(source._id)"
                                        class="text-blue-600 hover:text-blue-800">
                                        Test Connection
                                    </button>
                                    <button 
                                        @click="generateThumbnails(source._id)"
                                        class="text-green-600 hover:text-green-800">
                                        Generate Thumbnails
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Add Source Modal -->
            <div v-if="showAddSourceModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div class="bg-white rounded-lg p-6 max-w-lg w-full">
                    <h3 class="text-xl font-semibold mb-4">Add New Source</h3>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Source Type</label>
                        <select 
                            v-model="newSource.type"
                            class="w-full px-3 py-2 border rounded-lg">
                            <option value="local">Local</option>
                            <option value="sftp">SFTP</option>
                        </select>
                    </div>

                    <!-- Local Source Fields -->
                    <div v-if="newSource.type === 'local'" class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Path</label>
                        <input 
                            v-model="newSource.config.path"
                            type="text"
                            class="w-full px-3 py-2 border rounded-lg"
                            placeholder="/path/to/media">
                    </div>

                    <!-- SFTP Source Fields -->
                    <div v-if="newSource.type === 'sftp'" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Host</label>
                            <input 
                                v-model="newSource.config.host"
                                type="text"
                                class="w-full px-3 py-2 border rounded-lg"
                                placeholder="example.com">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Port</label>
                            <input 
                                v-model="newSource.config.port"
                                type="text"
                                class="w-full px-3 py-2 border rounded-lg"
                                placeholder="22">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Username</label>
                            <input 
                                v-model="newSource.config.user"
                                type="text"
                                class="w-full px-3 py-2 border rounded-lg"
                                placeholder="username">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                            <input 
                                v-model="newSource.config.pass"
                                type="password"
                                class="w-full px-3 py-2 border rounded-lg"
                                placeholder="password">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Remote Path</label>
                            <input 
                                v-model="newSource.config.path"
                                type="text"
                                class="w-full px-3 py-2 border rounded-lg"
                                placeholder="/remote/path">
                        </div>
                    </div>

                    <div class="flex justify-end gap-4 mt-6">
                        <button 
                            @click="showAddSourceModal = false"
                            class="px-4 py-2 text-gray-600 hover:text-gray-800">
                            Cancel
                        </button>
                        <button 
                            @click="addSource"
                            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                            Add Source
                        </button>
                    </div>
                </div>
            </div>

            <!-- Thumbnail Status Modal -->
            <ThumbnailStatusModal 
                :show="showThumbnailStatusModal"
                @close="showThumbnailStatusModal = false"
            />
        </div>
    `
};