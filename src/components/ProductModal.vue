<script setup>
import { ref, computed, watch } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useRestaurantStore } from '@/stores/restaurant'

const props = defineProps({
    product: { type: Object, required: true },
})

const emit = defineEmits(['close', 'added'])

const cart = useCartStore()
const restaurantStore = useRestaurantStore()

const quantity = ref(1)
const notes = ref('')
const selections = ref({})

function isMultiple(group) {
    return group.selection_type === 'multiple'
}

function groupKey(group) {
    return (group.source || 'inline') + '_' + group.id
}

watch(() => props.product, (product) => {
    selections.value = {}
    product.modifier_groups?.forEach((group) => {
        selections.value[groupKey(group)] = isMultiple(group) ? new Set() : null
    })
    quantity.value = 1
    notes.value = ''
}, { immediate: true })

function isMaxReached(group) {
    if (!isMultiple(group) || !group.max_selections) { return false }
    const sel = selections.value[groupKey(group)]
    return sel && sel.size >= group.max_selections
}

const selectedModifiers = computed(() => {
    const result = []
    props.product.modifier_groups?.forEach((group) => {
        const sel = selections.value[groupKey(group)]
        const source = group.source || 'inline'
        if (isMultiple(group)) {
            sel?.forEach((optionId) => {
                const opt = group.options.find((o) => o.id === optionId)
                if (opt) {
                    const entry = { name: opt.name, price_adjustment: Number(opt.price_adjustment), source }
                    if (source === 'catalog') { entry.modifier_option_template_id = opt.id }
                    else { entry.modifier_option_id = opt.id }
                    result.push(entry)
                }
            })
        } else if (sel !== null && sel !== undefined) {
            const opt = group.options.find((o) => o.id === sel)
            if (opt) {
                const entry = { name: opt.name, price_adjustment: Number(opt.price_adjustment), source }
                if (source === 'catalog') { entry.modifier_option_template_id = opt.id }
                else { entry.modifier_option_id = opt.id }
                result.push(entry)
            }
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
        const sel = selections.value[groupKey(group)]
        if (isMultiple(group)) { return sel?.size > 0 }
        return sel !== null && sel !== undefined
    }) ?? true
})

function toggleOption(group, optionId) {
    const key = groupKey(group)
    if (isMultiple(group)) {
        const set = selections.value[key]
        if (set.has(optionId)) {
            set.delete(optionId)
        } else if (!isMaxReached(group)) {
            set.add(optionId)
        }
    } else {
        if (selections.value[key] === optionId && !group.is_required) {
            selections.value[key] = null
        } else {
            selections.value[key] = optionId
        }
    }
}

function isSelected(group, optionId) {
    const sel = selections.value[groupKey(group)]
    if (isMultiple(group)) { return sel?.has(optionId) }
    return sel === optionId
}

function isOptionDisabled(group, optionId) {
    if (!isMultiple(group)) { return false }
    return isMaxReached(group) && !isSelected(group, optionId)
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
        <div class="relative z-10 w-full max-w-md md:max-w-2xl rounded-t-3xl md:rounded-2xl max-h-[92dvh] md:max-h-[85vh] overflow-y-auto md:shadow-xl" :style="{ backgroundColor: 'var(--color-card-bg)' }">

            <!-- Close button (desktop — top right) -->
            <button
                @click="emit('close')"
                class="hidden md:flex absolute top-3 right-3 z-20 w-8 h-8 rounded-full items-center justify-center transition-colors"
                :style="{ backgroundColor: 'var(--color-border-light)' }"
            >
                <span class="material-symbols-outlined text-lg" :style="{ color: 'var(--color-text-secondary)' }">close</span>
            </button>

            <div class="md:flex">

            <!-- Product image -->
            <div class="relative md:w-80 md:shrink-0 md:rounded-l-2xl md:overflow-hidden" :style="{ backgroundColor: 'var(--color-border-light)' }">
                <div v-if="product.image_url" class="w-full flex items-center justify-center overflow-hidden md:h-full md:min-h-[380px]" :style="{ backgroundColor: 'var(--color-border-light)' }">
                    <img
                        :src="product.image_url"
                        :alt="product.name"
                        class="w-full max-h-[320px] object-contain md:max-h-none md:h-full md:object-contain"
                    />
                </div>
                <div v-else-if="restaurantStore.restaurant?.default_product_image_url" class="w-full flex items-center justify-center overflow-hidden md:h-full md:min-h-[380px]" :style="{ backgroundColor: 'var(--color-border-light)' }">
                    <img
                        :src="restaurantStore.restaurant.default_product_image_url"
                        :alt="product.name"
                        class="w-full max-h-[320px] object-contain md:max-h-none md:h-full md:object-contain"
                    />
                </div>
                <div v-else class="w-full h-40 md:h-full md:min-h-[380px] flex items-center justify-center" :style="{ backgroundColor: 'var(--color-border-light)' }">
                    <span class="material-symbols-outlined text-6xl" :style="{ color: 'var(--color-text-muted)', fontVariationSettings: '\'FILL\' 1' }">fastfood</span>
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
                <h2 class="text-xl font-bold mb-1" :style="{ color: 'var(--color-text)' }">{{ product.name }}</h2>
                <p v-if="product.description" class="text-sm mb-3 leading-relaxed" :style="{ color: 'var(--color-text-secondary)' }">{{ product.description }}</p>

                <div class="flex items-center gap-2 mb-5">
                    <p class="text-lg font-bold" :style="{ color: 'var(--color-secondary)' }">${{ basePrice.toFixed(2) }}</p>
                    <span v-if="product.is_promotion" class="inline-block text-xs px-2.5 py-0.5 rounded-full font-medium" :style="{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)' }">
                        Promo
                    </span>
                </div>

                <!-- Modifier groups -->
                <div
                    v-for="group in product.modifier_groups"
                    :key="groupKey(group)"
                    class="mb-5"
                >
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-semibold text-sm" :style="{ color: 'var(--color-text)' }">{{ group.name }}</h3>
                        <div class="flex gap-1">
                            <span
                                v-if="group.is_required"
                                class="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium"
                            >Requerido</span>
                            <span
                                v-if="isMultiple(group) && group.max_selections"
                                class="text-xs px-2 py-0.5 rounded-full font-medium"
                                :style="isMaxReached(group)
                                    ? { backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)' }
                                    : { backgroundColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }"
                            >{{ (selections[groupKey(group)]?.size || 0) }}/{{ group.max_selections }}</span>
                            <span
                                v-else-if="isMultiple(group)"
                                class="text-xs px-2 py-0.5 rounded-full"
                                :style="{ backgroundColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }"
                            >Varios</span>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <button
                            v-for="option in group.options"
                            :key="(group.source || 'inline') + '_' + option.id"
                            @click="toggleOption(group, option.id)"
                            :disabled="isOptionDisabled(group, option.id)"
                            class="w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            :style="isSelected(group, option.id)
                                ? { borderColor: 'var(--color-secondary)', backgroundColor: 'var(--color-secondary-light)' }
                                : { borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-card-bg)' }"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-5 h-5 border-2 flex items-center justify-center transition-colors"
                                    :class="isMultiple(group) ? 'rounded-md' : 'rounded-full'"
                                    :style="isSelected(group, option.id)
                                        ? { borderColor: 'var(--color-secondary)', backgroundColor: 'var(--color-secondary)' }
                                        : { borderColor: 'var(--color-border)' }"
                                >
                                    <span v-if="isSelected(group, option.id)" class="material-symbols-outlined text-xs" :style="{ color: 'var(--color-text-on-secondary)' }">check</span>
                                </div>
                                <span class="text-sm font-medium" :style="{ color: 'var(--color-text)' }">{{ option.name }}</span>
                            </div>
                            <span v-if="Number(option.price_adjustment) > 0" class="text-sm font-semibold" :style="{ color: 'var(--color-secondary)' }">
                                +${{ Number(option.price_adjustment).toFixed(2) }}
                            </span>
                        </button>
                    </div>
                </div>

                <!-- Notes -->
                <div class="mb-5">
                    <label class="block text-sm font-semibold mb-2" :style="{ color: 'var(--color-text)' }">Instrucciones especiales</label>
                    <textarea
                        v-model="notes"
                        placeholder="Sin cebolla, extra picante, etc."
                        rows="2"
                        class="w-full border rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
                        :style="{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-secondary-ring)' }"
                    ></textarea>
                </div>

                <!-- Quantity + Add to cart -->
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-3 rounded-2xl px-3 py-2" :style="{ backgroundColor: 'var(--color-border-light)' }">
                        <button
                            @click="quantity = Math.max(1, quantity - 1)"
                            class="w-7 h-7 flex items-center justify-center rounded-full shadow-sm"
                            :style="{ backgroundColor: 'var(--color-card-bg)', color: 'var(--color-text)' }"
                        >
                            <span class="material-symbols-outlined text-lg">remove</span>
                        </button>
                        <span class="w-5 text-center font-bold" :style="{ color: 'var(--color-text)' }">{{ quantity }}</span>
                        <button
                            @click="quantity++"
                            class="w-7 h-7 flex items-center justify-center rounded-full shadow-sm"
                            :style="{ backgroundColor: 'var(--color-card-bg)', color: 'var(--color-text)' }"
                        >
                            <span class="material-symbols-outlined text-lg">add</span>
                        </button>
                    </div>

                    <button
                        @click="addToCart"
                        :disabled="!isValid"
                        class="flex-1 rounded-2xl py-3 font-semibold text-sm flex items-center justify-between px-5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                        :style="{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)' }"
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
