import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useOrderStore = defineStore('order', () => {
    const deliveryType = ref(null) // 'delivery' | 'pickup' | 'dine_in'
    const branchId = ref(null)
    const branchName = ref(null)
    const branchWhatsapp = ref(null)
    const branchAddress = ref('')
    const branchLatitude = ref(null)
    const branchLongitude = ref(null)
    const distanceKm = ref(null)
    const deliveryCost = ref(0)
    const address = ref('')
    const addressReferences = ref('')
    const latitude = ref(null)
    const longitude = ref(null)
    const scheduledAt = ref(null)
    const paymentMethod = ref(null)
    const customerName = ref('')
    const customerPhone = ref('')
    const confirmedOrderId = ref(null)
    const orderSummary = ref(null)

    function setDelivery(type, branch, deliveryData = {}) {
        deliveryType.value = type
        branchId.value = branch.id ?? branch.branch_id
        branchName.value = branch.name ?? branch.branch_name
        branchWhatsapp.value = branch.whatsapp ?? branch.branch_whatsapp
        branchAddress.value = branch.address ?? ''
        branchLatitude.value = branch.latitude ?? null
        branchLongitude.value = branch.longitude ?? null
        distanceKm.value = deliveryData.distance_km ?? null
        deliveryCost.value = deliveryData.delivery_cost ?? 0
        address.value = deliveryData.address ?? ''
        addressReferences.value = deliveryData.address_references ?? ''
        latitude.value = deliveryData.latitude ?? null
        longitude.value = deliveryData.longitude ?? null
    }

    function setOrderSummary(cartItems, subtotal, deliveryCostVal) {
        orderSummary.value = {
            items: JSON.parse(JSON.stringify(cartItems)),
            subtotal,
            deliveryCost: deliveryCostVal,
            total: subtotal + deliveryCostVal,
        }
    }

    function reset() {
        deliveryType.value = null
        branchId.value = null
        branchName.value = null
        branchWhatsapp.value = null
        branchAddress.value = ''
        branchLatitude.value = null
        branchLongitude.value = null
        distanceKm.value = null
        deliveryCost.value = 0
        address.value = ''
        addressReferences.value = ''
        latitude.value = null
        longitude.value = null
        scheduledAt.value = null
        paymentMethod.value = null
        confirmedOrderId.value = null
        orderSummary.value = null
    }

    return {
        deliveryType, branchId, branchName, branchWhatsapp,
        branchAddress, branchLatitude, branchLongitude, distanceKm,
        deliveryCost, address, addressReferences, latitude, longitude,
        scheduledAt, paymentMethod, customerName, customerPhone, confirmedOrderId,
        orderSummary,
        setDelivery, setOrderSummary, reset,
    }
})
