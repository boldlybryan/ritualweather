# Weather Service Setup

## Environment Configuration

Create a `.env` file in your project root with the following variables:

```bash
# Vercel KV Configuration
KV_REST_API_URL=your_vercel_kv_url
KV_REST_API_TOKEN=your_vercel_kv_token
```

## Usage Examples

### In your Vue components:

```typescript
// Get weather by coordinates
const getWeatherByLocation = async () => {
  const data = await $fetch('/api/weather', {
    method: 'POST',
    body: {
      type: 'coordinates',
      coordinates: [40.7128, -74.0060] // New York City
    }
  })
  return data
}

// Get weather by search query
const getWeatherBySearch = async (query: string) => {
  const data = await $fetch('/api/weather', {
    method: 'POST', 
    body: {
      type: 'search',
      query: 'Chicago, IL'
    }
  })
  return data
}
```

## Features

- ✅ Smart caching with Vercel KV (30-minute cache)
- ✅ Direct NWS API integration (no wrapper dependencies)
- ✅ TypeScript safety throughout
- ✅ Forward and reverse geocoding with Nominatim
- ✅ Proper error handling and fallbacks
- ✅ Rate limiting protection through caching
- ✅ Support for both coordinate and search-based queries

## Next Steps

1. Set up your Vercel KV database
2. Add your KV credentials to `.env`
3. Test the API endpoints
4. Consider upgrading to a paid geocoding service for production use
