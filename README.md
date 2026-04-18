# PideAqui / GuisoGo — Cliente SPA

SPA Vue 3 + Vite + Pinia que consume la API pública del backend Laravel (`../admin/`). Es la interfaz que el cliente final usa desde su móvil: navegar el menú, armar un carrito, elegir entrega, confirmar pago y abrir WhatsApp con el pedido creado.

**Diseño:** mobile-first (máx ~390px de ancho útil), bordes redondeados (`rounded-2xl`, `rounded-full`), tema dinámico por restaurante (colores primarios se aplican desde la API).

---

## Stack Tecnológico

| Dependencia | Versión |
| --- | --- |
| Vue | 3.5.x |
| Vite | 7.3.x |
| Pinia | 3.0.x |
| Vue Router | 4.6.x (hash mode) |
| Axios | 1.13.x |
| Tailwind CSS | 4.2.x (vía `@tailwindcss/vite`) |

No hay TypeScript. Composition API con `<script setup>` en todos los componentes.

---

## Requisitos Previos

- **Node.js** 20+ (recomendado)
- **npm**
- Backend corriendo en `../admin/` (Laravel Sail en `http://localhost`) con al menos un restaurante creado y su `access_token` a la mano

---

## Instalación

```bash
cd client
cp .env.example .env
# Editar .env con los valores reales (ver siguiente sección)

npm install
npm run dev
```

El dev server levanta en `http://localhost:5174` con proxy `/api → http://localhost:80`.

---

## Variables de Entorno (`.env`)

```env
VITE_API_BASE_URL=http://localhost
VITE_RESTAURANT_TOKEN=<access_token_del_restaurante>
VITE_GOOGLE_MAPS_KEY=<google_maps_browser_key>
```

- **`VITE_API_BASE_URL`** — URL del backend Laravel. En dev, `http://localhost` (el proxy de Vite lo enruta a través de `/api`).
- **`VITE_RESTAURANT_TOKEN`** — Token SHA256 del restaurante (el backend lo genera al crear el restaurante desde SuperAdmin). Se envía en cada request como header `X-Restaurant-Token`. **Un build = un restaurante**.
- **`VITE_GOOGLE_MAPS_KEY`** — Browser key de Google Maps. Solo se usa en `MapPicker.vue` para geocoding reverso y selección manual de ubicación.

---

## Scripts

```bash
npm run dev       # Dev server con HMR en :5174
npm run build     # Build de producción a dist/
npm run preview   # Preview del build de producción
```

---

## Estructura del Proyecto

```
client/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── CartBar.vue      # Barra flotante inferior con total y "Ver carrito"
│   │   ├── ProductModal.vue # Modal de producto con modificadores (inline + catalog)
│   │   └── MapPicker.vue    # Mapa con geolocalización y búsqueda manual
│   ├── views/               # Pantallas (1 por ruta)
│   │   ├── MenuHome.vue         # Catálogo + búsqueda + banner horario
│   │   ├── CartSummary.vue      # Revisión del carrito
│   │   ├── DeliveryLocation.vue # Sucursal + dirección + modo entrega
│   │   ├── PaymentConfirmation.vue # Método de pago + cupón
│   │   └── OrderConfirmed.vue   # Resumen final + reenvío WhatsApp
│   ├── stores/              # Pinia
│   │   ├── restaurant.js    # Datos del restaurante, menú, tema dinámico
│   │   ├── cart.js          # Items (persistido en localStorage)
│   │   └── order.js         # Entrega, dirección, pago, cupón
│   ├── services/
│   │   └── api.js           # Instancia Axios con X-Restaurant-Token
│   ├── router/
│   │   └── index.js         # 5 rutas hash, scroll-top en navegación
│   ├── utils/
│   │   └── cookies.js       # Persistencia cliente 90 días (UUID v4)
│   ├── assets/
│   ├── App.vue              # Fetch inicial + handler visibilitychange
│   ├── main.js              # Boot (Pinia, router)
│   └── style.css            # Tailwind v4 + tokens CSS del tema
├── public/
├── index.html
├── vite.config.js
└── package.json
```

---

## Rutas (Router)

| Ruta | Vista | Propósito |
| --- | --- | --- |
| `/` | `MenuHome.vue` | Catálogo de productos, búsqueda, banner si el restaurante está cerrado |
| `/cart` | `CartSummary.vue` | Revisión del carrito, modificar cantidades |
| `/delivery` | `DeliveryLocation.vue` | Elegir sucursal o dirección de entrega |
| `/payment` | `PaymentConfirmation.vue` | Método de pago + cupón de descuento |
| `/confirmed` | `OrderConfirmed.vue` | Resumen final, reabrir WhatsApp con el mensaje del pedido |

Modo `createWebHashHistory()` — no requiere configuración de servidor para rutas profundas.

---

## Stores Pinia

### `restaurant.js`
Datos globales del restaurante y del menú.
- `state`: `restaurant`, `menu`, `paymentMethods`, `loading`, `error`
- `actions`: `fetchRestaurant()`, `fetchMenu()`
- **Tema dinámico**: al recibir los datos del restaurante, aplica variables CSS (`--color-primary`, `--color-primary-dark`) desde la API.

### `cart.js`
Carrito persistido en `localStorage`.
- `state`: `items`
- `getters`: `subtotal`, `totalItems`
- `actions`: `addItem()` (hace merge si ya existe con los mismos modificadores), `updateQuantity()`, `removeItem()`, `clear()`
- **Detección de modificadores** para identificar items equivalentes: usa `modifier_option_template_id` (del catálogo) o `modifier_option_id` (inline).
- **Promociones**: cuando `product.is_promotion === true`, el item se envía al backend con `promotion_id` en vez de `product_id`.

### `order.js`
Estado del flujo de pedido (delivery, dirección, pago, cupón).
- `state`: tipo de entrega, sucursal seleccionada, dirección, lat/lng, método de pago, `couponCode`, `couponDiscount`, datos del cliente (nombre, teléfono)
- Persistido en `localStorage`
- `actions`: `setDelivery()`, `setOrderSummary()`, `reset()`

---

## Servicio API

`src/services/api.js` exporta una instancia de Axios configurada con:

- `baseURL` desde `VITE_API_BASE_URL`
- Header `X-Restaurant-Token` desde `VITE_RESTAURANT_TOKEN` en cada request
- Timeout razonable y manejo básico de errores

Endpoints consumidos (ver `docs/modules/10-api.md` del backend para detalles completos):

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/restaurant` | Datos del restaurante + banner cerrado + `today_schedule` |
| GET | `/api/menu` | Categorías, productos y promociones (incluye modifiers inline + catalog) |
| GET | `/api/branches` | Sucursales activas con cobertura |
| GET | `/api/payment-methods` | Métodos activos (cash / terminal / transfer) |
| POST | `/api/delivery/calculate` | Calcula sucursal + tarifa (Haversine + Google Distance Matrix) |
| POST | `/api/coupons/validate` | Preview de cupón antes de crear el pedido |
| POST | `/api/orders` | Crea el pedido (backend lo guarda ANTES de abrir WhatsApp) |

---

## App.vue — Comportamiento al Montar

1. `fetchRestaurant()` + `fetchMenu()` en paralelo
2. Aplica `<title>` y favicon dinámicos desde los datos del restaurante
3. Solicita geolocalización del navegador con timeout de 5s (no bloqueante)
4. **Handler `visibilitychange`**: cuando el usuario vuelve a la pestaña, re-fetch `fetchRestaurant()` para refrescar banner horario, `orders_limit_reached` y `today_schedule`

Footer sticky con créditos se renderiza en todas las vistas.

---

## Build de Producción

```bash
npm run build
```

Genera `dist/` con HTML + assets optimizados. Deploy: servir `dist/` desde cualquier static host (Netlify, Cloudflare Pages, Nginx, etc.). Como el router usa hash mode, no requiere rewrites en el host.

**Un build = un restaurante.** Si necesitas servir varios restaurantes, re-build con distinto `VITE_RESTAURANT_TOKEN` o inyéctalo en runtime (no implementado hoy).

---

## Documentación del Backend

La documentación completa del dominio, flujos, API y módulos vive **dentro del repo `admin/`** (`pideaqui-back`), en la carpeta `docs/`:

- `../admin/docs/modules/INDEX.md` — índice de módulos
- `../admin/docs/modules/08-customer-flow.md` — flujo del cliente (este SPA)
- `../admin/docs/modules/10-api.md` — contratos de la API pública
- `../admin/docs/DATABASE.md` — esquema de la base de datos
- `../admin/docs/ARCHITECTURE.md` — decisiones arquitectónicas

Si clonaste sólo `pideaqui-front` sin el `pideaqui-back`, consulta el repo del backend en GitHub para acceder a la documentación completa.

---

_PideAqui / GuisoGo — Cliente SPA_
