import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase, DoctorShift } from '../supabase'
import toast from 'react-hot-toast'

const SHIFT_COLUMNS =
  'id, clinic_id, barber_id, work_date, shift_start, shift_end, start_pulse, end_pulse, notes, created_at, updated_at'

export interface DoctorShiftInput {
  barberId: string
  workDate: string
  shiftStart?: string | null
  shiftEnd?: string | null
  startPulse: number
  endPulse?: number | null
  notes?: string | null
}

// All shifts of one doctor between two dates (inclusive), oldest first.
export const useDoctorShifts = (barberId?: string | null, dateFrom?: string, dateTo?: string) => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const queryKey = ['doctor_shifts', clinicId, barberId || null, dateFrom || null, dateTo || null]

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinicId || !barberId || !dateFrom || !dateTo) return []
      const { data, error } = await supabase
        .from('doctor_shifts')
        .select(SHIFT_COLUMNS)
        .eq('clinic_id', clinicId)
        .eq('barber_id', barberId)
        .gte('work_date', dateFrom)
        .lte('work_date', dateTo)
        .order('work_date', { ascending: true })
      if (error) throw error
      return (data || []) as DoctorShift[]
    },
    enabled: !!clinicId && !!barberId && !!dateFrom && !!dateTo,
  })

  // Re-saving the same day updates that day (UNIQUE barber_id + work_date)
  const saveMutation = useMutation({
    mutationFn: async ({ barberId: id, workDate, shiftStart, shiftEnd, startPulse, endPulse, notes }: DoctorShiftInput) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      if (!id) throw new Error('Doctor is required')
      if (shiftStart && shiftEnd && shiftStart === shiftEnd) {
        throw new Error('نهاية الوردية لا يمكن أن تساوي بدايتها')
      }
      const end = endPulse === null || endPulse === undefined ? null : Math.trunc(endPulse)
      const start = Math.max(0, Math.trunc(startPulse || 0))
      if (end !== null && end < start) {
        throw new Error('نبضة النهاية يجب أن تكون أكبر من أو تساوي نبضة البداية')
      }

      const { data, error } = await supabase
        .from('doctor_shifts')
        .upsert(
          {
            clinic_id: clinicId,
            barber_id: id,
            work_date: workDate,
            shift_start: shiftStart || null,
            shift_end: shiftEnd || null,
            start_pulse: start,
            end_pulse: end,
            notes: notes || null,
          },
          { onConflict: 'barber_id,work_date' },
        )
        .select(SHIFT_COLUMNS)
      if (error) throw error
      return data?.[0] as DoctorShift | undefined
    },
    onSuccess: () => {
      toast.success('تم حفظ الوردية')
      queryClient.invalidateQueries({ queryKey: ['doctor_shifts'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      const { error } = await supabase
        .from('doctor_shifts')
        .delete()
        .eq('id', id)
        .eq('clinic_id', clinicId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم حذف الوردية')
      queryClient.invalidateQueries({ queryKey: ['doctor_shifts'] })
    },
  })

  const saveShift = useCallback(
    async (input: DoctorShiftInput) => {
      try {
        return await saveMutation.mutateAsync(input)
      } catch (err: any) {
        toast.error(err.message || 'تعذر حفظ الوردية')
        throw err
      }
    },
    [saveMutation],
  )

  const deleteShift = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (err: any) {
        toast.error(err.message || 'تعذر حذف الوردية')
        throw err
      }
    },
    [deleteMutation],
  )

  return {
    shifts: (listQuery.data || []) as DoctorShift[],
    loading: listQuery.isLoading,
    error: listQuery.error ? listQuery.error.message ?? 'An error occurred' : null,
    fetchShifts: listQuery.refetch,
    saveShift,
    deleteShift,
    saving: saveMutation.isPending,
    deleting: deleteMutation.isPending,
  }
}
