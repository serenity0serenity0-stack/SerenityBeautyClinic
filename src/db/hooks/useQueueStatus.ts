import { useState, useEffect, useMemo } from 'react'
import { useBookings } from './useBookings'
import { getEgyptDateString, getEgyptTimeString } from '../../utils/egyptTime'
import {
  bookingDateOf,
  bookingMinutesOf,
  timeToMinutes,
} from '../../utils/bookingAvailability'
import { Booking } from '../supabase'

export interface QueueInfo {
  peopleAhead: number
  waitingMinutes: number
  currentTime: string
  estimatedTime: string
  nextBooking?: Booking
  isWaiting: boolean
  percentageWaited: number
}

/**
 * Real-time queue status.
 * Today's pending/confirmed/checked_in/ongoing bookings are pre-sorted in a
 * useMemo that runs only when `bookings` change; the per-second tick only
 * iterates that pre-sorted list (O(n)) instead of re-filtering and re-sorting
 * the whole dataset every second. All times are compared in Cairo wall clock.
 */
export const useQueueStatus = (externalBookings?: Booking[]) => {
  const { bookings: hookBookings } = useBookings()
  const bookings = externalBookings || hookBookings

  const [now, setNow] = useState(() => new Date())

  // Update the clock every second (drives a re-render; queueInfo below is memoized)
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Pre-sorted list of today's active bookings — computed once per bookings change.
  const todayBookings = useMemo(() => {
    const today = getEgyptDateString()
    return bookings
      .filter((b: Booking) => {
        const bookingDate = bookingDateOf(b.booking_time)
        return (
          bookingDate === today &&
          (b.status === 'pending' ||
            b.status === 'confirmed' ||
            b.status === 'checked_in' ||
            b.status === 'ongoing')
        )
      })
      .sort((a: Booking, b: Booking) => a.booking_time.localeCompare(b.booking_time))
  }, [bookings])

  const queueInfo = useMemo<QueueInfo>(() => {
    const currentTime = now
    const nowMinutes = timeToMinutes(getEgyptTimeString())

    if (todayBookings.length === 0) {
      return {
        peopleAhead: 0,
        waitingMinutes: 0,
        currentTime: currentTime.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        estimatedTime: currentTime.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isWaiting: false,
        percentageWaited: 0,
      }
    }

    // Separate current booking and future bookings
    const currentBooking =
      todayBookings.find(
        (b) => b.status === 'ongoing' || b.status === 'checked_in'
      ) || null
    let futureBookings: Booking[] = []
    let totalWaitMinutes = 0
    let remainingTimeForCurrent = 0

    if (currentBooking) {
      const duration = currentBooking.duration || 30
      const completionMinutes =
        bookingMinutesOf(currentBooking.booking_time) + duration
      remainingTimeForCurrent = Math.max(0, completionMinutes - nowMinutes)
    }

    futureBookings = todayBookings.filter((booking: Booking) => {
      if (booking.status === 'ongoing' || booking.status === 'checked_in') return false
      return bookingMinutesOf(booking.booking_time) > nowMinutes
    })

    // Calculate total wait
    let peopleAhead = futureBookings.length
    if (currentBooking) {
      totalWaitMinutes = remainingTimeForCurrent
    }

    totalWaitMinutes += futureBookings.reduce(
      (sum, b) => sum + (b.duration || 30),
      0
    )

    const finalEstimatedTime = new Date(
      currentTime.getTime() + totalWaitMinutes * 60000
    )

    // Calculate percentage (for progress indication)
    let percentageWaited = 0
    if (currentBooking !== null) {
      const duration = currentBooking.duration || 30
      const bookingStart = bookingMinutesOf(currentBooking.booking_time)
      const elapsed = nowMinutes - bookingStart
      percentageWaited = Math.min(100, Math.max(0, (elapsed / duration) * 100))
    }

    return {
      peopleAhead,
      waitingMinutes: Math.max(0, totalWaitMinutes),
      currentTime: currentTime.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      estimatedTime: finalEstimatedTime.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      nextBooking: futureBookings[0],
      isWaiting: peopleAhead > 0 || currentBooking !== null,
      percentageWaited,
    }
  }, [todayBookings, now])

  return {
    queueInfo,
    currentTime: now,
    recalculate: () => setNow(new Date()),
  }
}
