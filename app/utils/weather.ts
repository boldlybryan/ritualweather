import { Redis } from '@upstash/redis'
import { NWSClient } from './nws'
import { forwardGeocode, reverseGeocode, normalizeCoordinates } from './geocoding'
import { getTimezoneFromCoordinates } from './timezone'
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
    
    // Fetch forecast, hourly forecast, current conditions, and alerts in parallel
    const [forecastData, hourlyForecastData, currentData, alerts] = await Promise.all([
      this.nws.getForecast(pointData.properties.forecast),
      this.nws.getHourlyForecast(pointData.properties.forecastHourly).catch((error) => {
        console.error('Hourly forecast API error:', error)
        return null
      }),
      this.nws.getCurrentConditions(lat, lon).catch(() => null),
      this.nws.getAlerts(lat, lon)
    ])
    
    
    // Transform NWS data to our format
    return this.transformNWSData(forecastData, hourlyForecastData, currentData, alerts, coordinates, locationName)
  }
  
  private transformNWSData(forecastData: any, hourlyForecastData: any, currentData: any, alerts: any[], coordinates: [number, number], locationName: string): WeatherData {
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
    
    // Process hourly forecast data if available
    const hourlyForecasts = hourlyForecastData ? this.processHourlyForecast(hourlyForecastData, coordinates) : undefined
    
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

    // Extract additional current conditions data
    const currentHumidity = currentData?.properties?.relativeHumidity?.value || 0
    const currentDewPoint = currentData?.properties?.dewpoint?.value
    const currentPressure = currentData?.properties?.barometricPressure?.value
    const currentVisibility = currentData?.properties?.visibility?.value
    const currentWindGust = currentData?.properties?.windGust?.value
    const currentHeatIndex = currentData?.properties?.heatIndex?.value
    const currentWindChill = currentData?.properties?.windChill?.value

    // Convert units to proper display format
    // Pressure: Pascals to inches of mercury (divide by 100 to get mb, then multiply by 0.02953)
    const pressureInInches = currentPressure ? (currentPressure / 100) * 0.02953 : undefined
    // Visibility: meters to miles (divide by 1609.34)
    const visibilityInMiles = currentVisibility ? currentVisibility / 1609.34 : undefined
    // Dewpoint: Celsius to Fahrenheit if needed
    let dewPointInF = currentDewPoint
    if (currentDewPoint && currentData?.properties?.dewpoint?.unitCode === 'wmoUnit:degC') {
      dewPointInF = (currentDewPoint * 9/5) + 32
    }

    // Calculate "feels like" temperature
    let feelsLike = currentTemp
    if (currentHeatIndex && currentTemp > 80) {
      feelsLike = currentHeatIndex
    } else if (currentWindChill && currentTemp < 50) {
      feelsLike = currentWindChill
    }
    
    // Get timezone information for the location
    const [lat, lon] = coordinates
    const timezone = getTimezoneFromCoordinates(lat, lon)
    
    return {
      location: locationName,
      coordinates,
      timezone,
      current: {
        temperature: Math.round(currentTemp),
        conditions: currentData?.properties?.textDescription || periods[0]?.shortForecast || 'Unknown',
        humidity: currentHumidity,
        dewPoint: dewPointInF ? Math.round(dewPointInF) : undefined,
        pressure: pressureInInches ? Math.round(pressureInInches * 100) / 100 : undefined, // Round to 2 decimal places
        visibility: visibilityInMiles ? Math.round(visibilityInMiles * 10) / 10 : undefined, // Round to 1 decimal place
        windGust: currentWindGust ? Math.round(currentWindGust) : undefined,
        heatIndex: currentHeatIndex ? Math.round(currentHeatIndex) : undefined,
        windChill: currentWindChill ? Math.round(currentWindChill) : undefined,
        feelsLike: Math.round(feelsLike)
      },
      forecast: dailyForecasts, // Show all available forecast periods
      hourlyForecast: hourlyForecasts, // Show hourly forecast if available
      alerts: alerts || [],
      lastUpdated: new Date().toISOString(),
      _cache: {
        isCached: false,
        cacheAge: 0,
        cacheKey: null
      }
    }
  }
  

  private processHourlyForecast(hourlyForecastData: any, coordinates?: [number, number]): any[] {
    if (!hourlyForecastData?.properties?.periods || !Array.isArray(hourlyForecastData.properties.periods)) {
      return []
    }
    
    const hourlyPeriods = hourlyForecastData.properties.periods
    
    // Limit to next 24 hours for better performance and relevance
    const next24Hours = hourlyPeriods.slice(0, 24)
    
    return next24Hours.map((period: any) => {
      // Extract additional hourly forecast data
      const relativeHumidity = period.relativeHumidity?.value
      const dewPoint = period.dewpoint?.value
      const windGust = period.windGust?.value
      const heatIndex = period.heatIndex?.value
      const windChill = period.windChill?.value
      const barometricPressure = period.barometricPressure?.value
      const visibility = period.visibility?.value
      const skyCover = period.skyCover

      // Convert units to proper display format
      // Pressure: Pascals to inches of mercury (divide by 100 to get mb, then multiply by 0.02953)
      const pressureInInches = barometricPressure ? (barometricPressure / 100) * 0.02953 : undefined
      // Visibility: meters to miles (divide by 1609.34)
      const visibilityInMiles = visibility ? visibility / 1609.34 : undefined
      // Dewpoint: Celsius to Fahrenheit if needed
      let dewPointInF = dewPoint
      if (dewPoint && period.dewpoint?.unitCode === 'wmoUnit:degC') {
        dewPointInF = (dewPoint * 9/5) + 32
      }

      // Calculate "feels like" temperature
      let feelsLike = period.temperature
      if (heatIndex && period.temperature > 80) {
        feelsLike = heatIndex
      } else if (windChill && period.temperature < 50) {
        feelsLike = windChill
      }

      // NWS API provides startTime in UTC format
      // Convert to location's local timezone using same logic as current time
      const [lat, lon] = coordinates || [0, 0]
      
      // Parse the UTC time from NWS
      const utcDate = new Date(period.startTime)
      const utcTime = utcDate.getTime() + (utcDate.getTimezoneOffset() * 60000)
      
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
      const month = utcDate.getMonth();
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
      
      return {
        time,
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        conditions: period.shortForecast,
        isDaytime: period.isDaytime,
        windSpeed: period.windSpeed,
        windDirection: period.windDirection,
        icon: period.icon,
        probabilityOfPrecipitation: period.probabilityOfPrecipitation?.value || 0,
        relativeHumidity: relativeHumidity ? Math.round(relativeHumidity) : undefined,
        dewPoint: dewPointInF ? Math.round(dewPointInF) : undefined,
        windGust: windGust ? `${Math.round(windGust)} mph` : undefined,
        heatIndex: heatIndex ? Math.round(heatIndex) : undefined,
        windChill: windChill ? Math.round(windChill) : undefined,
        feelsLike: Math.round(feelsLike),
        barometricPressure: pressureInInches ? Math.round(pressureInInches * 100) / 100 : undefined, // Round to 2 decimal places
        visibility: visibilityInMiles ? Math.round(visibilityInMiles * 10) / 10 : undefined, // Round to 1 decimal place
        skyCover: skyCover ? Math.round(skyCover) : undefined
      }
    })
  }

  private combineDayNightPeriods(periods: any[]): any[] {
    // Return all available day and night periods for validation
    return periods.map((period: any) => {
      // Extract additional forecast data
      const relativeHumidity = period.relativeHumidity?.value
      const dewPoint = period.dewpoint?.value
      const windGust = period.windGust?.value

      // Convert dewpoint from Celsius to Fahrenheit if needed
      let dewPointInF = dewPoint
      if (dewPoint && period.dewpoint?.unitCode === 'wmoUnit:degC') {
        dewPointInF = (dewPoint * 9/5) + 32
      }

      // Calculate "feels like" temperature
      let feelsLike = period.temperature


      return {
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
        probabilityOfPrecipitation: period.probabilityOfPrecipitation?.value || 0,
        relativeHumidity: relativeHumidity ? Math.round(relativeHumidity) : undefined,
        dewPoint: dewPointInF ? Math.round(dewPointInF) : undefined,
        windGust: windGust ? `${Math.round(windGust)} mph` : undefined,
        feelsLike: Math.round(feelsLike)
      }
    })
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
