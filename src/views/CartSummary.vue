<script setup>
import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/order'
import { useRouter } from 'vue-router'

const cart = useCartStore()
const order = useOrderStore()
const router = useRouter()

function proceed() {
    order.reset()
    router.push('/delivery')
}
</script>

<template>
    <div class="min-h-dvh bg-[#f6f8f7]">

        <!-- Header -->
        <header class="sticky top-0 z-10 bg-[#f6f8f7] border-b border-gray-100 px-4 py-3">
            <div class="max-w-md mx-auto flex items-center gap-3">
                <button
                    @click="router.back()"
                    class="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-100"
                >
                    <span class="material-symbols-outlined text-gray-600 text-xl">arrow_back</span>
                </button>
                <h1 class="text-base font-bold text-gray-900">Tu carrito</h1>
            </div>
        </header>

        <div class="max-w-md mx-auto px-4 py-4 pb-36">

            <!-- Empty cart -->
            <div v-if="cart.items.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
                <span class="material-symbols-outlined text-6xl text-gray-300 mb-4" style="font-variation-settings:'FILL' 1">shopping_cart</span>
                <h2 class="text-lg font-bold text-gray-700 mb-2">Tu carrito está vacío</h2>
                <p class="text-sm text-gray-500 mb-6">Agrega productos del menú para continuar.</p>
                <button
                    @click="router.push('/')"
                    class="bg-[#FF5722] text-white rounded-2xl px-6 py-3 font-semibold text-sm"
                >
                    Ver el menú
                </button>
            </div>

            <template v-else>
                <!-- Cart items -->
                <div class="space-y-3 mb-6">
                    <div
                        v-for="(item, index) in cart.items"
                        :key="index"
                        class="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3"
                    >
                        <div class="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                            <img
                                v-if="item.product_image"
                                :src="item.product_image"
                                :alt="item.product_name"
                                class="w-full h-full object-cover"
                            />
                            <div v-else class="w-full h-full flex items-center justify-center">
                                <span class="material-symbols-outlined text-gray-300 text-2xl" style="font-variation-settings:'FILL' 1">fastfood</span>
                            </div>
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-2 mb-1">
                                <p class="font-semibold text-gray-900 text-sm leading-tight">{{ item.product_name }}</p>
                                <button
                                    @click="cart.removeItem(index)"
                                    class="shrink-0 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400"
                                >
                                    <span class="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>

                            <div v-if="item.modifiers.length > 0" class="text-xs text-gray-400 mb-1">
                                {{ item.modifiers.map(m => m.name).join(', ') }}
                            </div>
                            <div v-if="item.notes" class="text-xs text-gray-400 italic mb-2">
                                "{{ item.notes }}"
                            </div>

                            <div class="flex items-center justify-between mt-2">
                                <div class="flex items-center gap-2 bg-gray-100 rounded-xl px-2 py-1">
                                    <button
                                        @click="cart.updateQuantity(index, item.quantity - 1)"
                                        class="w-5 h-5 flex items-center justify-center text-gray-600"
                                    >
                                        <span class="material-symbols-outlined text-sm">remove</span>
                                    </button>
                                    <span class="text-sm font-bold text-gray-900 w-4 text-center">{{ item.quantity }}</span>
                                    <button
                                        @click="cart.updateQuantity(index, item.quantity + 1)"
                                        class="w-5 h-5 flex items-center justify-center text-gray-600"
                                    >
                                        <span class="material-symbols-outlined text-sm">add</span>
                                    </button>
                                </div>
                                <p class="font-bold text-gray-900 text-sm">${{ item.item_total.toFixed(2) }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Add more -->
                <button
                    @click="router.push('/')"
                    class="flex items-center gap-2 text-[#FF5722] text-sm font-medium mb-6"
                >
                    <span class="material-symbols-outlined text-lg">add_circle</span>
                    Agregar más productos
                </button>

                <!-- Summary -->
                <div class="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
                    <div class="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Subtotal</span>
                        <span class="font-semibold text-gray-900">${{ cart.subtotal.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-400 mb-3">
                        <span>Envío</span>
                        <span>Se calcula en el siguiente paso</span>
                    </div>
                    <div class="border-t border-gray-100 pt-3 flex justify-between font-bold text-base">
                        <span>Total</span>
                        <span class="text-[#FF5722]">${{ cart.subtotal.toFixed(2) }}</span>
                    </div>
                </div>
            </template>
        </div>

        <!-- Continue button -->
        <div v-if="cart.items.length > 0" class="fixed bottom-5 left-4 right-4 max-w-md mx-auto">
            <button
                @click="proceed"
                class="w-full bg-[#FF5722] text-white rounded-2xl py-4 font-bold text-base shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-transform"
            >
                Continuar →
            </button>
        </div>
    </div>
</template>
