<template>
  <div class="p-4">
    <h1 class="text-3xl font-semibold">Daily Weather Forecast for <span class="font-serif font-normal italic underline">{{ city }}</span></h1>
    
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

// Function to display weather data
function displayWeather(periods) {
  weatherData.value = periods;
  loading.value = false;
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

// Get user location and weather
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    async function(position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      console.log(`Precise location: ${lat}, ${lon}`);
      city.value = `${lat}, ${lon}`;
      
      // Get weather data for this location
      await getWeatherData(lat, lon);
    },
    async function(error) {
      console.log("User denied geolocation");
      const location = await getVisitorLocation();
      if (location) {
        city.value = `${location.city}, ${location.region}, ${location.country}`;
        // Get weather data for fallback location
        await getWeatherData(location.latitude, location.longitude);
      }
    }
  );
}

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