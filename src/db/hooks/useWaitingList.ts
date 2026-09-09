import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase, WaitingList } from '../supabase'
import toast from 'react-hot-toast'

// Explicit columns only.
const WAITING_COLUMNS =
  'id, clinic_id, client_id, client_name, client_phone, barber_id, barber_name, service_type, duration, status, notes, created_at, updated_at'

export const useWaitingList = () => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const queryKey: ['waiting-list', string | null | undefined] = ['waiting-list', clinicId]

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('waiting_list')
        .select(WAITING_COLUMNS)
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []) as WaitingList[]
    },
    enabled: !!clinicId,
  })

  const waiting = (listQuery.data || []) as WaitingList[]

  const addToWaitingListMutation = useMutation({
    mutationFn: async (entry: Omit<WaitingList, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      const { data, error } = await supabase
        .from('waiting_list')
        .insert({ ...entry, clinic_id: clinicId, status: 'waiting' })
        .select()
      if (error) throw error
      return data?.[0]
    },
    onSuccess: (data) => {
      if (data) toast.success('تمت الإضافة إلى قائمة الانتظار')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateWaitingEntryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WaitingList> }) => {
      const { data, error } = await supabase
        .from('waiting_list')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
      if (error) throw error
      return data?.[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const removeFromWaitingListMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('waiting_list').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('تمت إزالة العميل من قائمة الانتظار')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const fetchWaitingList = listQuery.refetch

  const addToWaitingList = useCallback(
    async (entry: Omit<WaitingList, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
      try {
        return await addToWaitingListMutation.mutateAsync(entry)
      } catch (err: any) {
        toast.error(err.message || 'خطأ في الإضافة إلى قائمة الانتظار')
        throw err
      }
    },
    [addToWaitingListMutation],
  )

  const updateWaitingEntry = useCallback(
    async (id: string, updates: Partial<WaitingList>) => {
      try {
        return await updateWaitingEntryMutation.mutateAsync({ id, updates })
      } catch (err: any) {
        toast.error(err.message || 'خطأ في تحديث قائمة الانتظار')
        throw err
      }
    },
    [updateWaitingEntryMutation],
  )

  /** Mark a waiting entry as notified / booked / removed. */
  const setWaitingStatus = useCallback(
    async (id: string, status: WaitingList['status']) => {
      return updateWaitingEntry(id, { status })
    },
    [updateWaitingEntry],
  )

  const removeFromWaitingList = useCallback(
    async (id: string) => {
      try {
        await removeFromWaitingListMutation.mutateAsync(id)
      } catch (err: any) {
        toast.error(err.message || 'خطأ في إزالة العميل من قائمة الانتظار')
        throw err
      }
    },
    [removeFromWaitingListMutation],
  )

  return {
    waiting,
    loading: listQuery.isLoading,
    error: listQuery.error ? listQuery.error.message ?? 'An error occurred' : null,
    fetchWaitingList,
    addToWaitingList,
    updateWaitingEntry,
    setWaitingStatus,
    removeFromWaitingList,
  }
}