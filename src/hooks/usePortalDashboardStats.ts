import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'

export interface DashboardStats {
  total_visits: number
  total_spent: number
  nextBooking?: {
    id: string
    booking_date: string
    booking_time: string
    serviceName: string
  }
  last_visit?: string
  upcomingBookingsCount: number
}

export function usePortalDashboardStats(clinicId?: string, customerId?: string, slug?: string) {
  const [stats, setStats] = useState<DashboardStats>({
    total_visits: 0,
    total_spent: 0,
    upcomingBookingsCount: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!customerId || !clinicId || !slug) return

    setLoading(true)
    try {
      // Step 1: Get customer phone from session
      const session = JSON.parse(localStorage.getItem(`portal_session_${slug}`) || '{}')
      const customerPhone = session.phone

      if (!customerPhone) {
        throw new Error('Customer phone not found in session')
      }

      // Step 2: Find client_id from clients table using phone
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('id, total_visits, total_spent')
        .eq('shop_id', clinicId)
        .eq('phone', customerPhone)
        .maybeSingle()

      if (clientErr) throw clientErr
      if (!clientData) {
        // Client not registered yet
        setStats({
          total_visits: 0,
          total_spent: 0,
          upcomingBookingsCount: 0
        })
        return
      }

      // Step 3: Get visit logs using correct columns
      const { data: visitLogs, error: visitErr } = await supabase
        .from('visit_logs')
        .select('total_spent, visitDate')
        .eq('shop_id', clinicId)
        .eq('client_id', clientData.id)
        .order('visitDate', { ascending: false })

      if (visitErr) throw visitErr

      const total_visits = visitLogs?.length || clientData.total_visits || 0
      const total_spent = visitLogs?.reduce((sum, v) => sum + (v.total_spent || 0), 0) || clientData.total_spent || 0
      const last_visit = visitLogs && visitLogs.length > 0 ? visitLogs[0]?.visitDate : undefined

      // Step 4: Get next upcoming booking using correct column name and date filtering
      const now = new Date()
      const dateStart = now.toISOString().split('T')[0] + 'T00:00:00'
      const dateEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T23:59:59'

      const { data: nextBookings, error: bookingErr } = await supabase
        .from('bookings')
        .select('id, booking_date, booking_time, service_name, status')
        .eq('shop_id', clinicId)
        .eq('client_phone', customerPhone)
        .in('status', ['pending', 'confirmed'])
        .gte('booking_date', dateStart.split('T')[0])
        .lte('booking_date', dateEnd.split('T')[0])
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true })
        .limit(1)

      if (bookingErr) throw bookingErr

      // Step 5: Get all upcoming bookings count
      const { count: upcomingCount, error: countErr } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', clinicId)
        .eq('client_phone', customerPhone)
        .in('status', ['pending', 'confirmed'])
        .gte('booking_date', dateStart.split('T')[0])
        .lte('booking_date', dateEnd.split('T')[0])

      if (countErr) throw countErr

      // Use service_name directly from bookings table (already a snapshot field)
      let serviceName = nextBookings && nextBookings.length > 0 
        ? nextBookings[0].service_name || 'خدمة'
        : ''

      const nextBooking = nextBookings && nextBookings.length > 0 
        ? {
            id: nextBookings[0].id,
            booking_date: nextBookings[0].booking_date,
            booking_time: nextBookings[0].booking_time,
            serviceName
          }
        : undefined

      setStats({
        total_visits,
        total_spent,
        nextBooking,
        last_visit,
        upcomingBookingsCount: upcomingCount || 0
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('خطأ في تحميل الإحصائيات')
    } finally {
      setLoading(false)
    }
  }, [customerId, clinicId, slug])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    stats,
    loading,
    error,
    fetchStats
  }
}
