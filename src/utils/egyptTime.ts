/**
 * Egypt Timezone Utilities
 * Handles all date/time operations for Egypt timezone (Africa/Cairo)
 */

const EGYPT_TIMEZONE = 'Africa/Cairo'

/**
 * Get current date in Egypt timezone as YYYY-MM-DD format
 */
export const getEgyptDateString = (date: Date = new Date()): string => {
  // Use Intl.DateTimeFormat with explicit Cairo timezone
  return date.toLocaleDateString('en-CA', {
    timeZone: 'Africa/Cairo'
  })
}

/**
 * Get current time in Egypt timezone as HH:MM format
 */
export const getEgyptTimeString = (date: Date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('en-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: EGYPT_TIMEZONE,
  })
  
  const parts = formatter.formatToParts(date)
  const hour = parts.find(p => p.type === 'hour')?.value
  const minute = parts.find(p => p.type === 'minute')?.value
  
  return `${hour}:${minute}`
}

/**
 * Get current date and time in Egypt timezone as ISO format
 * Returns date string only (no time portion)
 */
export const getEgyptISODate = (date: Date = new Date()): string => {
  const dateString = getEgyptDateString(date)
  return dateString
}

/**
 * Get current date and time in Egypt timezone with full formatting
 * Returns human-readable format: "Jan 15, 2026 14:30"
 */
export const getEgyptFormattedDateTime = (date: Date = new Date(), locale: 'ar' | 'en' = 'en'): string => {
  const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: EGYPT_TIMEZONE,
  })
  
  return formatter.format(date)
}

/**
 * Get date info for display (with year)
 * Returns: "January 15, 2026"
 */
export const getEgyptFormattedDate = (date: Date = new Date(), locale: 'ar' | 'en' = 'en'): string => {
  const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: EGYPT_TIMEZONE,
  })
  
  return formatter.format(date)
}

/**
 * Get month and year for display
 * Returns: "January 2026"
 */
export const getEgyptMonthYear = (date: Date = new Date(), locale: 'ar' | 'en' = 'en'): string => {
  const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'long',
    timeZone: EGYPT_TIMEZONE,
  })
  
  return formatter.format(date)
}

/**
 * Get quarter and year
 * Returns: "Q1 2026" or "الربع الأول 2026"
 */
export const getEgyptQuarterYear = (date: Date = new Date(), locale: 'ar' | 'en' = 'en'): string => {
  const parts = new Intl.DateTimeFormat('en-EG', {
    year: 'numeric',
    month: '2-digit',
    timeZone: EGYPT_TIMEZONE,
  }).formatToParts(date)
  
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1')
  const year = parts.find(p => p.type === 'year')?.value
  
  const quarter = Math.ceil(month / 3)
  
  if (locale === 'ar') {
    const quarterNames = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع']
    return `${quarterNames[quarter - 1]} ${year}`
  } else {
    return `Q${quarter} ${year}`
  }
}

/**
 * Get week number and year
 * Returns: "Week 3 2026"
 */
export const getEgyptWeekYear = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: EGYPT_TIMEZONE,
  }).formatToParts(date)
  
  const year = parts.find(p => p.type === 'year')?.value
  
  // Simple week calculation
  const firstDay = new Date(parseInt(year as string), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDay.getTime()) / 86400000
  const week = Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7)
  
  return `Week ${week} ${year}`
}

/**
 * Convert a string date (YYYY-MM-DD) to Egypt timezone aware date
 * This is useful when reading from database
 */
export const parseAsDatabaseDate = (dateString: string): string => {
  // Database dates are already stored as YYYY-MM-DD
  // This function ensures we're treating them correctly
  return dateString
}

/**
 * Get current year and month in Egypt timezone as YYYY-MM format
 * Used for billing period and usage_logs year_month field
 */
export const getEgyptYearMonth = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-EG', {
    year: 'numeric',
    month: '2-digit',
    timeZone: EGYPT_TIMEZONE,
  }).formatToParts(date)
  
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  
  return `${year}-${month}`
}
