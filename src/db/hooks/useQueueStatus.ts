import { useState, useEffect, useCallback } from 'react'
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

export const useQueueStatus = () => {
  const { bookings } = useBookings()
  const [queueInfo, setQueueInfo] = useState<QueueInfo>({
    peopleAhead: 0,
    waitingMinutes: 0,
    currentTime: '',
    estimatedTime: '',
    isWaiting: false,
    percentageWaited: 0,
  })
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Calculate queue status
  const calculateQueue = useCallback(() => {
    try {
      const today = getEgyptDateString()

      // Get all pending and ongoing bookings for today, sorted by time
      const todayBookings = bookings
        .filter((b: Booking) => {
          const booking_date = new Date(b.booking_time).toLocaleDateString('en-CA')
          const todayDate = new Date(today).toLocaleDateString('en-CA')
          return (
            booking_date === todayDate &&
            (b.status === 'pending' || b.status === 'ongoing')
          )
        })
        .sort(
          (a: Booking, b: Booking) =>
            new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
        )

      if (todayBookings.length === 0) {
        setQueueInfo({
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
        })
        return
      }

      // Separate current booking and future bookings
      let currentBooking: Booking | null = null
      let futureBookings: Booking[] = []
      let totalWaitMinutes = 0
      let remainingTimeForCurrent = 0

      todayBookings.forEach((booking: Booking) => {
        const bookingStartTime = new Date(booking.booking_time)
        const duration = booking.duration || 30

        if (booking.status === 'ongoing') {
          currentBooking = booking
          const completionTime = bookingStartTime.getTime() + duration * 60000
          remainingTimeForCurrent = Math.max(
            0,
            Math.ceil((completionTime - currentTime.getTime()) / 60000)
          )
        } else if (bookingStartTime.getTime() > currentTime.getTime()) {
          futureBookings.push(booking)
        }
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
      // Formula: (current time - start time) / total duration * 100
      let percentageWaited = 0
      if (currentBooking !== null && currentBooking !== undefined) {
        const duration = (currentBooking as Booking).duration || 30
        const bookingStart = new Date(
          (currentBooking as Booking).booking_time
        ).getTime()
        const elapsed = currentTime.getTime() - bookingStart
        percentageWaited = Math.min(100, Math.max(0, (elapsed / (duration * 60000)) * 100))
      }

      setQueueInfo({
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
        isWaiting: peopleAhead > 0 || (currentBooking !== null),
        percentageWaited: percentageWaited,
      })
    } catch (error) {
      console.error('Error calculating queue:', error)
    }
  }, [bookings, currentTime])

  // Recalculate when dependencies change
  useEffect(() => {
    calculateQueue()
  }, [calculateQueue])

  return {
    queueInfo,
    currentTime,
    recalculate: calculateQueue,
  }
}
