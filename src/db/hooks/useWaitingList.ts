import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, WaitingList } from '../supabase'
import toast from 'react-hot-toast'

export const useWaitingList = () => {
  const { clinicId } = useAuth()
  const [waiting, setWaiting] = useState<WaitingList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWaitingList = useCallback(async () => {
    try {
      setLoading(true)
      if (!clinicId) {
        setWaiting([])
        return
      }

      const { data, error } = await supabase
        .from('waiting_list')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })

      if (error) throw error
      setWaiting(data || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching waiting list:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    fetchWaitingList()
  }, [fetchWaitingList])

  const addToWaitingList = async (
    entry: Omit<WaitingList, 'id' | 'created_at' | 'updated_at' | 'status'>
  ) => {
    try {
      if (!clinicId) throw new Error('Clinic ID is required')

      const { data, error } = await supabase
        .from('waiting_list')
        .insert({ ...entry, clinic_id: clinicId, status: 'waiting' })
        .select()

      if (error) throw error
      setWaiting((prev) => [...prev, data?.[0]])
      toast.success('تمت الإضافة إلى قائمة الانتظار')
      return data?.[0]
    } catch (err: any) {
      toast.error(err.message || 'خطأ في الإضافة إلى قائمة الانتظار')
      throw err
    }
  }

  const updateWaitingEntry = async (id: string, updates: Partial<WaitingList>) => {
    try {
      const { data, error } = await supabase
        .from('waiting_list')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()

      if (error) throw error
      setWaiting((prev) => prev.map((w) => (w.id === id ? data?.[0] : w)))
      return data?.[0]
    } catch (err: any) {
      toast.error(err.message || 'خطأ في تحديث قائمة الانتظار')
      throw err
    }
  }

  /** Mark a waiting entry as notified / booked / removed. */
  const setWaitingStatus = async (id: string, status: WaitingList['status']) => {
    return updateWaitingEntry(id, { status })
  }

  const removeFromWaitingList = async (id: string) => {
    try {
      const { error } = await supabase.from('waiting_list').delete().eq('id', id)
      if (error) throw error
      setWaiting((prev) => prev.filter((w) => w.id !== id))
      toast.success('تمت إزالة العميل من قائمة الانتظار')
    } catch (err: any) {
      toast.error(err.message || 'خطأ في إزالة العميل من قائمة الانتظار')
      throw err
    }
  }

  return {
    waiting,
    loading,
    error,
    fetchWaitingList,
    addToWaitingList,
    updateWaitingEntry,
    setWaitingStatus,
    removeFromWaitingList,
  }
}
