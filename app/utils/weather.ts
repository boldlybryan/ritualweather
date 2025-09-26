import { kv } from '@vercel/kv'
import { NWSClient } from './nws'
import { forwardGeocode, reverseGeocode, normalizeCoordinates } from './geocoding'
import type { WeatherData, LocationInput } from '~/types/weather'

export class WeatherService {
  private nws = new NWSClient()
  private cacheTimeout = 1800 // 30 minutes
  
  async getWeather(input: LocationInput): Promise<WeatherData> {
    // Step 1: Normalize input to coordinates and location name
    let coordinates: [number, number]
    let locationName: string
    let cacheKey: string
    
    if (input.type === 'coordinates') {
      coordinates = input.coordinates!
      // Try reverse geocoding for cache key, fallback to normalized coords
      try {
        locationName = await reverseGeocode(coordinates[0], coordinates[1])
        cacheKey = `weather:${locationName}`
      } catch {
        locationName = `${coordinates[0].toFixed(3)}, ${coordinates[1].toFixed(3)}`
        cacheKey = `weather:${normalizeCoordinates(coordinates[0], coordinates[1])}`
      }
    } else {
      coordinates = await forwardGeocode(input.query!)
      locationName = input.query!
      cacheKey = `weather:${locationName.toLowerCase().trim()}`
    }
    
    // Step 2: Check cache
    const cached = await this.getCachedWeather(cacheKey)
    if (cached) return cached
    
    // Step 3: Fetch fresh data
    const weatherData = await this.fetchFreshWeather(coordinates, locationName)
    
    // Step 4: Cache the result
    await this.cacheWeather(cacheKey, weatherData)
    
    return weatherData
  }
  
  private async getCachedWeather(cacheKey: string): Promise<WeatherData | null> {
    try {
      // Check if KV is configured
      if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log('Vercel KV not configured, skipping cache')
        return null
      }
      
      const cached = await kv.get<WeatherData>(cacheKey)
      if (!cached) return null
      
      const age = Date.now() - new Date(cached.lastUpdated).getTime()
      if (age > this.cacheTimeout * 1000) {
        await kv.del(cacheKey) // Clean up stale data
        return null
      }
      
      return cached
    } catch (error) {
      console.error('Cache read error:', error)
      return null
    }
  }
  
  private async fetchFreshWeather(coordinates: [number, number], locationName: string): Promise<WeatherData> {
    const [lat, lon] = coordinates
    
    // Get NWS point data
    const pointData = await this.nws.getPointData(lat, lon)
    
    // Fetch forecast and current conditions in parallel
    const [forecastData, currentData] = await Promise.all([
      this.nws.getForecast(pointData.properties.forecast),
      this.nws.getCurrentConditions(lat, lon).catch(() => null)
    ])
    
    // Transform NWS data to our format
    return this.transformNWSData(forecastData, currentData, coordinates, locationName)
  }
  
  private transformNWSData(forecastData: any, currentData: any, coordinates: [number, number], locationName: string): WeatherData {
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
      lastUpdated: new Date().toISOString()
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
      // Check if KV is configured
      if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.log('Vercel KV not configured, skipping cache write')
        return
      }
      
      await kv.setex(cacheKey, this.cacheTimeout, JSON.stringify(data))
    } catch (error) {
      console.error('Cache write error:', error)
      // Don't throw - weather data is more important than caching
    }
  }
}
