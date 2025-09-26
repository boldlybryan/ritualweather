export interface WeatherData {
  location: string
  coordinates: [number, number]
  current: {
    temperature: number
    conditions: string
    humidity: number
  }
  forecast: Array<{
    date: string
    time: string
    temperature: number
    temperatureUnit: string
    conditions: string
    isDaytime: boolean
    detailedForecast: string
    windSpeed: string
    windDirection: string
    icon: string
    probabilityOfPrecipitation: number
  }>
  alerts: WeatherAlert[]
  lastUpdated: string
  _cache?: {
    isCached: boolean
    cacheAge: number
    cacheKey: string | null
  }
}

export interface WeatherAlert {
  id: string
  event: string
  headline: string
  description: string
  instruction: string
  severity: string
  urgency: string
  areas: string[]
  effective: string
  expires: string
  status: string
  messageType: string
  category: string
}

export interface NWSPointsResponse {
  properties: {
    forecast: string
    forecastHourly: string
    gridId: string
    gridX: number
    gridY: number
  }
}

export interface LocationInput {
  type: 'coordinates' | 'search'
  coordinates?: [number, number]
  query?: string
}
