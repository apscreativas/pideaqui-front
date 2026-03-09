# GuisoGo — SPA del Cliente

Aplicacion web mobile-first para que los clientes finales naveguen el menu digital, seleccionen productos y realicen pedidos via WhatsApp.

Proyecto independiente que consume la [API del backend](../admin/).

---

## Stack Tecnologico

| Tecnologia | Version |
|-----------|---------|
| Vue 3 | v3.5 |
| Vue Router | v4.6 |
| Pinia | v3 |
| Vite | v7 |
| Tailwind CSS | v4 |
| Axios | v1.13 |

---

## Requisitos Previos

- **Node.js** 20+
- **npm** 10+ (incluido con Node.js)
- El [backend](../admin/) debe estar corriendo y accesible

---

## Instalacion

### 1. Entrar al directorio del cliente

```bash
cd GuisoGo/client
```

### 2. Copiar variables de entorno

```bash
cp .env.example .env
```

### 3. Configurar variables de entorno

Edita `.env`:

```dotenv
# URL base de la API del backend
VITE_API_BASE_URL=http://localhost

# Token de acceso del restaurante (generado en el SuperAdmin)
VITE_RESTAURANT_TOKEN=tu_token_de_restaurante

# Google Maps API key (para mapa de delivery)
VITE_GOOGLE_MAPS_KEY=tu_api_key_de_google_maps
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

La SPA esta disponible en **http://localhost:5174**.

> En desarrollo, las peticiones a `/api/*` se redirigen automaticamente al backend en `http://localhost:80` via el proxy de Vite.

---

## Variables de Entorno

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `VITE_API_BASE_URL` | Si | URL base del backend. En desarrollo: `http://localhost`. En produccion: `https://tu-dominio.com` |
| `VITE_RESTAURANT_TOKEN` | Si | Token de acceso del restaurante. Se genera al crear el restaurante en el SuperAdmin. |
| `VITE_GOOGLE_MAPS_KEY` | Si | API key de Google Maps para el mapa de delivery. |

---

## Desarrollo

### Comandos

```bash
# Servidor de desarrollo con HMR
npm run dev

# Compilar para produccion
npm run build

# Previsualizar build de produccion localmente
npm run preview
```

### Proxy de API

En desarrollo, Vite redirige las peticiones `/api/*` al backend:

```js
// vite.config.js
proxy: {
  '/api': {
    target: 'http://localhost:80',
    changeOrigin: true,
  },
}
```

No necesitas configurar CORS adicional en desarrollo.

---

## Estructura del Proyecto

```
client/
├── public/                    # Assets estaticos
├── src/
│   ├── assets/                # Imagenes, fuentes
│   ├── components/            # Componentes Vue reutilizables
│   │   ├── ProductModal.vue   # Modal de producto con modificadores
│   │   ├── CartBar.vue        # Barra flotante del carrito
│   │   └── ...
│   ├── router/
│   │   └── index.js           # Vue Router (hash history, route guards)
│   ├── services/
│   │   └── api.js             # Instancia Axios configurada
│   ├── stores/
│   │   ├── cart.js            # Carrito (Pinia, persistido en localStorage)
│   │   ├── order.js           # Datos del pedido (Pinia, persistido en localStorage)
│   │   └── restaurant.js     # Datos del restaurante (Pinia)
│   ├── utils/
│   │   └── cookies.js         # Gestion de cookies del cliente
│   ├── views/
│   │   ├── MenuHome.vue       # Paso 1: Menu con categorias y productos
│   │   ├── CartSummary.vue    # Resumen del carrito
│   │   ├── DeliveryLocation.vue # Paso 2: Tipo de entrega, direccion, mapa
│   │   ├── PaymentConfirmation.vue # Paso 3: Pago y confirmacion
│   │   └── OrderConfirmed.vue # Pantalla de confirmacion
│   └── App.vue                # Componente raiz
├── .env.example               # Plantilla de variables de entorno
├── index.html                 # Entry point HTML
├── package.json
└── vite.config.js             # Configuracion de Vite + proxy
```

---

## Flujo del Cliente

```
Menu ──> Carrito ──> Delivery/Entrega ──> Pago ──> Confirmacion + WhatsApp
 (1)      (2)           (3)               (4)           (5)
```

1. **Menu** — Navega categorias, selecciona productos con modificadores y notas.
2. **Carrito** — Revisa items, ajusta cantidades.
3. **Entrega** — Elige tipo (domicilio/recoger/comer aqui). Para domicilio: ingresa direccion, arrastra pin en mapa, selecciona horario.
4. **Pago** — Ingresa nombre, telefono. Elige metodo de pago (efectivo/terminal/transferencia).
5. **Confirmacion** — El pedido se crea en el backend. Se abre WhatsApp con la comanda completa dirigida a la sucursal.

### Route Guards

Las rutas tienen guards que evitan navegacion a pasos incompletos:

| Ruta | Guard |
|------|-------|
| `/cart` | Carrito no vacio |
| `/delivery` | Carrito no vacio |
| `/payment` | Carrito no vacio + sucursal seleccionada |
| `/confirmed` | ID de pedido confirmado |

### Persistencia

- **Carrito**: `localStorage` (clave `guisogo_cart`)
- **Datos del pedido**: `localStorage` (clave `guisogo_order`)
- **Datos del cliente**: Cookie con duracion de 90 dias (nombre, telefono, direccion)

> El cliente **no necesita cuenta ni registro**. Un token UUID v4 generado con `crypto.getRandomValues()` identifica al cliente.

---

## Despliegue a Produccion

La SPA se compila a archivos estaticos que puedes servir desde cualquier servidor web, CDN o servicio de hosting estatico.

### 1. Configurar variables de entorno de produccion

Crea `.env.production`:

```dotenv
VITE_API_BASE_URL=https://tu-dominio-backend.com
VITE_RESTAURANT_TOKEN=token_de_produccion
VITE_GOOGLE_MAPS_KEY=api_key_de_produccion
```

### 2. Compilar

```bash
npm ci
npm run build
```

Los archivos se generan en `dist/`.

### 3. Servir los archivos estaticos

#### Opcion A: Nginx

```nginx
server {
    listen 80;
    server_name menu.tu-dominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name menu.tu-dominio.com;
    root /var/www/guisogo-client/dist;

    ssl_certificate     /etc/ssl/certs/tu-dominio.crt;
    ssl_certificate_key /etc/ssl/private/tu-dominio.key;

    index index.html;

    # SPA: todas las rutas redirigen a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache agresivo para assets con hash
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # CORS para la API del backend
    # (Solo si el backend esta en un dominio diferente)
    # En la mayoria de los casos, el proxy inverso del backend maneja CORS.
}
```

#### Opcion B: Vercel / Netlify / Cloudflare Pages

1. Conecta el repositorio.
2. Configura:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Node version:** 20
3. Agrega las variables de entorno (`VITE_API_BASE_URL`, `VITE_RESTAURANT_TOKEN`, `VITE_GOOGLE_MAPS_KEY`).
4. Despliega.

> Para Vercel, agrega un `vercel.json` para manejar el SPA routing:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Opcion C: Servir desde el mismo servidor que el backend

Puedes colocar el `dist/` en un subdirectorio del servidor Nginx del backend:

```nginx
# Agregar al server block del backend
location /menu/ {
    alias /var/www/guisogo-client/dist/;
    try_files $uri $uri/ /menu/index.html;
}
```

### Checklist de produccion

- [ ] `VITE_API_BASE_URL` apunta al backend de produccion (HTTPS)
- [ ] `VITE_RESTAURANT_TOKEN` es el token correcto del restaurante
- [ ] `VITE_GOOGLE_MAPS_KEY` es una API key de produccion (restringida por dominio HTTP referrer)
- [ ] HTTPS habilitado
- [ ] Headers de cache configurados para assets hasheados
- [ ] SPA fallback (`try_files` o rewrite a `index.html`)
- [ ] CORS configurado en el backend si la SPA esta en un dominio diferente

---

## Notas de Seguridad

- El cliente **nunca** ve el `production_cost` de los productos.
- Todos los precios y totales se recalculan en el backend (anti-tampering).
- La distancia de delivery se calcula server-side con Haversine.
- Los modificadores se validan por producto en el backend.
- El rate limiting protege el endpoint de creacion de pedidos (30/min).
- Las cookies usan `SameSite=Lax` y `Secure` flag en HTTPS.
