export default {
    name: 'YearSidebar',
    props: {
        // Expects an array of objects: [{ year: Number, count: Number }, ...]
        yearsWithCounts: {
            type: Array,
            required: true
            // Providing a default might also help, but the check below is safer
            // default: () => []
        },
        selectedYear: {
            type: Number,
            default: null
        }
    },
    template: `
        <aside class="w-64 bg-gray-50 shadow-md p-4 sticky top-4 self-start border border-gray-200 rounded-lg">
            <h2 class="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Filter by Year</h2>
            <ul class="space-y-1 max-h-[80vh] overflow-y-auto">
                <!-- Add an 'All Years' option -->
                <li>
                    <button
                        @click="$emit('year-selected', null)"
                        class="w-full text-left px-3 py-1.5 rounded-md text-sm flex justify-between items-center"
                        :class="{
                            'bg-blue-500 text-white font-medium shadow-sm': selectedYear === null,
                            'text-gray-600 hover:bg-gray-200 hover:text-gray-800': selectedYear !== null
                        }">
                        <span>All Years</span>
                        <!-- Optionally show total count here if available -->
                    </button>
                </li>

                <!-- Iterate over years with counts -->
                <li v-for="item in yearsWithCounts" :key="item.year">
                    <button
                        @click="$emit('year-selected', item.year)"
                        class="w-full text-left px-3 py-1.5 rounded-md text-sm flex justify-between items-center"
                        :class="{
                            'bg-blue-500 text-white font-medium shadow-sm': selectedYear === item.year,
                            'text-gray-600 hover:bg-gray-200 hover:text-gray-800': selectedYear !== item.year
                        }">
                        <span>{{ item.year }}</span>
                        <span class="text-xs px-1.5 py-0.5 rounded"
                              :class="{
                                'bg-blue-100 text-blue-700': selectedYear === item.year,
                                'bg-gray-200 text-gray-600': selectedYear !== item.year
                              }">
                              {{ item.count }}
                        </span>
                    </button>
                </li>
                <!-- Check if yearsWithCounts exists AND is empty -->
                <li v-if="yearsWithCounts && yearsWithCounts.length === 0">
                    <p class="text-sm text-gray-500 px-3 py-1.5">No years found.</p>
                </li>
            </ul>
        </aside>
    `
};