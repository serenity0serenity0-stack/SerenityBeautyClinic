import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'

export interface ServiceVariant {
  id: string
  service_id: string
  nameAr: string
  nameEn: string
  price: number
  duration?: number
  isActive: boolean
  created_at: string
  updated_at: string
}

export const useServiceVariants = () => {
  const [variants, setVariants] = useState<ServiceVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVariants = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('service_variants')
        .select('*')
        .eq('isActive', true)
        .order('created_at', { ascending: true })

      if (error) throw error
      setVariants(data || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVariants()
  }, [])

  const addVariant = async (variant: Omit<ServiceVariant, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('service_variants')
        .insert({
          ...variant,
          service_id: variant.service_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()

      if (error) throw error
      await fetchVariants()
      return data?.[0]
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const updateVariant = async (id: string, updates: Partial<ServiceVariant>) => {
    try {
      const { error } = await supabase
        .from('service_variants')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      await fetchVariants()
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const deleteVariant = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_variants')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchVariants()
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const getVariantsByServiceId = async (serviceId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_variants')
        .select('*')
        .eq('service_id', serviceId)
        .eq('isActive', true)
        .order('price', { ascending: true })

      if (error) throw error
      return data || []
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  return {
    variants,
    loading,
    error,
    fetchVariants,
    addVariant,
    updateVariant,
    deleteVariant,
    getVariantsByServiceId,
  }
}
