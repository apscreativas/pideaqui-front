<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRestaurantStore } from '@/stores/restaurant'
import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/order'
import { getCustomerCookie } from '@/utils/cookies'
import api from '@/services/api'
import MapPicker from '@/components/MapPicker.vue'

const router = useRouter()
const restaurantStore = useRestaurantStore()
const cart = useCartStore()
const order = useOrderStore()
const cookie = getCustomerCookie()

const restaurant = computed(() => restaurantStore.restaurant)
const branches = computed(() => restaurantStore.restaurant?.branches ?? [])
const noBranches = computed(() => branches.value.length === 0)

const typeLabels = {
    delivery: { label: 'A domicilio', icon: 'delivery_dining' },
    pickup: { label: 'Recoger', icon: 'shopping_bag' },
    dine_in: { label: 'En local', icon: 'restaurant' },
}

const activeTypes = computed(() => {
    const r = restaurant.value
    if (!r) { return [] }
    const types = []
    if (r.allows_delivery) { types.push('delivery') }
    if (r.allows_pickup) { types.push('pickup') }
    if (r.allows_dine_in) { types.push('dine_in') }
    return types
})

const selectedType = ref(order.deliveryType || activeTypes.value[0] || 'delivery')
const selectedBranch = ref(null)

const addressStreet = ref(order.addressStreet || cookie?.address_street || '')
const addressNumber = ref(order.addressNumber || cookie?.address_number || '')
const addressColony = ref(order.addressColony || cookie?.address_colony || '')
const addressReferences = ref(order.addressReferences || cookie?.address_references || '')
const latitude = ref(order.latitude || cookie?.latitude || null)
const longitude = ref(order.longitude || cookie?.longitude || null)

const gpsResolved = ref(!!latitude.value)
const gpsError = ref(null)
const locating = ref(false)
const deliveryError = ref(null)
const proceeding = ref(false)

// Schedule
const scheduledAt = ref(order.scheduledAt || null)
const showSchedule = ref(!!scheduledAt.value)

const todaySchedule = computed(() => {
    // Use resolved schedule from API (respects special dates > regular schedule).
    const resolved = restaurant.value?.today_schedule
    if (resolved && resolved.source !== 'closed' && resolved.opens_at) {
        return { opens_at: resolved.opens_at, closes_at: resolved.closes_at, is_closed: false }
    }
    if (resolved?.source === 'closed') {
        return { is_closed: true }
    }
    // Fallback to regular schedules if today_schedule not available.
    const schedules = restaurant.value?.schedules
    if (!schedules?.length) { return null }
    const today = new Date().getDay()
    return schedules.find((s) => s.day_of_week === today) ?? null
})

const timeSlots = computed(() => {
    const schedule = todaySchedule.value
    if (!schedule || schedule.is_closed) { return [] }

    const [openH, openM] = (schedule.opens_at || '00:00').split(':').map(Number)
    const [closeH, closeM] = (schedule.closes_at || '23:59').split(':').map(Number)

    const now = new Date()
    const slots = []
    const d = new Date(now)
    d.setSeconds(0, 0)

    // Round to next 30-min increment + 30 min buffer
    const mins = d.getMinutes()
    d.setMinutes(mins + (30 - (mins % 30)) + 30)

    const endDate = new Date(now)
    endDate.setHours(closeH, closeM, 0, 0)

    while (d <= endDate && slots.length < 48) {
        const h = d.getHours()
        const m = d.getMinutes()
        if (h > openH || (h === openH && m >= openM)) {
            // Send local datetime (not UTC) so backend timezone matches
            const pad = (n) => String(n).padStart(2, '0')
            const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00`
            const label = `${pad(h)}:${pad(m)}`
            slots.push({ value: localIso, label })
        }
        d.setMinutes(d.getMinutes() + 30)
    }
    return slots
})

function requestGps() {
    if (!navigator.geolocation) {
        gpsError.value = 'Tu navegador no soporta geolocalizacion.'
        gpsResolved.value = true
        return
    }
    locating.value = true
    gpsError.value = null

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            latitude.value = pos.coords.latitude
            longitude.value = pos.coords.longitude
            gpsResolved.value = true
            locating.value = false
        },
        (err) => {
            locating.value = false
            gpsResolved.value = true
            if (err.code === 1) {
                gpsError.value = 'Permiso de ubicacion denegado. Puedes mover el pin manualmente en el mapa.'
            } else if (err.code === 2) {
                gpsError.value = 'No se pudo obtener tu ubicacion. Intenta de nuevo o mueve el pin en el mapa.'
            } else {
                gpsError.value = 'Tiempo de espera agotado. Intenta de nuevo o mueve el pin en el mapa.'
            }
            if (!latitude.value) {
                latitude.value = 19.4326
                longitude.value = -99.1332
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
}

onMounted(() => {
    if (selectedType.value === 'delivery' && !gpsResolved.value) {
        requestGps()
    }
    if (branches.value.length === 1 && (selectedType.value === 'pickup' || selectedType.value === 'dine_in')) {
        selectedBranch.value = branches.value[0]
    }
})

watch(selectedType, (type) => {
    if (type === 'delivery' && !gpsResolved.value) {
        requestGps()
    }
    if ((type === 'pickup' || type === 'dine_in') && branches.value.length === 1) {
        selectedBranch.value = branches.value[0]
    }
})

const canProceed = computed(() => {
    if (noBranches.value || proceeding.value) { return false }
    if (selectedType.value === 'delivery') {
        return !!(addressStreet.value && addressNumber.value && addressColony.value && latitude.value && longitude.value)
    }
    return !!selectedBranch.value
})

async function proceed() {
    if (!canProceed.value) { return }
    proceeding.value = true
    deliveryError.value = null

    try {
        if (selectedType.value === 'delivery') {
            const { data } = await api.post('/api/delivery/calculate', {
                latitude: latitude.value,
                longitude: longitude.value,
            })
            const result = data.data

            if (!result.is_in_coverage) {
                deliveryError.value = 'No hay cobertura de entrega para esta ubicacion.'
                return
            }

            order.setDelivery('delivery', {
                id: result.branch_id,
                name: result.branch_name,
                whatsapp: result.branch_whatsapp,
                address: result.branch_address,
            }, {
                distance_km: result.distance_km,
                delivery_cost: result.delivery_cost,
                address_street: addressStreet.value,
                address_number: addressNumber.value,
                address_colony: addressColony.value,
                address_references: addressReferences.value,
                latitude: latitude.value,
                longitude: longitude.value,
            })
        } else {
            const branch = selectedBranch.value
            order.setDelivery(selectedType.value, {
                id: branch.id,
                name: branch.name,
                whatsapp: branch.whatsapp,
                address: branch.address,
            })
        }
        order.scheduledAt = scheduledAt.value
        router.push('/payment')
    } catch (err) {
        const msg = err.response?.data?.message || err.response?.data?.errors?.delivery_cost?.[0]
        deliveryError.value = msg || 'No hay cobertura de entrega para esta ubicacion.'
    } finally {
        proceeding.value = false
    }
}

function formatPrice(v) {
    return '$' + Number(v).toFixed(2)
}
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
                <h1 class="text-base font-bold" :style="{ color: 'var(--color-text)' }">Como recibes tu pedido?</h1>
            </div>
        </header>

        <div class="max-w-6xl mx-auto px-4 py-5 pb-40 md:pb-8">
            <div class="md:flex md:gap-8">

            <!-- Left column: form -->
            <div class="md:flex-1 min-w-0">

            <!-- No branches warning -->
            <div v-if="noBranches" class="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700 mb-4">
                <div class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-amber-500 text-lg shrink-0">warning</span>
                    Este restaurante aun no tiene sucursales configuradas.
                </div>
            </div>

            <!-- Delivery type selector -->
            <div class="flex gap-2 mb-6">
                <button
                    v-for="type in activeTypes"
                    :key="type"
                    @click="selectedType = type; deliveryError = null; if (type === 'delivery' && !gpsResolved) requestGps()"
                    class="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border transition-all text-sm font-medium"
                    :style="selectedType === type
                        ? { backgroundColor: 'var(--color-secondary-light)', borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }
                        : { backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }"
                >
                    <span
                        class="material-symbols-outlined text-2xl"
                        :style="selectedType === type ? 'font-variation-settings:\'FILL\' 1' : ''"
                    >{{ typeLabels[type]?.icon }}</span>
                    {{ typeLabels[type]?.label }}
                </button>
            </div>

            <!-- Delivery: address form -->
            <template v-if="selectedType === 'delivery'">
                <button
                    @click="requestGps"
                    class="w-full flex items-center gap-3 border rounded-2xl px-4 py-3 mb-3 text-sm font-medium"
                    :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }"
                    :class="{ 'opacity-60': locating }"
                >
                    <span class="material-symbols-outlined text-xl" :style="{ color: 'var(--color-secondary)', fontVariationSettings: '\'FILL\' 1' }">my_location</span>
                    <span>{{ locating ? 'Obteniendo ubicacion...' : latitude ? 'Ubicacion obtenida' : 'Usar mi ubicacion actual' }}</span>
                </button>

                <div v-if="gpsError" class="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700 mb-3">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-amber-500 text-lg shrink-0">warning</span>
                        {{ gpsError }}
                    </div>
                </div>

                <!-- Map -->
                <div class="mb-4">
                    <div v-if="!gpsResolved" class="w-full h-56 md:h-72 rounded-2xl flex flex-col items-center justify-center" :style="{ backgroundColor: 'var(--color-border-light)' }">
                        <div class="w-8 h-8 rounded-full border-4 animate-spin mb-2" :style="{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-secondary)' }"></div>
                        <p class="text-xs" :style="{ color: 'var(--color-text-secondary)' }">Obteniendo tu ubicacion...</p>
                    </div>
                    <MapPicker
                        v-else
                        :lat="latitude"
                        :lng="longitude"
                        @update:lat="val => latitude = val"
                        @update:lng="val => longitude = val"
                    />
                </div>

                <!-- Address fields — 2-col grid on desktop -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                        <label class="block text-xs font-semibold mb-1 uppercase tracking-wide" :style="{ color: 'var(--color-text-secondary)' }">Calle</label>
                        <input v-model="addressStreet" type="text" maxlength="255" placeholder="Av. Alvaro Obregon"
                            class="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-secondary-ring]"
                            :style="{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }" />
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1 uppercase tracking-wide" :style="{ color: 'var(--color-text-secondary)' }">Numero exterior</label>
                        <input v-model="addressNumber" type="text" maxlength="50" placeholder="154"
                            class="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-secondary-ring]"
                            :style="{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }" />
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1 uppercase tracking-wide" :style="{ color: 'var(--color-text-secondary)' }">Colonia</label>
                        <input v-model="addressColony" type="text" maxlength="255" placeholder="Roma Norte"
                            class="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-secondary-ring]"
                            :style="{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }" />
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1 uppercase tracking-wide" :style="{ color: 'var(--color-text-secondary)' }">Referencias</label>
                        <input v-model="addressReferences" type="text" placeholder="Entre calles, color de casa..."
                            class="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[--color-secondary-ring]"
                            :style="{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }" />
                    </div>
                </div>

                <div v-if="deliveryError" class="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 mb-4">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-red-500 text-lg shrink-0" style="font-variation-settings:'FILL' 1">error</span>
                        {{ deliveryError }}
                    </div>
                </div>
            </template>

            <!-- Pickup / Dine in: branch selection -->
            <template v-if="selectedType === 'pickup' || selectedType === 'dine_in'">
                <div v-if="branches.length === 0" class="text-center py-8 text-sm" :style="{ color: 'var(--color-text-muted)' }">Sin sucursales disponibles.</div>
                <div v-else class="space-y-3 mb-4">
                    <button
                        v-for="branch in branches"
                        :key="branch.id"
                        @click="selectedBranch = branch"
                        class="w-full rounded-2xl border p-4 text-left transition-all"
                        :style="selectedBranch?.id === branch.id ? { borderColor: 'var(--color-secondary)', backgroundColor: 'var(--color-secondary-light)' } : { backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }"
                    >
                        <div class="flex items-start gap-3">
                            <div
                                class="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0"
                                :class="selectedBranch?.id === branch.id ? '' : ''"
                                :style="selectedBranch?.id === branch.id ? { borderColor: 'var(--color-secondary)', backgroundColor: 'var(--color-secondary)' } : { borderColor: 'var(--color-border)' }"
                            >
                                <span v-if="selectedBranch?.id === branch.id" class="material-symbols-outlined text-xs" :style="{ color: 'var(--color-text-on-secondary)' }">check</span>
                            </div>
                            <div>
                                <p class="font-semibold text-sm" :style="{ color: 'var(--color-text)' }">{{ branch.name }}</p>
                                <p class="text-xs mt-0.5" :style="{ color: 'var(--color-text-secondary)' }">{{ branch.address }}</p>
                            </div>
                        </div>
                    </button>
                </div>
            </template>

            <!-- Schedule -->
            <div class="rounded-2xl border p-4 mb-4" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                <p class="text-sm font-semibold mb-3" :style="{ color: 'var(--color-text)' }">Para cuando?</p>
                <div class="flex gap-2 mb-1">
                    <button
                        @click="scheduledAt = null; showSchedule = false"
                        class="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
                        :style="!scheduledAt ? { backgroundColor: 'var(--color-secondary-light)', borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' } : { borderColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }"
                    >Lo antes posible</button>
                    <button
                        @click="showSchedule = true; if (!scheduledAt && timeSlots.length) scheduledAt = timeSlots[0].value"
                        class="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
                        :style="showSchedule ? { backgroundColor: 'var(--color-secondary-light)', borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' } : { borderColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }"
                    >Programar</button>
                </div>

                <div v-if="showSchedule" class="mt-3">
                    <p class="text-xs mb-2" :style="{ color: 'var(--color-text-muted)' }">Hoy</p>
                    <div v-if="timeSlots.length" class="flex flex-wrap gap-2">
                        <button
                            v-for="slot in timeSlots"
                            :key="slot.value"
                            @click="scheduledAt = slot.value"
                            class="px-4 py-2 rounded-full text-sm font-medium border transition-all"
                            :class="scheduledAt === slot.value
                                ? 'shadow-md'
                                : ''"
                            :style="scheduledAt === slot.value
                                ? { backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)', borderColor: 'var(--color-secondary)', boxShadow: '0 4px 6px -1px var(--color-secondary-ring)' }
                                : { backgroundColor: 'var(--color-card-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }"
                        >{{ slot.label }}</button>
                    </div>
                    <p v-else class="text-xs text-center py-3" :style="{ color: 'var(--color-text-muted)' }">Sin horarios disponibles para hoy.</p>
                </div>
            </div>

            </div>

            <!-- Right column: order summary (desktop) -->
            <div class="hidden md:block md:w-80 md:shrink-0">
                <div class="sticky top-[85px] border rounded-2xl p-5" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                    <h3 class="font-bold mb-4" :style="{ color: 'var(--color-text)' }">Resumen del pedido</h3>

                    <div class="space-y-2 mb-4 max-h-60 overflow-y-auto">
                        <div v-for="(item, i) in cart.items" :key="i" class="flex items-start gap-3">
                            <img v-if="item.product_image" :src="item.product_image" class="w-10 h-10 rounded-lg object-cover shrink-0" />
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium leading-snug" :style="{ color: 'var(--color-text)' }">{{ item.quantity }}x {{ item.product_name }}</p>
                                <p v-if="item.modifiers.length" class="text-xs truncate" :style="{ color: 'var(--color-text-muted)' }">{{ item.modifiers.map(m => m.name).join(', ') }}</p>
                            </div>
                            <span class="text-sm font-semibold shrink-0" :style="{ color: 'var(--color-text)' }">{{ formatPrice(item.item_total) }}</span>
                        </div>
                    </div>

                    <div class="border-t pt-3 space-y-1 mb-4" :style="{ borderColor: 'var(--color-border-light)' }">
                        <div class="flex justify-between text-sm" :style="{ color: 'var(--color-text-secondary)' }">
                            <span>Subtotal</span>
                            <span>{{ formatPrice(cart.subtotal) }}</span>
                        </div>
                    </div>

                    <button
                        @click="proceed"
                        :disabled="!canProceed"
                        class="w-full py-3 rounded-xl text-sm font-semibold transition-colors"
                        :class="canProceed
                            ? 'hover:brightness-90'
                            : 'cursor-not-allowed'"
                        :style="canProceed
                            ? { backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)' }
                            : { backgroundColor: 'var(--color-border)', color: 'var(--color-text-muted)' }"
                    >
                        {{ proceeding ? 'Verificando cobertura...' : 'Continuar al pago' }}
                    </button>
                </div>
            </div>

            </div>
        </div>

        <!-- Mobile CTA -->
        <div class="fixed bottom-10 left-4 right-4 max-w-md mx-auto md:hidden">
            <button
                @click="proceed"
                :disabled="!canProceed"
                class="w-full rounded-2xl py-4 font-bold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40"
                style="box-shadow: 0 10px 15px -3px var(--color-secondary-ring)"
                :style="{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)' }"
            >
                {{ proceeding ? 'Verificando cobertura...' : 'Continuar al pago' }}
            </button>
        </div>
    </div>
</template>
