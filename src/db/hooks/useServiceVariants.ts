import { useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'

export interface ServiceVariant {
  id: string
  clinic_id: string
  service_id: string
  name: string
  price: number
  duration?: number
  isActive: boolean
  service_type?: 'regular' | 'package' | null
  unit_label?: string | null
  package_quantity?: number | null
  bonus_quantity?: number | null
  expiry_value?: number | null
  expiry_unit?: 'days' | 'weeks' | 'months' | null
  created_at: string
  updated_at: string
}

// Explicit columns only.
const VARIANT_COLUMNS =
  'id, clinic_id, service_id, name, price, duration, isActive, service_type, unit_label, package_quantity, bonus_quantity, expiry_value, expiry_unit, created_at, updated_at'

export const useServiceVariants = () => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const queryKey: ['service-variants', string | null | undefined] = ['service-variants', clinicId]

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinicId) return []
      const q = supabase
        .from('service_variants')
        .select(VARIANT_COLUMNS)
        .eq('clinic_id', clinicId)
        .eq('isActive', true)
        .order('created_at', { ascending: true })
      const { data, error } = await q
      if (error) throw error
      return (data || []) as ServiceVariant[]
    },
    enabled: !!clinicId,
  })

  const variants = (listQuery.data || []) as ServiceVariant[]

  // Derived lookup map (price ascending) so POS/Services never query per service.
  const variantsByServiceId = useMemo(() => {
    const map: Record<string, ServiceVariant[]> = {}
    for (const v of variants) {
      if (!v.service_id) continue
      ;(map[v.service_id] ||= []).push(v)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    }
    return map
  }, [variants])

  const getVariantsByServiceId = useCallback(
    async (serviceId: string): Promise<ServiceVariant[]> => variantsByServiceId[serviceId] || [],
    [variantsByServiceId],
  )

  const getVariantsByServiceIds = useCallback(
    async (serviceIds: string[]): Promise<Record<string, ServiceVariant[]>> => {
      const out: Record<string, ServiceVariant[]> = {}
      for (const id of serviceIds) out[id] = variantsByServiceId[id] || []
      return out
    },
    [variantsByServiceId],
  )

  const addVariantMutation = useMutation({
    mutationFn: async (variant: Omit<ServiceVariant, 'id' | 'created_at' | 'updated_at'>) => {
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
      return data?.[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateVariantMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ServiceVariant> }) => {
      const { error } = await supabase
        .from('service_variants')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteVariantMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_variants').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const fetchVariants = listQuery.refetch

  const addVariant = useCallback(
    async (variant: Omit<ServiceVariant, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        return await addVariantMutation.mutateAsync(variant)
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [addVariantMutation],
  )

  const updateVariant = useCallback(
    async (id: string, updates: Partial<ServiceVariant>) => {
      try {
        await updateVariantMutation.mutateAsync({ id, updates })
      } catch (err: any) {
        toast.error(err.message)
      }
    },
    [updateVariantMutation],
  )

  const deleteVariant = useCallback(
    async (id: string) => {
      try {
        await deleteVariantMutation.mutateAsync(id)
      } catch (err: any) {
        toast.error(err.message)
      }
    },
    [deleteVariantMutation],
  )

  return {
    variants,
    variantsByServiceId,
    loading: listQuery.isLoading,
    error: listQuery.error ? listQuery.error.message ?? 'An error occurred' : null,
    fetchVariants,
    addVariant,
    updateVariant,
    deleteVariant,
    getVariantsByServiceId,
    getVariantsByServiceIds,
  }
}