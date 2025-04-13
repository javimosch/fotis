export default {
    name: 'DateSidebar',
    props: {
        yearsWithCounts: {
            type: Array,
            required: true
        },
        selectedYear: {
            type: Number,
            default: null
        },
        selectedMonth: {
            type: Number,
            default: null
        }
    },
    data() {
        return {
            months: [
                { number: 1, name: 'January' },
                { number: 2, name: 'February' },
                { number: 3, name: 'March' },
                { number: 4, name: 'April' },
                { number: 5, name: 'May' },
                { number: 6, name: 'June' },
                { number: 7, name: 'July' },
                { number: 8, name: 'August' },
                { number: 9, name: 'September' },
                { number: 10, name: 'October' },
                { number: 11, name: 'November' },
                { number: 12, name: 'December' }
            ]
        };
    },
    template: `
        <aside class="w-64 bg-gray-50 shadow-md p-4 sticky top-4 self-start border border-gray-200 rounded-lg">
            <!-- Year Filter -->
            <h2 class="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Filter by Date</h2>
            <div class="mb-6">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Year</h3>
                <ul class="space-y-1 max-h-[40vh] overflow-y-auto">
                    <!-- All Years option -->
                    <li>
                        <button
                            @click="$emit('year-selected', null)"
                            class="w-full text-left px-3 py-1.5 rounded-md text-sm flex justify-between items-center"
                            :class="{
                                'bg-blue-500 text-white font-medium shadow-sm': selectedYear === null,
                                'text-gray-600 hover:bg-gray-200 hover:text-gray-800': selectedYear !== null
                            }">
                            <span>All Years</span>
                        </button>
                    </li>

                    <!-- Years list -->
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
                    <li v-if="yearsWithCounts && yearsWithCounts.length === 0">
                        <p class="text-sm text-gray-500 px-3 py-1.5">No years found.</p>
                    </li>
                </ul>
            </div>

            <!-- Month Filter -->
            <div v-if="selectedYear">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Month</h3>
                <ul class="space-y-1 max-h-[40vh] overflow-y-auto">
                    <!-- All Months option -->
                    <li>
                        <button
                            @click="$emit('month-selected', null)"
                            class="w-full text-left px-3 py-1.5 rounded-md text-sm flex justify-between items-center"
                            :class="{
                                'bg-blue-500 text-white font-medium shadow-sm': selectedMonth === null,
                                'text-gray-600 hover:bg-gray-200 hover:text-gray-800': selectedMonth !== null
                            }">
                            <span>All Months</span>
                        </button>
                    </li>

                    <!-- Months list -->
                    <li v-for="month in months" :key="month.number">
                        <button
                            @click="$emit('month-selected', month.number)"
                            class="w-full text-left px-3 py-1.5 rounded-md text-sm flex justify-between items-center"
                            :class="{
                                'bg-blue-500 text-white font-medium shadow-sm': selectedMonth === month.number,
                                'text-gray-600 hover:bg-gray-200 hover:text-gray-800': selectedMonth !== month.number
                            }">
                            <span>{{ month.name }}</span>
                        </button>
                    </li>
                </ul>
            </div>
        </aside>
    `
};
