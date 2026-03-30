<script setup>
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'

const router = useRouter()
const order = useOrderStore()
const restaurantStore = useRestaurantStore()

const summary = order.orderSummary

function goBack() {
    order.reset()
    router.push('/')
}

function mapsUrl(lat, lng) {
    return `https://maps.google.com/?q=${lat},${lng}`
}

function resendWhatsapp() {
    if (!order.confirmedOrderId || !order.branchWhatsapp || !summary) return

    const typeLabels = { delivery: 'A domicilio', pickup: 'Recoger en local', dine_in: 'Comer en el local' }
    const paymentLabels = { cash: 'Efectivo', terminal: 'Terminal bancaria', transfer: 'Transferencia (SPEI)' }

    const itemLines = summary.items.map((item) => {
        const mods = item.modifiers?.length > 0 ? ` (${item.modifiers.map((m) => m.name).join(', ')})` : ''
        const notes = item.notes ? ` - Nota: ${item.notes}` : ''
        return `• ${item.quantity}x ${item.product_name}${mods}${notes} - $${item.item_total.toFixed(2)}`
    }).join('\n')

    let deliveryLines = ''
    if (order.deliveryType === 'delivery') {
        const fullAddress = `${order.addressStreet} #${order.addressNumber}, Col. ${order.addressColony}`
        deliveryLines = `🚗 *Tipo:* A domicilio\n`
            + `📍 *Direccion:* ${fullAddress}${order.addressReferences ? ' - ' + order.addressReferences : ''}\n`
            + `🏪 *Sucursal:* ${order.branchName}\n`
            + (order.distanceKm ? `📏 Distancia: ${order.distanceKm.toFixed(1)} km\n` : '')
            + (order.latitude && order.longitude ? `📌 *Ubicacion:* ${mapsUrl(order.latitude, order.longitude)}\n` : '')
    } else {
        deliveryLines = `🏪 *Tipo:* ${typeLabels[order.deliveryType]}\n`
            + `📍 *Sucursal:* ${order.branchName}\n`
            + (order.branchAddress ? `${order.branchAddress}\n` : '')
            + (order.branchLatitude && order.branchLongitude ? `📌 *Ubicacion:* ${mapsUrl(order.branchLatitude, order.branchLongitude)}\n` : '')
    }

    const scheduledLine = order.scheduledAt
        ? `🕐 Programado para: ${new Date(order.scheduledAt).toLocaleString('es-MX')}`
        : '🕐 Lo antes posible'

    const paymentLine = paymentLabels[order.paymentMethod] ?? order.paymentMethod

    let paymentExtra = ''
    if (order.paymentMethod === 'cash' && order.cashAmount) {
        const amt = parseFloat(order.cashAmount)
        paymentExtra = `\n*Paga con:* $${amt.toFixed(2)}`
        const change = amt - summary.total
        if (change > 0) { paymentExtra += `\n*Cambio:* $${change.toFixed(2)}` }
    }
    if (order.paymentMethod === 'transfer' && order.transferDetails) {
        const td = order.transferDetails
        paymentExtra = `\n*Banco:* ${td.bank_name}`
            + `\n*Titular:* ${td.account_holder}`
            + `\n*CLABE:* ${td.clabe}`
    }

    const message = encodeURIComponent(
        `*Pedido #${order.confirmedOrderId} - PideAqui*\n\n` +
        `👤 *Cliente:* ${order.customerName} | ${order.customerPhone}\n\n` +
        `🛒 *Pedido:*\n${itemLines}\n\n` +
        `${deliveryLines}` +
        `${scheduledLine}\n` +
        `💳 *Pago:* ${paymentLine}${paymentExtra}\n\n` +
        `*Subtotal:* $${summary.subtotal.toFixed(2)}\n` +
        (summary.discount > 0 ? `🏷️ *Cupón:* ${summary.couponCode} (-$${summary.discount.toFixed(2)})\n` : '') +
        `*Envio:* $${summary.deliveryCost.toFixed(2)}\n` +
        `*Total: $${summary.total.toFixed(2)}*`,
    )

    const sanitizedWhatsapp = order.branchWhatsapp.replace(/[^\d+]/g, '')
    window.open(`https://api.whatsapp.com/send?phone=${sanitizedWhatsapp}&text=${message}`, '_blank')
}
</script>

<template>
    <div class="min-h-dvh flex flex-col" style="background-color: var(--color-primary)">

        <!-- Header -->
        <header class="flex items-center p-4 pb-2 z-10">
            <button
                @click="goBack"
                class="w-9 h-9 flex items-center justify-center rounded-full border transition-colors"
                :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }"
            >
                <span class="material-symbols-outlined text-xl" :style="{ color: 'var(--color-text-secondary)' }">close</span>
            </button>
            <h1 class="text-lg font-bold tracking-tight flex-1 text-center pr-10" :style="{ color: 'var(--color-text)' }">
                {{ restaurantStore.restaurant?.name ?? '' }}
            </h1>
        </header>

        <!-- Main content -->
        <main class="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center gap-8 pb-40">

            <!-- Success icon + text -->
            <div class="flex flex-col items-center gap-6 mt-8">
                <div class="w-32 h-32 rounded-full flex items-center justify-center animate-pulse" style="background-color: var(--color-secondary-light)">
                    <div class="w-24 h-24 rounded-full flex items-center justify-center shadow-lg" :style="{ backgroundColor: 'var(--color-secondary)', boxShadow: '0 10px 15px -3px var(--color-secondary-ring)' }">
                        <span class="material-symbols-outlined !text-[64px]" :style="{ color: 'var(--color-text-on-secondary)' }">check</span>
                    </div>
                </div>
                <div class="flex flex-col items-center gap-2 text-center">
                    <h2 class="text-3xl font-bold tracking-tight" :style="{ color: 'var(--color-text)' }">Pedido enviado</h2>
                    <p class="text-base leading-relaxed max-w-[280px]" :style="{ color: 'var(--color-text-secondary)' }">
                        Recibirás la confirmación y detalles de tu orden por WhatsApp.
                    </p>
                </div>
            </div>

            <!-- Order ID badge -->
            <div
                v-if="order.confirmedOrderId"
                class="inline-flex items-center justify-center h-10 px-6 rounded-full"
                style="background-color: var(--color-secondary-light); border: 1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent)"
            >
                <span class="font-bold text-lg tracking-wide" :style="{ color: 'var(--color-secondary)' }">#{{ order.confirmedOrderId }}</span>
            </div>

            <!-- Order summary card -->
            <div v-if="summary" class="w-full rounded-xl shadow-sm overflow-hidden" :style="{ backgroundColor: 'var(--color-card-bg)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-border-light)' }">
                <!-- Gradient header -->
                <div class="relative h-32 w-full" style="background: linear-gradient(to right, var(--color-secondary), var(--color-secondary-dark))">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <div class="absolute bottom-3 left-4 right-4">
                        <p class="text-white font-bold text-lg">Resumen del pedido</p>
                    </div>
                </div>

                <!-- Items -->
                <div class="p-4 flex flex-col gap-3" :style="{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'var(--color-border-light)' }">
                    <div
                        v-for="(item, index) in summary.items"
                        :key="index"
                        class="flex justify-between items-start"
                    >
                        <div class="flex gap-3">
                            <span class="font-bold text-xs h-6 w-6 rounded flex items-center justify-center mt-0.5" :style="{ backgroundColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }">
                                {{ item.quantity }}
                            </span>
                            <div class="flex flex-col">
                                <p class="text-sm font-medium" :style="{ color: 'var(--color-text)' }">{{ item.product_name }}</p>
                                <p
                                    v-if="item.modifiers && item.modifiers.length > 0"
                                    class="text-xs" :style="{ color: 'var(--color-text-secondary)' }"
                                >{{ item.modifiers.map(m => m.name).join(', ') }}</p>
                            </div>
                        </div>
                        <p class="text-sm font-medium" :style="{ color: 'var(--color-text)' }">${{ item.item_total.toFixed(2) }}</p>
                    </div>
                </div>

                <!-- Totals -->
                <div class="p-4" :style="{ backgroundColor: 'var(--color-border-light)' }">
                    <div class="flex justify-between items-center mb-1">
                        <p class="text-sm" :style="{ color: 'var(--color-text-secondary)' }">Subtotal</p>
                        <p class="text-sm font-medium" :style="{ color: 'var(--color-text)' }">${{ summary.subtotal.toFixed(2) }}</p>
                    </div>
                    <div v-if="summary.discount > 0" class="flex justify-between items-center mb-1">
                        <p class="text-sm text-green-600">Descuento ({{ summary.couponCode }})</p>
                        <p class="text-sm font-medium text-green-600">-${{ summary.discount.toFixed(2) }}</p>
                    </div>
                    <div class="flex justify-between items-center mb-3">
                        <p class="text-sm" :style="{ color: 'var(--color-text-secondary)' }">Envío</p>
                        <p class="text-sm font-medium" :style="{ color: 'var(--color-text)' }">${{ summary.deliveryCost.toFixed(2) }}</p>
                    </div>
                    <div class="flex justify-between items-center pt-3" :style="{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'var(--color-border)' }">
                        <p class="font-bold text-base" :style="{ color: 'var(--color-secondary)' }">Total</p>
                        <p class="font-bold text-xl" :style="{ color: 'var(--color-text)' }">${{ summary.total.toFixed(2) }} MXN</p>
                    </div>
                </div>
            </div>
        </main>

        <!-- Footer -->
        <footer class="fixed bottom-0 left-0 right-0 p-6 flex flex-col gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-xl z-20" :style="{ backgroundColor: 'var(--color-card-bg)', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'var(--color-border-light)' }">
            <div class="max-w-md md:max-w-lg mx-auto w-full flex flex-col gap-3">
                <button
                    v-if="order.branchWhatsapp && order.confirmedOrderId"
                    @click="resendWhatsapp"
                    class="w-full h-12 rounded-full bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold text-base tracking-wide shadow-lg shadow-[#25D366]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <span class="material-symbols-outlined text-xl">chat</span>
                    Reenviar por WhatsApp
                </button>
                <button
                    @click="goBack"
                    class="w-full py-4 rounded-2xl font-bold text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:brightness-90"
                    :style="{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)', boxShadow: '0 10px 15px -3px var(--color-secondary-ring)' }"
                >
                    Volver al menú
                </button>
            </div>
        </footer>
    </div>
</template>
