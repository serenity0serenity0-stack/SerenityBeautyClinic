import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '../supabase'
import { getEgyptDateString } from '../../utils/egyptTime'
import toast from 'react-hot-toast'

export interface VisitLog {
  id: string
  client_id: string
  visitDate: string
  visitTime: string
  servicesCount: number
  total_spent: number
  notes?: string
  created_at: string
  updated_at: string
}

const VL_COLUMNS =
  'id, client_id, visitDate, visitTime, servicesCount, total_spent, notes, created_at, updated_at, clinic_id'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

export const useVisitLogs = (opts?: { dateFrom?: string; dateTo?: string }) => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const dateFrom = opts?.dateFrom ?? daysAgo(90)
  const dateTo = opts?.dateTo ?? getEgyptDateString()

  const listQuery = useQuery<VisitLog[]>({
    queryKey: ['visit_logs', clinicId, dateFrom, dateTo],
    queryFn: async () => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('visit_logs')
        .select(VL_COLUMNS)
        .eq('clinic_id', clinicId)
        .gte('visitDate', dateFrom)
        .lte('visitDate', dateTo)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })

  const addMutation = useMutation({
    mutationFn: async (log: Omit<VisitLog, 'id' | 'created_at' | 'updated_at'>) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      if (!log.visitDate) throw new Error('Visit date is required')

      const { data, error } = await supabase
        .from('visit_logs')
        .insert({
          client_id: log.client_id,
          visit_date: log.visitDate,
          visitDate: log.visitDate,
          visitTime: log.visitTime,
          servicesCount: log.servicesCount,
          total_spent: log.total_spent,
          notes: log.notes || '',
          clinic_id: clinicId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return data!
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visit_logs', clinicId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('visit_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visit_logs', clinicId] }),
  })

  const getClientVisitLogs = useCallback(
    async (client_id: string): Promise<VisitLog[]> => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('visit_logs')
        .select(VL_COLUMNS)
        .eq('clinic_id', clinicId)
        .eq('client_id', client_id)
        .order('visitDate', { ascending: false })
      if (error) { toast.error(error.message); throw error }
      return data ?? []
    },
    [clinicId]
  )

  return {
    visitLogs: (listQuery.data ?? []) as VisitLog[],
    loading: listQuery.isLoading,
    error: listQuery.error?.message ?? null,
    fetchVisitLogs: listQuery.refetch,
    addVisitLog: async (log: Omit<VisitLog, 'id' | 'created_at' | 'updated_at'>) => addMutation.mutateAsync(log),
    getClientVisitLogs,
    deleteVisitLog: async (id: string) => { await deleteMutation.mutateAsync(id) },
  }
}
