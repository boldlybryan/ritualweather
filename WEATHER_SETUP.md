# Weather Service Setup

## Caching Options

The weather service supports caching but works without it. Here are your options:

### Option 1: No Caching (Default)
The app works perfectly without any caching setup. Weather data is fetched fresh from NWS API on each request.

### Option 2: Vercel Edge Config (Recommended)
For ultra-fast global caching, use Vercel Edge Config:

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Edge Config**
3. Create a new Edge Config store
4. Use the Edge Config SDK for caching

### Option 3: Upstash Redis (Recommended for Caching)
For fast Redis caching with Upstash:

1. **Create Upstash account** at [console.upstash.com](https://console.upstash.com)
2. **Create a new database**:
   - Name: `ritualweather-cache`
   - Region: Choose closest to your users
   - Plan: Start with Free (10,000 requests/day)
3. **Get your credentials** from the database dashboard
4. **Set up environment variables**:

```bash
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here
```

5. **Test the connection**:
   ```bash
   curl http://localhost:3000/api/test-kv
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
