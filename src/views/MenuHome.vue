<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRestaurantStore } from '@/stores/restaurant'
import { useCartStore } from '@/stores/cart'
import { useRouter } from 'vue-router'
import CartBar from '@/components/CartBar.vue'
import ProductModal from '@/components/ProductModal.vue'

const restaurantStore = useRestaurantStore()
const cart = useCartStore()
const router = useRouter()

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
const limitReason = computed(() => restaurant.value?.limit_reason)
const isUnavailable = computed(() => isClosed.value || ordersLimitReached.value)
const isAvailable = computed(() => !isUnavailable.value)

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

function openProduct(product, category = null) {
    if (isUnavailable.value) { return }
    selectedProduct.value = product
}

function onProductAdded() {
    selectedProduct.value = null
}

function formatPrice(value) {
    return '$' + Number(value).toFixed(2)
}

function goToCart() {
    if (cart.totalItems > 0 && isAvailable.value) {
        router.push('/cart')
    }
}

// Track active category on scroll
let observer = null
onMounted(async () => {
    await nextTick()
    observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.dataset.categoryId
                    if (id) { activeCategory.value = id.startsWith('promo') ? id : parseInt(id) }
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

        <!-- Error / Inactive states -->
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

            <!-- Closed / limit banners -->
            <div v-if="isClosed" class="bg-gray-800 px-4 py-4">
                <div class="max-w-7xl mx-auto flex items-center gap-3">
                    <span class="material-symbols-outlined text-amber-400 text-2xl">schedule</span>
                    <div>
                        <p class="text-sm font-bold text-white">Fuera de horario</p>
                        <p class="text-xs text-gray-300">
                            <template v-if="todaySchedule && !todaySchedule.is_closed && todaySchedule.opens_at">
                                Abrimos hoy de {{ todaySchedule.opens_at }} a {{ todaySchedule.closes_at }}
                            </template>
                            <template v-else>No abrimos hoy. Vuelve pronto.</template>
                        </p>
                    </div>
                </div>
            </div>

            <div v-else-if="ordersLimitReached" class="bg-gray-800 px-4 py-4">
                <div class="max-w-7xl mx-auto flex items-center gap-3">
                    <span class="material-symbols-outlined text-amber-400 text-2xl" style="font-variation-settings:'FILL' 1">block</span>
                    <div>
                        <template v-if="limitReason === 'period_expired'">
                            <p class="text-sm font-bold text-white">Periodo finalizado</p>
                            <p class="text-xs text-gray-300">El periodo de operacion de este restaurante ha concluido.</p>
                        </template>
                        <template v-else-if="limitReason === 'period_not_started'">
                            <p class="text-sm font-bold text-white">Aun no disponible</p>
                            <p class="text-xs text-gray-300">Este restaurante aun no ha iniciado su periodo de operacion.</p>
                        </template>
                        <template v-else>
                            <p class="text-sm font-bold text-white">No disponible por el momento</p>
                            <p class="text-xs text-gray-300">Hemos alcanzado nuestro limite de pedidos del periodo. Vuelve pronto.</p>
                        </template>
                    </div>
                </div>
            </div>

            <!-- ─── Header ─────────────────────────────────────────────────── -->
            <header class="sticky top-0 z-30 bg-[#f6f8f7] border-b border-gray-100 px-4 py-3">
                <div class="max-w-7xl mx-auto flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl bg-white border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            <img v-if="restaurant.logo_url" :src="restaurant.logo_url" :alt="restaurant.name" class="w-full h-full object-contain" />
                            <span v-else class="material-symbols-outlined text-[#FF5722] text-2xl" style="font-variation-settings:'FILL' 1">restaurant</span>
                        </div>
                        <h1 class="text-base font-bold text-gray-900 leading-tight">{{ restaurant.name }}</h1>
                    </div>

                    <!-- Mobile: toggle search icon -->
                    <button
                        @click="showSearch = !showSearch; if (!showSearch) { searchQuery = '' }"
                        class="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-100 md:hidden"
                    >
                        <span class="material-symbols-outlined text-gray-500 text-xl">{{ showSearch ? 'close' : 'search' }}</span>
                    </button>

                    <!-- Desktop: centered search -->
                    <div class="hidden md:flex flex-1 justify-center px-8">
                        <div class="relative w-full max-w-md">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-lg">search</span>
                            <input
                                v-model="searchQuery"
                                type="search"
                                placeholder="Buscar en el menu..."
                                class="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/30"
                            />
                        </div>
                    </div>
                    <!-- Spacer for symmetry -->
                    <div class="hidden md:block w-12"></div>
                </div>

                <!-- Mobile search input -->
                <div v-if="showSearch" class="max-w-md mx-auto mt-2 md:hidden">
                    <input
                        v-model="searchQuery"
                        type="search"
                        placeholder="Buscar..."
                        autofocus
                        class="w-full bg-white border border-gray-200 rounded-2xl px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/30"
                    />
                </div>
            </header>

            <!-- Loading skeleton -->
            <div v-if="restaurantStore.loading" class="max-w-7xl mx-auto px-4 py-6 space-y-4">
                <div class="h-8 bg-gray-200 rounded-full animate-pulse w-3/4"></div>
                <div class="h-32 bg-gray-200 rounded-2xl animate-pulse"></div>
                <div class="h-32 bg-gray-200 rounded-2xl animate-pulse"></div>
            </div>

            <template v-else>
                <div :class="isUnavailable && 'grayscale-[70%] opacity-50 pointer-events-none select-none'">

                <!-- ─── Mobile: Category chips (horizontal) ─────────────────── -->
                <div v-if="menu.length > 0" class="sticky top-[69px] z-20 bg-[#f6f8f7] border-b border-gray-100 md:hidden">
                    <div class="max-w-md mx-auto">
                        <div class="flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar">
                            <button
                                v-for="category in menu"
                                :key="category.id"
                                @click="scrollToCategory(category.id)"
                                class="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1"
                                :class="activeCategory === category.id
                                    ? 'bg-[#FF5722] text-white shadow-md shadow-orange-200'
                                    : 'bg-white text-gray-600 border border-gray-200'"
                            >
                                <span v-if="category.is_promotion_category" class="material-symbols-outlined text-base" style="font-variation-settings:'FILL' 1">local_fire_department</span>
                                {{ category.is_promotion_category ? 'Promociones' : category.name }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- ─── Desktop: 3-column layout ─────────────────────────────── -->
                <!-- ─── Mobile: Single column ────────────────────────────────── -->
                <div class="max-w-7xl mx-auto md:flex md:gap-6 md:px-6 md:pt-6">

                    <!-- Desktop: Category sidebar (left) -->
                    <aside class="hidden md:block w-52 shrink-0">
                        <nav class="sticky top-[85px] space-y-1">
                            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Categorias</p>
                            <button
                                v-for="category in menu"
                                :key="category.id"
                                @click="scrollToCategory(category.id)"
                                class="w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                                :class="activeCategory === category.id
                                    ? 'bg-[#FF5722] text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100'"
                            >
                                <span v-if="category.is_promotion_category" class="material-symbols-outlined text-base" style="font-variation-settings:'FILL' 1">local_fire_department</span>
                                {{ category.is_promotion_category ? 'Promociones' : category.name }}
                            </button>
                        </nav>
                    </aside>

                    <!-- Menu content (center) -->
                    <main class="flex-1 min-w-0 px-4 pb-36 md:px-0 md:pb-8">

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
                                    <span v-if="category.is_promotion_category" class="material-symbols-outlined text-[#FF5722] text-2xl" style="font-variation-settings:'FILL' 1">local_fire_department</span>
                                    <div v-else-if="category.image_url" class="w-8 h-8 rounded-xl overflow-hidden">
                                        <img :src="category.image_url" :alt="category.name" class="w-full h-full object-cover" />
                                    </div>
                                    <h2 class="text-lg font-bold text-gray-900">{{ category.is_promotion_category ? 'Promociones' : category.name }}</h2>
                                </div>

                                <!-- Mobile: list layout -->
                                <div class="space-y-3 md:hidden">
                                    <button
                                        v-for="product in category.products"
                                        :key="product.id"
                                        @click="openProduct(product, category)"
                                        class="w-full bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 text-left hover:border-[#FF5722]/30 transition-colors active:scale-[0.99] motion-reduce:transform-none touch-manipulation"
                                    >
                                        <div class="flex-1 min-w-0">
                                            <p class="font-semibold text-gray-900 text-base leading-snug mb-1">{{ product.name }}</p>
                                            <p v-if="product.description" class="text-sm text-gray-500 leading-snug line-clamp-2 mb-2">{{ product.description }}</p>
                                            <div class="flex items-center gap-2">
                                                <p class="text-base font-bold text-[#FF5722]">{{ formatPrice(product.price) }}</p>
                                                <span v-if="product.is_promotion" class="inline-block text-xs bg-[#FF5722] text-white px-2 py-0.5 rounded-full font-medium">Promo</span>
                                            </div>
                                        </div>
                                        <div class="relative shrink-0">
                                            <div class="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                                                <img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="max-w-full max-h-full object-contain" />
                                                <span v-else class="material-symbols-outlined text-gray-300 text-3xl" style="font-variation-settings:'FILL' 1">fastfood</span>
                                            </div>
                                            <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-[#FF5722] rounded-full flex items-center justify-center shadow">
                                                <span class="material-symbols-outlined text-white text-base">add</span>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                <!-- Desktop: grid layout -->
                                <div class="hidden md:grid md:grid-cols-2 gap-3">
                                    <button
                                        v-for="product in category.products"
                                        :key="product.id"
                                        @click="openProduct(product, category)"
                                        class="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 text-left hover:border-[#FF5722]/30 hover:shadow-sm transition-all"
                                    >
                                        <div class="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                                            <img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="max-w-full max-h-full object-contain" />
                                            <span v-else class="material-symbols-outlined text-gray-300 text-2xl" style="font-variation-settings:'FILL' 1">fastfood</span>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <p class="font-semibold text-gray-900 text-sm leading-snug mb-0.5">{{ product.name }}</p>
                                            <p v-if="product.description" class="text-xs text-gray-500 leading-snug line-clamp-2 mb-1.5">{{ product.description }}</p>
                                            <div class="flex items-center gap-2">
                                                <p class="text-sm font-bold text-[#FF5722]">{{ formatPrice(product.price) }}</p>
                                                <span v-if="product.is_promotion" class="inline-block text-[10px] bg-[#FF5722] text-white px-1.5 py-0.5 rounded-full font-medium">Promo</span>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </template>
                    </main>

                    <!-- Desktop: Cart sidebar (right) -->
                    <aside class="hidden md:block w-80 shrink-0">
                        <div class="sticky top-[85px] bg-white border border-gray-100 rounded-2xl overflow-hidden">
                            <div class="px-4 py-3 border-b border-gray-100">
                                <h2 class="font-bold text-gray-900">Tu Pedido</h2>
                            </div>

                            <div v-if="cart.totalItems === 0" class="px-4 py-8 text-center">
                                <span class="material-symbols-outlined text-3xl text-gray-300 mb-2" style="font-variation-settings:'FILL' 1">shopping_cart</span>
                                <p class="text-sm text-gray-400">Tu carrito esta vacio</p>
                            </div>

                            <div v-else>
                                <div class="max-h-80 overflow-y-auto divide-y divide-gray-50">
                                    <div v-for="(item, i) in cart.items" :key="i" class="px-4 py-3 flex items-start gap-3">
                                        <img v-if="item.product_image" :src="item.product_image" class="w-10 h-10 rounded-lg object-cover shrink-0" />
                                        <div class="flex-1 min-w-0">
                                            <p class="text-sm font-medium text-gray-900 leading-snug">{{ item.quantity }}x {{ item.product_name }}</p>
                                            <p v-if="item.modifiers.length" class="text-xs text-gray-400 truncate">
                                                {{ item.modifiers.map(m => m.name).join(', ') }}
                                            </p>
                                        </div>
                                        <span class="text-sm font-semibold text-gray-700 shrink-0">{{ formatPrice(item.item_total) }}</span>
                                    </div>
                                </div>

                                <div class="px-4 py-3 border-t border-gray-100">
                                    <div class="flex items-center justify-between mb-3">
                                        <span class="text-sm text-gray-500">Subtotal</span>
                                        <span class="text-sm font-bold text-gray-900">{{ formatPrice(cart.subtotal) }}</span>
                                    </div>
                                    <button
                                        @click="goToCart"
                                        :disabled="!isAvailable"
                                        class="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
                                        :class="isAvailable
                                            ? 'bg-[#FF5722] text-white hover:bg-[#D84315]'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
                                    >
                                        Confirmar pedido
                                    </button>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                </div>
            </template>
        </template>

        <!-- Loading fallback -->
        <div v-else class="flex items-center justify-center min-h-dvh">
            <div class="flex flex-col items-center gap-3">
                <div class="w-10 h-10 rounded-full border-4 border-[#FF5722]/30 border-t-[#FF5722] animate-spin"></div>
                <p class="text-sm text-gray-500">Cargando menu...</p>
            </div>
        </div>

        <!-- Mobile cart bar (hidden on desktop) -->
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
