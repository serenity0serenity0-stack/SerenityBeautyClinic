import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase, Expense } from '../supabase'
import { getEgyptDateString } from '../../utils/egyptTime'
import toast from 'react-hot-toast'

const EXPENSE_COLUMNS = 'id, clinic_id, category, amount, date, note, created_at, updated_at'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

export const useExpenses = (opts?: { dateFrom?: string; dateTo?: string }) => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const dateFrom = opts?.dateFrom ?? daysAgo(90)
  const dateTo = opts?.dateTo ?? getEgyptDateString()

  const listQuery = useQuery<Expense[]>({
    queryKey: ['expenses', clinicId, dateFrom, dateTo],
    queryFn: async () => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('expenses')
        .select(EXPENSE_COLUMNS)
        .eq('clinic_id', clinicId)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })

  const addMutation = useMutation({
    mutationFn: async (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          ...expense,
          clinic_id: clinicId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return data!
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses', clinicId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses', clinicId] }),
  })

  const getExpensesByDateRange = useCallback(
    async (startDate: string, endDate: string) => {
      const { data, error } = await supabase
        .from('expenses')
        .select(EXPENSE_COLUMNS)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
      if (error) { toast.error(error.message); return [] }
      return data ?? []
    },
    []
  )

  const getTodayExpenses = useCallback(async (): Promise<number> => {
    const today = getEgyptDateString()
    const { data, error } = await supabase
      .from('expenses')
      .select('amount')
      .eq('date', today)
    if (error) { toast.error(error.message); return 0 }
    return data?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) ?? 0
  }, [])

  const getExpensesByCategory = useCallback(
    async (category: string, startDate: string, endDate: string) => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .eq('category', category)
        .gte('date', startDate)
        .lte('date', endDate)
      if (error) { toast.error(error.message); return 0 }
      return data?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) ?? 0
    },
    []
  )

  return {
    expenses: (listQuery.data ?? []) as Expense[],
    loading: listQuery.isLoading,
    error: listQuery.error?.message ?? null,
    fetchExpenses: listQuery.refetch,
    addExpense: async (e: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => addMutation.mutateAsync(e),
    deleteExpense: async (id: string) => { await deleteMutation.mutateAsync(id) },
    getExpensesByDateRange,
    getTodayExpenses,
    getExpensesByCategory,
  }
}
