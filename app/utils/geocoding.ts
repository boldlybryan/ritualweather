export async function forwardGeocode(query: string): Promise<[number, number]> {
  // Use Nominatim (free) for now - replace with paid service for production
  const encoded = encodeURIComponent(query)
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=us`,
    {
      headers: {
        'User-Agent': 'RitualWeather/1.0 (contact@ritualweather.com)'
      }
    }
  )
  
  if (!response.ok) {
    throw new Error(`Geocoding service error: ${response.status}`)
  }
  
  const results = await response.json()
  if (!results || !results.length) {
    throw new Error(`Location not found: ${query}`)
  }
  
  return [parseFloat(results[0].lat), parseFloat(results[0].lon)]
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&countrycodes=us`,
    {
      headers: {
        'User-Agent': 'RitualWeather/1.0 (contact@ritualweather.com)'
      }
    }
  )
  
  if (!response.ok) {
    throw new Error(`Reverse geocoding service error: ${response.status}`)
  }
  
  const result = await response.json()
  const address = result.address || {}
  
  // Create normalized city name
  const city = address.city || address.town || address.village || address.hamlet
  const state = address.state
  
  if (!city || !state) {
    throw new Error('Unable to determine city/state from coordinates')
  }
  
  return `${city}, ${getStateAbbreviation(state)}`
}

function getStateAbbreviation(stateName: string): string {
  const stateMap: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
  }
  return stateMap[stateName] || stateName
}

export function normalizeCoordinates(lat: number, lon: number, precision = 2): string {
  return `${lat.toFixed(precision)},${lon.toFixed(precision)}`
}
