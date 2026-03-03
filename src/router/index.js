import { createRouter, createWebHashHistory } from 'vue-router'
import MenuHome from '@/views/MenuHome.vue'
import CartSummary from '@/views/CartSummary.vue'
import DeliveryLocation from '@/views/DeliveryLocation.vue'
import PaymentConfirmation from '@/views/PaymentConfirmation.vue'
import OrderConfirmed from '@/views/OrderConfirmed.vue'

const routes = [
    { path: '/', name: 'menu', component: MenuHome },
    { path: '/cart', name: 'cart', component: CartSummary },
    { path: '/delivery', name: 'delivery', component: DeliveryLocation },
    { path: '/payment', name: 'payment', component: PaymentConfirmation },
    { path: '/confirmed', name: 'confirmed', component: OrderConfirmed },
]

export default createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
})
