<template>
  <div class="p-4">
    <div class="text-center">
      <!-- Current time in location's timezone -->
      <div v-if="currentTimeInLocation" class="text-sm text-gray-600 mb-1">
        {{ currentTimeInLocation }}
      </div>
      <h1 class="text-3xl font-semibold">
        <span v-if="!isEditingLocation"
              @click="startEditingLocation"
              class="font-semibold tracking-tight cursor-pointer hover:bg-gray-100 py-1 rounded transition-colors">
          {{ city }}
        </span>
        <div v-else class="inline-block relative">
          <input v-model="newLocation"
                 @keyup.enter="updateLocation"
                 @keyup.escape="cancelEditing"
                 @blur="handleBlur"
                 class="font-semibold tracking-tight text-center border-b-2 border-blue-500 bg-transparent text-3xl focus:outline-none"
                 placeholder="Enter city name"
                 ref="locationInput">
      
          <!-- Recent locations dropdown -->
          <div v-if="showLocationSuggestions && recentLocations.length > 0"
               class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-64">
            <div class="p-2 text-sm text-gray-600 border-b text-left">Recent locations</div>
            <div v-for="location in recentLocations"
                 :key="location.timestamp"
                 class="p-3 hover:bg-gray-100 border-b last:border-b-0 flex items-center justify-between group">
              <div @click="selectRecentLocation(location)" class="flex-1 cursor-pointer">
                <div class="text-base font-semibold text-left">{{ location.name }}</div>
              </div>
              <button
                @click.stop="deleteLocationFromStorage(location)"
                class="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors touch-manipulation"
                title="Delete location">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </h1>
      <div v-if="weatherData && !loading" class="flex flex-col gap-0.5">
        <div class="text-[4rem] font-bold tracking-tight ml-4 leading-none mt-1">{{ weatherData.current.temperature }}°</div>
        <div class="text-lg font-semibold">{{ weatherData.current.conditions }}</div>
      </div>
    </div>
    
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
      <!-- Weather Alerts -->
      <div v-if="weatherData.alerts && weatherData.alerts.length > 0" class="mb-6">
        <div class="space-y-3">
          <div v-for="alert in weatherData.alerts" :key="alert.id" 
               :class="getAlertStyling(alert.severity)"
               class="rounded-lg border-l-4 shadow-sm">
            <!-- Alert Header (Always Visible) -->
            <div class="p-4 cursor-pointer" @click="toggleAlert(alert.id)">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <svg class="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                  </svg>
                  <h3 class="font-semibold text-lg">{{ alert.event }}</h3>
                  <span :class="getSeverityBadgeStyling(alert.severity)" 
                        class="ml-2 px-2 py-1 text-xs font-medium rounded-full">
                    {{ alert.severity }}
                  </span>
                </div>
                <!-- Expand/Collapse Icon -->
                <svg class="w-5 h-5 transition-transform duration-200" 
                     :class="{ 'rotate-180': isAlertExpanded(alert.id) }"
                     fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <!-- Summary line (always visible) -->
              <p v-if="alert.headline" class="font-medium mt-2 text-sm">{{ alert.headline }}</p>
            </div>
            
            <!-- Alert Details (Collapsible) -->
            <div v-if="isAlertExpanded(alert.id)" class="px-4 pb-4 border-t border-current border-opacity-20">
              <div class="pt-3 space-y-3">
                <p class="text-sm whitespace-pre-line">{{ alert.description }}</p>
                <div v-if="alert.instruction" class="text-sm font-medium">
                  <strong>Instructions:</strong>
                  <p class="whitespace-pre-line mt-1">{{ alert.instruction }}</p>
                </div>
                <div class="text-xs space-y-1">
                  <p><strong>Effective:</strong> {{ formatAlertTime(alert.effective) }}</p>
                  <p><strong>Expires:</strong> {{ formatAlertTime(alert.expires) }}</p>
                  <p v-if="alert.areas.length > 0"><strong>Areas:</strong> {{ alert.areas.join(', ') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      
      <!-- Current Conditions Card -->
      <div v-if="weatherData.current" class="mb-6">
        <div class="bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.05)] rounded-lg p-4">
          <div class="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-4">

            <!-- Temperature -->
            <div v-if="weatherData.current.temperature" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Temperature</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.temperature }}°F</div>
            </div>
            
            <!-- Humidity -->
            <div v-if="weatherData.current.humidity" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Humidity</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ Math.round(weatherData.current.humidity) }}%</div>
            </div>
            
            <!-- Pressure -->
            <div v-if="weatherData.current.pressure" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Pressure</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.pressure.toFixed(2) }} in</div>
            </div>
            
            <!-- Visibility -->
            <div v-if="weatherData.current.visibility" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Visibility</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.visibility.toFixed(1) }} mi</div>
            </div>
            
            <!-- Wind -->
            <div v-if="weatherData.current.windSpeed" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Wind</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.windDirection || 'N' }} {{ weatherData.current.windSpeed }} mph</div>
            </div>
            
            <!-- Dewpoint -->
            <div v-if="weatherData.current.dewPoint" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Dewpoint</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.dewPoint }}°</div>
            </div>
            
            <!-- UV Index -->
            <div v-if="weatherData.current.uvIndex" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">UV Index</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.uvIndex }}</div>
            </div>
            
            <!-- Sunrise -->
            <div v-if="weatherData.current.sunrise" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Sunrise</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.sunrise }}</div>
            </div>
            
            <!-- Sunset -->
            <div v-if="weatherData.current.sunset" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Sunset</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.sunset }}</div>
            </div>
            
            <!-- Moon Phase -->
            <div v-if="weatherData.current.moonPhase" class="flex flex-col gap-0.5">
              <div class="text-xs font-medium text-black">Moon</div>
              <div class="text-xl font-bold text-[rgba(0,0,0,0.9)] tracking-tight">{{ weatherData.current.moonPhase }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Hourly Forecast Section -->
      <div v-if="weatherData.hourlyForecast && weatherData.hourlyForecast.length > 0" class="mb-6">
        <h2 class="text-lg font-bold text-black mb-2 tracking-tight">24-Hour Forecast</h2>
        
        <div class="flex gap-2.5 overflow-x-auto">
          <div v-for="hour in weatherData.hourlyForecast" :key="hour.time" 
               class=" flex flex-col justify-between bg-[rgba(0,0,0,0.03)] rounded-lg shrink-0 w-[114px] h-[114px] border border-[rgba(0,0,0,0.05)] pt-[10px] pb-1">
            <!-- Time -->
            <div class="text-xs font-semibold text-black text-center tracking-tight">
              {{ hour.time }}
            </div>
            
            <!-- Temperature and Conditions -->
            <div class="text-center">
              <div class="text-4xl font-bold text-black tracking-tight leading-none">
                &nbsp;&nbsp;{{ hour.temperature }}°
              </div>
              <div class="text-xs font-semibold text-black tracking-tight">
                {{ hour.conditions }}
              </div>
            </div>
            
            <!-- Precipitation Percentage -->
            <div class="text-xs font-medium text-black text-center tracking-tight">
              {{ hour.probabilityOfPrecipitation }}%
            </div>
          </div>
        </div>
      </div>
      <h2 class="text-xl font-semibold mb-3">The next 7 days</h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="period in weatherData.forecast" :key="period.number" 
             class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 class="text-lg font-semibold mb-2">{{ period.name }}</h3>
          <div class="flex items-center mb-2">
            <img :src="period.icon" :alt="period.shortForecast" class="w-12 h-12 mr-3">
            <div>
              <p class="text-2xl font-bold">{{ period.temperature }}{{ period.temperatureUnit }}</p>
              <p class="text-sm text-gray-600">{{ period.shortForecast }}</p>
              <p v-if="period.feelsLike && period.feelsLike !== period.temperature" class="text-xs text-orange-600">
                Feels like {{ period.feelsLike }}°F
              </p>
            </div>
          </div>
          <p class="text-sm text-gray-700 mb-2">{{ period.detailedForecast }}</p>
          
          
          <div class="text-xs text-gray-500 space-y-1">
            <p><strong>Wind:</strong> {{ period.windSpeed }} {{ period.windDirection }}</p>
            <p v-if="period.windGust"><strong>Wind Gust:</strong> {{ period.windGust }}</p>
            <p><strong>Precipitation:</strong> {{ period.probabilityOfPrecipitation }}%</p>
            <p v-if="period.relativeHumidity"><strong>Humidity:</strong> {{ Math.round(period.relativeHumidity) }}%</p>
            <p v-if="period.dewPoint"><strong>Dew Point:</strong> {{ period.dewPoint }}°F</p>
            <p><strong>Time:</strong> {{ period.isDaytime ? 'Day' : 'Night' }}</p>
          </div>
        </div>
      </div>
      <!-- Cache status indicator -->
      <div v-if="weatherData._cache" class="mb-10 mt-5 text-sm text-gray-500 text-center">
        Data last updated: {{ formatLastUpdated(weatherData.lastUpdated) }}
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';

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
const expandedAlerts = ref(new Set());
;
const weatherCache = ref(new Map());

// Computed property for current time in location's timezone
const currentTimeInLocation = computed(() => {
  if (!weatherData.value || !weatherData.value.coordinates) {
    return null;
  }
  
  const [lat, lon] = weatherData.value.coordinates;
  const timezone = weatherData.value.timezone;
  
  // Get current UTC time
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  
  // Calculate timezone offset for the location
  let timezoneOffset = 0;
  if (lon >= -125 && lon <= -66.5) {
    // Continental US
    if (lon >= -125 && lon <= -115) {
      timezoneOffset = -8; // Pacific Standard Time
    } else if (lon >= -115 && lon <= -102) {
      timezoneOffset = -7; // Mountain Standard Time
    } else if (lon >= -102 && lon <= -87) {
      timezoneOffset = -6; // Central Standard Time
    } else {
      timezoneOffset = -5; // Eastern Standard Time
    }
  }
  
  // Adjust for DST (simplified check)
  const month = now.getMonth();
  const isDST = month >= 2 && month <= 9; // Rough DST period (March-October)
  if (isDST) {
    timezoneOffset += 1;
  }
  
  // Convert UTC to location's local time
  const localTime = new Date(utcTime + (timezoneOffset * 60 * 60 * 1000));
  const time = localTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return `${time} ${timezone}`;
});

// Function to display weather data
function displayWeather(periods) {
  weatherData.value = periods;
  loading.value = false;
}

    // localStorage functions
    function saveLocationToStorage(locationName, coordinates) {
      if (typeof window === 'undefined') return; // Skip on server-side
      try {
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
      } catch (e) {
        console.error('Error saving location to storage:', e);
      }
    }

    function loadLocationsFromStorage() {
      if (typeof window === 'undefined') return; // Skip on server-side
      try {
        const stored = localStorage.getItem('recentLocations');
        if (stored) {
          recentLocations.value = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Error loading locations from storage:', e);
      }
    }

    function deleteLocationFromStorage(locationToDelete) {
      if (typeof window === 'undefined') return; // Skip on server-side
      try {
        // Get existing locations
        const existing = JSON.parse(localStorage.getItem('recentLocations') || '[]');
        
        // Filter out the location to delete
        const updated = existing.filter(loc => 
          loc.name !== locationToDelete.name || 
          loc.timestamp !== locationToDelete.timestamp
        );
        
        // Update localStorage
        localStorage.setItem('recentLocations', JSON.stringify(updated));
        
        // Update the reactive array
        recentLocations.value = updated;
        
      } catch (e) {
        console.error('Error deleting location from storage:', e);
      }
    }

    // sessionStorage functions for current session location
    function saveCurrentLocationToSession(locationName, coordinates) {
      if (typeof window === 'undefined') return; // Skip on server-side
      try {
        const locationData = {
          name: locationName,
          lat: coordinates.lat,
          lng: coordinates.lng,
          timestamp: Date.now()
        };
        
        sessionStorage.setItem('currentLocation', JSON.stringify(locationData));
      } catch (e) {
        console.error('Error saving current location to session:', e);
      }
    }

    function loadCurrentLocationFromSession() {
      if (typeof window === 'undefined') return null; // Skip on server-side
      try {
        const stored = sessionStorage.getItem('currentLocation');
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error('Error loading current location from session:', e);
      }
      return null;
    }

    function clearCurrentLocationFromSession() {
      if (typeof window === 'undefined') return; // Skip on server-side
      try {
        sessionStorage.removeItem('currentLocation');
      } catch (e) {
        console.error('Error clearing current location from session:', e);
      }
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
      probabilityOfPrecipitation: period.probabilityOfPrecipitation,
      // Include all the new enhanced fields
      relativeHumidity: period.relativeHumidity,
      dewPoint: period.dewPoint,
      windGust: period.windGust,
      heatIndex: period.heatIndex,
      windChill: period.windChill,
      feelsLike: period.feelsLike,
      barometricPressure: period.barometricPressure,
      visibility: period.visibility,
      skyCover: period.skyCover
    }));
    
    // Create the complete weather data object with cache information
    const completeWeatherData = {
      forecast: periods, // Keep periods as an array in the forecast property
      current: weatherData.current, // Include current conditions
      hourlyForecast: weatherData.hourlyForecast, // Include hourly forecast
      alerts: weatherData.alerts || [], // Ensure alerts are included
      _cache: weatherData._cache,
      lastUpdated: weatherData.lastUpdated,
      location: weatherData.location,
      coordinates: weatherData.coordinates,
      timezone: weatherData.timezone
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
    
    // Check client-side cache first
    const cachedData = getCachedWeather(latitude, longitude);
    if (cachedData) {
      city.value = cachedData.location;
      displayWeather(cachedData);
      loading.value = false;
      
      // Still fetch fresh data in background for next time
      fetchFreshWeatherData(latitude, longitude);
      return;
    }
    
    // No cache, fetch fresh data
    await fetchFreshWeatherData(latitude, longitude);
  } catch (err) {
    error.value = `Error loading weather: ${err.message}`;
    loading.value = false;
  }
}

// Separate function to fetch fresh weather data
async function fetchFreshWeatherData(latitude, longitude) {
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
    probabilityOfPrecipitation: period.probabilityOfPrecipitation,
    // Include all the new enhanced fields
    relativeHumidity: period.relativeHumidity,
    dewPoint: period.dewPoint,
    windGust: period.windGust,
    heatIndex: period.heatIndex,
    windChill: period.windChill,
    feelsLike: period.feelsLike,
    barometricPressure: period.barometricPressure,
    visibility: period.visibility,
    skyCover: period.skyCover
  }));
  
  // Create the complete weather data object with cache information
  const completeWeatherData = {
    forecast: periods, // Keep periods as an array in the forecast property
    current: weatherData.current, // Include current conditions
    hourlyForecast: weatherData.hourlyForecast, // Include hourly forecast
    alerts: weatherData.alerts || [], // Ensure alerts are included
    _cache: weatherData._cache,
    lastUpdated: weatherData.lastUpdated,
      location: weatherData.location,
      coordinates: weatherData.coordinates,
      timezone: weatherData.timezone
  };
  
  // Cache the data for future use
  setCachedWeather(latitude, longitude, completeWeatherData);
  
  displayWeather(completeWeatherData);
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
  // Set a loading state for city name
  city.value = 'Loading location...';
  
  // Try to get user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async function(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        // Get weather data for this location (this will also get the proper display name)
        await getWeatherData(lat, lon);
      },
      async function(error) {
        
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
  // Load recent locations from localStorage first (synchronous)
  loadLocationsFromStorage();
  
  // Check session storage immediately for instant location restore
  const savedLocation = loadCurrentLocationFromSession();
  if (savedLocation) {
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

// Alert styling functions
function getAlertStyling(severity) {
  const severityLower = severity.toLowerCase();
  
  switch (severityLower) {
    case 'extreme':
      return 'bg-red-50 border-red-500 text-red-800';
    case 'severe':
      return 'bg-orange-50 border-orange-500 text-orange-800';
    case 'moderate':
      return 'bg-yellow-50 border-yellow-500 text-yellow-800';
    case 'minor':
      return 'bg-blue-50 border-blue-500 text-blue-800';
    default:
      return 'bg-gray-50 border-gray-500 text-gray-800';
  }
}

function getSeverityBadgeStyling(severity) {
  const severityLower = severity.toLowerCase();
  
  switch (severityLower) {
    case 'extreme':
      return 'bg-red-100 text-red-800';
    case 'severe':
      return 'bg-orange-100 text-orange-800';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-800';
    case 'minor':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatAlertTime(timestamp) {
  if (!timestamp) return 'Unknown';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return 'Invalid date';
  }
}

// Alert toggle functions
function toggleAlert(alertId) {
  if (expandedAlerts.value.has(alertId)) {
    expandedAlerts.value.delete(alertId);
  } else {
    expandedAlerts.value.add(alertId);
  }
}

function isAlertExpanded(alertId) {
  return expandedAlerts.value.has(alertId);
}




// Client-side weather caching functions
function getCacheKey(lat, lng) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function getCachedWeather(lat, lng) {
  const cacheKey = getCacheKey(lat, lng);
  const cached = weatherCache.value.get(cacheKey);
  
  if (cached) {
    const age = Date.now() - cached.timestamp;
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    if (age < maxAge) {
      return cached.data;
    } else {
      // Remove expired cache
      weatherCache.value.delete(cacheKey);
    }
  }
  
  return null;
}

function setCachedWeather(lat, lng, data) {
  const cacheKey = getCacheKey(lat, lng);
  weatherCache.value.set(cacheKey, {
    data: data,
    timestamp: Date.now()
  });
  
  // Limit cache size to 10 locations
  if (weatherCache.value.size > 10) {
    const firstKey = weatherCache.value.keys().next().value;
    weatherCache.value.delete(firstKey);
  }
}


</script>