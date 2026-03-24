import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'

export interface DashboardStats {
  totalVisits: number
  totalSpent: number
  nextBooking?: {
    id: string
    bookingDate: string
    bookingTime: string
    serviceName: string
  }
  lastVisit?: string
  upcomingBookingsCount: number
}

export function usePortalDashboardStats(shopId?: string, customerId?: string, slug?: string) {
  const [stats, setStats] = useState<DashboardStats>({
    totalVisits: 0,
    totalSpent: 0,
    upcomingBookingsCount: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!customerId || !shopId || !slug) return

    setLoading(true)
    try {
      // Step 1: Get customer phone from session
      const session = JSON.parse(localStorage.getItem(`portal_session_${slug}`) || '{}')
      const customerPhone = session.phone

      if (!customerPhone) {
        throw new Error('Customer phone not found in session')
      }

      // Step 2: Find clientId from clients table using phone
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('id, totalVisits, totalSpent')
        .eq('shop_id', shopId)
        .eq('phone', customerPhone)
        .maybeSingle()

      if (clientErr) throw clientErr
      if (!clientData) {
        // Client not registered yet
        setStats({
          totalVisits: 0,
          totalSpent: 0,
          upcomingBookingsCount: 0
        })
        return
      }

      // Step 3: Get visit logs using correct columns
      const { data: visitLogs, error: visitErr } = await supabase
        .from('visit_logs')
        .select('totalSpent, visitDate')
        .eq('shop_id', shopId)
        .eq('clientId', clientData.id)
        .order('visitDate', { ascending: false })

      if (visitErr) throw visitErr

      const totalVisits = visitLogs?.length || clientData.totalVisits || 0
      const totalSpent = visitLogs?.reduce((sum, v) => sum + (v.totalSpent || 0), 0) || clientData.totalSpent || 0
      const lastVisit = visitLogs && visitLogs.length > 0 ? visitLogs[0]?.visitDate : undefined

      // Step 4: Get next upcoming booking using correct column name and date filtering
      const now = new Date()
      const dateStart = now.toISOString().split('T')[0] + 'T00:00:00'
      const dateEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T23:59:59'

      const { data: nextBookings, error: bookingErr } = await supabase
        .from('bookings')
        .select('id, bookingtime, service_id')
        .eq('shop_id', shopId)
        .eq('clientphone', customerPhone)
        .in('status', ['pending', 'confirmed'])
        .gte('bookingtime', dateStart)
        .lte('bookingtime', dateEnd)
        .order('bookingtime', { ascending: true })
        .limit(1)

      if (bookingErr) throw bookingErr

      // Step 5: Get all upcoming bookings count
      const { count: upcomingCount, error: countErr } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('clientphone', customerPhone)
        .in('status', ['pending', 'confirmed'])
        .gte('bookingtime', dateStart)
        .lte('bookingtime', dateEnd)

      if (countErr) throw countErr

      // Get service name for next booking
      let serviceName = ''
      if (nextBookings && nextBookings.length > 0) {
        const { data: serviceData } = await supabase
          .from('services')
          .select('nameAr')
          .eq('id', nextBookings[0].service_id)
          .single()
        serviceName = serviceData?.nameAr || 'خدمة'
      }

      const nextBooking = nextBookings && nextBookings.length > 0 
        ? {
            id: nextBookings[0].id,
            bookingDate: new Date(nextBookings[0].bookingtime).toISOString().split('T')[0],
            bookingTime: new Date(nextBookings[0].bookingtime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            serviceName
          }
        : undefined

      setStats({
        totalVisits,
        totalSpent,
        nextBooking,
        lastVisit,
        upcomingBookingsCount: upcomingCount || 0
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('خطأ في تحميل الإحصائيات')
    } finally {
      setLoading(false)
    }
  }, [customerId, shopId, slug])

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
