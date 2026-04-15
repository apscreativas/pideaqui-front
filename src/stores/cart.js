import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'pideaqui_cart'

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch { return [] }
}

export const useCartStore = defineStore('cart', () => {
    const items = ref(loadFromStorage())

    watch(items, (val) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    }, { deep: true })

    const subtotal = computed(() =>
        items.value.reduce((sum, item) => sum + item.item_total, 0),
    )

    const totalItems = computed(() =>
        items.value.reduce((sum, item) => sum + item.quantity, 0),
    )

    function modifierKey(m) {
        if (m.modifier_option_template_id) { return 'cat_' + m.modifier_option_template_id }
        return 'inl_' + (m.modifier_option_id || 0)
    }

    function addItem(product, selectedModifiers, quantity, notes) {
        const price = Number(product.price)
        const modifiersTotal = selectedModifiers.reduce((s, m) => s + m.price_adjustment, 0)
        const unitTotal = price + modifiersTotal
        const itemTotal = unitTotal * quantity

        // Determine if this is a promotion item (id like "promo_5") or a product.
        const isPromotion = product.is_promotion === true
        const productId = isPromotion ? null : product.id
        const promotionId = isPromotion ? product.promotion_id : null

        // Check if same item with same modifiers already in cart.
        const existingIndex = items.value.findIndex((i) =>
            i.product_id === productId &&
            i.promotion_id === promotionId &&
            JSON.stringify(i.modifiers.map((m) => modifierKey(m)).sort()) ===
            JSON.stringify(selectedModifiers.map((m) => modifierKey(m)).sort()) &&
            i.notes === notes,
        )

        if (existingIndex !== -1) {
            const existing = items.value[existingIndex]
            existing.quantity += quantity
            existing.item_total = (existing.unit_price + existing.modifiers.reduce((s, m) => s + m.price_adjustment, 0)) * existing.quantity
        } else {
            items.value.push({
                product_id: productId,
                promotion_id: promotionId,
                product_name: product.name,
                product_image: product.image_url,
                unit_price: price,
                quantity,
                notes,
                modifiers: selectedModifiers,
                item_total: itemTotal,
            })
        }
    }

    function updateQuantity(index, quantity) {
        if (quantity <= 0) {
            removeItem(index)
            return
        }
        const item = items.value[index]
        item.quantity = quantity
        const modifiersTotal = item.modifiers.reduce((s, m) => s + m.price_adjustment, 0)
        item.item_total = (item.unit_price + modifiersTotal) * quantity
    }

    function removeItem(index) {
        items.value.splice(index, 1)
    }

    function clear() {
        items.value = []
        localStorage.removeItem(STORAGE_KEY)
    }

    return { items, subtotal, totalItems, addItem, updateQuantity, removeItem, clear }
})
