import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, Transaction } from '../supabase'
import { getEgyptDateString } from '../../utils/egyptTime'
import toast from 'react-hot-toast'

export const useTransactions = () => {
  const { clinicId } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      if (!clinicId) {
        setTransactions([])
        return
      }

      console.log('Fetching transactions from database...')
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('Transactions fetched:', data?.length || 0, 'records')
      setTransactions(data || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching transactions:', err)
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    try {
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

      if (error) throw error

      // ✅ Database trigger (log_transaction_usage) automatically logs to usage_logs
      // No need to insert here - trigger handles it automatically

      // 🔄 Auto-complete the linked booking after payment.
      // Flow: pending -> confirmed -> checked_in -> completed (cashier integration).
      try {
        const today = getEgyptDateString()

        // 1) Prefer the explicitly linked booking (booking_id on the transaction).
        let targetIds: string[] = []
        if (transaction.booking_id) {
          targetIds = [transaction.booking_id]
        } else {
          // 2) Fallback: find the client's earliest active booking today.
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
            .update({
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', bookingId)
            .in('status', ['pending', 'confirmed', 'checked_in', 'ongoing'])

          if (updateErr) {
            console.warn('⚠️ Warning: Failed to complete booking:', bookingId, updateErr)
          }
        }
        if (targetIds.length > 0) {
          console.log(`✅ Auto-completed ${targetIds.length} booking(s) after payment`)
        }
      } catch (bookingErr) {
        console.warn('⚠️ Warning: Error auto-completing bookings:', bookingErr)
        // Don't throw - transaction should succeed even if booking completion fails
      }

      await fetchTransactions()
      return data?.[0]
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const deleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchTransactions()
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const getTransactionsByDate = async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('date', date)
        .order('time', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err: any) {
      toast.error(err.message)
      return []
    }
  }

  const getTransactionsByclient_id = async (client_id: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', client_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err: any) {
      toast.error(err.message)
      return []
    }
  }

  const getTodayRevenue = async () => {
    try {
      const today = getEgyptDateString()
      const { data, error } = await supabase
        .from('transactions')
        .select('total')
        .eq('date', today)

      if (error) throw error
      return data?.reduce((sum: number, t: any) => sum + (t.total || 0), 0) || 0
    } catch (err: any) {
      toast.error(err.message)
      return 0
    }
  }

  const getRevenueForDateRange = async (startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('total, date')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (error) throw error
      return data || []
    } catch (err: any) {
      toast.error(err.message)
      return []
    }
  }

  return {
    transactions,
    loading,
    error,
    fetchTransactions,
    addTransaction,
    deleteTransaction,
    getTransactionsByDate,
    getTransactionsByclient_id,
    getTodayRevenue,
    getRevenueForDateRange,
  }
}
