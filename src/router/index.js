import { createRouter, createWebHashHistory } from 'vue-router'
import MenuHome from '@/views/MenuHome.vue'
import CartSummary from '@/views/CartSummary.vue'
import DeliveryLocation from '@/views/DeliveryLocation.vue'
import PaymentConfirmation from '@/views/PaymentConfirmation.vue'
import OrderConfirmed from '@/views/OrderConfirmed.vue'
import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/order'

const routes = [
    { path: '/', name: 'menu', component: MenuHome },
    {
        path: '/cart',
        name: 'cart',
        component: CartSummary,
        beforeEnter: () => {
            const cart = useCartStore()
            if (cart.items.length === 0) return { name: 'menu' }
        },
    },
    {
        path: '/delivery',
        name: 'delivery',
        component: DeliveryLocation,
        beforeEnter: () => {
            const cart = useCartStore()
            if (cart.items.length === 0) return { name: 'menu' }
        },
    },
    {
        path: '/payment',
        name: 'payment',
        component: PaymentConfirmation,
        beforeEnter: () => {
            const cart = useCartStore()
            const order = useOrderStore()
            if (cart.items.length === 0) return { name: 'menu' }
            if (!order.branchId) return { name: 'delivery' }
        },
    },
    {
        path: '/confirmed',
        name: 'confirmed',
        component: OrderConfirmed,
        beforeEnter: () => {
            const order = useOrderStore()
            if (!order.confirmedOrderId) return { name: 'menu' }
        },
    },
]

export default createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
})
