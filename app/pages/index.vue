<template>
  <div class="p-4">
    <h1 class="text-3xl font-semibold">Daily Weather Forecast for 
      <span v-if="!isEditingLocation" 
            @click="startEditingLocation" 
            class="font-serif font-normal italic underline cursor-pointer hover:bg-gray-100 py-1 rounded transition-colors">
        {{ city }}
        <span v-if="isLookingUpLocation" class="ml-2 text-sm text-blue-500">(looking up...)</span>
      </span>
      <div v-else class="inline-block relative">
        <input v-model="newLocation" 
               @keyup.enter="updateLocation" 
               @keyup.escape="cancelEditing"
               @blur="handleBlur"
               class="font-serif font-normal italic border-b-2 border-blue-500 bg-transparent py-1 text-3xl focus:outline-none"
               placeholder="Enter city name"
               ref="locationInput">
        
        <!-- Recent locations dropdown -->
        <div v-if="showLocationSuggestions && recentLocations.length > 0" 
             class="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-64"
             @mousedown.prevent>
          <div class="p-2 text-sm text-gray-600 border-b">Recent locations:</div>
          <div v-for="location in recentLocations" 
               :key="location.timestamp"
               @mousedown.prevent
               @click="selectRecentLocation(location)"
               class="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0">
            <div class="font-medium">{{ location.name }}</div>
            <div class="text-sm text-gray-500">{{ new Date(location.timestamp).toLocaleDateString() }}</div>
          </div>
        </div>
      </div>
    </h1>
    
    <!-- Loading state -->
    <div v-if="loading" class="mt-4 text-center">
      <p class="text-lg">Loading weather data...</p>
    </div>
    
    <!-- Error state -->
    <div v-if="error" class="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      <p>{{ error }}</p>
    </div>
    
    <!-- Weather data -->
    <div v-if="weatherData && !loading" class="mt-6">
      <!-- Cache status indicator -->
      <div v-if="weatherData._cache" class="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div :class="weatherData._cache.isCached ? 'text-green-600' : 'text-blue-600'" class="flex items-center">
              <svg v-if="weatherData._cache.isCached" class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clip-rule="evenodd"></path>
              </svg>
              <svg v-else class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-sm font-medium">
                {{ weatherData._cache.isCached ? 'Cached Data' : 'Fresh Data' }}
              </span>
            </div>
            <span class="text-xs text-gray-500">
              {{ weatherData._cache.isCached ? `Updated ${formatCacheAge(weatherData._cache.cacheAge)} ago` : 'Just fetched' }}
            </span>
          </div>
          <div class="text-xs text-gray-500">
            Last updated: {{ formatLastUpdated(weatherData.lastUpdated) }}
          </div>
        </div>
      </div>
      
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="period in weatherData" :key="period.number" 
             class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 class="text-lg font-semibold mb-2">{{ period.name }}</h3>
          <div class="flex items-center mb-2">
            <img :src="period.icon" :alt="period.shortForecast" class="w-12 h-12 mr-3">
            <div>
              <p class="text-2xl font-bold">{{ period.temperature }}{{ period.temperatureUnit }}</p>
              <p class="text-sm text-gray-600">{{ period.shortForecast }}</p>
            </div>
          </div>
          <p class="text-sm text-gray-700 mb-2">{{ period.detailedForecast }}</p>
          <div class="text-xs text-gray-500 space-y-1">
            <p><strong>Wind:</strong> {{ period.windSpeed }} {{ period.windDirection }}</p>
            <p><strong>Precipitation:</strong> {{ period.probabilityOfPrecipitation }}%</p>
            <p><strong>Time:</strong> {{ period.isDaytime ? 'Day' : 'Night' }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';

// Reactive state
const city = ref('');
const weatherData = ref(null);
const loading = ref(false);
const error = ref(null);
const isEditingLocation = ref(false);
const newLocation = ref('');
const locationInput = ref(null);
const recentLocations = ref([]);
const showLocationSuggestions = ref(false);
const isLookingUpLocation = ref(false);

// Function to display weather data
function displayWeather(periods) {
  weatherData.value = periods;
  loading.value = false;
}

    // localStorage functions
    function saveLocationToStorage(locationName, coordinates) {
      const locationData = {
        name: locationName,
        lat: coordinates.lat,
        lng: coordinates.lng,
        timestamp: Date.now()
      };
      
      // Get existing locations
      const existing = JSON.parse(localStorage.getItem('recentLocations') || '[]');
      
      // Remove if already exists (to avoid duplicates)
      const filtered = existing.filter(loc => loc.name !== locationName);
      
      // Add to beginning and limit to 10 locations
      const updated = [locationData, ...filtered].slice(0, 10);
      
      localStorage.setItem('recentLocations', JSON.stringify(updated));
      recentLocations.value = updated;
    }

    function loadLocationsFromStorage() {
      const stored = localStorage.getItem('recentLocations');
      if (stored) {
        recentLocations.value = JSON.parse(stored);
      }
    }

    // sessionStorage functions for current session location
    function saveCurrentLocationToSession(locationName, coordinates) {
      const locationData = {
        name: locationName,
        lat: coordinates.lat,
        lng: coordinates.lng,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem('currentLocation', JSON.stringify(locationData));
    }

    function loadCurrentLocationFromSession() {
      const stored = sessionStorage.getItem('currentLocation');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Error parsing current location from session:', e);
          return null;
        }
      }
      return null;
    }

    function clearCurrentLocationFromSession() {
      sessionStorage.removeItem('currentLocation');
    }

    // Function to reset to geolocation (clear session and reload)
    function resetToGeolocation() {
      clearCurrentLocationFromSession();
      // Reload the page to trigger geolocation again
      window.location.reload();
    }

async function selectRecentLocation(location) {
  city.value = location.name;
  
  // Update the location in localStorage (move to top of recent list)
  saveLocationToStorage(location.name, { lat: location.lat, lng: location.lng });
  
  // Save current location to session storage
  saveCurrentLocationToSession(location.name, { lat: location.lat, lng: location.lng });
  
  // Get weather data for the selected location
  await getWeatherData(location.lat, location.lng);
  
  // Close the suggestions dropdown and exit edit mode
  showLocationSuggestions.value = false;
  isEditingLocation.value = false;
}

// Location editing functions
function startEditingLocation() {
  isEditingLocation.value = true;
  newLocation.value = city.value;
  showLocationSuggestions.value = true;
  loadLocationsFromStorage();
  
  // Focus the input after the DOM updates
  setTimeout(() => {
    if (locationInput.value) {
      locationInput.value.focus();
      locationInput.value.select();
    }
  }, 0);
}

function cancelEditing() {
  isEditingLocation.value = false;
  newLocation.value = '';
  showLocationSuggestions.value = false;
}

function handleBlur() {
  // Add a small delay to allow click events on dropdown to fire first
  setTimeout(() => {
    if (showLocationSuggestions.value) {
      // If suggestions are still showing, it means user clicked outside
      updateLocation();
    }
  }, 150);
}

async function updateLocation() {
  if (!newLocation.value.trim()) {
    cancelEditing();
    return;
  }
  
  const locationQuery = newLocation.value.trim();
  
  // Keep the user's input visible during lookup
  city.value = locationQuery;
  isEditingLocation.value = false;
  showLocationSuggestions.value = false;
  newLocation.value = '';
  isLookingUpLocation.value = true;
  
  try {
    // Use our new weather service for search-based queries
    const weatherData = await $fetch('/api/weather', {
      method: 'POST',
      body: {
        type: 'search',
        query: locationQuery
      }
    });
    
    // Update city name with the normalized location from the service
    city.value = weatherData.location;
    
    // Save to localStorage using the coordinates from the weather data
    saveLocationToStorage(weatherData.location, { 
      lat: weatherData.coordinates[0], 
      lng: weatherData.coordinates[1] 
    });
    
    // Save current location to session storage
    saveCurrentLocationToSession(weatherData.location, { 
      lat: weatherData.coordinates[0], 
      lng: weatherData.coordinates[1] 
    });
    
    // Transform and display the weather data
    const periods = weatherData.forecast.map((period, index) => ({
      number: index + 1,
      name: period.time, // Use the NWS period name (Today, Tonight, Tomorrow, etc.)
      temperature: period.temperature,
      temperatureUnit: period.temperatureUnit,
      shortForecast: period.conditions,
      detailedForecast: period.detailedForecast,
      icon: period.icon, // Use the NWS icon directly
      isDaytime: period.isDaytime,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection,
      probabilityOfPrecipitation: period.probabilityOfPrecipitation
    }));
    
    // Create the complete weather data object with cache information
    const completeWeatherData = {
      ...periods,
      _cache: weatherData._cache,
      lastUpdated: weatherData.lastUpdated
    };
    
    displayWeather(completeWeatherData);
    
  } catch (err) {
    error.value = `Error finding location: ${err.message}`;
    // Revert to previous city name on error
    city.value = recentLocations.value.length > 0 ? recentLocations.value[0].name : 'New York';
  } finally {
    isLookingUpLocation.value = false;
  }
}

// Note: Geocoding is now handled by our weather service

// Function to get weather data using our new weather service
async function getWeatherData(latitude, longitude) {
  try {
    loading.value = true;
    error.value = null;
    
    const weatherData = await $fetch('/api/weather', {
      method: 'POST',
      body: {
        type: 'coordinates',
        coordinates: [latitude, longitude]
      }
    });
    
    // Update city name with the normalized location from the service
    city.value = weatherData.location;
    
    // Save to localStorage using the coordinates from the weather data
    saveLocationToStorage(weatherData.location, { 
      lat: weatherData.coordinates[0], 
      lng: weatherData.coordinates[1] 
    });
    
    // Save current location to session storage
    saveCurrentLocationToSession(weatherData.location, { 
      lat: weatherData.coordinates[0], 
      lng: weatherData.coordinates[1] 
    });
    
    // Transform the weather data to match the expected format
    const periods = weatherData.forecast.map((period, index) => ({
      number: index + 1,
      name: period.time, // Use the NWS period name (Today, Tonight, Tomorrow, etc.)
      temperature: period.temperature,
      temperatureUnit: period.temperatureUnit,
      shortForecast: period.conditions,
      detailedForecast: period.detailedForecast,
      icon: period.icon, // Use the NWS icon directly
      isDaytime: period.isDaytime,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection,
      probabilityOfPrecipitation: period.probabilityOfPrecipitation
    }));
    
    // Create the complete weather data object with cache information
    const completeWeatherData = {
      ...periods,
      _cache: weatherData._cache,
      lastUpdated: weatherData.lastUpdated
    };
    
    displayWeather(completeWeatherData);
  } catch (err) {
    error.value = `Error loading weather: ${err.message}`;
    loading.value = false;
  }
}

// Helper function to get weather icons based on conditions
function getWeatherIcon(conditions) {
  const condition = conditions.toLowerCase();
  if (condition.includes('sunny') || condition.includes('clear')) {
    return 'https://api.weather.gov/icons/land/day/skc?size=medium';
  } else if (condition.includes('cloudy') || condition.includes('overcast')) {
    return 'https://api.weather.gov/icons/land/day/ovc?size=medium';
  } else if (condition.includes('rain') || condition.includes('shower')) {
    return 'https://api.weather.gov/icons/land/day/ra?size=medium';
  } else if (condition.includes('snow')) {
    return 'https://api.weather.gov/icons/land/day/snw?size=medium';
  } else if (condition.includes('thunderstorm') || condition.includes('storm')) {
    return 'https://api.weather.gov/icons/land/day/tsra?size=medium';
  } else if (condition.includes('fog') || condition.includes('mist')) {
    return 'https://api.weather.gov/icons/land/day/fg?size=medium';
  } else {
    return 'https://api.weather.gov/icons/land/day/sct?size=medium'; // Partly cloudy default
  }
}

// Initialize app with location and weather
async function initializeApp() {
  // Load recent locations from localStorage
  loadLocationsFromStorage();
  
  // Set a loading state for city name
  city.value = 'Loading location...';
  
  // Try to get user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async function(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        console.log(`Precise location: ${lat}, ${lon}`);
        
        // Get weather data for this location (this will also get the proper display name)
        await getWeatherData(lat, lon);
      },
      async function(error) {
        console.log("User denied geolocation or error occurred:", error);
        
        // Try to get location from IP
        const location = await getVisitorLocation();
        if (location) {
          // Get weather data for fallback location (this will set the proper city name)
          await getWeatherData(location.latitude, location.longitude);
        } else {
          // Final fallback - use a default location
          city.value = 'New York'; // Set fallback city name
          await getWeatherData(40.7128, -74.0060); // NYC coordinates
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  } else {
    // Browser doesn't support geolocation
    const location = await getVisitorLocation();
    if (location) {
      await getWeatherData(location.latitude, location.longitude);
    } else {
      // Final fallback - use a default location
      city.value = 'New York'; // Set fallback city name
      await getWeatherData(40.7128, -74.0060);
    }
  }
}

// Initialize the app when component mounts (client-side only)
onMounted(() => {
  // Check session storage immediately for instant location restore
  const savedLocation = loadCurrentLocationFromSession();
  if (savedLocation) {
    console.log('Instantly restoring location from session:', savedLocation.name);
    city.value = savedLocation.name;
    // Load weather data asynchronously
    getWeatherData(savedLocation.lat, savedLocation.lng);
    return;
  }
  
  // If no saved location, proceed with normal initialization
  initializeApp();
});

async function getVisitorLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        return {
            city: data.city,
            region: data.region,
            country: data.country_name,
            countryCode: data.country_code,
            latitude: data.latitude,
            longitude: data.longitude
        };
    } catch (error) {
        console.log('Geolocation failed:', error);
        return null;
    }
}

// Helper functions for cache display
function formatCacheAge(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h`;
  }
}

function formatLastUpdated(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}


</script>