import { useState, useEffect } from 'react'
import {
  getEgyptDateString,
  getEgyptTimeString,
  getEgyptFormattedDateTime,
  getEgyptFormattedDate,
} from '../utils/egyptTime'

/**
 * Real-time Egypt timezone hook
 * Updates every second to provide current Egypt time
 */
export const useEgyptTime = () => {
  const [now, setNow] = useState<Date>(new Date())
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    // Set initial time
    setNow(new Date())

    // Update every second
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!isClient) {
    return {
      now: new Date(),
      dateString: '',
      timeString: '',
      formattedDateTime: '',
      formattedDate: '',
    }
  }

  return {
    now,
    dateString: getEgyptDateString(now),
    timeString: getEgyptTimeString(now),
    formattedDateTime: getEgyptFormattedDateTime(now, 'en'),
    formattedDateTimeAr: getEgyptFormattedDateTime(now, 'ar'),
    formattedDate: getEgyptFormattedDate(now, 'en'),
    formattedDateAr: getEgyptFormattedDate(now, 'ar'),
  }
}
