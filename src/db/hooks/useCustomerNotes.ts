import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, CustomerNote } from '../supabase'
import toast from 'react-hot-toast'

export const useCustomerNotes = () => {
  const { clinicId, user, userName } = useAuth()
  const [notes, setNotes] = useState<CustomerNote[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNotes = useCallback(async (customerId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('customer_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotes(data || [])
    } catch (err: any) {
      toast.error(err.message)
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  const addNote = async (customerId: string, noteText: string) => {
    try {
      if (!clinicId) throw new Error('Clinic ID is required')

      const { data, error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customerId,
          clinic_id: clinicId,
          note: noteText,
          created_by: user?.id || null,
          created_by_name: userName || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()

      if (error) throw error

      await fetchNotes(customerId)
      return data?.[0]
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const updateNote = async (noteId: string, noteText: string, customerId: string) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .update({
          note: noteText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)

      if (error) throw error
      await fetchNotes(customerId)
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const deleteNote = async (noteId: string, customerId: string) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
      await fetchNotes(customerId)
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  return {
    notes,
    loading,
    fetchNotes,
    addNote,
    updateNote,
    deleteNote,
  }
}
