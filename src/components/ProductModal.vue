<script setup>
import { ref, computed, watch } from 'vue'
import { useCartStore } from '@/stores/cart'

const props = defineProps({
    product: { type: Object, required: true },
})

const emit = defineEmits(['close', 'added'])

const cart = useCartStore()

const quantity = ref(1)
const notes = ref('')
// { [groupId]: Set of modifier_option_id for multiple, or single id for single }
const selections = ref({})

// Initialize selections
watch(() => props.product, (product) => {
    selections.value = {}
    product.modifier_groups?.forEach((group) => {
        selections.value[group.id] = group.is_multiple ? new Set() : null
    })
    quantity.value = 1
    notes.value = ''
}, { immediate: true })

const selectedModifiers = computed(() => {
    const result = []
    props.product.modifier_groups?.forEach((group) => {
        const sel = selections.value[group.id]
        if (group.is_multiple) {
            sel?.forEach((optionId) => {
                const opt = group.options.find((o) => o.id === optionId)
                if (opt) { result.push({ modifier_option_id: opt.id, name: opt.name, price_adjustment: Number(opt.price_adjustment) }) }
            })
        } else if (sel !== null && sel !== undefined) {
            const opt = group.options.find((o) => o.id === sel)
            if (opt) { result.push({ modifier_option_id: opt.id, name: opt.name, price_adjustment: Number(opt.price_adjustment) }) }
        }
    })
    return result
})

const modifiersTotal = computed(() =>
    selectedModifiers.value.reduce((s, m) => s + m.price_adjustment, 0),
)

const unitTotal = computed(() => Number(props.product.price) + modifiersTotal.value)
const totalPrice = computed(() => unitTotal.value * quantity.value)

const isValid = computed(() => {
    return props.product.modifier_groups?.every((group) => {
        if (!group.is_required) { return true }
        const sel = selections.value[group.id]
        if (group.is_multiple) { return sel?.size > 0 }
        return sel !== null && sel !== undefined
    }) ?? true
})

function toggleOption(group, optionId) {
    if (group.is_multiple) {
        const set = selections.value[group.id]
        if (set.has(optionId)) { set.delete(optionId) } else { set.add(optionId) }
    } else {
        selections.value[group.id] = optionId
    }
}

function isSelected(group, optionId) {
    const sel = selections.value[group.id]
    if (group.is_multiple) { return sel?.has(optionId) }
    return sel === optionId
}

function addToCart() {
    if (!isValid.value) { return }
    cart.addItem(props.product, selectedModifiers.value, quantity.value, notes.value)
    emit('added')
}
</script>

<template>
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-50 flex items-end justify-center"
        @click.self="emit('close')"
    >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')"></div>

        <!-- Sheet -->
        <div class="relative z-10 w-full max-w-md bg-white rounded-t-3xl max-h-[92dvh] overflow-y-auto">

            <!-- Product image -->
            <div class="relative bg-gray-50">
                <div v-if="product.image_url" class="w-full flex items-center justify-center bg-gray-100 overflow-hidden">
                    <img
                        :src="product.image_url"
                        :alt="product.name"
                        class="w-full max-h-[320px] object-contain"
                    />
                </div>
                <div v-else class="w-full h-40 flex items-center justify-center bg-gray-100">
                    <span class="material-symbols-outlined text-gray-300 text-6xl" style="font-variation-settings:'FILL' 1">fastfood</span>
                </div>
                <button
                    @click="emit('close')"
                    class="absolute top-3 right-3 w-8 h-8 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center"
                >
                    <span class="material-symbols-outlined text-white text-lg">close</span>
                </button>
            </div>

            <!-- Content -->
            <div class="px-5 pt-5 pb-4">
                <h2 class="text-xl font-bold text-gray-900 mb-1">{{ product.name }}</h2>
                <p v-if="product.description" class="text-sm text-gray-500 mb-3 leading-relaxed">{{ product.description }}</p>
                <p class="text-lg font-bold text-[#FF5722] mb-5">${{ Number(product.price).toFixed(2) }}</p>

                <!-- Modifier groups -->
                <div
                    v-for="group in product.modifier_groups"
                    :key="group.id"
                    class="mb-5"
                >
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-semibold text-gray-900 text-sm">{{ group.name }}</h3>
                        <div class="flex gap-1">
                            <span
                                v-if="group.is_required"
                                class="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium"
                            >Requerido</span>
                            <span
                                v-if="group.is_multiple"
                                class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                            >Varios</span>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <button
                            v-for="option in group.options"
                            :key="option.id"
                            @click="toggleOption(group, option.id)"
                            class="w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all"
                            :class="isSelected(group, option.id)
                                ? 'border-[#FF5722] bg-orange-50'
                                : 'border-gray-100 bg-gray-50'"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                                    :class="isSelected(group, option.id) ? 'border-[#FF5722] bg-[#FF5722]' : 'border-gray-300'"
                                >
                                    <span v-if="isSelected(group, option.id)" class="material-symbols-outlined text-white text-xs">check</span>
                                </div>
                                <span class="text-sm font-medium text-gray-800">{{ option.name }}</span>
                            </div>
                            <span v-if="Number(option.price_adjustment) > 0" class="text-sm font-semibold text-[#FF5722]">
                                +${{ Number(option.price_adjustment).toFixed(2) }}
                            </span>
                        </button>
                    </div>
                </div>

                <!-- Notes -->
                <div class="mb-5">
                    <label class="block text-sm font-semibold text-gray-900 mb-2">Instrucciones especiales</label>
                    <textarea
                        v-model="notes"
                        placeholder="Sin cebolla, extra picante, etc."
                        rows="2"
                        class="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FF5722]/30"
                    ></textarea>
                </div>

                <!-- Quantity + Add to cart -->
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-3 bg-gray-100 rounded-2xl px-3 py-2">
                        <button
                            @click="quantity = Math.max(1, quantity - 1)"
                            class="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-700"
                        >
                            <span class="material-symbols-outlined text-lg">remove</span>
                        </button>
                        <span class="w-5 text-center font-bold text-gray-900">{{ quantity }}</span>
                        <button
                            @click="quantity++"
                            class="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-700"
                        >
                            <span class="material-symbols-outlined text-lg">add</span>
                        </button>
                    </div>

                    <button
                        @click="addToCart"
                        :disabled="!isValid"
                        class="flex-1 bg-[#FF5722] text-white rounded-2xl py-3 font-semibold text-sm flex items-center justify-between px-5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                    >
                        <span>Agregar al carrito</span>
                        <span class="font-bold">${{ totalPrice.toFixed(2) }}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
