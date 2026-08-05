import { useState, useEffect, useMemo } from 'react'
import { useBookings } from './useBookings'
import { getEgyptDateString } from '../../utils/egyptTime'
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
 * Today's pending/ongoing bookings are pre-sorted in a useMemo that runs only when
 * `bookings` change; the per-second tick only iterates that pre-sorted list (O(n)),
 * instead of re-filtering and re-sorting the whole dataset every second.
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

  // Pre-sorted list of today's pending/ongoing bookings — computed once per bookings change.
  const todayBookings = useMemo(() => {
    const todayDate = new Date(getEgyptDateString()).toLocaleDateString('en-CA')
    return bookings
      .filter((b: Booking) => {
        const bookingDate = new Date(b.booking_time).toLocaleDateString('en-CA')
        return (
          bookingDate === todayDate &&
          (b.status === 'pending' || b.status === 'ongoing')
        )
      })
      .sort(
        (a: Booking, b: Booking) =>
          new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
      )
  }, [bookings])

  const queueInfo = useMemo<QueueInfo>(() => {
    const currentTime = now

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
      todayBookings.find((b) => b.status === 'ongoing') || null
    let futureBookings: Booking[] = []
    let totalWaitMinutes = 0
    let remainingTimeForCurrent = 0

    if (currentBooking) {
      const bookingStartTime = new Date(currentBooking.booking_time)
      const duration = currentBooking.duration || 30
      const completionTime = bookingStartTime.getTime() + duration * 60000
      remainingTimeForCurrent = Math.max(
        0,
        Math.ceil((completionTime - currentTime.getTime()) / 60000)
      )
    }

    futureBookings = todayBookings.filter((booking: Booking) => {
      if (booking.status === 'ongoing') return false
      return new Date(booking.booking_time).getTime() > currentTime.getTime()
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
      const bookingStart = new Date(currentBooking.booking_time).getTime()
      const elapsed = currentTime.getTime() - bookingStart
      percentageWaited = Math.min(100, Math.max(0, (elapsed / (duration * 60000)) * 100))
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
