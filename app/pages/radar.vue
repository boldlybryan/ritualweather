<template>
  <div class="radar-container">
    <!-- Control Panel -->
    <div class="control-panel">
      <div class="control-group">
        <button 
          @click="toggleRadar" 
          :class="['control-btn', { active: radarVisible }]"
          :disabled="loading"
        >
          {{ radarVisible ? 'Hide Radar' : 'Show Radar' }}
        </button>
      </div>
      
      <div class="control-group" v-if="radarVisible">
        <label for="opacity-slider">Opacity:</label>
        <input
          id="opacity-slider"
          type="range"
          min="0.2"
          max="1.0"
          step="0.1"
          v-model="radarOpacity"
          @input="updateRadarOpacity"
          class="opacity-slider"
        />
        <span class="opacity-value">{{ Math.round(radarOpacity * 100) }}%</span>
      </div>
      
      <div class="control-group">
        <button @click="resetView" class="control-btn reset-btn">
          Reset View
        </button>
      </div>
    </div>

    <!-- Loading Indicator -->
    <div v-if="loading" class="loading-indicator">
      <div class="spinner"></div>
      <p>Loading radar data...</p>
    </div>

    <!-- Map Container -->
    <div id="radar-map" class="map-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'

// Reactive state
const loading = ref(true)
const radarVisible = ref(true)
const radarOpacity = ref(0.6)
let map: any = null
let radarLayer: any = null

// Map configuration
const MAP_CONFIG = {
  center: [39.8283, -98.5795] as [number, number], // Continental US center
  zoom: 5,
  minZoom: 3,
  maxZoom: 10
}

// WMS Configuration - Using National Weather Service radar
const WMS_CONFIG = {
  url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi',
  layers: 'nexrad-n0r-900913', // Radar layer
  format: 'image/png',
  transparent: true,
  opacity: 0.6,
  attribution: 'NOAA Weather Radar via Iowa State University',
  version: '1.1.1',
  crs: 'EPSG:3857'
}

onMounted(async () => {
  await initializeMap()
})

onUnmounted(() => {
  if (map) {
    map.remove()
  }
  // Clean up resize event listener
  window.removeEventListener('resize', () => {
    if (map) {
      setTimeout(() => map.invalidateSize(), 100)
    }
  })
})

async function initializeMap() {
  try {
    // Dynamically import Leaflet to avoid SSR issues
    const L = await import('leaflet')

    // Fix for default markers in Leaflet with Vite
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })

    // Initialize map
    map = L.map('radar-map', {
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      zoomControl: true,
      attributionControl: true
    })

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map)

    // Create WMS layer directly using Leaflet's built-in WMS support
    radarLayer = L.tileLayer.wms(WMS_CONFIG.url, {
      layers: WMS_CONFIG.layers,
      format: WMS_CONFIG.format,
      transparent: WMS_CONFIG.transparent,
      opacity: WMS_CONFIG.opacity,
      attribution: WMS_CONFIG.attribution,
      version: WMS_CONFIG.version,
      crs: L.CRS.EPSG3857,
      styles: ''
    })

    // Add the radar layer
    radarLayer.addTo(map)
    console.log('Radar layer added to map:', radarLayer)

    // Handle loading state
    map.whenReady(() => {
      // Force map to resize and invalidate size
      setTimeout(() => {
        map.invalidateSize()
        loading.value = false
        console.log('Map ready and resized')
      }, 100)
    })

    // Handle tile loading events
    radarLayer.on('tileload', (e: any) => {
      console.log('Radar tile loaded successfully:', e)
    })

    radarLayer.on('tileerror', (e: any) => {
      console.warn('Radar tile loading error:', e)
    })

    radarLayer.on('loading', () => {
      console.log('Radar layer loading started')
    })

    radarLayer.on('load', () => {
      console.log('Radar layer loading completed')
    })

    // Force resize on window resize
    window.addEventListener('resize', () => {
      if (map) {
        setTimeout(() => map.invalidateSize(), 100)
      }
    })

  } catch (error) {
    console.error('Error initializing map:', error)
    loading.value = false
  }
}

function toggleRadar() {
  if (!map || !radarLayer) return
  
  radarVisible.value = !radarVisible.value
  
  if (radarVisible.value) {
    radarLayer.addTo(map)
  } else {
    radarLayer.remove()
  }
}

function updateRadarOpacity() {
  if (!radarLayer) return
  
  radarLayer.setOpacity(radarOpacity.value)
}

function resetView() {
  if (!map) return
  
  map.setView(MAP_CONFIG.center, MAP_CONFIG.zoom)
}

// SEO and page metadata
useHead({
  title: 'US Weather Radar - Ritual Weather',
  meta: [
    { name: 'description', content: 'Interactive US weather radar map with NOAA radar overlay' }
  ]
})
</script>

<style scoped>
.radar-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.map-container {
  width: 100%;
  height: 100%;
  z-index: 1;
  position: relative;
}

.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  max-width: 280px;
}

.control-group {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group:last-child {
  margin-bottom: 0;
}

.control-group label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.control-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #3b82f6;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 40px;
}

.control-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.control-btn:active {
  transform: translateY(0);
}

.control-btn.active {
  background: #10b981;
}

.control-btn.active:hover {
  background: #059669;
}

.control-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.reset-btn {
  background: #6b7280;
}

.reset-btn:hover {
  background: #4b5563;
}

.opacity-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.opacity-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.opacity-value {
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  font-weight: 500;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-indicator p {
  margin: 0;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .control-panel {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
    padding: 12px;
  }
  
  .control-group {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }
  
  .control-group label {
    margin-bottom: 0;
    min-width: 60px;
  }
  
  .control-btn {
    flex: 1;
    min-height: 36px;
    font-size: 13px;
    padding: 8px 12px;
  }
  
  .opacity-slider {
    flex: 1;
  }
  
  .opacity-value {
    min-width: 40px;
    text-align: right;
  }
}

@media (max-width: 480px) {
  .control-panel {
    padding: 8px;
  }
  
  .control-group {
    margin-bottom: 8px;
  }
  
  .control-btn {
    font-size: 12px;
    padding: 6px 10px;
  }
}

/* Ensure map takes full viewport */
:global(.leaflet-container) {
  height: 100vh !important;
  width: 100vw !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  z-index: 1 !important;
}

/* Ensure map tiles render properly */
:global(.leaflet-tile-container) {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
}

:global(.leaflet-tile) {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  width: 256px !important;
  height: 256px !important;
}

/* Customize Leaflet attribution */
:global(.leaflet-control-attribution) {
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(5px);
  border-radius: 4px;
  font-size: 11px;
}
</style>