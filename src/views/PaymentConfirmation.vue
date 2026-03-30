<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'
import { getCustomerCookie, setCustomerCookie, generateCustomerToken } from '@/utils/cookies'
import api from '@/services/api'

const router = useRouter()
const cart = useCartStore()
const order = useOrderStore()
const restaurantStore = useRestaurantStore()

const paymentMethods = computed(() => restaurantStore.paymentMethods)
const total = computed(() => cart.subtotal - couponDiscount.value + order.deliveryCost)

const customerName = ref(order.customerName)
const customerPhone = ref(order.customerPhone)
const selectedPaymentMethod = ref(null)

const cashAmount = ref(null)
const requiresInvoice = ref(false)
const submitting = ref(false)
const submitError = ref(null)

// Coupon state
const couponInput = ref('')
const couponDiscount = ref(0)
const couponApplied = ref(false)
const couponError = ref(null)
const couponLoading = ref(false)
const couponLabel = ref('')

async function applyCoupon() {
    if (!couponInput.value.trim() || couponLoading.value) return
    if (!customerPhone.value || !/^\d{10}$/.test(customerPhone.value)) {
        couponError.value = 'Ingresa tu teléfono primero para validar el cupón.'
        return
    }
    couponLoading.value = true
    couponError.value = null
    try {
        const { data } = await api.post('/api/coupons/validate', {
            code: couponInput.value.trim(),
            subtotal: cart.subtotal,
            customer_phone: customerPhone.value,
        })
        if (data.valid) {
            couponApplied.value = true
            couponDiscount.value = data.calculated_discount
            couponLabel.value = couponInput.value.trim().toUpperCase()
            order.couponCode = couponLabel.value
            order.couponDiscount = data.calculated_discount
        } else {
            couponError.value = data.reason
        }
    } catch {
        couponError.value = 'Error al validar el cupón. Intenta de nuevo.'
    } finally {
        couponLoading.value = false
    }
}

function removeCoupon() {
    couponApplied.value = false
    couponDiscount.value = 0
    couponLabel.value = ''
    couponError.value = null
    couponInput.value = ''
    order.couponCode = null
    order.couponDiscount = 0
}

onMounted(() => {
    // Pre-fill from cookie
    const cookie = getCustomerCookie()
    if (cookie) {
        customerName.value = cookie.name ?? ''
        customerPhone.value = cookie.phone ?? ''
    }

    // Auto-select if only one active
    if (paymentMethods.value.length === 1) {
        selectedPaymentMethod.value = paymentMethods.value[0].type
    }
})


async function confirm() {
    if (submitting.value) { return }
    if (!customerName.value || !customerPhone.value || !selectedPaymentMethod.value) { return }
    if (selectedPaymentMethod.value === 'cash' && (!cashAmount.value || parseFloat(cashAmount.value) < total.value || parseFloat(cashAmount.value) > 100000)) { return }

    submitting.value = true
    submitError.value = null

    // Open blank window immediately in user-click stack to avoid popup blocker
    const whatsappWin = window.open('', '_blank')

    try {
        // Get or create customer token
        let cookie = getCustomerCookie()
        if (!cookie) {
            cookie = { token: generateCustomerToken() }
        }

        const payload = {
            customer: {
                token: cookie.token,
                name: customerName.value,
                phone: customerPhone.value,
            },
            branch_id: order.branchId,
            delivery_type: order.deliveryType,
            payment_method: selectedPaymentMethod.value,
            cash_amount: selectedPaymentMethod.value === 'cash' && cashAmount.value ? parseFloat(cashAmount.value) : null,
            address_street: order.addressStreet || null,
            address_number: order.addressNumber || null,
            address_colony: order.addressColony || null,
            address_references: order.addressReferences || null,
            latitude: order.latitude || null,
            longitude: order.longitude || null,
            distance_km: order.distanceKm || null,
            delivery_cost: order.deliveryCost,
            scheduled_at: order.scheduledAt || null,
            requires_invoice: requiresInvoice.value,
            coupon_code: couponApplied.value ? couponLabel.value : null,
            items: cart.items.map((item) => ({
                product_id: item.product_id || null,
                promotion_id: item.promotion_id || null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                notes: item.notes || null,
                modifiers: item.modifiers.map((m) => {
                    const mod = { price_adjustment: m.price_adjustment }
                    if (m.modifier_option_template_id) {
                        mod.modifier_option_template_id = m.modifier_option_template_id
                    } else {
                        mod.modifier_option_id = m.modifier_option_id
                    }
                    return mod
                }),
            })),
        }

        const { data } = await api.post('/api/orders', payload)
        const orderId = data.data.order_id
        const whatsapp = data.data.branch_whatsapp
        const whatsappMessage = data.data.whatsapp_message

        // Save customer data to cookie
        // For non-delivery orders, preserve previously saved address data
        const isDelivery = order.deliveryType === 'delivery'
        setCustomerCookie({
            token: cookie.token,
            name: customerName.value,
            phone: customerPhone.value,
            address_street: isDelivery ? order.addressStreet : (cookie.address_street ?? ''),
            address_number: isDelivery ? order.addressNumber : (cookie.address_number ?? ''),
            address_colony: isDelivery ? order.addressColony : (cookie.address_colony ?? ''),
            address_references: isDelivery ? order.addressReferences : (cookie.address_references ?? ''),
            latitude: isDelivery ? order.latitude : (cookie.latitude ?? null),
            longitude: isDelivery ? order.longitude : (cookie.longitude ?? null),
        })

        order.confirmedOrderId = orderId
        order.customerName = customerName.value
        order.customerPhone = customerPhone.value
        order.paymentMethod = selectedPaymentMethod.value
        order.cashAmount = selectedPaymentMethod.value === 'cash' && cashAmount.value ? parseFloat(cashAmount.value) : null
        order.transferDetails = selectedPaymentMethod.value === 'transfer' && selectedPmDetails.value
            ? { bank_name: selectedPmDetails.value.bank_name, account_holder: selectedPmDetails.value.account_holder, clabe: selectedPmDetails.value.clabe }
            : null

        // Open WhatsApp — use backend-generated message (single source of truth)
        const sanitizedWhatsapp = whatsapp.replace(/[^\d+]/g, '')
        const waUrl = `https://api.whatsapp.com/send?phone=${sanitizedWhatsapp}&text=${encodeURIComponent(whatsappMessage)}`
        if (whatsappWin) {
            whatsappWin.location.href = waUrl
        } else {
            // Popups blocked — redirect current tab as fallback
            window.location.href = waUrl
        }

        order.setOrderSummary(cart.items, cart.subtotal, order.deliveryCost, couponDiscount.value)
        cart.clear()
        router.push('/confirmed')
    } catch (err) {
        // Close the pre-opened blank window on error
        if (whatsappWin) { whatsappWin.close() }
        submitError.value = err.response?.data?.message ?? 'Error al registrar el pedido. Intenta de nuevo.'
    } finally {
        submitting.value = false
    }
}

const selectedPmDetails = computed(() =>
    restaurantStore.paymentMethods.find((pm) => pm.type === selectedPaymentMethod.value),
)
</script>

<template>
    <div class="min-h-dvh" style="background-color: var(--color-primary)">

        <!-- Header -->
        <header class="sticky top-0 z-10 border-b px-4 py-3" :style="{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border-light)' }">
            <div class="max-w-6xl mx-auto flex items-center gap-3">
                <button
                    @click="router.back()"
                    class="w-9 h-9 flex items-center justify-center rounded-full border"
                    :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }"
                >
                    <span class="material-symbols-outlined text-xl" :style="{ color: 'var(--color-text-secondary)' }">arrow_back</span>
                </button>
                <h1 class="text-base font-bold" :style="{ color: 'var(--color-text)' }">Confirmar pedido</h1>
            </div>
        </header>

        <div class="max-w-6xl mx-auto px-4 py-5 pb-40 md:pb-8">
        <div class="md:flex md:gap-8">

        <div class="md:flex-1 min-w-0">
            <!-- Customer data -->
            <div class="rounded-2xl border p-5 mb-4" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                <h2 class="text-sm font-bold mb-4" :style="{ color: 'var(--color-text)' }">Tus datos</h2>
                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wide mb-1" :style="{ color: 'var(--color-text-secondary)' }">Nombre completo</label>
                        <div class="flex items-center gap-2 rounded-2xl px-4 py-3 focus-within:ring-2" :style="{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border)', '--tw-ring-color': 'var(--color-secondary-ring)' }">
                            <span class="material-symbols-outlined text-lg" :style="{ color: 'var(--color-text-muted)' }">person</span>
                            <input
                                v-model="customerName"
                                type="text"
                                maxlength="255"
                                placeholder="Juan Pérez"
                                class="flex-1 bg-transparent text-sm focus:outline-none focus:ring-0"
                                :style="{ color: 'var(--color-text)' }"
                            />
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wide mb-1" :style="{ color: 'var(--color-text-secondary)' }">Teléfono</label>
                        <div class="flex items-center gap-2 rounded-2xl px-4 py-3 focus-within:ring-2" :style="{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border)', '--tw-ring-color': 'var(--color-secondary-ring)' }">
                            <span class="material-symbols-outlined text-lg" :style="{ color: 'var(--color-text-muted)' }" aria-hidden="true">phone</span>
                            <input
                                v-model="customerPhone"
                                type="tel"
                                inputmode="numeric"
                                pattern="[0-9]{10}"
                                maxlength="10"
                                name="phone"
                                autocomplete="tel-national"
                                placeholder="5512345678"
                                class="flex-1 bg-transparent text-sm focus-visible:outline-none focus:ring-0"
                                :style="{ color: 'var(--color-text)' }"
                            />
                        </div>
                        <p v-if="customerPhone && !/^\d{10}$/.test(customerPhone)" class="mt-1 text-xs text-red-500">Ingresa 10 dígitos numéricos.</p>
                    </div>
                </div>
            </div>

            <!-- Delivery summary -->
            <div class="rounded-2xl border p-5 mb-4" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                <h2 class="text-sm font-bold mb-3" :style="{ color: 'var(--color-text)' }">Entrega</h2>
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-xl" style="font-variation-settings:'FILL' 1; color: var(--color-secondary)">
                        {{ order.deliveryType === 'delivery' ? 'delivery_dining' : order.deliveryType === 'pickup' ? 'shopping_bag' : 'restaurant' }}
                    </span>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium mb-0.5" :style="{ color: 'var(--color-secondary)' }">
                            {{ order.deliveryType === 'delivery' ? 'A domicilio' : order.deliveryType === 'pickup' ? 'Recoger en local' : 'Comer en el local' }}
                        </p>
                        <p class="text-sm font-semibold" :style="{ color: 'var(--color-text)' }">{{ order.branchName }}</p>

                        <!-- Delivery: customer address -->
                        <template v-if="order.deliveryType === 'delivery'">
                            <p v-if="order.addressStreet" class="text-xs mt-0.5" :style="{ color: 'var(--color-text-secondary)' }">{{ order.addressStreet }} #{{ order.addressNumber }}, Col. {{ order.addressColony }}</p>
                            <p v-if="order.distanceKm" class="text-xs mt-0.5" :style="{ color: 'var(--color-text-secondary)' }">{{ order.distanceKm?.toFixed(1) }} km · ${{ order.deliveryCost.toFixed(2) }} envio</p>
                        </template>

                        <!-- Pickup / Dine in: branch address -->
                        <template v-else>
                            <p v-if="order.branchAddress" class="text-xs mt-0.5" :style="{ color: 'var(--color-text-secondary)' }">{{ order.branchAddress }}</p>
                        </template>

                        <p class="text-xs mt-1" :style="{ color: 'var(--color-text-muted)' }">{{ order.scheduledAt ? 'Programado: ' + new Date(order.scheduledAt).toLocaleString('es-MX') : 'Lo antes posible' }}</p>
                    </div>
                </div>
            </div>

            <!-- Payment method -->
            <div class="rounded-2xl border p-5 mb-4" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                <h2 class="text-sm font-bold mb-3" :style="{ color: 'var(--color-text)' }">Método de pago</h2>

                <div v-if="paymentMethods.length === 0" class="text-sm text-center py-2" :style="{ color: 'var(--color-text-muted)' }">
                    Sin métodos de pago disponibles.
                </div>

                <div class="space-y-2">
                    <button
                        v-for="pm in paymentMethods"
                        :key="pm.type"
                        @click="selectedPaymentMethod = pm.type"
                        class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left"
                        :class="selectedPaymentMethod === pm.type
                            ? ''
                            : ''"
                        :style="selectedPaymentMethod === pm.type ? { borderColor: 'var(--color-secondary)', backgroundColor: 'var(--color-secondary-light)' } : { borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-input-bg)' }"
                    >
                        <div
                            class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                            :class="selectedPaymentMethod === pm.type ? '' : 'border-gray-300'"
                            :style="selectedPaymentMethod === pm.type ? { borderColor: 'var(--color-secondary)', backgroundColor: 'var(--color-secondary)' } : {}"
                        >
                            <span v-if="selectedPaymentMethod === pm.type" class="material-symbols-outlined text-white text-xs">check</span>
                        </div>
                        <div>
                            <p class="text-sm font-semibold" :style="{ color: 'var(--color-text)' }">
                                {{ pm.type === 'cash' ? 'Efectivo' : pm.type === 'terminal' ? 'Terminal bancaria' : 'Transferencia (SPEI)' }}
                            </p>
                            <p class="text-xs" :style="{ color: 'var(--color-text-secondary)' }">
                                {{ pm.type === 'cash' ? 'Pagas al recibir' : pm.type === 'terminal' ? 'Tarjeta débito/crédito' : 'Pago por SPEI' }}
                            </p>
                        </div>
                    </button>
                </div>

                <!-- Cash: "pays with" input -->
                <div v-if="selectedPaymentMethod === 'cash'" class="mt-4 rounded-2xl p-4" :style="{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-light)' }">
                    <label class="block text-xs font-semibold uppercase tracking-wide mb-2" :style="{ color: 'var(--color-text-secondary)' }">Con cuánto pagas?</label>
                    <div class="flex items-center gap-2">
                        <span class="font-semibold" :style="{ color: 'var(--color-text-secondary)' }">$</span>
                        <input
                            v-model="cashAmount"
                            type="number"
                            inputmode="decimal"
                            min="0"
                            max="100000"
                            step="any"
                            placeholder="Ej: 500"
                            class="flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                            :style="{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-secondary-ring)' }"
                        />
                    </div>
                    <p v-if="cashAmount && parseFloat(cashAmount) <= 0" class="text-xs text-red-500 mt-1">El monto debe ser mayor a cero.</p>
                    <p v-else-if="cashAmount && parseFloat(cashAmount) > 100000" class="text-xs text-red-500 mt-1">El monto maximo es $100,000.</p>
                    <p v-else-if="cashAmount && parseFloat(cashAmount) < total" class="text-xs text-red-500 mt-1">El monto debe ser igual o mayor al total (${{ total.toFixed(2) }})</p>
                    <p v-else-if="cashAmount && parseFloat(cashAmount) >= total" class="text-xs mt-1" :style="{ color: 'var(--color-text-muted)' }">Cambio: ${{ (parseFloat(cashAmount) - total).toFixed(2) }}</p>
                    <p v-if="!cashAmount" class="text-xs text-red-500 mt-1">Indica con cuanto pagas para calcular tu cambio.</p>
                </div>

                <!-- Transfer bank details -->
                <div
                    v-if="selectedPaymentMethod === 'transfer' && selectedPmDetails"
                    class="mt-4 rounded-2xl p-4 text-sm"
                    :style="{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-light)' }"
                >
                    <p class="font-semibold mb-2" :style="{ color: 'var(--color-text)' }">Datos bancarios</p>
                    <p :style="{ color: 'var(--color-text-secondary)' }">Banco: <span class="font-medium">{{ selectedPmDetails.bank_name }}</span></p>
                    <p :style="{ color: 'var(--color-text-secondary)' }">Titular: <span class="font-medium">{{ selectedPmDetails.account_holder }}</span></p>
                    <p :style="{ color: 'var(--color-text-secondary)' }">CLABE: <span class="font-mono font-medium">{{ selectedPmDetails.clabe }}</span></p>
                </div>
            </div>

            <!-- Invoice toggle -->
            <label class="flex items-center gap-3 rounded-2xl border p-4 cursor-pointer touch-manipulation"
                :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: requiresInvoice ? 'var(--color-secondary)' : 'var(--color-border-light)' }"
            >
                <input
                    v-model="requiresInvoice"
                    type="checkbox"
                    class="sr-only"
                />
                <span
                    class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                    :style="requiresInvoice
                        ? { backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' }
                        : { borderColor: 'var(--color-border)' }"
                >
                    <span v-if="requiresInvoice" class="material-symbols-outlined text-white" style="font-size: 14px">check</span>
                </span>
                <div>
                    <p class="text-sm font-semibold" :style="{ color: 'var(--color-text)' }">Requiere factura?</p>
                    <p class="text-xs" :style="{ color: 'var(--color-text-secondary)' }">Marca si necesitas factura para este pedido.</p>
                </div>
            </label>

            <!-- Coupon section -->
            <div class="rounded-2xl border p-5 mb-4 mt-4" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                <h2 class="text-sm font-bold mb-3" :style="{ color: 'var(--color-text)' }">¿Tienes un cupón?</h2>

                <div v-if="!couponApplied" class="flex gap-2">
                    <input
                        v-model="couponInput"
                        type="text"
                        maxlength="20"
                        placeholder="Código del cupón"
                        class="flex-1 rounded-2xl px-4 py-3 text-sm uppercase focus:outline-none focus:ring-2"
                        :style="{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', '--tw-ring-color': 'var(--color-secondary-ring)' }"
                        @keyup.enter="applyCoupon"
                    />
                    <button
                        @click="applyCoupon"
                        :disabled="couponLoading || !couponInput.trim()"
                        class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0 disabled:opacity-40"
                        :style="{ backgroundColor: 'var(--color-secondary)' }"
                    >
                        {{ couponLoading ? '...' : 'Aplicar' }}
                    </button>
                </div>

                <div v-else class="flex items-center justify-between rounded-xl px-4 py-3" style="background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3)">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-green-600 text-lg">confirmation_number</span>
                        <div>
                            <p class="text-sm font-semibold text-green-700">{{ couponLabel }}</p>
                            <p class="text-xs text-green-600">-${{ couponDiscount.toFixed(2) }} de descuento</p>
                        </div>
                    </div>
                    <button @click="removeCoupon" class="p-1 rounded-full hover:bg-green-100 transition-colors">
                        <span class="material-symbols-outlined text-green-600 text-lg">close</span>
                    </button>
                </div>

                <p v-if="couponError" class="text-xs text-red-500 mt-2">{{ couponError }}</p>
            </div>

            <!-- Order summary (mobile only) -->
            <div class="rounded-2xl border p-5 mb-4 md:hidden" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                <h2 class="text-sm font-bold mb-3" :style="{ color: 'var(--color-text)' }">Resumen del pedido</h2>

                <div class="space-y-2 mb-3">
                    <div v-for="(item, index) in cart.items" :key="index" class="flex justify-between text-sm">
                        <div>
                            <span :style="{ color: 'var(--color-text)' }">{{ item.quantity }}x {{ item.product_name }}</span>
                            <div v-if="item.modifiers.length > 0" class="text-xs" :style="{ color: 'var(--color-text-muted)' }">{{ item.modifiers.map(m => m.name).join(', ') }}</div>
                        </div>
                        <span class="font-medium shrink-0" :style="{ color: 'var(--color-text)' }">${{ item.item_total.toFixed(2) }}</span>
                    </div>
                </div>

                <div class="border-t pt-3 space-y-1" :style="{ borderColor: 'var(--color-border-light)' }">
                    <div class="flex justify-between text-sm" :style="{ color: 'var(--color-text-secondary)' }">
                        <span>Subtotal</span>
                        <span>${{ cart.subtotal.toFixed(2) }}</span>
                    </div>
                    <div v-if="couponDiscount > 0" class="flex justify-between text-sm text-green-600">
                        <span>Descuento ({{ couponLabel }})</span>
                        <span>-${{ couponDiscount.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-sm" :style="{ color: 'var(--color-text-secondary)' }">
                        <span>Envio</span>
                        <span>${{ order.deliveryCost.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between font-bold text-base pt-1" :style="{ color: 'var(--color-text)' }">
                        <span>Total</span>
                        <span :style="{ color: 'var(--color-secondary)' }">${{ total.toFixed(2) }}</span>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div v-if="submitError" class="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 mb-4">
                <div class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-red-500 text-lg shrink-0" style="font-variation-settings:'FILL' 1">error</span>
                    {{ submitError }}
                </div>
            </div>

            <p class="text-xs text-center px-4 md:hidden" :style="{ color: 'var(--color-text-muted)' }">
                Al confirmar, se abrira WhatsApp con los detalles de tu pedido.
            </p>
        </div>

            <!-- Desktop: Order summary sidebar (right) -->
            <div class="hidden md:block md:w-80 md:shrink-0">
                <div class="sticky top-[85px] border rounded-2xl p-5" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                    <h3 class="font-bold mb-4" :style="{ color: 'var(--color-text)' }">Resumen del pedido</h3>

                    <div class="space-y-2 mb-4 max-h-52 overflow-y-auto">
                        <div v-for="(item, i) in cart.items" :key="i" class="flex items-start gap-3">
                            <img v-if="item.product_image" :src="item.product_image" class="w-10 h-10 rounded-lg object-cover shrink-0" />
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium leading-snug" :style="{ color: 'var(--color-text)' }">{{ item.quantity }}x {{ item.product_name }}</p>
                                <p v-if="item.modifiers.length" class="text-xs truncate" :style="{ color: 'var(--color-text-muted)' }">{{ item.modifiers.map(m => m.name).join(', ') }}</p>
                            </div>
                            <span class="text-sm font-semibold shrink-0" :style="{ color: 'var(--color-text)' }">${{ item.item_total.toFixed(2) }}</span>
                        </div>
                    </div>

                    <div class="border-t pt-3 space-y-1 mb-4" :style="{ borderColor: 'var(--color-border-light)' }">
                        <div class="flex justify-between text-sm" :style="{ color: 'var(--color-text-secondary)' }">
                            <span>Subtotal</span>
                            <span>${{ cart.subtotal.toFixed(2) }}</span>
                        </div>
                        <div v-if="couponDiscount > 0" class="flex justify-between text-sm text-green-600">
                            <span>Descuento ({{ couponLabel }})</span>
                            <span>-${{ couponDiscount.toFixed(2) }}</span>
                        </div>
                        <div class="flex justify-between text-sm" :style="{ color: 'var(--color-text-secondary)' }">
                            <span>Envio</span>
                            <span>${{ order.deliveryCost.toFixed(2) }}</span>
                        </div>
                        <div class="flex justify-between font-bold text-base pt-1" :style="{ color: 'var(--color-text)' }">
                            <span>Total</span>
                            <span :style="{ color: 'var(--color-secondary)' }">${{ total.toFixed(2) }}</span>
                        </div>
                    </div>

                    <button
                        @click="confirm"
                        :disabled="!customerName || !/^\d{10}$/.test(customerPhone) || !selectedPaymentMethod || submitting || (selectedPaymentMethod === 'cash' && (!cashAmount || parseFloat(cashAmount) < total || parseFloat(cashAmount) > 100000))"
                        class="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                        :class="submitting ? 'bg-gray-300 text-gray-500' : 'text-white hover:brightness-90'"
                        :style="!submitting ? { backgroundColor: 'var(--color-secondary)' } : {}"
                    >
                        <span class="material-symbols-outlined text-lg" style="font-variation-settings:'FILL' 1">send</span>
                        {{ submitting ? 'Registrando...' : 'Confirmar y enviar' }}
                    </button>

                    <p class="text-xs text-center mt-3" :style="{ color: 'var(--color-text-muted)' }">
                        Al confirmar, se abrira WhatsApp con los detalles de tu pedido.
                    </p>
                </div>
            </div>
        </div>
        </div>

        <!-- Mobile CTA -->
        <div class="fixed bottom-10 left-4 right-4 max-w-md mx-auto md:hidden">
            <button
                @click="confirm"
                :disabled="!customerName || !/^\d{10}$/.test(customerPhone) || !selectedPaymentMethod || submitting || (selectedPaymentMethod === 'cash' && (!cashAmount || parseFloat(cashAmount) < total || parseFloat(cashAmount) > 100000))"
                class="w-full text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-transform disabled:opacity-40"
                :style="{ backgroundColor: 'var(--color-secondary)' }"
            >
                <span class="material-symbols-outlined text-xl" style="font-variation-settings:'FILL' 1">send</span>
                {{ submitting ? 'Registrando pedido...' : 'Confirmar y enviar por WhatsApp' }}
            </button>
        </div>
    </div>
</template>
