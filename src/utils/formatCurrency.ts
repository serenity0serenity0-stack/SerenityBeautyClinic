export const formatCurrency = (amount: number, currency: string = 'EGP', locale: string = 'ar-EG'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatNumber = (num: number, locale: string = 'ar-EG'): string => {
  return new Intl.NumberFormat(locale).format(num)
}

export const formatDate = (date: string | Date, locale: string = 'ar-EG'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export const formatTime = (time: string): string => {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  return `${hours}:${minutes}`
}

export const formatPhoneNumber = (phone: string): string => {
  // Egyptian phone format: 01X-XXXX-XXXX
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

export const validatePhoneNumber = (phone: string): boolean => {
  // Egyptian phone validation (01X-XXXX-XXXX or 01XXXXXXXXX)
  const regex = /^(01)[0-9]{9}$/
  const cleaned = phone.replace(/\D/g, '')
  return regex.test(cleaned)
}

export const toArabicIndic = (num: string | number): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return String(num).replace(/\d/g, (d) => arabicDigits[parseInt(d)])
}

export const fromArabicIndic = (num: string): string => {
  const arabicToWestern = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  }
  return num.replace(/[٠-٩]/g, (d) => arabicToWestern[d as keyof typeof arabicToWestern])
}

// ============================================
// Egypt Timezone Formatting
// ============================================

/**
 * Format date with Egypt timezone
 */
export const formatDateEgypt = (date: string | Date, locale: 'ar' | 'en' = 'ar'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Cairo',
  }).format(d)
}

/**
 * Format time with Egypt timezone
 */
export const formatTimeEgypt = (date: string | Date, locale: 'ar' | 'en' = 'ar'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Cairo',
  }).format(d)
}

/**
 * Format date and time together with Egypt timezone
 */
export const formatDateTimeEgypt = (date: string | Date, locale: 'ar' | 'en' = 'ar'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Cairo',
  }).format(d)
}
