/**
 * Utility functions for timezone handling
 */

/**
 * Check if daylight saving time is currently active
 */
function isDST(): boolean {
  const now = new Date()
  const year = now.getFullYear()
  
  // DST starts on the second Sunday of March
  const marchFirst = new Date(year, 2, 1)
  const marchFirstDay = marchFirst.getDay()
  const secondSunday = 8 + (7 - marchFirstDay) % 7
  const dstStart = new Date(year, 2, secondSunday, 2, 0, 0)
  
  // DST ends on the first Sunday of November
  const novemberFirst = new Date(year, 10, 1)
  const novemberFirstDay = novemberFirst.getDay()
  const firstSunday = 1 + (7 - novemberFirstDay) % 7
  const dstEnd = new Date(year, 10, firstSunday, 2, 0, 0)
  
  return now >= dstStart && now < dstEnd
}

/**
 * Get timezone abbreviation from coordinates
 * This is a simplified approach - in production you might want to use a more robust timezone library
 */
export function getTimezoneFromCoordinates(lat: number, lon: number): string {
  const dst = isDST()
  
  // Rough timezone estimation based on longitude
  // This is a simplified approach - real timezone boundaries are more complex
  
  if (lon >= -125 && lon <= -66.5) {
    // Continental US timezones
    if (lon >= -125 && lon <= -115) {
      return dst ? 'PDT' : 'PST' // Pacific
    } else if (lon >= -115 && lon <= -102) {
      return dst ? 'MDT' : 'MST' // Mountain
    } else if (lon >= -102 && lon <= -87) {
      return dst ? 'CDT' : 'CST' // Central
    } else {
      return dst ? 'EDT' : 'EST' // Eastern
    }
  } else if (lon >= -180 && lon <= -125) {
    return dst ? 'AKDT' : 'AKST' // Alaska
  } else if (lon >= -66.5 && lon <= -60) {
    return dst ? 'ADT' : 'AST' // Atlantic
  } else {
    // For international locations, return UTC as fallback
    return 'UTC'
  }
}
