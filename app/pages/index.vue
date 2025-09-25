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
          <p class="text-sm text-gray-700">{{ period.detailedForecast }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';

// Reactive state
const city = ref('New York');
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

async function selectRecentLocation(location) {
  city.value = location.name;
  
  // Update the location in localStorage (move to top of recent list)
  saveLocationToStorage(location.name, { lat: location.lat, lng: location.lng });
  
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
    // Try to geocode the location with improved logic
    const coordinates = await geocodeLocation(locationQuery);
    if (coordinates) {
      // Get a better display name for the location
      const displayName = await getLocationDisplayName(coordinates.lat, coordinates.lng, locationQuery);
      city.value = displayName;
      
      // Save to localStorage
      saveLocationToStorage(displayName, coordinates);
      
      // Get weather data
      await getWeatherData(coordinates.lat, coordinates.lng);
    } else {
      error.value = 'Location not found. Please try a different city name.';
      // Revert to previous city name on error
      city.value = recentLocations.value.length > 0 ? recentLocations.value[0].name : 'New York';
    }
  } catch (err) {
    error.value = `Error finding location: ${err.message}`;
    // Revert to previous city name on error
    city.value = recentLocations.value.length > 0 ? recentLocations.value[0].name : 'New York';
  } finally {
    isLookingUpLocation.value = false;
  }
}

// Improved geocoding function with better error handling and results
async function geocodeLocation(query) {
  try {
    // Using OpenStreetMap Nominatim API with improved parameters
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&extratags=1`,
      {
        headers: {
          'User-Agent': 'RitualWeather/1.0' // Required by Nominatim
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding service error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      // Prefer results with higher importance scores and better address details
      const bestResult = data.reduce((best, current) => {
        const currentScore = (current.importance || 0) + (current.address ? 0.1 : 0);
        const bestScore = (best.importance || 0) + (best.address ? 0.1 : 0);
        return currentScore > bestScore ? current : best;
      });
      
      return {
        lat: parseFloat(bestResult.lat),
        lng: parseFloat(bestResult.lon),
        displayName: bestResult.display_name,
        address: bestResult.address
      };
    }
    return null;
  } catch (err) {
    console.error('Geocoding error:', err);
    throw new Error('Failed to find location. Please check your internet connection and try again.');
  }
}

// Reverse geocoding to get a better display name
async function getLocationDisplayName(lat, lng, originalQuery) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RitualWeather/1.0'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        // Create a nice display name
        if (addr.city || addr.town || addr.village) {
          const city = addr.city || addr.town || addr.village;
          const state = addr.state || addr.region;
          const country = addr.country;
          return state ? `${city}, ${state}` : `${city}, ${country}`;
        }
      }
    }
  } catch (err) {
    console.warn('Reverse geocoding failed:', err);
  }
  
  // Fallback to original query
  return originalQuery;
}

// Function to get weather data
async function getWeatherData(latitude, longitude) {
  try {
    loading.value = true;
    error.value = null;
    
    // Step 1: Get grid info
    const pointsResponse = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`);
    if (!pointsResponse.ok) {
      throw new Error('Failed to get location data');
    }
    const pointsData = await pointsResponse.json();
    
    // Step 2: Get forecast
    const forecastUrl = pointsData.properties.forecast;
    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) {
      throw new Error('Failed to get forecast data');
    }
    const forecast = await forecastResponse.json();
    
    displayWeather(forecast.properties.periods);
  } catch (err) {
    error.value = `Error loading weather: ${err.message}`;
    loading.value = false;
  }
}

// Initialize app with location and weather
async function initializeApp() {
  // Load recent locations from localStorage
  loadLocationsFromStorage();
  
  // Try to get user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async function(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        console.log(`Precise location: ${lat}, ${lon}`);
        
        // Get a better display name for the coordinates
        const displayName = await getLocationDisplayName(lat, lon, `${lat}, ${lon}`);
        city.value = displayName;
        
        // Save to localStorage
        saveLocationToStorage(displayName, { lat, lng: lon });
        
        // Get weather data for this location
        await getWeatherData(lat, lon);
      },
      async function(error) {
        console.log("User denied geolocation or error occurred:", error);
        
        // Try to get location from IP
        const location = await getVisitorLocation();
        if (location) {
          const displayName = `${location.city}, ${location.region}`;
          city.value = displayName;
          
          // Save to localStorage
          saveLocationToStorage(displayName, { lat: location.latitude, lng: location.longitude });
          
          // Get weather data for fallback location
          await getWeatherData(location.latitude, location.longitude);
        } else {
          // Final fallback - use a default location
          city.value = 'New York, NY';
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
      const displayName = `${location.city}, ${location.region}`;
      city.value = displayName;
      await getWeatherData(location.latitude, location.longitude);
    } else {
      city.value = 'New York, NY';
      await getWeatherData(40.7128, -74.0060);
    }
  }
}

// Initialize the app
initializeApp();

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

</script>