export default {
    name: 'YearSidebar',
    props: {
        years: {
            type: Array,
            required: true
        },
        selectedYear: {
            type: Number,
            default: null
        }
    },
    template: `
        <aside class="w-64 bg-white shadow-lg p-6">
            <h2 class="text-lg font-semibold mb-4">Filter by Year</h2>
            <ul class="space-y-2">
                <li v-for="year in years" :key="year">
                    <button 
                        @click="$emit('year-selected', year)"
                        class="w-full text-left px-4 py-2 rounded"
                        :class="{
                            'bg-blue-500 text-white': selectedYear === year,
                            'hover:bg-gray-100': selectedYear !== year
                        }">
                        {{ year }}
                    </button>
                </li>
            </ul>
        </aside>
    `
};