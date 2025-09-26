import { Redis } from '@upstash/redis'
import { NWSClient } from './nws'
import { forwardGeocode, reverseGeocode, normalizeCoordinates } from './geocoding'
import type { WeatherData, LocationInput } from '~/types/weather'

export class WeatherService {
  private nws = new NWSClient()
  private cacheTimeout = 900 // 15 minutes
  private redis: Redis | null = null
  
  constructor() {
    // Initialize Redis only if environment variables are available
    if (process.env.NUXT_UPSTASH_REDIS_REST_URL && process.env.NUXT_UPSTASH_REDIS_REST_TOKEN) {
      try {
        this.redis = new Redis({
          url: process.env.NUXT_UPSTASH_REDIS_REST_URL,
          token: process.env.NUXT_UPSTASH_REDIS_REST_TOKEN,
        })
      } catch (error) {
        console.error('Failed to initialize Redis client:', error)
        this.redis = null
      }
    }
  }
  
  async getWeather(input: LocationInput): Promise<WeatherData> {
    // Step 1: Normalize input to coordinates and location name
    let coordinates: [number, number]
    let locationName: string
    
    if (input.type === 'coordinates') {
      coordinates = input.coordinates!
      
      // Always reverse geocode coordinates to get location name for caching
      try {
        locationName = await reverseGeocode(coordinates[0], coordinates[1])
      } catch {
        // If reverse geocoding fails, don't cache - return coordinates as fallback
        locationName = `${coordinates[0].toFixed(3)}, ${coordinates[1].toFixed(3)}`
      }
    } else {
      coordinates = await forwardGeocode(input.query!)
      locationName = input.query!
    }
    
    // Always use location name as cache key - never cache raw coordinates
    // This ensures meaningful, reusable cache entries
    const cacheKey = `weather:${locationName.toLowerCase().trim()}`
    
    // Step 2: Check cache (only if we have a meaningful location name)
    const shouldCache = !locationName.includes(',') || locationName !== `${coordinates[0].toFixed(3)}, ${coordinates[1].toFixed(3)}`
    
    if (shouldCache) {
      const cached = await this.getCachedWeather(cacheKey)
      if (cached) {
        return cached
      }
    }
    
    // Step 3: Fetch fresh data
    const weatherData = await this.fetchFreshWeather(coordinates, locationName)
    
    // Step 4: Cache the result (only if we have a meaningful location name)
    if (shouldCache) {
      await this.cacheWeather(cacheKey, weatherData)
    }
    
    return weatherData
  }
  
  private async getCachedWeather(cacheKey: string): Promise<WeatherData | null> {
    try {
      // Check if Upstash Redis is configured
      if (!this.redis) {
        console.log('Upstash Redis not configured, skipping cache')
        return null
      }
      
      const cached = await this.redis.get<WeatherData>(cacheKey)
      if (!cached) return null
      
      const age = Date.now() - new Date(cached.lastUpdated).getTime()
      if (age > this.cacheTimeout * 1000) {
        await this.redis.del(cacheKey) // Clean up stale data
        return null
      }
      
      // Add cache metadata
      return {
        ...cached,
        _cache: {
          isCached: true,
          cacheAge: Math.round(age / 1000), // age in seconds
          cacheKey
        }
      }
    } catch (error) {
      console.error('Cache read error:', error)
      return null
    }
  }
  
  private async fetchFreshWeather(coordinates: [number, number], locationName: string): Promise<WeatherData> {
    const [lat, lon] = coordinates
    
    // Get NWS point data
    const pointData = await this.nws.getPointData(lat, lon)
    
    // Fetch forecast, current conditions, and alerts in parallel
    const [forecastData, currentData, alerts] = await Promise.all([
      this.nws.getForecast(pointData.properties.forecast),
      this.nws.getCurrentConditions(lat, lon).catch(() => null),
      this.nws.getAlerts(lat, lon)
    ])
    
    // Transform NWS data to our format
    return this.transformNWSData(forecastData, currentData, alerts, coordinates, locationName)
  }
  
  private transformNWSData(forecastData: any, currentData: any, alerts: any[], coordinates: [number, number], locationName: string): WeatherData {
    // Add safety checks for the forecast data structure
    if (!forecastData || !forecastData.properties || !forecastData.properties.periods) {
      throw new Error('Invalid forecast data received from NWS API')
    }
    
    const periods = forecastData.properties.periods
    
    if (!Array.isArray(periods) || periods.length === 0) {
      throw new Error('No forecast periods available')
    }
    
    // Group periods by date and combine day/night data
    const dailyForecasts = this.combineDayNightPeriods(periods)
    
    // Get current temperature - convert from Celsius to Fahrenheit if needed
    let currentTemp = 0
    if (currentData?.properties?.temperature?.value) {
      currentTemp = currentData.properties.temperature.value
      // If the unit is Celsius, convert to Fahrenheit
      if (currentData.properties.temperature.unitCode === 'wmoUnit:degC') {
        currentTemp = (currentTemp * 9/5) + 32
      }
    } else if (periods[0]?.temperature) {
      currentTemp = periods[0].temperature
    }
    
    return {
      location: locationName,
      coordinates,
      current: {
        temperature: Math.round(currentTemp),
        conditions: currentData?.properties?.textDescription || periods[0]?.shortForecast || 'Unknown',
        humidity: currentData?.properties?.relativeHumidity?.value || 0
      },
      forecast: dailyForecasts, // Show all available forecast periods
      alerts: alerts || [],
      lastUpdated: new Date().toISOString(),
      _cache: {
        isCached: false,
        cacheAge: 0,
        cacheKey: null
      }
    }
  }
  
  private combineDayNightPeriods(periods: any[]): any[] {
    // Return all available day and night periods for validation
    return periods.map((period: any) => ({
      date: period.startTime.split('T')[0],
      time: period.name, // "Today", "Tonight", "Tomorrow", etc.
      temperature: period.temperature,
      temperatureUnit: period.temperatureUnit,
      conditions: period.shortForecast,
      isDaytime: period.isDaytime,
      detailedForecast: period.detailedForecast,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection,
      icon: period.icon,
      probabilityOfPrecipitation: period.probabilityOfPrecipitation?.value || 0
    }))
  }
  
  private async cacheWeather(cacheKey: string, data: WeatherData): Promise<void> {
    try {
      // Check if Upstash Redis is configured
      if (!this.redis) {
        console.log('Upstash Redis not configured, skipping cache write')
        return
      }
      
      await this.redis.setex(cacheKey, this.cacheTimeout, JSON.stringify(data))
    } catch (error) {
      console.error('Cache write error:', error)
      // Don't throw - weather data is more important than caching
    }
  }
}
