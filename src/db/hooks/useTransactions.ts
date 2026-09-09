import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase, Transaction } from '../supabase'
import { getEgyptDateString } from '../../utils/egyptTime'
import toast from 'react-hot-toast'

const TX_COLUMNS =
  'id, client_id, client_name, client_phone, barber_id, barber_name, amount, discount, discount_type, total, payment_method, status, description, is_completed, invoice_no, date, time, items, subtotal, visit_number, created_at, clinic_id'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

export const useTransactions = (opts?: { dateFrom?: string; dateTo?: string }) => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const dateFrom = opts?.dateFrom ?? daysAgo(90)
  const dateTo = opts?.dateTo ?? getEgyptDateString()

  // ── Main list query (React Query) ──
  const listQuery = useQuery<Transaction[]>({
    queryKey: ['transactions', clinicId, dateFrom, dateTo],
    queryFn: async () => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('transactions')
        .select(TX_COLUMNS)
        .eq('clinic_id', clinicId)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })

  // ── Mutations (invalidate cache after mutations) ──
  const addMutation = useMutation({
    mutationFn: async (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
      if (!clinicId) throw new Error('Clinic ID is required')

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...transaction,
          clinic_id: clinicId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error

      // Auto-complete linked booking after payment
      try {
        const today = getEgyptDateString()
        let targetIds: string[] = []

        if (transaction.booking_id) {
          targetIds = [transaction.booking_id]
        } else {
          const client_id = transaction.client_id
          const client_phone = transaction.client_phone

          let q = supabase
            .from('bookings')
            .select('id')
            .eq('clinic_id', clinicId)
            .eq('booking_date', today)
            .in('status', ['pending', 'confirmed', 'checked_in', 'ongoing'])
            .order('booking_time', { ascending: true })
            .limit(1)

          if (client_id) q = q.eq('client_id', client_id)
          else if (client_phone) q = q.eq('client_phone', client_phone)

          if (client_id || client_phone) {
            const { data: activeBookings, error: bookingErr } = await q
            if (!bookingErr && activeBookings && activeBookings.length > 0) {
              targetIds = activeBookings.map((b: any) => b.id)
            }
          }
        }

        for (const bookingId of targetIds) {
          const { error: updateErr } = await supabase
            .from('bookings')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', bookingId)
            .in('status', ['pending', 'confirmed', 'checked_in', 'ongoing'])
          if (updateErr) console.warn('Warning: Failed to complete booking:', bookingId, updateErr)
        }
        if (targetIds.length > 0) {
          console.log(`Auto-completed ${targetIds.length} booking(s) after payment`)
        }
      } catch (bookingErr) {
        console.warn('Warning: Error auto-completing bookings:', bookingErr)
      }

      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', clinicId] })
      queryClient.invalidateQueries({ queryKey: ['bookings', clinicId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', clinicId] })
    },
  })

  // ── Utility functions (use cached data or direct query) ──
  const getTransactionsByDate = useCallback(
    async (date: string): Promise<Transaction[]> => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('transactions')
        .select(TX_COLUMNS)
        .eq('date', date)
        .order('time', { ascending: false })
      if (error) { toast.error(error.message); return [] }
      return data ?? []
    },
    [clinicId]
  )

  const getTransactionsByclient_id = useCallback(
    async (client_id: string): Promise<Transaction[]> => {
      const q = supabase
        .from('transactions')
        .select(TX_COLUMNS)
        .eq('client_id', client_id)
        .order('created_at', { ascending: false })
      if (clinicId) q.eq('clinic_id', clinicId)
      const { data, error } = await q
      if (error) { toast.error(error.message); return [] }
      return data ?? []
    },
    [clinicId]
  )

  const getTodayRevenue = useCallback(async (): Promise<number> => {
    const today = getEgyptDateString()
    const { data, error } = await supabase
      .from('transactions')
      .select('total')
      .eq('date', today)
    if (error) { toast.error(error.message); return 0 }
    return data?.reduce((sum: number, t: any) => sum + (t.total || 0), 0) ?? 0
  }, [])

  const getRevenueForDateRange = useCallback(
    async (startDate: string, endDate: string) => {
      const { data, error } = await supabase
        .from('transactions')
        .select('total, date')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
      if (error) { toast.error(error.message); return [] }
      return data ?? []
    },
    []
  )

  return {
    transactions: (listQuery.data ?? []) as Transaction[],
    loading: listQuery.isLoading,
    error: listQuery.error?.message ?? null,
    fetchTransactions: listQuery.refetch,
    addTransaction: async (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
      const result = await addMutation.mutateAsync(tx)
      return result
    },
    deleteTransaction: async (id: string) => { await deleteMutation.mutateAsync(id) },
    getTransactionsByDate,
    getTransactionsByclient_id,
    getTodayRevenue,
    getRevenueForDateRange,
  }
}
