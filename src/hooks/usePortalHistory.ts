import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'

export interface VisitHistory {
  id: string
  visitDate: string
  servicesCount: number
  total_spent: number
  notes?: string
}

export function usePortalHistory(clinicId?: string, _customerId?: string, slug?: string) {
  const [history, setHistory] = useState<VisitHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!clinicId || !slug) return

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
        .select('id')
        .eq('shop_id', clinicId)
        .eq('phone', customerPhone)
        .maybeSingle()

      if (clientErr) throw clientErr
      if (!clientData) {
        // Client not registered yet, no history
        setHistory([])
        return
      }

      // Step 3: Fetch visit logs using correct columns
      const { data: visitLogs, error: err } = await supabase
        .from('visit_logs')
        .select('id, visitDate, servicesCount, total_spent, notes')
        .eq('shop_id', clinicId)
        .eq('client_id', clientData.id)
        .order('visitDate', { ascending: false })

      if (err) throw err

      setHistory(
        visitLogs?.map(log => ({
          id: log.id,
          visitDate: log.visitDate,
          servicesCount: log.servicesCount || 0,
          total_spent: log.total_spent || 0,
          notes: log.notes
        })) || []
      )
    } catch (err) {
      console.error('Error fetching history:', err)
      setError('خطأ في تحميل السجل')
    } finally {
      setLoading(false)
    }
  }, [clinicId, slug])
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Get stats
  const getStats = useCallback(() => {
    return {
      total_visits: history.length,
      total_spent: history.reduce((sum, log) => sum + log.total_spent, 0),
      averageSpent: history.length > 0 ? history.reduce((sum, log) => sum + log.total_spent, 0) / history.length : 0,
      last_visit: history[0]?.visitDate || null
    }
  }, [history])

  return {
    history,
    loading,
    error,
    fetchHistory,
    getStats
  }
}

