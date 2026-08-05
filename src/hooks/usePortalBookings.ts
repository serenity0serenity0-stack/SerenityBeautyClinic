import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'
import {
  generateSlots,
  getBarberWorkingWindow,
  isBarberOffOnDate,
} from '@/utils/bookingAvailability'

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
  working_hours_start?: string | null
  working_hours_end?: string | null
  days_off?: number[] | null
  vacation_start?: string | null
  vacation_end?: string | null
}

export interface TimeSlot {
  time: string
  available: boolean
  startTime: Date
}

export interface BookingData {
  id: string
  status: 'pending' | 'confirmed' | 'checked_in' | 'cancelled' | 'completed'
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
      const { data, error: err } = await supabase
        .from('services')
        .select('id, nameEn, nameAr, duration, price, category')
        .eq('clinic_id', clinicId)
        .eq('active', true)

      if (err) {
        console.error('❌ Error fetching services:', err)
        throw err
      }
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
      const { data, error: err } = await supabase
        .from('barbers')
        .select(
          'id, name, working_hours_start, working_hours_end, days_off, vacation_start, vacation_end'
        )
        .eq('clinic_id', clinicId)
        .eq('active', true)
        .order('name', { ascending: true })

      if (err) {
        console.error('❌ Error fetching barbers:', err.code, err.message)
        // Try alternative query without active filter
        const { data: altData, error: altErr } = await supabase
          .from('barbers')
          .select(
            'id, name, working_hours_start, working_hours_end, days_off, vacation_start, vacation_end'
          )
          .eq('clinic_id', clinicId)
          .order('name', { ascending: true })

        if (altErr) throw altErr
        setBarbers(altData || [])
        return
      }
      setBarbers(data || [])
    } catch (err) {
      console.error('Error fetching barbers:', err)
      setError('خطأ في تحميل الأطباء')
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
        .select('id, booking_time, service_type, barber_id, barber_name, status, notes')
        .eq('clinic_id', clinicId)
        .eq('client_phone', user.phone || '')
        .order('booking_time', { ascending: false })

      if (err) throw err

      // Transform booking data to match interface
      const transformedBookings = (data || []).map(b => ({
        id: b.id,
        status: b.status,
        serviceId: '',
        barber_id: b.barber_id || '',
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

  // Get available time slots for a date (duration-aware, per-doctor schedule).
  const getAvailableSlots = useCallback(
    async (
      booking_date: string,
      barber_id?: string,
      duration: number = 30
    ): Promise<string[]> => {
      try {
        // Doctor working window + days off / vacation (falls back to clinic hours).
        const barber = barbers.find((b) => b.id === barber_id) as any
        const workingWindow = getBarberWorkingWindow(barber, {
          start: 9 * 60,
          end: 22 * 60,
          active: true,
        })

        if (!workingWindow.active) return []
        if (isBarberOffOnDate(barber, booking_date)) return []

        // Fetch the day's active bookings for this doctor in one query.
        const dateStart = `${booking_date}T00:00:00`
        const dateEnd = `${booking_date}T23:59:59`

        let q = supabase
          .from('bookings')
          .select('booking_time, barber_id, duration, status')
          .eq('clinic_id', clinicId)
          .gte('booking_time', dateStart)
          .lt('booking_time', dateEnd)
          .in('status', ['pending', 'confirmed', 'checked_in', 'ongoing', 'completed'])

        if (barber_id) q = q.eq('barber_id', barber_id)

        const { data: dayBookings, error } = await q
        if (error) {
          console.warn('⚠️ Could not fetch booked slots:', error)
        }

        const slots = generateSlots({
          date: booking_date,
          barberId: barber_id,
          bookings: (dayBookings || []).map((b: any) => ({
            booking_time: b.booking_time,
            barber_id: b.barber_id,
            duration: b.duration,
            status: b.status,
            client_id: '',
            client_name: '',
            client_phone: '',
            queue_number: 0,
            created_at: b.booking_time,
          })),
          duration,
          interval: 30,
          workingWindow,
          skipPast: true,
        })

        return slots.filter((s) => s.available).map((s) => s.time)
      } catch (err) {
        console.error('❌ Error getting available slots:', err)
        return []
      }
    },
    [clinicId, barbers]
  )

  // Add the current customer to the clinic waiting list (when no slot is free).
  const addToWaitingList = useCallback(
    async (
      serviceId: string,
      barber_id?: string
    ): Promise<boolean> => {
      if (!customerId || !clinicId) {
        setError('خطأ في البيانات')
        return false
      }

      try {
        const service = services.find((s) => s.id === serviceId)
        const barber = barbers.find((b) => b.id === barber_id)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) {
          setError('لم يتم العثور على بيانات المستخدم')
          return false
        }

        const { data: portalUserData } = await supabase
          .from('portal_users')
          .select('phone')
          .eq('id', user.id)
          .single()

        const client_phone =
          portalUserData?.phone || user.user_metadata?.phone || user.phone || ''

        const { data: clientData } = await supabase
          .from('clients')
          .select('id, name')
          .eq('clinic_id', clinicId)
          .eq('phone', client_phone)
          .maybeSingle()

        const { error } = await supabase
          .from('waiting_list')
          .insert({
            clinic_id: clinicId,
            client_id: clientData?.id || null,
            client_name: clientData?.name || user.user_metadata?.name || client_phone,
            client_phone,
            barber_id: barber_id || null,
            barber_name: barber?.name || null,
            service_type: service ? (service.nameAr || service.nameEn) : null,
            duration: service?.duration || 30,
            status: 'waiting',
            notes: 'Added via customer portal (no slots available)',
          })

        if (error) throw error
        return true
      } catch (err: any) {
        console.error('❌ Error adding to waiting list:', err)
        setError(err.message || 'خطأ في إضافة قائمة الانتظار')
        return false
      }
    },
    [customerId, clinicId, services, barbers]
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

        // Get phone from portal_users record (id is unique, don't need clinic_id filter)
        // RLS might block clinic_id filter, so just query by user id
        const { data: portalUserData, error: portalErr } = await supabase
          .from('portal_users')
          .select('phone')
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

        // Get client record by phone + clinic_id
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('id, phone, name')
          .eq('clinic_id', clinicId)
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
          clinic_id: clinicId,
          client_id: actualclient_id,  // ← USE ACTUAL CLIENT RECORD ID
          client_name: client_name,
          client_phone: client_phone,
          customer_phone: client_phone,
          barber_id: barber_id || null,
          barber_name: barber_id ? barbers.find(b => b.id === barber_id)?.name || null : null,
          booking_time: `${booking_date}T${booking_time}:00`,
          service_type: service.nameAr || service.nameEn,
          service_name: service.nameAr || service.nameEn,
          duration: service.duration || 30,
          queue_number: 0,
          status: 'pending',
          notes: 'Booked via customer portal',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

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
    addToWaitingList,
    fetchCustomerBookings,
  }
}
