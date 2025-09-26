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
  lastUpdated: string
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
