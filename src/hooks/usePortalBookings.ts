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
  barber_id?: string
  booking_date: string
  booking_time: string
  serviceName: string
  barber_name?: string
  created_at: string
}

export function usePortalBookings(clinicId?: string, customerId?: string) {
  const [services, setServices] = useState<ServiceData[]>([])
  const [barbers, setBarbers] = useState<BarberData[]>([])
  const [bookings, setBookings] = useState<BookingData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch services for shop
  const fetchServices = useCallback(async () => {
    if (!clinicId) return
    try {
      console.log('🔍 Fetching services for shop:', clinicId)
      const { data, error: err } = await supabase
        .from('services')
        .select('id, nameEn, nameAr, duration, price, category')
        .eq('shop_id', clinicId)
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
  }, [clinicId])

  // Fetch active barbers for shop
  const fetchBarbers = useCallback(async () => {
    if (!clinicId) return
    try {
      console.log('🔍 Fetching barbers for shop:', clinicId)
      const { data, error: err } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('shop_id', clinicId)
        .eq('active', true)
        .order('name', { ascending: true })

      if (err) {
        console.error('❌ Error fetching barbers:', err.code, err.message)
        // Try alternative query without active filter
        console.log('⚠️ Retrying without active filter...')
        const { data: altData, error: altErr } = await supabase
          .from('barbers')
          .select('id, name')
          .eq('shop_id', clinicId)
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
  }, [clinicId])

  // Fetch customer's bookings
  const fetchCustomerBookings = useCallback(async () => {
    if (!customerId || !clinicId) return
    try {
      // First, get the customer phone from auth or profile
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: err } = await supabase
        .from('bookings')
        .select('id, booking_time, service_type, barber_name, status, notes')
        .eq('shop_id', clinicId)
        .eq('client_phone', user.phone || '')
        .order('booking_time', { ascending: false })

      if (err) throw err
      
      // Transform booking data to match interface
      const transformedBookings = (data || []).map(b => ({
        id: b.id,
        status: b.status,
        serviceId: '',
        barber_id: '',
        booking_date: b.booking_time?.split('T')[0] || '',
        booking_time: b.booking_time?.split('T')[1]?.substring(0, 5) || '',
        serviceName: b.service_type || '',
        barber_name: b.barber_name,
        created_at: new Date().toISOString(),
      }))
      
      setBookings(transformedBookings)
    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError('خطأ في تحميل المواعيد')
    }
  }, [customerId, clinicId])

  // Get available time slots for a date
  const getAvailableSlots = useCallback(
    async (
      booking_date: string,
      barber_id?: string
    ): Promise<string[]> => {
      try {
        console.log('⏰ Generating slots for:', booking_date, 'barber:', barber_id)
        
        // Shop hours: 9 AM to 10 PM, 30-min slots
        const slots: string[] = []
        const startHour = 9
        const endHour = 22
        const slotDuration = 30 // minutes

        // Check if date is in future or today
        const selectedDate = new Date(booking_date)
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
        if (barber_id) {
          // Cast booking_time to text for date comparison (timestamp can't use ILIKE)
          const dateStart = `${booking_date}T00:00:00`
          const dateEnd = `${booking_date}T23:59:59`
          
          const { data: bookedSlots, error } = await supabase
            .from('bookings')
            .select('booking_time')
            .eq('shop_id', clinicId)
            .gte('booking_time', dateStart)
            .lt('booking_time', dateEnd)
            .eq('barber_id', barber_id)
            .in('status', ['confirmed', 'pending'])

          if (error) {
            console.warn('⚠️ Could not fetch booked slots:', error)
          } else {
            const bookedTimes = new Set(
              bookedSlots?.map(b => {
                // Extract time portion from ISO string (e.g., "14:30" from "2025-03-25T14:30:00")
                const timeMatch = b.booking_time?.match(/T(\d{2}:\d{2})/)
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
    [clinicId]
  )

  // Create new booking
  const createBooking = useCallback(
    async (
      serviceId: string,
      booking_date: string,
      booking_time: string,
      barber_id?: string
    ) => {
      if (!customerId || !clinicId) {
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

        // Get actual client record ID from clients table (not auth UID)
        let actualclient_id: string | undefined
        let client_phone = ''
        let client_name = ''

        // Always lookup client by phone from auth user
        // (customerId is auth user ID, not client ID - don't use it for lookups)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) {
          setError('لم يتم العثور على بيانات المستخدم')
          return null
        }

        // Get phone from portal_users record (id is unique, don't need shop_id filter)
        // RLS might block shop_id filter, so just query by user id
        const { data: portalUserData, error: portalErr } = await supabase
          .from('portal_users')
          .select('phone, shop_id')
          .eq('id', user.id)
          .single()

        if (portalErr || !portalUserData?.phone) {
          console.error('❌ Portal user record not found:', { portalErr, userId: user.id })
          console.log('⚠️ Trying alternative lookup...')
          
          // Fallback: Try to get phone from auth user metadata
          const phone = user.user_metadata?.phone || user.phone
          if (!phone) {
            setError('لم يتم العثور على رقم الهاتف')
            return null
          }
          client_phone = phone as string
          console.log('📞 Using phone from auth metadata:', client_phone)
        } else {
          client_phone = portalUserData.phone
          console.log('📞 Found portal user phone:', client_phone)
        }

        // Get client record by phone + shop_id
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('id, phone, name')
          .eq('shop_id', clinicId)
          .eq('phone', client_phone)
          .single()

        if (clientErr || !clientData) {
          console.error('❌ Client record not found:', { clientErr, client_phone, clinicId })
          setError('بيانات العميل غير موجودة')
          return null
        }

        actualclient_id = clientData.id
        client_phone = clientData.phone
        client_name = clientData.name

        // Create booking in bookings table (for staff)
        const bookingData = {
          shop_id: clinicId,
          client_id: actualclient_id,  // ← USE ACTUAL CLIENT RECORD ID
          client_name: client_name,
          client_phone: client_phone,
          customer_phone: client_phone,
          barber_id: barber_id || null,
          barber_name: barber_id ? barbers.find(b => b.id === barber_id)?.name || null : null,
          booking_time: `${booking_date}T${booking_time}:00`,
          service_type: service.nameAr || service.nameEn,
          duration: service.duration || 30,
          queue_number: 0,
          status: 'pending',
          notes: 'Booked via customer portal',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        console.log('📝 Creating booking with:', { actualclient_id, client_phone, client_name })

        const { data: bookings, error: bookingErr } = await supabase
          .from('bookings')
          .insert([bookingData])
          .select()

        if (bookingErr) {
          console.error('❌ Booking error:', bookingErr)
          throw bookingErr
        }
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
    [customerId, clinicId, services, fetchCustomerBookings]
  )

  // Cancel booking
  const cancelBooking = useCallback(
    async (booking_id: string) => {
      try {
        setLoading(true)

        // Get customer phone from auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.phone) {
          throw new Error('Customer phone not found')
        }

        // Update booking with cancelled status and new updated_at timestamp
        const { error: err } = await supabase
          .from('bookings')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking_id)
          .eq('client_phone', user.phone) // Security check - only cancel own bookings

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
    if (clinicId) {
      console.log('🚀 Initializing portal bookings for shop:', clinicId)
      fetchServices()
      fetchBarbers()
    } else {
      console.warn('⚠️ clinicId not available yet, will retry when it becomes available')
    }
  }, [clinicId, fetchServices, fetchBarbers])

  useEffect(() => {
    if (customerId && clinicId) {
      console.log('🚀 Fetching customer bookings for:', customerId, clinicId)
      fetchCustomerBookings()
    }
  }, [customerId, clinicId, fetchCustomerBookings])

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
