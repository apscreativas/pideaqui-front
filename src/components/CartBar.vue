<script setup>
import { computed } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useRestaurantStore } from '@/stores/restaurant'
import { useRouter } from 'vue-router'

const cart = useCartStore()
const restaurantStore = useRestaurantStore()
const router = useRouter()

const isOpen = computed(() => restaurantStore.restaurant?.is_open !== false)
</script>

<template>
    <Transition name="slide-up">
        <div
            v-if="cart.totalItems > 0"
            class="fixed bottom-5 left-4 right-4 z-50"
        >
            <button
                @click="isOpen && router.push('/cart')"
                :disabled="!isOpen"
                class="w-full text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg active:scale-[0.98] transition-transform"
                :class="isOpen ? 'bg-[#FF5722] shadow-orange-500/30' : 'bg-gray-400 shadow-gray-300/30 cursor-not-allowed'"
            >
                <div class="flex items-center gap-3">
                    <span class="bg-white/20 rounded-xl px-2.5 py-0.5 text-sm font-bold">{{ cart.totalItems }}</span>
                    <span class="font-semibold">Ver carrito</span>
                </div>
                <span class="font-bold">${{ cart.subtotal.toFixed(2) }}</span>
            </button>
        </div>
    </Transition>
</template>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active {
    transition: all 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
    transform: translateY(100px);
    opacity: 0;
}
</style>
