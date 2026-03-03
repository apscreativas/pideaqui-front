import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'

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
