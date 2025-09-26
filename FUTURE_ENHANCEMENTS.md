# Future Enhancements

## Phase 2: Hourly Forecasts ✅ COMPLETED

### Overview
Add detailed hourly forecasts using the NWS forecastHourly endpoint that's already available in the points API response.

### Implementation ✅
- **API Call:** `pointData.properties.forecastHourly` (URL already available)
- **Data:** Hourly temperature, precipitation, wind, sky cover trends
- **UI:** Always-visible hourly forecast section between current conditions and daily forecast
- **Performance Impact:** +1 API call per weather request

### Benefits ✅
- Temperature trends throughout the day
- Hourly precipitation probability
- Wind condition changes
- Better planning for outdoor activities
- 24-hour detailed forecast with all enhanced weather data

---

## Phase 3: Air Quality & Astronomical Data (2 Additional API Calls)

### Air Quality Data (EPA AirNow API)

#### Overview
Add real-time air quality information to help users make informed decisions about outdoor activities.

#### Implementation
- **API:** EPA AirNow API
- **Cost:** Free (requires free API key from api.data.gov)
- **Authentication:** API key required
- **Data Available:**
  - Air Quality Index (AQI)
  - PM2.5, PM10 concentrations
  - Ozone levels
  - Health recommendations
  - Pollutant breakdown

#### UI Integration
- Add air quality card to current conditions
- Color-coded AQI indicators
- Health recommendations
- Pollutant breakdown in expandable details

### Sun/Moon Data (USNO API)

#### Overview
Add astronomical data for sunrise/sunset and moon phases to provide complete environmental context.

#### Implementation
- **API:** U.S. Naval Observatory (USNO) API
- **Cost:** Free
- **Authentication:** None required
- **Data Available:**
  - Sunrise/sunset times
  - Moonrise/moonset times
  - Moon phases
  - Civil/nautical/astronomical twilight times

#### UI Integration
- Add astronomical data card
- Show today's sun/moon times
- Display current moon phase
- Twilight times for photography/outdoor activities

### Performance Impact
- **Total Additional API Calls:** 2
- **Current:** 5 API calls (points, forecast, hourly forecast, current observations, alerts)
- **With Phase 3:** 7 API calls total
- **Caching:** Optimized cache times per data type (see Caching Strategy below)

---

## Phase 4: Advanced Features

### Weather Trends & Historical Context
- Compare current conditions to historical averages
- Show record highs/lows for the date
- Temperature trend indicators (rising/falling)
- Pressure trend indicators

### Enhanced Alerts
- Categorize alerts by type (severe, marine, fire weather)
- Show alert coverage areas on a map
- Alert severity indicators with better styling

### Weather Station Information
- Show which weather station data is from
- Display data freshness timestamp
- Add station distance from user location

### Seasonal Enhancements
- Show snow/ice amounts in winter
- Display heat index prominently in summer
- Add wind chill indicators in winter
- Seasonal comfort recommendations

---

## Implementation Priority

### ✅ COMPLETED
1. **Phase 2: Hourly Forecasts** - Single additional API call, significant value

### High Priority (Low Effort, High Impact)
2. **Air Quality Data** - High user value, moderate implementation effort
3. **Optimized Caching Strategy** - Different cache times for different data types

### Medium Priority (Medium Effort, Medium Impact)
4. **Sun/Moon Data** - Nice to have, easy implementation
5. **Weather Trends** - Good for power users

### Low Priority (High Effort, Low Impact)
6. **Advanced Features** - Polish and edge cases

---

## Technical Notes

### API Rate Limits
- **NWS API:** No official rate limits, but be respectful
- **EPA AirNow API:** 1000 requests/hour (should be sufficient)
- **USNO API:** No documented rate limits

### Error Handling
- All APIs should have graceful fallbacks
- Air quality data may not be available in all locations
- USNO data is very reliable but should still have error handling

### Caching Strategy
- **Current State:** All data uses 15-minute cache timeout
- **Ideal State:** Different cache times for different data types:
  - Current conditions: 5 minutes (frequent updates needed)
  - Hourly forecast: 30 minutes (NWS updates every 1-2 hours)
  - Daily forecast: 1 hour (changes less frequently)
  - Alerts: 5 minutes (critical for safety)
  - Air quality: 15 minutes (EPA updates frequently)
  - Astronomical data: 24 hours (changes daily)
- Cache keys should include location and data type
- Smart cache invalidation based on NWS updateTime vs our lastUpdated

### Data Structure Updates
- Update TypeScript interfaces for new data types
- Maintain backward compatibility
- Add proper null/undefined handling for optional data
