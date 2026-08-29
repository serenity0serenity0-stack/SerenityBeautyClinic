import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, ServicePurchase, InvoiceItem, ClientBalanceSummary } from '../supabase'
import toast from 'react-hot-toast'

export const useBalanceData = () => {
  const { clinicId } = useAuth()

  const getPurchasesByClient = useCallback(
    async (clientId: string): Promise<ServicePurchase[]> => {
      try {
        if (!clinicId) return []
        const { data, error } = await supabase
          .from('service_purchases')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data || []) as ServicePurchase[]
      } catch (err: any) {
        toast.error(err.message)
        return []
      }
    },
    [clinicId]
  )

  const getConsumptionsByClient = useCallback(
    async (clientId: string) => {
      try {
        if (!clinicId) return []
        const { data, error } = await supabase
          .from('service_consumptions')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
      } catch (err: any) {
        toast.error(err.message)
        return []
      }
    },
    [clinicId]
  )

  const getAdjustmentsByClient = useCallback(
    async (clientId: string) => {
      try {
        if (!clinicId) return []
        const { data, error } = await supabase
          .from('balance_adjustments')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
      } catch (err: any) {
        toast.error(err.message)
        return []
      }
    },
    [clinicId]
  )

  const getInvoiceItemsByTransaction = useCallback(
    async (transactionId: string): Promise<InvoiceItem[]> => {
      try {
        const { data, error } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('transaction_id', transactionId)
          .order('created_at', { ascending: true })

        if (error) throw error
        return (data || []) as InvoiceItem[]
      } catch (err: any) {
        toast.error(err.message)
        return []
      }
    },
    []
  )

  const getBalanceSummaryByClient = useCallback(
    async (clientId: string): Promise<ClientBalanceSummary[]> => {
      try {
        if (!clinicId) return []
        const { data, error } = await supabase
          .from('client_balance_summary')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('client_id', clientId)
          .order('service_name', { ascending: true })

        if (error) throw error
        return (data || []) as ClientBalanceSummary[]
      } catch (err: any) {
        toast.error(err.message)
        return []
      }
    },
    [clinicId]
  )

  return {
    getPurchasesByClient,
    getConsumptionsByClient,
    getAdjustmentsByClient,
    getInvoiceItemsByTransaction,
    getBalanceSummaryByClient,
  }
}

export const useClientBalance = (clientId?: string) => {
  const { clinicId } = useAuth()
  const [summary, setSummary] = useState<ClientBalanceSummary[]>([])
  const [purchases, setPurchases] = useState<ServicePurchase[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!clientId || !clinicId) {
      setSummary([])
      setPurchases([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [sum, pur] = await Promise.all([
        supabase
          .from('client_balance_summary')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('client_id', clientId)
          .order('service_name', { ascending: true }),
        supabase
          .from('service_purchases')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('client_id', clientId)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ])

      if (sum.error) throw sum.error
      if (pur.error) throw pur.error

      setSummary((sum.data || []) as ClientBalanceSummary[])
      setPurchases((pur.data || []) as ServicePurchase[])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [clientId, clinicId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { summary, purchases, loading, refresh }
}