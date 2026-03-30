<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useRestaurantStore } from '@/stores/restaurant'

const restaurantStore = useRestaurantStore()

onMounted(async () => {
    console.log('[PideAqui] App mounted, fetching restaurant...')
    await restaurantStore.fetchRestaurant()
    console.log('[PideAqui] Restaurant loaded:', restaurantStore.restaurant?.name, 'primary_color:', restaurantStore.restaurant?.primary_color)
    console.log('[PideAqui] CSS --color-primary:', getComputedStyle(document.documentElement).getPropertyValue('--color-primary'))
    await restaurantStore.fetchMenu()
    console.log('[PideAqui] Menu loaded:', restaurantStore.menu?.length, 'categories')

    // Set favicon to restaurant logo
    const logo = restaurantStore.restaurant?.logo_url
    if (logo) {
        const link = document.getElementById('favicon')
        if (link) {
            link.href = logo
            link.removeAttribute('type')
        }
    }

    // Set page title to restaurant name
    if (restaurantStore.restaurant?.name) {
        document.title = restaurantStore.restaurant.name
    }

    // Request geolocation permission early so the browser prompt appears before checkout
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 5000 })
    }
})
</script>

<template>
    <div class="min-h-dvh" style="background-color: var(--color-primary)">
        <RouterView />
    </div>
</template>
