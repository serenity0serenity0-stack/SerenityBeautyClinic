import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'

export interface ServiceData {
  id: string
  nameEn: string
  nameAr: string
  durationMinutes: number
  price: number
}

export interface BarberData {
  id: string
  name: string
  email?: string
}

export interface TimeSlot {
  time: string
  available: boolean
  startTime: Date
}

export interface BookingData {
  id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  serviceId: string
  barberId?: string
  bookingDate: string
  bookingTime: string
  serviceName: string
  barberName?: string
  createdAt: string
}

export function usePortalBookings(shopId?: string, customerId?: string) {
  const [services, setServices] = useState<ServiceData[]>([])
  const [barbers, setBarbers] = useState<BarberData[]>([])
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch services for shop
  const fetchServices = useCallback(async () => {
    if (!shopId) return
    try {
      const { data, error: err } = await supabase
        .from('services')
        .select('id, nameEn, nameAr, durationMinutes, price')
        .eq('shop_id', shopId)
        .eq('active', true)

      if (err) throw err
      setServices(data || [])
    } catch (err) {
      console.error('Error fetching services:', err)
      setError('خطأ في تحميل الخدمات')
    }
  }, [shopId])

  // Fetch active barbers for shop
  const fetchBarbers = useCallback(async () => {
    if (!shopId) return
    try {
      const { data, error: err } = await supabase
        .from('barbers')
        .select('id, name, email')
        .eq('shop_id', shopId)
        .eq('active', true)
        .order('name')

      if (err) throw err
      setBarbers(data || [])
    } catch (err) {
      console.error('Error fetching barbers:', err)
      setError('خطأ في تحميل الحلاقين')
    }
  }, [shopId])

  // Fetch customer's bookings
  const fetchCustomerBookings = useCallback(async () => {
    if (!customerId || !shopId) return
    try {
      const { data, error: err } = await supabase
        .from('customer_bookings')
        .select('*')
        .eq('customer_user_id', customerId)
        .eq('shop_id', shopId)
        .order('booking_date', { ascending: false })

      if (err) throw err
      setBookings(data || [])
    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError('خطأ في تحميل المواعيد')
    }
  }, [customerId, shopId])

  // Get available time slots for a date
  const getAvailableSlots = useCallback(
    async (
      bookingDate: string,
      barberId?: string
    ): Promise<string[]> => {
      try {
        // Shop hours: 9 AM to 10 PM (13 hours), 30-min slots
        const slots: string[] = []
        const startHour = 9
        const endHour = 22
        const slotDuration = 30 // minutes

        for (let hour = startHour; hour < endHour; hour++) {
          for (let minutes = 0; minutes < 60; minutes += slotDuration) {
            const slotTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

            // Check if slot conflicts with existing bookings
            const { data: existingBookings } = await supabase
              .from('bookings')
              .select('id')
              .eq('booking_date', bookingDate)
              .eq('assigned_barber_id', barberId || null)
              .eq('status', 'pending')
              .limit(1)

            // Simplified availability check - in production would need more detail
            const isAvailable = !existingBookings || existingBookings.length === 0

            if (isAvailable) {
              slots.push(slotTime)
            }
          }
        }

        return slots
      } catch (err) {
        console.error('Error getting available slots:', err)
        return []
      }
    },
    []
  )

  // Create new booking
  const createBooking = useCallback(
    async (
      serviceId: string,
      bookingDate: string,
      bookingTime: string,
      barberId?: string,
      clientId?: string
    ) => {
      if (!customerId || !shopId) {
        setError('خطأ في البيانات')
        return null
      }

      try {
        setLoading(true)

        // Get service details
        const service = services.find((s) => s.id === serviceId)
        if (!service) {
          setError('خدمة غير موجودة')
          return null
        }

        // Create booking in bookings table (for staff)
        const bookingData = {
          shop_id: shopId,
          booking_date: bookingDate,
          booking_time: bookingTime,
          service_id: serviceId,
          assigned_barber_id: barberId || null,
          client_id: clientId || null,
          status: 'pending',
          notes: 'Booked via customer portal',
        }

        const { data: booking, error: bookingErr } = await supabase
          .from('bookings')
          .insert([bookingData])
          .select()
          .single()

        if (bookingErr) throw bookingErr

        // Create booking in customer_bookings table
        const customerBookingData = {
          customer_user_id: customerId,
          shop_id: shopId,
          booking_id: booking.id,
          service_id: serviceId,
          barber_id: barberId || null,
          booking_date: bookingDate,
          booking_time: bookingTime,
          status: 'pending',
        }

        const { data: customerBooking, error: custErr } = await supabase
          .from('customer_bookings')
          .insert([customerBookingData])
          .select()
          .single()

        if (custErr) throw custErr

        // Refresh bookings list
        await fetchCustomerBookings()

        return customerBooking
      } catch (err: any) {
        console.error('Error creating booking:', err)
        setError(err.message || 'خطأ في إنشاء الحجز')
        return null
      } finally {
        setLoading(false)
      }
    },
    [customerId, shopId, services, fetchCustomerBookings]
  )

  // Cancel booking
  const cancelBooking = useCallback(
    async (bookingId: string) => {
      try {
        setLoading(true)

        // Update customer_bookings
        const { error: custErr } = await supabase
          .from('customer_bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookingId)

        if (custErr) throw custErr

        // Find and update corresponding booking in bookings table
        const booking = bookings.find((b) => b.id === bookingId)
        if (booking) {
          const { error: err } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', booking.id)

          if (err) throw err
        }

        // Refresh bookings list
        await fetchCustomerBookings()
        return true
      } catch (err: any) {
        console.error('Error cancelling booking:', err)
        setError(err.message || 'خطأ في إلغاء الحجز')
        return false
      } finally {
        setLoading(false)
      }
    },
    [bookings, fetchCustomerBookings]
  )

  // Initial load
  useEffect(() => {
    if (shopId) {
      fetchServices()
      fetchBarbers()
    }
  }, [shopId, fetchServices, fetchBarbers])

  useEffect(() => {
    if (customerId && shopId) {
      fetchCustomerBookings()
    }
  }, [customerId, shopId, fetchCustomerBookings])

  return {
    services,
    barbers,
    bookings,
    loading,
    error,
    createBooking,
    cancelBooking,
    getAvailableSlots,
    fetchCustomerBookings,
  }
}
