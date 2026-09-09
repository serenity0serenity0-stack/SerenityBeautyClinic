import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase, Barber } from '../supabase'
import toast from 'react-hot-toast'

// Explicit columns only.
const BARBER_COLUMNS =
  'id, name, phone, email, specialization, active, working_hours_start, working_hours_end, days_off, vacation_start, vacation_end, created_at, updated_at, clinic_id'

export const useBarbers = () => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const queryKey: ['barbers', string | null | undefined] = ['barbers', clinicId]

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('barbers')
        .select(BARBER_COLUMNS)
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as Barber[]
    },
    enabled: !!clinicId,
  })

  const barbers = (listQuery.data || []) as Barber[]

  const addBarberMutation = useMutation({
    mutationFn: async (barber: Omit<Barber, 'id' | 'created_at' | 'updated_at'>) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      const { data, error } = await supabase
        .from('barbers')
        .insert({ ...barber, clinic_id: clinicId, active: true })
        .select()
      if (error) throw error
      return data?.[0]
    },
    onSuccess: (data) => {
      if (data) toast.success('تم إضافة الطبيب بنجاح')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateBarberMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Barber> }) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      const { data, error } = await supabase
        .from('barbers')
        .update(updates)
        .eq('id', id)
        .eq('clinic_id', clinicId)
        .select()
      if (error) throw error
      return data?.[0]
    },
    onSuccess: (data) => {
      if (data) toast.success('تم تحديث بيانات الطبيب')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteBarberMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      const { error } = await supabase
        .from('barbers')
        .delete()
        .eq('id', id)
        .eq('clinic_id', clinicId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تم حذف الطبيب')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const fetchBarbers = listQuery.refetch

  const addBarber = useCallback(
    async (barber: Omit<Barber, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        return await addBarberMutation.mutateAsync(barber)
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [addBarberMutation],
  )

  const updateBarber = useCallback(
    async (id: string, updates: Partial<Barber>) => {
      try {
        return await updateBarberMutation.mutateAsync({ id, updates })
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [updateBarberMutation],
  )

  const deleteBarber = useCallback(
    async (id: string) => {
      try {
        await deleteBarberMutation.mutateAsync(id)
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [deleteBarberMutation],
  )

  return {
    barbers,
    loading: listQuery.isLoading,
    error: listQuery.error ? listQuery.error.message ?? 'An error occurred' : null,
    fetchBarbers,
    addBarber,
    updateBarber,
    deleteBarber,
  }
}