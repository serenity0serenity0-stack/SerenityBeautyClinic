import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '../supabase'
import { getEgyptDateString } from '../../utils/egyptTime'

// ---------------------------------------------------------------------------
// Types for the unified Daily Records page
// ---------------------------------------------------------------------------

export type ActivityType = 'sale' | 'visit' | 'consumption' | 'payment' | 'invoice' | 'adjustment'

export interface DailyInvoiceLine {
  service_id?: string | null
  service_name: string
  service_type?: string | null
  unit_label?: string | null
  unit_price: number
  quantity: number
  bonus_quantity: number
  line_total: number
  variant_id?: string | null
}

export interface DailyTransaction {
  id: string
  client_id?: string | null
  client_name?: string | null
  client_phone?: string | null
  amount?: number | null
  discount?: number | null
  total: number
  payment_method?: string | null
  status?: string | null
  is_completed?: boolean | null
  invoice_no?: number | null
  date: string
  time?: string | null
  items?: unknown
  subtotal?: number | null
  visit_number?: number | null
  barber_id?: string | null
  barber_name?: string | null
  description?: string | null
  created_at?: string | null
  lines?: DailyInvoiceLine[]
}

export interface DailyVisit {
  id: string
  client_id?: string | null
  service_id?: string | null
  variant_id?: string | null
  service_name?: string | null
  unit_label?: string | null
  purchase_id?: string | null
  quantity?: number | null
  balance_before?: number | null
  balance_after?: number | null
  doctor_id?: string | null
  doctor_name?: string | null
  employee_id?: string | null
  employee_name?: string | null
  visit_type?: string | null
  start_time?: string | null
  end_time?: string | null
  notes?: string | null
  visitTime?: string | null
  visit_date?: string | null
  booking_id?: string | null
  visit_number?: number | null
  created_at?: string | null
}

export interface DailyAdjustment {
  id: string
  client_id?: string | null
  service_id?: string | null
  variant_id?: string | null
  service_name?: string | null
  unit_label?: string | null
  delta: number
  reason?: string | null
  created_at?: string | null
  created_by?: string | null
}

export interface DailySummary {
  totalSales: number
  saleCount: number
  totalCollected: number
  visitCount: number
  servicesPerformed: number
  sessionsConsumed: number
  pulsesConsumed: number
  adjustmentCount: number
  paymentBreakdown: Record<string, number>
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'حدث خطأ'
}

/**
 * Fetch invoices lines for a set of transaction ids (one query, batched).
 */
async function fetchInvoiceLines(txIds: string[]): Promise<Record<string, DailyInvoiceLine[]>> {
  if (txIds.length === 0) return {}
  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .in('transaction_id', txIds)
    .order('created_at', { ascending: true })
  if (error) throw error
  const map: Record<string, DailyInvoiceLine[]> = {}
  ;(data || []).forEach((it: any) => {
    const line: DailyInvoiceLine = {
      service_id: it.service_id,
      service_name: it.service_name,
      service_type: it.service_type,
      unit_label: it.unit_label,
      unit_price: it.unit_price,
      quantity: it.quantity,
      bonus_quantity: it.bonus_quantity || 0,
      line_total: it.line_total,
      variant_id: it.variant_id,
    }
    if (!map[it.transaction_id]) map[it.transaction_id] = []
    map[it.transaction_id].push(line)
  })
  return map
}

export const useDailyRecords = () => {
  const { clinicId } = useAuth()
  const [sales, setSales] = useState<DailyTransaction[]>([])
  const [invoices, setInvoices] = useState<DailyTransaction[]>([])
  const [payments, setPayments] = useState<DailyTransaction[]>([])
  const [visits, setVisits] = useState<DailyVisit[]>([])
  const [consumptions, setConsumptions] = useState<DailyVisit[]>([])
  const [adjustments, setAdjustments] = useState<DailyAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientNames, setClientNames] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)

  const fetchRecords = useCallback(
    async (date?: string) => {
      const day = date || getEgyptDateString()

      abortRef.current?.abort?.()

      if (!clinicId) {
        setSales([])
        setVisits([])
        setConsumptions([])
        setAdjustments([])
        setInvoices([])
        setPayments([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // ---- Transactions (sales / invoices / payments) - full day ----
        const txRes = await supabase
          .from('transactions')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('date', day)
          .order('created_at', { ascending: false })

        if (txRes.error) throw txRes.error
        const txData = (txRes.data || []) as DailyTransaction[]

        // ---- Invoice lines (real service names) ---------------------
        const linesMap = await fetchInvoiceLines(txData.map((t) => t.id))

        const txWithLines = txData.map((t) => ({ ...t, lines: linesMap[t.id] || [] }))
        setSales(txWithLines)
        setInvoices(txWithLines)
        setPayments(txWithLines)

        // ---- Visits + consumptions (visit_logs) - full day ----------
        const visitRes = await supabase
          .from('visit_logs')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('visit_date', day)
          .in('visit_type', ['consumption', 'service'])
          .not('service_name', 'is', null)
          .order('created_at', { ascending: false })

        if (visitRes.error) throw visitRes.error
        const visitData = (visitRes.data || []) as DailyVisit[]

        setVisits(visitData)
        setConsumptions(visitData.filter((v) => v.visit_type === 'consumption'))

        // ---- Adjustments - full day ---------------------------------
        const adjRes = await supabase
          .from('balance_adjustments')
          .select('*')
          .eq('clinic_id', clinicId)
          .gte('created_at', `${day}T00:00:00`)
          .lte('created_at', `${day}T23:59:59`)
          .order('created_at', { ascending: false })

        if (adjRes.error) throw adjRes.error
        const adjData = (adjRes.data || []) as DailyAdjustment[]
        setAdjustments(adjData)

        // ---- Client names (batch resolution for visits/adjustments) --
        const ids = new Set<string>()
        txData.forEach((t) => t.client_id && ids.add(t.client_id))
        visitData.forEach((v) => v.client_id && ids.add(v.client_id))
        adjData.forEach((a) => a.client_id && ids.add(a.client_id))
        const nameMap: Record<string, string> = {}
        txData.forEach((t) => {
          if (t.client_id && t.client_name) nameMap[t.client_id] = t.client_name
        })
        if (ids.size > 0) {
          const cRes = await supabase
            .from('clients')
            .select('id, name')
            .in('id', Array.from(ids))
            .eq('clinic_id', clinicId)
          if (!cRes.error) {
            ;(cRes.data || []).forEach((c: any) => {
              if (c.name) nameMap[c.id] = c.name
            })
          }
        }
        setClientNames(nameMap)
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(errorMessage(err))
        }
      } finally {
        setLoading(false)
      }
    },
    [clinicId]
  )

  const deleteRecord = useCallback(
    async (type: 'transaction' | 'consumption', id: string) => {
      if (!clinicId) return
      const { error } = await supabase.rpc('delete_daily_record', {
        p_type: type,
        p_id: id,
        p_clinic_id: clinicId,
      })
      if (error) throw error
    },
    [clinicId]
  )

  return { sales, invoices, payments, visits, consumptions, adjustments, loading, error, fetchRecords, clientNames, deleteRecord }
}

/**
 * Pure client-side summary computed over (already filtered) daily arrays,
 * so the KPI cards always match the currently shown rows.
 */
export function computeSummary(
  tx: DailyTransaction[],
  visits: DailyVisit[]
): DailySummary {
  const breakdown: Record<string, number> = {}
  let collected = 0
  for (const t of tx) {
    collected += t.total || 0
    const m = t.payment_method || 'cash'
    breakdown[m] = (breakdown[m] || 0) + (t.total || 0)
  }

  const consumptions = visits.filter((v) => v.visit_type === 'consumption')
  const services = visits.filter((v) => v.visit_type === 'service')

  let sessions = 0
  let pulses = 0
  for (const c of consumptions) {
    const q = c.quantity || 1
    const label = (c.unit_label || '').toLowerCase()
    if (label.includes('نبض') || label.includes('pulse')) pulses += q
    else if (label.includes('جلسة')) sessions += q
    else sessions += q
  }

  return {
    totalSales: collected,
    saleCount: tx.length,
    totalCollected: collected,
    paymentBreakdown: breakdown,
    visitCount: visits.length,
    servicesPerformed: services.length,
    sessionsConsumed: sessions,
    pulsesConsumed: pulses,
    adjustmentCount: 0,
  }
}
