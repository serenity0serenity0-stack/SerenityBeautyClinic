import { useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

const BOOKING_COLUMNS =
  'id, client_id, client_name, client_phone, barber_id, barber_name, service_type, booking_time, booking_date, duration, queue_number, status, notes, created_at, clinic_id'

/** Parse "HH:MM" from an ISO time into minutes of the day. */
const timeToMinutes = (iso: string) => {
  const t = iso.split('T')[1] || ''
  const h = parseInt(t.substring(0, 2), 10)
  const m = parseInt(t.substring(3, 5), 10)
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

/** Add N days to today and return YYYY-MM-DD (Cairo TZ). */
function plusDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

export const useBookings = (opts?: { dateFrom?: string; dateTo?: string }) => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  // Bookings need a wider window: 7 days past (for queue display) + 7 days future
  const dateFrom = opts?.dateFrom ?? (() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
  })()
  const dateTo = opts?.dateTo ?? plusDays(7)

  const listQuery = useQuery<Booking[]>({
    queryKey: ['bookings', clinicId, dateFrom, dateTo],
    queryFn: async () => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .eq('clinic_id', clinicId)
        .gte('booking_date', dateFrom)
        .lte('booking_date', dateTo)
        .order('booking_time', { ascending: true })
      if (error) throw error
      return (data ?? []).map((b: any) => ({
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
        clinic_id: b.clinic_id,
      }))
    },
    enabled: !!clinicId,
  })

  const bookings = (listQuery.data ?? []) as Booking[]

  // Listen for new bookings
  useEffect(() => {
    const handleNewBooking = () => { listQuery.refetch() }
    appEmitter.on('booking:created', handleNewBooking)
    return () => { appEmitter.off('booking:created', handleNewBooking) }
  }, [listQuery.refetch])

  // ── Smart queue calculation (uses in-memory bookings) ──
  const calculateSmartQueue = async (
    booking_time: string,
    selectedbarber_id?: string
  ): Promise<{ queue_number: number; recommendedbarber_id?: string }> => {
    const booking_date = bookingDateOf(booking_time)
    const dayBookings = bookings.filter((b) => {
      const bDate = bookingDateOf(b.booking_time)
      return bDate === booking_date && b.status !== 'cancelled' && b.status !== 'completed'
    })

    const newBookingMinutes = timeToMinutes(booking_time)

    if (selectedbarber_id) {
      const barberBookings = dayBookings
        .filter((b) => b.barber_id === selectedbarber_id)
        .sort((a, b) => {
          const aTime = timeToMinutes(a.booking_time)
          const bTime = timeToMinutes(b.booking_time)
          if (aTime === bTime) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          return aTime - bTime
        })
      const bookingsBefore = barberBookings.filter((b) => timeToMinutes(b.booking_time) < newBookingMinutes)
      return { queue_number: bookingsBefore.length + 1, recommendedbarber_id: selectedbarber_id }
    }

    try {
      const { data: barbers } = await supabase
        .from('barbers')
        .select('id')
        .eq('active', true)

      if (!barbers || barbers.length === 0) {
        return { queue_number: dayBookings.length + 1 }
      }

      const barberCounts = barbers.map((barber) => ({
        id: barber.id,
        count: dayBookings.filter((b) => b.barber_id === barber.id).length,
      }))
      const recommendedBarber = barberCounts.reduce((prev, current) =>
        current.count < prev.count ? current : prev
      )
      const barberBookings = dayBookings
        .filter((b) => b.barber_id === recommendedBarber.id)
        .sort((a, b) => {
          const aTime = timeToMinutes(a.booking_time)
          const bTime = timeToMinutes(b.booking_time)
          if (aTime === bTime) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          return aTime - bTime
        })
      const bookingsBefore = barberBookings.filter((b) => timeToMinutes(b.booking_time) < newBookingMinutes)
      return { queue_number: bookingsBefore.length + 1, recommendedbarber_id: recommendedBarber.id }
    } catch (err) {
      console.error('Error in smart queue calculation:', err)
      return { queue_number: dayBookings.length + 1 }
    }
  }

  // ── Queue info ──
  const getQueueInfo = useCallback(
    (queue_number: number, booking_time: string) => {
      const booking_date = bookingDateOf(booking_time)
      const dayBookings = bookings
        .filter((b) => {
          const bDate = bookingDateOf(b.booking_time)
          return bDate === booking_date && b.status !== 'cancelled' && b.status !== 'completed' && b.queue_number < queue_number
        })
        .sort((a, b) => a.queue_number - b.queue_number)

      const totalMinutesBefore = dayBookings.reduce((sum, b) => sum + (b.duration || 30), 0)
      const remainingQueue = dayBookings.length
      const estimatedWaitTime = totalMinutesBefore + remainingQueue * 5

      return {
        positionInQueue: queue_number,
        peopleAhead: remainingQueue,
        estimatedWaitMinutes: estimatedWaitTime,
        estimatedStartTime: new Date(
          new Date(booking_time).getTime() + estimatedWaitTime * 60000
        ).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      }
    },
    [bookings]
  )

  // ── Time slot availability ──
  const isTimeSlotAvailable = useCallback(
    (booking_time: string, barber_id?: string, duration: number = 30): boolean => {
      const date = bookingDateOf(booking_time)
      const minutes = bookingMinutesOf(booking_time)
      const today = getEgyptDateString()
      const nowMinutes = timeToMinutes(getEgyptTimeString())
      if (date < today || (date === today && minutes < nowMinutes)) return false
      return isSlotAvailable({ date, time: minutesToTime(minutes), barberId: barber_id, bookings, duration })
    },
    [bookings]
  )

  // ── Memoized derived data ──
  const todayBookings = useMemo(() => {
    const today = getEgyptDateString()
    return bookings
      .filter((b) => bookingDateOf(b.booking_time) === today && b.status !== 'cancelled')
      .sort((a, b) => a.queue_number - b.queue_number)
      .map((b) => ({ ...b, queueInfo: getQueueInfo(b.queue_number, b.booking_time) }))
  }, [bookings, getQueueInfo])

  const upcomingBookings = useMemo(() => {
    const today = getEgyptDateString()
    const nowMinutes = timeToMinutes(getEgyptTimeString())
    const limit = plusDays(2)
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

  // ── Mutations ──
  const addMutation = useMutation({
    mutationFn: async (booking: Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'queue_number'>) => {
      if (!booking.booking_time || booking.booking_time.trim() === '') {
        throw new Error('booking_time is required and cannot be empty')
      }
      if (!isTimeSlotAvailable(booking.booking_time, booking.barber_id, booking.duration)) {
        throw new Error('هذا الموعد محجوز بالفعل. اختر موعد آخر')
      }

      const clientConflict = bookings.find((b) => {
        if (b.status === 'cancelled' || b.status === 'completed') return false
        const requestStart = bookingMinutesOf(booking.booking_time)
        const requestEnd = requestStart + (booking.duration || 30)
        const bookingStart = bookingMinutesOf(b.booking_time)
        const bookingEnd = bookingStart + (b.duration || 30)
        return b.client_phone === booking.client_phone && requestStart < bookingEnd && requestEnd > bookingStart
      })
      if (clientConflict) throw new Error('هذا العميل لديه حجز آخر في نفس الوقت تقريباً')

      const { queue_number, recommendedbarber_id } = await calculateSmartQueue(booking.booking_time, booking.barber_id)
      const booking_id = crypto.randomUUID()

      const bookingWithId = {
        clinic_id: clinicId,
        client_id: booking.client_id,
        client_name: booking.client_name,
        client_phone: booking.client_phone,
        barber_id: booking.barber_id || recommendedbarber_id,
        barber_name: booking.barber_name,
        service_type: booking.service_type,
        booking_time: booking.booking_time,
        duration: booking.duration,
        queue_number,
        status: 'pending',
        notes: booking.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        id: booking_id,
      }

      const { data, error } = await supabase.from('bookings').insert(bookingWithId as any).select()
      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          const retryBooking = { ...bookingWithId, id: crypto.randomUUID() }
          const { data: retryData, error: retryError } = await supabase.from('bookings').insert(retryBooking as any).select()
          if (retryError) throw retryError
          return retryData?.[0]
        }
        throw error
      }
      return data?.[0]
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', clinicId] })
      appEmitter.emit('booking:created', data)
      toast.success('تم إنشاء الحجز بنجاح ✓')
    },
    onError: (err: any) => {
      if (!err.message?.includes('محجوز')) {
        toast.error(err.message || 'خطأ في إنشاء الحجز')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Booking, 'id' | 'created_at' | 'updated_at'>> }) => {
      const currentBooking = bookings.find(b => b.id === id)
      if (!currentBooking) throw new Error('الحجز غير موجود')

      if (updates.booking_time || updates.barber_id) {
        const newbooking_time = updates.booking_time || currentBooking.booking_time
        const newbarber_id = updates.barber_id || currentBooking.barber_id
        const newDuration = updates.duration || currentBooking.duration || 30
        const tempBookings = bookings.filter(b => b.id !== id)
        const conflicting = !isSlotAvailable({
          date: bookingDateOf(newbooking_time),
          time: minutesToTime(bookingMinutesOf(newbooking_time)),
          barberId: newbarber_id,
          bookings: tempBookings,
          duration: newDuration,
        })
        if (conflicting) throw new Error('هذا الموعد محجوز بالفعل للطبيب المحدد')
      }

      const dbUpdates: Record<string, any> = {}
      Object.entries(updates).forEach(([key, value]) => { dbUpdates[key.toLowerCase()] = value })
      dbUpdates['updated_at'] = new Date().toISOString()

      const { data, error } = await supabase.from('bookings').update(dbUpdates).eq('id', id).select()
      if (error) throw error
      return { data: data?.[0], status: updates.status }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', clinicId] })
      if (variables.updates.status) appEmitter.emit('booking:statusChanged', { id: variables.id, status: variables.updates.status })
      toast.success('تم تحديث الحجز بنجاح')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', clinicId] })
      toast.success('تم حذف الحجز بنجاح')
    },
  })

  const getClientBookings = useCallback(
    (client_id: string) => bookings
      .filter((b) => b.client_id === client_id && b.status !== 'cancelled')
      .sort((a, b) => b.booking_time.localeCompare(a.booking_time)),
    [bookings]
  )

  const getBarberSchedule = useCallback(
    (barber_id: string, date?: string) => {
      const targetDate = date || getEgyptDateString()
      return bookings
        .filter((b) => bookingDateOf(b.booking_time) === targetDate && b.barber_id === barber_id && b.status !== 'cancelled')
        .sort((a, b) => a.queue_number - b.queue_number)
    },
    [bookings]
  )

  return {
    bookings,
    loading: listQuery.isLoading,
    error: listQuery.error?.message ?? null,
    fetchBookings: listQuery.refetch,
    addBooking: async (b: Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'queue_number'>) => {
      const result = await addMutation.mutateAsync(b)
      return result
    },
    updateBooking: async (id: string, updates: Partial<Omit<Booking, 'id' | 'created_at' | 'updated_at'>>) => {
      const result = await updateMutation.mutateAsync({ id, updates })
      return result.data
    },
    deleteBooking: async (id: string) => { await deleteMutation.mutateAsync(id) },
    getTodayBookings: useCallback(() => todayBookings, [todayBookings]),
    getUpcomingBookings: useCallback(() => upcomingBookings, [upcomingBookings]),
    getClientBookings,
    getBarberSchedule,
    calculateSmartQueue,
    isTimeSlotAvailable,
    getQueueInfo,
  }
}
