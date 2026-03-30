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
const selections = ref({})

function isMultiple(group) {
    return group.selection_type === 'multiple'
}

watch(() => props.product, (product) => {
    selections.value = {}
    product.modifier_groups?.forEach((group) => {
        selections.value[group.id] = isMultiple(group) ? new Set() : null
    })
    quantity.value = 1
    notes.value = ''
}, { immediate: true })

const selectedModifiers = computed(() => {
    const result = []
    props.product.modifier_groups?.forEach((group) => {
        const sel = selections.value[group.id]
        if (isMultiple(group)) {
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

const basePrice = computed(() => Number(props.product.price))
const unitTotal = computed(() => basePrice.value + modifiersTotal.value)
const totalPrice = computed(() => unitTotal.value * quantity.value)

const isValid = computed(() => {
    return props.product.modifier_groups?.every((group) => {
        if (!group.is_required) { return true }
        const sel = selections.value[group.id]
        if (isMultiple(group)) { return sel?.size > 0 }
        return sel !== null && sel !== undefined
    }) ?? true
})

function toggleOption(group, optionId) {
    if (isMultiple(group)) {
        const set = selections.value[group.id]
        if (set.has(optionId)) { set.delete(optionId) } else { set.add(optionId) }
    } else {
        // Single-select: allow deselect if group is not required.
        if (selections.value[group.id] === optionId && !group.is_required) {
            selections.value[group.id] = null
        } else {
            selections.value[group.id] = optionId
        }
    }
}

function isSelected(group, optionId) {
    const sel = selections.value[group.id]
    if (isMultiple(group)) { return sel?.has(optionId) }
    return sel === optionId
}

function addToCart() {
    if (!isValid.value) { return }
    cart.addItem(
        props.product,
        selectedModifiers.value,
        quantity.value,
        notes.value,
    )
    emit('added')
}
</script>

<template>
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-50 flex items-end justify-center md:items-center"
        @click.self="emit('close')"
    >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')"></div>

        <!-- Sheet (mobile) / Modal (desktop) -->
        <div class="relative z-10 w-full max-w-md md:max-w-2xl bg-white rounded-t-3xl md:rounded-2xl max-h-[92dvh] md:max-h-[85vh] overflow-y-auto md:shadow-xl">

            <!-- Close button (desktop — top right) -->
            <button
                @click="emit('close')"
                class="hidden md:flex absolute top-3 right-3 z-20 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full items-center justify-center transition-colors"
            >
                <span class="material-symbols-outlined text-gray-500 text-lg">close</span>
            </button>

            <div class="md:flex">

            <!-- Product image -->
            <div class="relative bg-gray-100 md:w-80 md:shrink-0 md:rounded-l-2xl md:overflow-hidden">
                <div v-if="product.image_url" class="w-full flex items-center justify-center bg-gray-100 overflow-hidden md:h-full md:min-h-[380px]">
                    <img
                        :src="product.image_url"
                        :alt="product.name"
                        class="w-full max-h-[320px] object-contain md:max-h-none md:h-full md:object-contain"
                    />
                </div>
                <div v-else class="w-full h-40 md:h-full md:min-h-[380px] flex items-center justify-center bg-gray-100">
                    <span class="material-symbols-outlined text-gray-300 text-6xl" style="font-variation-settings:'FILL' 1">fastfood</span>
                </div>
                <!-- Mobile close button -->
                <button
                    @click="emit('close')"
                    class="md:hidden absolute top-3 right-3 w-8 h-8 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center"
                >
                    <span class="material-symbols-outlined text-white text-lg">close</span>
                </button>
            </div>

            <!-- Content column (desktop right) -->
            <div class="md:flex-1 md:min-w-0 md:max-h-[85vh] md:overflow-y-auto">

            <!-- Content -->
            <div class="px-5 pt-5 pb-4">
                <h2 class="text-xl font-bold text-gray-900 mb-1">{{ product.name }}</h2>
                <p v-if="product.description" class="text-sm text-gray-500 mb-3 leading-relaxed">{{ product.description }}</p>

                <div class="flex items-center gap-2 mb-5">
                    <p class="text-lg font-bold text-[#FF5722]">${{ basePrice.toFixed(2) }}</p>
                    <span v-if="product.is_promotion" class="inline-block text-xs bg-[#FF5722] text-white px-2.5 py-0.5 rounded-full font-medium">
                        Promo
                    </span>
                </div>

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
                                v-if="isMultiple(group)"
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
                                    class="w-5 h-5 border-2 flex items-center justify-center transition-colors"
                                    :class="[
                                        isMultiple(group) ? 'rounded-md' : 'rounded-full',
                                        isSelected(group, option.id) ? 'border-[#FF5722] bg-[#FF5722]' : 'border-gray-300',
                                    ]"
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
        </div>
    </div>
</template>
