import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'

export interface ServiceData {
  id: string
  nameEn: string
  nameAr: string
  duration: number
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
      console.log('🔍 Fetching services for shop:', shopId)
      const { data, error: err } = await supabase
        .from('services')
        .select('id, nameEn, nameAr, duration, price, category')
        .eq('shop_id', shopId)
        .eq('active', true)

      if (err) {
        console.error('❌ Error fetching services:', err)
        throw err
      }
      console.log('✅ Services fetched:', data?.length)
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
      console.log('🔍 Fetching barbers for shop:', shopId)
      const { data, error: err } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('shop_id', shopId)
        .eq('active', true)
        .order('name', { ascending: true })

      if (err) {
        console.error('❌ Error fetching barbers:', err.code, err.message)
        // Try alternative query without active filter
        console.log('⚠️ Retrying without active filter...')
        const { data: altData, error: altErr } = await supabase
          .from('barbers')
          .select('id, name')
          .eq('shop_id', shopId)
          .order('name', { ascending: true })

        if (altErr) throw altErr
        setBarbers(altData || [])
        return
      }
      console.log('✅ Barbers fetched:', data?.length)
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
        console.log('⏰ Generating slots for:', bookingDate, 'barber:', barberId)
        
        // Shop hours: 9 AM to 10 PM, 30-min slots
        const slots: string[] = []
        const startHour = 9
        const endHour = 22
        const slotDuration = 30 // minutes

        // Check if date is in future or today
        const selectedDate = new Date(bookingDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        let startOffset = 0
        if (selectedDate.toDateString() === today.toDateString()) {
          // For today, skip past times
          const now = new Date()
          startOffset = Math.ceil((now.getHours() * 60 + now.getMinutes()) / slotDuration) * slotDuration
        }

        for (let hour = startHour; hour < endHour; hour++) {
          for (let minutes = 0; minutes < 60; minutes += slotDuration) {
            const minutesSinceStart = hour * 60 + minutes
            if (minutesSinceStart < startOffset) continue // Skip past times

            const slotTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
            slots.push(slotTime)
          }
        }

        // Get booked times for this barber on this date
        if (barberId) {
          const { data: bookedSlots, error } = await supabase
            .from('bookings')
            .select('booking_time')
            .eq('shop_id', shopId)
            .eq('booking_date', bookingDate)
            .eq('assigned_barber_id', barberId)
            .in('status', ['confirmed', 'pending'])

          if (error) {
            console.warn('⚠️ Could not fetch booked slots:', error)
          } else {
            const bookedTimes = new Set(bookedSlots?.map(b => b.booking_time) || [])
            const available = slots.filter(s => !bookedTimes.has(s))
            console.log(`📅 Available: ${available.length}/${slots.length} slots`)
            return available
          }
        }

        console.log(`📅 Generated ${slots.length} total slots`)
        return slots
      } catch (err) {
        console.error('❌ Error getting available slots:', err)
        return []
      }
    },
    [shopId]
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

        const { data: bookings, error: bookingErr } = await supabase
          .from('bookings')
          .insert([bookingData])
          .select()

        if (bookingErr) throw bookingErr
        if (!bookings || bookings.length === 0) {
          throw new Error('Failed to create booking')
        }

        const booking = bookings[0]

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

        const { data: customerBookings, error: custErr } = await supabase
          .from('customer_bookings')
          .insert([customerBookingData])
          .select()

        if (custErr) throw custErr
        if (!customerBookings || customerBookings.length === 0) {
          throw new Error('Failed to create customer booking')
        }

        // Refresh bookings list
        await fetchCustomerBookings()

        return customerBookings[0]
      } catch (err: any) {
        console.error('❌ Error creating booking:', err)
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
