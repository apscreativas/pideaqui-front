<script setup>
import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'
import { useRouter } from 'vue-router'

const cart = useCartStore()
const order = useOrderStore()
const { restaurant } = useRestaurantStore()
const router = useRouter()

function proceed() {
    order.reset()
    router.push('/delivery')
}
</script>

<template>
    <div class="min-h-dvh" style="background-color: var(--color-primary)">

        <!-- Header -->
        <header class="sticky top-0 z-10 border-b px-4 py-3" :style="{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-border-light)' }">
            <div class="max-w-md md:max-w-4xl mx-auto flex items-center gap-3">
                <button
                    @click="router.back()"
                    class="w-9 h-9 flex items-center justify-center rounded-full border"
                    :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }"
                >
                    <span class="material-symbols-outlined text-xl" :style="{ color: 'var(--color-text-secondary)' }">arrow_back</span>
                </button>
                <h1 class="text-base font-bold" :style="{ color: 'var(--color-text)' }">Tu carrito</h1>
            </div>
        </header>

        <div class="max-w-md md:max-w-4xl mx-auto px-4 py-4 pb-40 md:pb-8">

            <!-- Empty cart -->
            <div v-if="cart.items.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
                <span class="material-symbols-outlined text-6xl mb-4" style="font-variation-settings:'FILL' 1" :style="{ color: 'var(--color-text-muted)' }">shopping_cart</span>
                <h2 class="text-lg font-bold mb-2" :style="{ color: 'var(--color-text)' }">Tu carrito está vacío</h2>
                <p class="text-sm mb-6" :style="{ color: 'var(--color-text-secondary)' }">Agrega productos del menú para continuar.</p>
                <button
                    @click="router.push('/')"
                    class="rounded-2xl px-6 py-3 font-semibold text-sm hover:brightness-90 transition"
                    :style="{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)' }"
                >
                    Ver el menú
                </button>
            </div>

            <template v-else>
                <div class="md:flex md:gap-6">
                <div class="md:flex-1">
                <!-- Cart items -->
                <div class="space-y-3 mb-6">
                    <div
                        v-for="(item, index) in cart.items"
                        :key="index"
                        class="rounded-2xl border p-4 flex gap-3"
                        :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }"
                    >
                        <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0" :style="{ backgroundColor: 'var(--color-border-light)' }">
                            <img
                                v-if="item.product_image"
                                :src="item.product_image"
                                :alt="item.product_name"
                                class="w-full h-full object-cover"
                            />
                            <img
                                v-else-if="restaurant?.default_product_image_url"
                                :src="restaurant.default_product_image_url"
                                :alt="item.product_name"
                                class="w-full h-full object-cover"
                            />
                            <div v-else class="w-full h-full flex items-center justify-center">
                                <span class="material-symbols-outlined text-2xl" style="font-variation-settings:'FILL' 1" :style="{ color: 'var(--color-text-muted)' }">fastfood</span>
                            </div>
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-2 mb-1">
                                <p class="font-semibold text-sm leading-tight" :style="{ color: 'var(--color-text)' }">{{ item.product_name }}</p>
                                <button
                                    @click="cart.removeItem(index)"
                                    class="shrink-0 w-5 h-5 flex items-center justify-center hover:text-red-400"
                                    :style="{ color: 'var(--color-text-muted)' }"
                                >
                                    <span class="material-symbols-outlined text-base">delete</span>
                                </button>
                            </div>

                            <div v-if="item.modifiers.length > 0" class="text-xs mb-1" :style="{ color: 'var(--color-text-muted)' }">
                                {{ item.modifiers.map(m => m.name).join(', ') }}
                            </div>
                            <div v-if="item.notes" class="text-xs italic mb-2" :style="{ color: 'var(--color-text-muted)' }">
                                "{{ item.notes }}"
                            </div>

                            <div class="flex items-center justify-between mt-2">
                                <div class="flex items-center gap-2 rounded-xl px-2 py-1" :style="{ backgroundColor: 'var(--color-border-light)' }">
                                    <button
                                        @click="cart.updateQuantity(index, item.quantity - 1)"
                                        class="w-5 h-5 flex items-center justify-center"
                                        :style="{ color: 'var(--color-text-secondary)' }"
                                    >
                                        <span class="material-symbols-outlined text-sm">remove</span>
                                    </button>
                                    <span class="text-sm font-bold w-4 text-center" :style="{ color: 'var(--color-text)' }">{{ item.quantity }}</span>
                                    <button
                                        @click="cart.updateQuantity(index, item.quantity + 1)"
                                        class="w-5 h-5 flex items-center justify-center"
                                        :style="{ color: 'var(--color-text-secondary)' }"
                                    >
                                        <span class="material-symbols-outlined text-sm">add</span>
                                    </button>
                                </div>
                                <p class="font-bold text-sm" :style="{ color: 'var(--color-text)' }">${{ item.item_total.toFixed(2) }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Add more -->
                <button
                    @click="router.push('/')"
                    class="flex items-center gap-2 text-sm font-medium mb-6"
                    :style="{ color: 'var(--color-secondary)' }"
                >
                    <span class="material-symbols-outlined text-lg">add_circle</span>
                    Agregar más productos
                </button>

                </div>

                <!-- Summary sidebar (desktop right) -->
                <div class="md:w-80 md:shrink-0">
                <div class="rounded-2xl border p-5 mb-6 md:sticky md:top-[85px]" :style="{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border-light)' }">
                    <h3 class="hidden md:block font-bold mb-4" :style="{ color: 'var(--color-text)' }">Resumen del pedido</h3>
                    <div class="flex justify-between text-sm mb-2" :style="{ color: 'var(--color-text-secondary)' }">
                        <span>Subtotal</span>
                        <span class="font-semibold" :style="{ color: 'var(--color-text)' }">${{ cart.subtotal.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-xs mb-3" :style="{ color: 'var(--color-text-muted)' }">
                        <span>Envio</span>
                        <span>Se calcula en el siguiente paso</span>
                    </div>
                    <div class="border-t pt-3 flex justify-between font-bold text-base" :style="{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }">
                        <span>Total</span>
                        <span :style="{ color: 'var(--color-secondary)' }">${{ cart.subtotal.toFixed(2) }}</span>
                    </div>
                    <button
                        @click="proceed"
                        class="hidden md:block w-full mt-4 rounded-xl py-3 font-semibold text-sm hover:brightness-90 transition-colors"
                        :style="{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)' }"
                    >
                        Continuar
                    </button>
                </div>
                </div>
                </div>
            </template>
        </div>

        <!-- Continue button -->
        <div v-if="cart.items.length > 0" class="fixed bottom-10 left-4 right-4 max-w-md mx-auto md:hidden">
            <button
                @click="proceed"
                class="w-full rounded-2xl py-4 font-bold text-base shadow-lg active:scale-[0.98] transition-transform hover:brightness-90"
                :style="{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text-on-secondary)', boxShadow: '0 10px 15px -3px var(--color-secondary-ring)' }"
            >
                Continuar →
            </button>
        </div>
    </div>
</template>
