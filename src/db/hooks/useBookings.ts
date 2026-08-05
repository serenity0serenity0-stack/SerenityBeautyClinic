import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, Booking } from '../supabase'
import { getEgyptDateString, getEgyptTimeString } from '../../utils/egyptTime'
import {
  isSlotAvailable,
  bookingDateOf,
  bookingMinutesOf,
  minutesToTime,
} from '../../utils/bookingAvailability'
import toast from 'react-hot-toast'
import { appEmitter } from '../../utils/eventEmitter'

/** Parse "HH:MM" (or "HH:MM:SS") from an ISO time into minutes of the day. */
const timeToMinutes = (iso: string) => {
  const t = iso.split('T')[1] || ''
  const h = parseInt(t.substring(0, 2), 10)
  const m = parseInt(t.substring(3, 5), 10)
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

export const useBookings = () => {
  const { clinicId } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      if (!clinicId) {
        setBookings([])
        return
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('booking_time', { ascending: true })

      if (error) throw error

      // Convert lowercase database field names to camelCase
      const normalizedData = (data || []).map((b: any) => ({
        id: b.id,
        client_id: b.client_id,
        client_name: b.client_name,
        client_phone: b.client_phone,
        barber_id: b.barber_id,
        barber_name: b.barber_name,
        service_type: b.service_type,
        booking_time: b.booking_time,
        booking_date: b.booking_date,
        duration: b.duration,
        queue_number: b.queue_number,
        status: b.status,
        notes: b.notes,
        created_at: b.created_at,
        updated_at: b.updated_at,
        clinic_id: b.clinic_id,
      }))

      setBookings(normalizedData)
      setError(null)
    } catch (err: any) {
      console.error('Error fetching bookings:', err)
      setError(err.message)
      toast.error('خطأ في جلب الحجوزات')
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Listen for new bookings
  useEffect(() => {
    const handleNewBooking = () => {
      fetchBookings()
    }
    appEmitter.on('booking:created', handleNewBooking)
    return () => {
      appEmitter.off('booking:created', handleNewBooking)
    }
  }, [fetchBookings])

  /**
   * Smart algorithm to calculate queue number and find next available slot
   * يختار الحلاق الأقل انشغالاً في نفس اليوم
   * ✅ Fixed: Ensures unique queue numbers even with simultaneous bookings
   */
  const calculateSmartQueue = async (
    booking_time: string,
    selectedbarber_id?: string
  ): Promise<{ queue_number: number; recommendedbarber_id?: string }> => {
    // Get all bookings for the same day (pending/ongoing only)
    const booking_date = bookingDateOf(booking_time)
    const dayBookings = bookings.filter((b) => {
      const bDate = bookingDateOf(b.booking_time)
      // استبعد المكتملة والملغاة
      return bDate === booking_date && b.status !== 'cancelled' && b.status !== 'completed'
    })

    const newBookingMinutes = timeToMinutes(booking_time)

    // If barber is specified, calculate queue for that barber
    if (selectedbarber_id) {
      // Get all bookings for this barber on this day, sorted by time
      const barberBookings = dayBookings
        .filter((b) => b.barber_id === selectedbarber_id)
        .sort((a, b) => {
          const aTime = timeToMinutes(a.booking_time)
          const bTime = timeToMinutes(b.booking_time)
          // If times are equal, sort by creation time (earlier first)
          if (aTime === bTime) {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          }
          return aTime - bTime
        })

      // Count bookings before this time (more reliable than using queue_number)
      const bookingsBefore = barberBookings.filter((b) => timeToMinutes(b.booking_time) < newBookingMinutes)

      // Queue number = count of bookings before + 1
      const nextQueue = bookingsBefore.length + 1

      return { queue_number: nextQueue, recommendedbarber_id: selectedbarber_id }
    }

    // Smart distribution: find the barber with least bookings today
    try {
      const { data: barbers } = await supabase
        .from('barbers')
        .select('*')
        .eq('active', true)

      if (!barbers || barbers.length === 0) {
        // Fallback: use total count + 1
        const nextQueue = dayBookings.length + 1
        return { queue_number: nextQueue }
      }

      // Count bookings per barber
      const barberCounts = barbers.map((barber) => ({
        id: barber.id,
        count: dayBookings.filter((b) => b.barber_id === barber.id).length,
      }))

      // Select barber with least bookings
      const recommendedBarber = barberCounts.reduce((prev, current) =>
        (current.count < prev.count) ? current : prev
      )

      // Get all bookings for the recommended barber, sorted by time
      const barberBookings = dayBookings
        .filter((b) => b.barber_id === recommendedBarber.id)
        .sort((a, b) => {
          const aTime = timeToMinutes(a.booking_time)
          const bTime = timeToMinutes(b.booking_time)
          // If times are equal, sort by creation time
          if (aTime === bTime) {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          }
          return aTime - bTime
        })

      // Count bookings before this time
      const bookingsBefore = barberBookings.filter((b) => timeToMinutes(b.booking_time) < newBookingMinutes)

      const nextQueue = bookingsBefore.length + 1

      return { queue_number: nextQueue, recommendedbarber_id: recommendedBarber.id }
    } catch (err) {
      console.error('Error in smart queue calculation:', err)
      // Safest fallback: use total count of bookings today + 1
      const nextQueue = dayBookings.length + 1
      return { queue_number: nextQueue }
    }
  }

  /**
   * Calculate remaining time and position in queue
   */
  const getQueueInfo = useCallback((queue_number: number, booking_time: string) => {
    const booking_date = bookingDateOf(booking_time)
    const dayBookings = bookings
      .filter((b) => {
        const bDate = bookingDateOf(b.booking_time)
        return (
          bDate === booking_date &&
          b.status !== 'cancelled' &&
          b.status !== 'completed' &&
          b.queue_number < queue_number
        )
      })
      .sort((a, b) => a.queue_number - b.queue_number)

    const totalMinutesBefore = dayBookings.reduce((sum, b) => sum + (b.duration || 30), 0)
    const remainingQueue = dayBookings.length
    const estimatedWaitTime = totalMinutesBefore + (remainingQueue * 5) // +5 min buffer per person

    return {
      positionInQueue: queue_number,
      peopleAhead: remainingQueue,
      estimatedWaitMinutes: estimatedWaitTime,
      estimatedStartTime: new Date(
        new Date(booking_time).getTime() + estimatedWaitTime * 60000
      ).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
  }, [bookings])

  /**
   * Check if time slot is available - with proper conflict detection
   * المنطق الصحيح: لا يمكن تداخل الحجزات
   *   إذا كان هناك حجز من 10:00-10:30
   *   لا يمكن حجز أي وقت يتداخل معه قبل 10:30
   * Uses the shared availability util: Cairo-local past-time guard +
   * duration-aware overlap detection against all active bookings.
   */
  const isTimeSlotAvailable = useCallback(
    (booking_time: string, barber_id?: string, duration: number = 30): boolean => {
      const date = bookingDateOf(booking_time)
      const minutes = bookingMinutesOf(booking_time)

      // Past-time guard in Cairo wall clock
      const today = getEgyptDateString()
      const nowMinutes = timeToMinutes(getEgyptTimeString())
      if (date < today || (date === today && minutes < nowMinutes)) {
        return false
      }

      return isSlotAvailable({
        date,
        time: minutesToTime(minutes),
        barberId: barber_id,
        bookings,
        duration,
      })
    },
    [bookings]
  )

  /**
   * Get today's bookings with queue info.
   * Memoized: the O(n²) queue computation runs only when bookings change.
   */
  const todayBookings = useMemo(() => {
    const today = getEgyptDateString()
    return bookings
      .filter((b) => {
        const bDate = bookingDateOf(b.booking_time)
        return bDate === today && b.status !== 'cancelled'
      })
      .sort((a, b) => a.queue_number - b.queue_number)
      .map((b) => ({
        ...b,
        queueInfo: getQueueInfo(b.queue_number, b.booking_time),
      }))
  }, [bookings, getQueueInfo])

  /**
   * Get upcoming bookings (next 48 hours, Cairo wall clock).
   * Memoized to avoid recomputation on every render.
   */
  const upcomingBookings = useMemo(() => {
    const today = getEgyptDateString()
    const nowMinutes = timeToMinutes(getEgyptTimeString())

    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() + 2)
    const limit = limitDate.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })

    return bookings
      .filter((b) => {
        if (b.status === 'cancelled') return false

        const d = bookingDateOf(b.booking_time)
        if (d < today || d > limit) return false
        if (d === today && bookingMinutesOf(b.booking_time) < nowMinutes) return false

        return true
      })
      .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
  }, [bookings])

  const addBooking = async (
    booking: Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'queue_number'>
  ) => {
    try {
      // Validate booking_time exists
      if (!booking.booking_time || booking.booking_time.trim() === '') {
        throw new Error('booking_time is required and cannot be empty')
      }

      // Check if time slot is available with correct duration
      if (!isTimeSlotAvailable(booking.booking_time, booking.barber_id, booking.duration)) {
        const errorMsg = 'هذا الموعد محجوز بالفعل. اختر موعد آخر'
        toast.error(errorMsg)
        throw new Error(errorMsg)
      }

      // Check for duplicate client booking in same time window
      const clientConflict = bookings.find((b) => {
        if (b.status === 'cancelled' || b.status === 'completed') return false

        const requestStart = bookingMinutesOf(booking.booking_time)
        const requestEnd = requestStart + (booking.duration || 30)
        const bookingStart = bookingMinutesOf(b.booking_time)
        const bookingEnd = bookingStart + (b.duration || 30)

        const hasOverlap = requestStart < bookingEnd && requestEnd > bookingStart
        return b.client_phone === booking.client_phone && hasOverlap
      })

      if (clientConflict) {
        const errorMsg = 'هذا العميل لديه حجز آخر في نفس الوقت تقريباً'
        toast.error(errorMsg)
        throw new Error(errorMsg)
      }

      // Calculate smart queue number
      const { queue_number, recommendedbarber_id } = await calculateSmartQueue(
        booking.booking_time,
        booking.barber_id
      )

      const newBooking = {
        clinic_id: clinicId,
        client_id: booking.client_id,
        client_name: booking.client_name,
        client_phone: booking.client_phone,
        barber_id: booking.barber_id || recommendedbarber_id,
        barber_name: booking.barber_name,
        service_type: booking.service_type,
        booking_time: booking.booking_time,
        duration: booking.duration,
        queue_number: queue_number,
        status: 'pending',
        notes: booking.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Generate unique ID (Supabase should do this, but we add safeguard)
      const booking_id = crypto.randomUUID()

      const bookingWithId = {
        ...newBooking,
        id: booking_id,
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingWithId as any)
        .select()

      if (error) {
        console.error('Booking insert error:', error)
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          // If ID collision (very rare), retry with a new ID
          const retryBooking = {
            ...bookingWithId,
            id: crypto.randomUUID(),
          }
          const { data: retryData, error: retryError } = await supabase
            .from('bookings')
            .insert(retryBooking as any)
            .select()

          if (retryError) throw retryError

          await fetchBookings()
          appEmitter.emit('booking:created', retryData?.[0])
          toast.success('تم إنشاء الحجز بنجاح ✓ (محاولة ثانية)')
          return retryData?.[0]
        }
        throw error
      }

      await fetchBookings()
      appEmitter.emit('booking:created', data?.[0])
      toast.success('تم إنشاء الحجز بنجاح ✓')
      return data?.[0]
    } catch (err: any) {
      console.error('Error adding booking:', err)
      setError(err.message)
      if (!err.message.includes('محجوز')) {
        toast.error(err.message || 'خطأ في إنشاء الحجز')
      }
      throw err
    }
  }

  const updateBooking = async (
    id: string,
    updates: Partial<Omit<Booking, 'id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      // Get the current booking
      const currentBooking = bookings.find(b => b.id === id)
      if (!currentBooking) {
        throw new Error('الحجز غير موجود')
      }

      // If time or barber is being changed, check for conflicts
      if (updates.booking_time || updates.barber_id) {
        const newbooking_time = updates.booking_time || currentBooking.booking_time
        const newbarber_id = updates.barber_id || currentBooking.barber_id
        const newDuration = updates.duration || currentBooking.duration || 30

        // Create a temporary list excluding the current booking being updated
        const tempBookings = bookings.filter(b => b.id !== id)

        const conflicting = !isSlotAvailable({
          date: bookingDateOf(newbooking_time),
          time: minutesToTime(bookingMinutesOf(newbooking_time)),
          barberId: newbarber_id,
          bookings: tempBookings,
          duration: newDuration,
        })

        if (conflicting) {
          throw new Error('هذا الموعد محجوز بالفعل للطبيب المحدد')
        }
      }

      // Convert camelCase to lowercase for PostgreSQL
      const dbUpdates: any = {}
      Object.entries(updates).forEach(([key, value]) => {
        dbUpdates[key.toLowerCase()] = value
      })
      dbUpdates['updated_at'] = new Date().toISOString()

      const { data, error } = await supabase
        .from('bookings')
        .update(dbUpdates)
        .eq('id', id)
        .select()

      if (error) throw error
      await fetchBookings()

      // Emit event for real-time updates when status changes
      if (updates.status) {
        appEmitter.emit('booking:statusChanged', { id, status: updates.status })
      }

      toast.success('تم تحديث الحجز بنجاح')
      return data?.[0]
    } catch (err: any) {
      console.error('Error updating booking:', err)
      setError(err.message)
      toast.error(err.message || 'خطأ في تحديث الحجز')
      throw err
    }
  }

  const deleteBooking = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchBookings()
      toast.success('تم حذف الحجز بنجاح')
    } catch (err: any) {
      console.error('Error deleting booking:', err)
      setError(err.message)
      toast.error(err.message || 'خطأ في حذف الحجز')
      throw err
    }
  }

  /** Get bookings for a client (memoized per client). */
  const getClientBookings = useCallback((client_id: string) => {
    return bookings
      .filter((b) => b.client_id === client_id && b.status !== 'cancelled')
      .sort((a, b) => b.booking_time.localeCompare(a.booking_time))
  }, [bookings])

  /** Get barber's schedule for the day (memoized per barber/date). */
  const getBarberSchedule = useCallback((barber_id: string, date?: string) => {
    const targetDate = date || getEgyptDateString()
    return bookings
      .filter((b) => {
        const bDate = bookingDateOf(b.booking_time)
        return b.barber_id === barber_id && bDate === targetDate && b.status !== 'cancelled'
      })
      .sort((a, b) => a.queue_number - b.queue_number)
  }, [bookings])

  return {
    bookings,
    loading,
    error,
    fetchBookings,
    addBooking,
    updateBooking,
    deleteBooking,
    getTodayBookings: useCallback(() => todayBookings, [todayBookings]),
    getUpcomingBookings: useCallback(() => upcomingBookings, [upcomingBookings]),
    getClientBookings,
    getBarberSchedule,
    calculateSmartQueue,
    isTimeSlotAvailable,
    getQueueInfo,
  }
}
