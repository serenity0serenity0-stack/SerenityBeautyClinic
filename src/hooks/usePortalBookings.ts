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
      // First, get the customer phone from auth or profile
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: err } = await supabase
        .from('bookings')
        .select('id, bookingtime, servicetype, barbername, status, notes')
        .eq('shop_id', shopId)
        .eq('clientphone', user.phone || '')
        .order('bookingtime', { ascending: false })

      if (err) throw err
      
      // Transform booking data to match interface
      const transformedBookings = (data || []).map(b => ({
        id: b.id,
        status: b.status,
        serviceId: '',
        barberId: '',
        bookingDate: b.bookingtime?.split('T')[0] || '',
        bookingTime: b.bookingtime?.split('T')[1]?.substring(0, 5) || '',
        serviceName: b.servicetype || '',
        barberName: b.barbername,
        createdAt: new Date().toISOString(),
      }))
      
      setBookings(transformedBookings)
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
            .select('bookingtime')
            .eq('shop_id', shopId)
            .ilike('bookingtime', `${bookingDate}%`)
            .eq('barberid', barberId)
            .in('status', ['confirmed', 'pending'])

          if (error) {
            console.warn('⚠️ Could not fetch booked slots:', error)
          } else {
            const bookedTimes = new Set(
              bookedSlots?.map(b => {
                // Extract time portion from ISO string (e.g., "14:30" from "2025-03-25T14:30:00")
                const timeMatch = b.bookingtime?.match(/T(\d{2}:\d{2})/)
                return timeMatch ? timeMatch[1] : ''
              }) || []
            )
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
          clientid: clientId || customerId,
          clientname: '', // Will be fetched from customer profile
          clientphone: '', // Will be fetched from customer profile
          customer_phone: '', // Will be fetched from customer profile
          barberid: barberId || null,
          barbername: barberId ? barbers.find(b => b.id === barberId)?.name || null : null,
          bookingtime: `${bookingDate}T${bookingTime}:00`,
          servicetype: service.nameAr || service.nameEn,
          duration: service.duration || 30,
          queuenumber: 0,
          status: 'pending',
          notes: 'Booked via customer portal',
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString(),
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

        // Refresh bookings list
        await fetchCustomerBookings()

        return booking
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

        // Get customer phone from auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.phone) {
          throw new Error('Customer phone not found')
        }

        // Update booking with cancelled status and new updatedat timestamp
        const { error: err } = await supabase
          .from('bookings')
          .update({ 
            status: 'cancelled',
            updatedat: new Date().toISOString()
          })
          .eq('id', bookingId)
          .eq('clientphone', user.phone) // Security check - only cancel own bookings

        if (err) throw err

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
    [fetchCustomerBookings]
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
