import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'

function hexToLinear(hex) {
    const c = hex.replace('#', '')
    const full = c.length === 3 ? c[0]+c[0]+c[1]+c[1]+c[2]+c[2] : c
    const r = parseInt(full.substring(0, 2), 16) / 255
    const g = parseInt(full.substring(2, 4), 16) / 255
    const b = parseInt(full.substring(4, 6), 16) / 255
    const toLinear = (v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function darkenHex(hex, factor = 0.8) {
    const c = hex.replace('#', '')
    const full = c.length === 3 ? c[0]+c[0]+c[1]+c[1]+c[2]+c[2] : c
    const r = Math.round(parseInt(full.substring(0, 2), 16) * factor)
    const g = Math.round(parseInt(full.substring(2, 4), 16) * factor)
    const b = Math.round(parseInt(full.substring(4, 6), 16) * factor)
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

function applyTheme(data) {
    const root = document.documentElement
    const primary = data.primary_color || '#f6f8f7'
    const secondary = data.secondary_color || '#FF5722'
    console.log('[PideAqui] applyTheme called — primary:', primary, 'secondary:', secondary, 'raw:', data.primary_color, data.secondary_color)
    console.log('[PideAqui] root element:', root.tagName, 'style before:', root.style.cssText)
    const secondaryDark = darkenHex(secondary, 0.78)
    const textOnSecondary = hexToLinear(secondary) > 0.4 ? '#1a1a1a' : '#ffffff'

    // text_color is always resolved by the API ("light" or "dark")
    const isDark = (data.text_color || 'dark') === 'dark'

    root.style.setProperty('--color-primary', primary)
    root.style.setProperty('--color-secondary', secondary)
    console.log('[PideAqui] style after setProperty:', root.style.cssText)
    console.log('[PideAqui] getComputedStyle --color-primary:', getComputedStyle(root).getPropertyValue('--color-primary'))
    root.style.setProperty('--color-secondary-dark', secondaryDark)
    root.style.setProperty('--color-secondary-light', secondary + '1a')
    root.style.setProperty('--color-secondary-ring', secondary + '4d')
    root.style.setProperty('--color-text-on-secondary', textOnSecondary)

    // Text colors derived from text_color
    root.style.setProperty('--color-text', isDark ? '#1a1a1a' : '#ffffff')
    root.style.setProperty('--color-text-secondary', isDark ? '#6b7280' : 'rgba(255,255,255,0.6)')
    root.style.setProperty('--color-text-muted', isDark ? '#9ca3af' : 'rgba(255,255,255,0.4)')

    // Surface colors that depend on text mode
    root.style.setProperty('--color-border', isDark ? '#e5e7eb' : 'rgba(255,255,255,0.15)')
    root.style.setProperty('--color-border-light', isDark ? '#f3f4f6' : 'rgba(255,255,255,0.1)')
    root.style.setProperty('--color-card-bg', isDark ? '#ffffff' : 'rgba(255,255,255,0.08)')
    root.style.setProperty('--color-input-bg', isDark ? '#ffffff' : 'rgba(255,255,255,0.12)')
}

export const useRestaurantStore = defineStore('restaurant', () => {
    const restaurant = ref(null)
    const menu = ref([])
    const paymentMethods = ref([])
    const loading = ref(false)
    const error = ref(null)

    async function fetchRestaurant() {
        loading.value = true
        error.value = null
        try {
            const { data } = await api.get('/api/restaurant')
            restaurant.value = data.data
            paymentMethods.value = data.data.payment_methods ?? []
            applyTheme(data.data)
        } catch (err) {
            error.value = err.response?.data?.message ?? 'Error al cargar el restaurante.'
        } finally {
            loading.value = false
        }
    }

    async function fetchMenu() {
        try {
            const { data } = await api.get('/api/menu')
            menu.value = data.data
        } catch {
            // menu stays empty
        }
    }

    return { restaurant, menu, paymentMethods, loading, error, fetchRestaurant, fetchMenu }
})
