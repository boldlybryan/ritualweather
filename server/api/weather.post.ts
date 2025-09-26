import { WeatherService } from '~/utils/weather'
import type { LocationInput } from '~/types/weather'

const weatherService = new WeatherService()

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<LocationInput>(event)
    console.log('Weather API request:', body)
    
    if (!body.type || (body.type === 'coordinates' && !body.coordinates) || (body.type === 'search' && !body.query)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request body'
      })
    }
    
    const startTime = Date.now()
    const weatherData = await weatherService.getWeather(body)
    const endTime = Date.now()
    
    console.log('Weather API response:', { 
      location: weatherData.location, 
      forecastCount: weatherData.forecast.length,
      responseTime: `${endTime - startTime}ms`
    })
    
    // Add performance information to response while preserving weather service cache info
    return {
      ...weatherData,
      _cache: {
        ...weatherData._cache,
        responseTime: `${endTime - startTime}ms`,
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    console.error('Weather API error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to fetch weather data'
    })
  }
})
