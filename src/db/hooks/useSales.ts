import { useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'

export interface SaleLine {
  service_id: string
  quantity: number
  variant_id?: string | null
}

export interface SaleResult {
  transaction_id: string
  invoice_no: number
  purchases: string[]
}

export const useSales = () => {
  const { clinicId } = useAuth()

  const completeSale = useCallback(
    async (params: {
      client_id: string
      items: SaleLine[]
      discount?: number
      discount_type?: 'percentage' | 'fixed'
      payment_method?: 'cash' | 'card' | 'wallet'
      barber_id?: string | null
      notes?: string
      /** true => الخدمة تتم الآن (الفاتورة مكتملة). false => ستُنفذ لاحقاً/للرصيد (غير مكتملة). */
      markDone?: boolean
    }): Promise<SaleResult | null> => {
      try {
        if (!clinicId) throw new Error('Clinic ID مطلوب')

        const { data, error } = await supabase.rpc('complete_sale', {
          p_client_id: params.client_id,
          p_clinic_id: clinicId,
          p_items: params.items.map((i) => ({
            service_id: i.service_id,
            quantity: i.quantity,
            variant_id: i.variant_id || null,
          })),
          p_discount: params.discount || 0,
          p_discount_type: params.discount_type || 'fixed',
          p_payment_method: params.payment_method || 'cash',
          p_barber_id: params.barber_id || null,
          p_notes: params.notes || null,
          p_mark_done: params.markDone === true,
        })

        if (error) throw error
        return data as SaleResult
      } catch (err: any) {
        toast.error(err.message || 'فشلت عملية البيع')
        return null
      }
    },
    [clinicId]
  )

  const consumeService = useCallback(
    async (client_id: string, service_id: string, quantity: number, note?: string, variant_id?: string | null, doctor_id?: string | null) => {
      try {
        if (!clinicId) throw new Error('Clinic ID مطلوب')

        const { data, error } = await supabase.rpc('consume_service', {
          p_client_id: client_id,
          p_clinic_id: clinicId,
          p_service_id: service_id,
          p_quantity: quantity,
          p_note: note || null,
          p_variant_id: variant_id || null,
          p_doctor_id: doctor_id || null,
          p_employee_id: null,
        })

        if (error) throw error
        toast.success(`✅ تم استهلاك ${quantity}`)
        return data
      } catch (err: any) {
        toast.error(err.message || 'فشل استهلاك الرصيد')
        return null
      }
    },
    [clinicId]
  )

  const adjustBalance = useCallback(
    async (client_id: string, service_id: string, delta: number, reason?: string) => {
      try {
        if (!clinicId) throw new Error('Clinic ID مطلوب')

        const { data, error } = await supabase.rpc('adjust_balance', {
          p_client_id: client_id,
          p_clinic_id: clinicId,
          p_service_id: service_id,
          p_delta: delta,
          p_reason: reason || null,
        })

        if (error) throw error
        toast.success('تم تعديل الرصيد')
        return data
      } catch (err: any) {
        toast.error(err.message || 'فشل تعديل الرصيد')
        return null
      }
    },
    [clinicId]
  )

  const markTransactionCompleted = useCallback(
    async (transaction_id: string) => {
      try {
        if (!clinicId) throw new Error('Clinic ID مطلوب')

        const { data, error } = await supabase.rpc('mark_transaction_completed', {
          p_transaction_id: transaction_id,
          p_clinic_id: clinicId,
        })

        if (error) throw error
        return data
      } catch (err: any) {
        toast.error(err.message || 'فشل اعتماد الفاتورة')
        return null
      }
    },
    [clinicId]
  )

  return { completeSale, consumeService, adjustBalance, markTransactionCompleted }
}