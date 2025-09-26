import type { NWSPointsResponse, WeatherAlert } from '~/types/weather'

export class NWSClient {
  private baseUrl = 'https://api.weather.gov'
  
  async getPointData(lat: number, lon: number): Promise<NWSPointsResponse> {
    const response = await fetch(`${this.baseUrl}/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: {
        'User-Agent': 'RitualWeather/1.0 (contact@ritualweather.com)'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NWS API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    if (!data || !data.properties) {
      throw new Error('Invalid response from NWS points API')
    }
    
    return data
  }
  
  async getForecast(forecastUrl: string) {
    const response = await fetch(forecastUrl, {
      headers: {
        'User-Agent': 'RitualWeather/1.0 (contact@ritualweather.com)'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NWS forecast error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    if (!data || !data.properties) {
      throw new Error('Invalid response from NWS forecast API')
    }
    
    return data
  }

  async getHourlyForecast(hourlyForecastUrl: string) {
    const response = await fetch(hourlyForecastUrl, {
      headers: {
        'User-Agent': 'RitualWeather/1.0 (contact@ritualweather.com)'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NWS hourly forecast error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    if (!data || !data.properties) {
      throw new Error('Invalid response from NWS hourly forecast API')
    }
    
    return data
  }
  
  async getCurrentConditions(lat: number, lon: number) {
    // Get nearest observation station
    const stationsResponse = await fetch(`${this.baseUrl}/points/${lat.toFixed(4)},${lon.toFixed(4)}/stations`, {
      headers: {
        'User-Agent': 'RitualWeather/1.0 (contact@ritualweather.com)'
      }
    })
    
    const stations = await stationsResponse.json()
    if (!stations.features?.length) return null
    
    // Get latest observation from first station
    const stationUrl = stations.features[0].id
    const obsResponse = await fetch(`${stationUrl}/observations/latest`, {
      headers: {
        'User-Agent': 'RitualWeather/1.0 (contact@ritualweather.com)'
      }
    })
    
    return obsResponse.ok ? obsResponse.json() : null
  }

  async getAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
    try {
      // First try point-based search for exact location
      let response = await fetch(`${this.baseUrl}/alerts?point=${lat.toFixed(4)},${lon.toFixed(4)}&active=true`, {
        headers: {
          'User-Agent': 'RitualWeather/1.0 (contact@ritualweather.com)'
        }
      })
      
      if (!response.ok) {
        console.warn(`NWS alerts API error: ${response.status}`)
        return []
      }
      
      let data = await response.json()
      
      // If no alerts found for exact point, return empty array
      // We don't want to show irrelevant alerts from other areas
      if (!data || !data.features || data.features.length === 0) {
        console.log('No alerts found for this location')
        return []
      }
      
      if (!data || !data.features || !Array.isArray(data.features)) {
        return []
      }
      
      // Transform the GeoJSON features to our WeatherAlert format
      return data.features.map((feature: any) => ({
        id: feature.id,
        event: feature.properties.event || 'Unknown Event',
        headline: feature.properties.headline || '',
        description: feature.properties.description || '',
        instruction: feature.properties.instruction || '',
        severity: feature.properties.severity || 'Unknown',
        urgency: feature.properties.urgency || 'Unknown',
        areas: feature.properties.areaDesc ? feature.properties.areaDesc.split(';') : [],
        effective: feature.properties.effective || '',
        expires: feature.properties.expires || '',
        status: feature.properties.status || 'Unknown',
        messageType: feature.properties.messageType || 'Unknown',
        category: feature.properties.category || 'Unknown'
      }))
    } catch (error) {
      console.error('Error fetching alerts:', error)
      return []
    }
  }
}
