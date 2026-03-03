<script setup>
/**
 * MapPicker — Interactive Google Maps component with a draggable marker.
 *
 * Props:
 *   lat (Number) — initial latitude
 *   lng (Number) — initial longitude
 *
 * Emits:
 *   update:lat (Number)
 *   update:lng (Number)
 *
 * Requires VITE_GOOGLE_MAPS_KEY to be set.
 * Falls back to a text-based coordinate display when no key is available.
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
})

const emit = defineEmits(['update:lat', 'update:lng'])

const mapEl = ref(null)
const mapLoaded = ref(false)
const mapError = ref(null)

let googleMap = null
let marker = null

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

function loadGoogleMapsScript() {
    return new Promise((resolve, reject) => {
        if (window.google?.maps) {
            resolve()
            return
        }

        if (!API_KEY) {
            reject(new Error('VITE_GOOGLE_MAPS_KEY no configurada'))
            return
        }

        const existing = document.querySelector('#google-maps-script')
        if (existing) {
            existing.addEventListener('load', resolve)
            existing.addEventListener('error', reject)
            return
        }

        const script = document.createElement('script')
        script.id = 'google-maps-script'
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}`
        script.async = true
        script.defer = true
        script.onload = resolve
        script.onerror = () => reject(new Error('Error al cargar Google Maps'))
        document.head.appendChild(script)
    })
}

async function initMap() {
    try {
        await loadGoogleMapsScript()

        const center = {
            lat: props.lat ?? 19.4326,
            lng: props.lng ?? -99.1332,
        }

        googleMap = new window.google.maps.Map(mapEl.value, {
            center,
            zoom: 15,
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
        })

        marker = new window.google.maps.Marker({
            position: center,
            map: googleMap,
            draggable: true,
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#FF5722',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
            },
            title: 'Arrastra para ajustar tu ubicación',
        })

        marker.addListener('dragend', (event) => {
            emit('update:lat', event.latLng.lat())
            emit('update:lng', event.latLng.lng())
        })

        mapLoaded.value = true
    } catch (err) {
        mapError.value = err.message
    }
}

// Re-center map when props change (e.g. GPS obtained)
watch(() => [props.lat, props.lng], ([newLat, newLng]) => {
    if (!googleMap || !marker || !newLat || !newLng) { return }
    const pos = { lat: newLat, lng: newLng }
    googleMap.setCenter(pos)
    marker.setPosition(pos)
})

onMounted(() => { initMap() })

onUnmounted(() => {
    marker = null
    googleMap = null
})
</script>

<template>
    <div class="relative w-full h-56 rounded-2xl overflow-hidden bg-gray-100">

        <!-- Map container -->
        <div ref="mapEl" class="w-full h-full"></div>

        <!-- Loading state -->
        <div
            v-if="!mapLoaded && !mapError"
            class="absolute inset-0 flex flex-col items-center justify-center bg-gray-100"
        >
            <div class="w-8 h-8 rounded-full border-4 border-gray-200 border-t-[#FF5722] animate-spin mb-2"></div>
            <p class="text-xs text-gray-500">Cargando mapa...</p>
        </div>

        <!-- Fallback: no API key or error -->
        <div
            v-if="mapError"
            class="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 px-4 text-center"
        >
            <span class="material-symbols-outlined text-gray-300 text-4xl mb-2">map</span>
            <p class="text-xs text-gray-500 mb-1">Mapa no disponible</p>
            <p class="text-xs text-gray-400">{{ mapError }}</p>
            <div v-if="lat && lng" class="mt-2 text-xs font-mono text-gray-500">
                {{ lat?.toFixed(6) }}, {{ lng?.toFixed(6) }}
            </div>
        </div>

        <!-- Pin hint overlay (shown when loaded) -->
        <div v-if="mapLoaded" class="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
            <div class="bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                Arrastra el pin para ajustar tu ubicación
            </div>
        </div>
    </div>
</template>
