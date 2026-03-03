<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRestaurantStore } from '@/stores/restaurant'
import { useCartStore } from '@/stores/cart'
import CartBar from '@/components/CartBar.vue'
import ProductModal from '@/components/ProductModal.vue'

const restaurantStore = useRestaurantStore()
const cart = useCartStore()

const activeCategory = ref(null)
const selectedProduct = ref(null)
const searchQuery = ref('')
const showSearch = ref(false)

const restaurant = computed(() => restaurantStore.restaurant)

const todaySchedule = computed(() => {
    const schedules = restaurant.value?.schedules

    
    if (!schedules?.length) { return null }
    const today = new Date().getDay()
    return schedules.find((s) => s.day_of_week === today) ?? null


})

const isClosed = computed(() => restaurant.value?.is_open === false)
const ordersLimitReached = computed(() => restaurant.value?.orders_limit_reached === true)
const isUnavailable = computed(() => isClosed.value || ordersLimitReached.value)

const menu = computed(() => restaurantStore.menu)

const filteredMenu = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) { return menu.value }
    return menu.value.map((cat) => ({
        ...cat,
        products: cat.products.filter(
            (p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q),
        ),
    })).filter((cat) => cat.products.length > 0)
})

onMounted(() => {
    
    if (menu.value.length > 0) {

        activeCategory.value = menu.value[0]?.id
    }
})

function scrollToCategory(categoryId) {
    activeCategory.value = categoryId
    const el = document.getElementById(`category-${categoryId}`)
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
}

function openProduct(product) {
    if (isUnavailable.value) { return }
    selectedProduct.value = product
}

function onProductAdded() {
    selectedProduct.value = null
}

// Track active category on scroll
let observer = null
onMounted(async () => {
    await nextTick()
    observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = parseInt(entry.target.dataset.categoryId)
                    if (id) { activeCategory.value = id }
                }
            })
        },
        { rootMargin: '-30% 0px -60% 0px' },
    )
    document.querySelectorAll('[data-category-id]').forEach((el) => observer.observe(el))
})
</script>

<template>
    <div class="min-h-dvh bg-[#f6f8f7]">

        <!-- Unavailable state -->
        <div v-if="restaurantStore.error" class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
            <span class="material-symbols-outlined text-6xl text-gray-300 mb-4">storefront</span>
            <h1 class="text-xl font-bold text-gray-700 mb-2">Restaurante no disponible</h1>
            <p class="text-sm text-gray-500">{{ restaurantStore.error }}</p>
        </div>

        <div v-else-if="restaurant && !restaurant.is_active" class="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
            <span class="material-symbols-outlined text-6xl text-gray-300 mb-4" style="font-variation-settings:'FILL' 1">pause_circle</span>
            <h1 class="text-xl font-bold text-gray-700 mb-2">Restaurante no disponible</h1>
            <p class="text-sm text-gray-500">Estamos en pausa por el momento. Vuelve pronto.</p>
        </div>

        <template v-else-if="restaurant">

            <!-- Closed banner -->
            <div v-if="isClosed" class="bg-gray-800 px-4 py-4">
                <div class="max-w-md mx-auto flex items-center gap-3">
                    <span class="material-symbols-outlined text-amber-400 text-2xl">schedule</span>
                    <div>
                        <p class="text-sm font-bold text-white">Fuera de horario</p>
                        <p class="text-xs text-gray-300">
                            <template v-if="todaySchedule && !todaySchedule.is_closed && todaySchedule.opens_at">
                                Abrimos hoy de {{ todaySchedule.opens_at }} a {{ todaySchedule.closes_at }}
                            </template>
                            <template v-else>
                                No abrimos hoy. Vuelve pronto.
                            </template>
                        </p>
                    </div>
                </div>
            </div>

            <!-- Orders limit reached banner -->
            <div v-else-if="ordersLimitReached" class="bg-gray-800 px-4 py-4">
                <div class="max-w-md mx-auto flex items-center gap-3">
                    <span class="material-symbols-outlined text-amber-400 text-2xl" style="font-variation-settings:'FILL' 1">block</span>
                    <div>
                        <p class="text-sm font-bold text-white">No disponible por el momento</p>
                        <p class="text-xs text-gray-300">Hemos alcanzado nuestro límite de pedidos del mes. Vuelve pronto.</p>
                    </div>
                </div>
            </div>

            <!-- Sticky Header -->
            <header class="sticky top-0 z-30 bg-[#f6f8f7] border-b border-gray-100 px-4 py-3">
                <div class="max-w-md mx-auto flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-white border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            <img
                                v-if="restaurant.logo_url"
                                :src="restaurant.logo_url"
                                :alt="restaurant.name"
                                class="w-full h-full object-cover"
                            />
                            <span v-else class="material-symbols-outlined text-[#FF5722] text-xl" style="font-variation-settings:'FILL' 1">restaurant</span>
                        </div>
                        <div>
                            <h1 class="text-sm font-bold text-gray-900 leading-tight">{{ restaurant.name }}</h1>
                        </div>
                    </div>
                    <button
                        @click="showSearch = !showSearch; if (!showSearch) { searchQuery = '' }"
                        :aria-label="showSearch ? 'Cerrar búsqueda' : 'Buscar en el menú'"
                        class="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-100"
                    >
                        <span class="material-symbols-outlined text-gray-500 text-xl" aria-hidden="true">{{ showSearch ? 'close' : 'search' }}</span>
                    </button>
                </div>

                <!-- Search input -->
                <div v-if="showSearch" class="max-w-md mx-auto mt-2">
                    <input
                        v-model="searchQuery"
                        type="search"
                        name="search"
                        placeholder="Buscar..."
                        autofocus
                        class="w-full bg-white border border-gray-200 rounded-2xl px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/30"
                    />
                </div>
            </header>

            <!-- Loading skeleton -->
            <div v-if="restaurantStore.loading" class="max-w-md mx-auto px-4 py-6 space-y-4">
                <div class="h-8 bg-gray-200 rounded-full animate-pulse w-3/4"></div>
                <div class="h-32 bg-gray-200 rounded-2xl animate-pulse"></div>
                <div class="h-32 bg-gray-200 rounded-2xl animate-pulse"></div>
            </div>

            <template v-else>
                <div :class="isUnavailable && 'grayscale-[70%] opacity-50 pointer-events-none select-none'">
                <!-- Category chips -->
                <div v-if="menu.length > 0" class="sticky top-[61px] z-20 bg-[#f6f8f7] border-b border-gray-100">
                    <div class="max-w-md mx-auto">
                        <div class="flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar">
                            <button
                                v-for="category in menu"
                                :key="category.id"
                                @click="scrollToCategory(category.id)"
                                class="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                                :class="activeCategory === category.id
                                    ? 'bg-[#FF5722] text-white shadow-md shadow-orange-200'
                                    : 'bg-white text-gray-600 border border-gray-200'"
                            >
                                {{ category.name }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Menu content -->
                <main class="max-w-md mx-auto px-4 pb-32">

                    <div v-if="filteredMenu.length === 0 && searchQuery.trim()" class="py-16 text-center">
                        <span class="material-symbols-outlined text-5xl text-gray-300 block mb-3">search_off</span>
                        <p class="text-gray-500 text-sm">Sin resultados para "{{ searchQuery.trim() }}"</p>
                    </div>

                    <template v-for="category in filteredMenu" :key="category.id">
                        <div
                            :id="`category-${category.id}`"
                            :data-category-id="category.id"
                            class="pt-6 pb-2"
                        >
                            <div class="flex items-center gap-3 mb-4">
                                <div v-if="category.image_url" class="w-8 h-8 rounded-xl overflow-hidden">
                                    <img :src="category.image_url" :alt="category.name" class="w-full h-full object-cover" />
                                </div>
                                <h2 class="text-lg font-bold text-gray-900">{{ category.name }}</h2>
                            </div>

                            <div class="space-y-3">
                                <button
                                    v-for="product in category.products"
                                    :key="product.id"
                                    @click="openProduct(product)"
                                    class="w-full bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 text-left hover:border-[#FF5722]/30 transition-colors active:scale-[0.99] motion-reduce:transform-none touch-manipulation"
                                >
                                    <div class="flex-1 min-w-0">
                                        <p class="font-semibold text-gray-900 text-base leading-snug mb-1">{{ product.name }}</p>
                                        <p v-if="product.description" class="text-sm text-gray-500 leading-snug line-clamp-2 mb-2">{{ product.description }}</p>
                                        <p class="text-base font-bold text-[#FF5722]">${{ Number(product.price).toFixed(2) }}</p>
                                    </div>
                                    <div class="relative shrink-0">
                                        <div class="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                                            <img
                                                v-if="product.image_url"
                                                :src="product.image_url"
                                                :alt="product.name"
                                                class="max-w-full max-h-full object-contain"
                                            />
                                            <span v-else class="material-symbols-outlined text-gray-300 text-3xl" style="font-variation-settings:'FILL' 1">fastfood</span>
                                        </div>
                                        <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-[#FF5722] rounded-full flex items-center justify-center shadow">
                                            <span class="material-symbols-outlined text-white text-base" aria-hidden="true">add</span>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </template>
                </main>
                </div>
            </template>
        </template>

        <!-- Fallback: loading -->
        <div v-else class="flex items-center justify-center min-h-dvh">
            <div class="flex flex-col items-center gap-3">
                <div class="w-10 h-10 rounded-full border-4 border-[#FF5722]/30 border-t-[#FF5722] animate-spin"></div>
                <p class="text-sm text-gray-500">Cargando menú...</p>
            </div>
        </div>

        <!-- Cart bar -->
        <CartBar />

        <!-- Product modal -->
        <ProductModal
            v-if="selectedProduct"
            :product="selectedProduct"
            @close="selectedProduct = null"
            @added="onProductAdded"
        />
    </div>
</template>
