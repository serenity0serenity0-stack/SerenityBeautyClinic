import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'

export interface VisitLog {
  id: string
  client_id: string
  client_name: string
  visitDate: string
  visitTime: string
  servicesCount: number
  total_spent: number
  notes?: string
  created_at: string
  updated_at: string
}

export const useVisitLogs = () => {
  const { clinicId } = useAuth()
  const [visitLogs, setVisitLogs] = useState<VisitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVisitLogs = async () => {
    try {
      setLoading(true)
      if (!clinicId) {
        setVisitLogs([])
        return
      }

      const { data, error } = await supabase
        .from('visit_logs')
        .select('*')
        .eq('shop_id', clinicId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVisitLogs(data || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVisitLogs()
  }, [clinicId])

  const addVisitLog = async (log: Omit<VisitLog, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!clinicId) {
        throw new Error('Shop ID is required')
      }

      const { data, error } = await supabase
        .from('visit_logs')
        .insert({
          ...log,
          shop_id: clinicId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()

      if (error) throw error
      await fetchVisitLogs()
      return data?.[0]
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const getClientVisitLogs = async (client_id: string) => {
    try {
      if (!clinicId) {
        return []
      }
      
      const { data, error } = await supabase
        .from('visit_logs')
        .select('*')
        .eq('shop_id', clinicId)
        .eq('client_id', client_id)
        .order('visitDate', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  return {
    visitLogs,
    loading,
    error,
    fetchVisitLogs,
    addVisitLog,
    getClientVisitLogs,
  }
}
