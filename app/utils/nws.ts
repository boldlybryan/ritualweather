import type { NWSPointsResponse } from '~/types/weather'

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
}
