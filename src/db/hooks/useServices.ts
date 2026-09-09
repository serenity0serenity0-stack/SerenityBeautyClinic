import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase, Service } from '../supabase'
import toast from 'react-hot-toast'

// Explicit columns only.
const SERVICE_COLUMNS =
  'id, nameAr, nameEn, price, duration, category, active, service_type, unit_label, package_quantity, bonus_quantity, expiry_value, expiry_unit, description, created_at, updated_at'

export const useServices = () => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const queryKey: ['services', string | null | undefined] = ['services', clinicId]

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('services')
        .select(SERVICE_COLUMNS)
        .eq('clinic_id', clinicId)
        .eq('active', true)
        .order('category', { ascending: true })
      if (error) throw error
      return (data || []) as Service[]
    },
    enabled: !!clinicId,
  })

  const services = (listQuery.data || []) as Service[]

  const onServiceChanged = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  const addServiceMutation = useMutation({
    mutationFn: async (service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      const { data, error } = await supabase
        .from('services')
        .insert({
          ...service,
          clinic_id: clinicId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
      if (error) throw error
      return data?.[0]
    },
    onSuccess: onServiceChanged,
  })

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Service> }) => {
      const { error } = await supabase
        .from('services')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: onServiceChanged,
  })

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: onServiceChanged,
  })

  const fetchServices = listQuery.refetch

  const addService = useCallback(
    async (service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        return await addServiceMutation.mutateAsync(service)
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [addServiceMutation],
  )

  const updateService = useCallback(
    async (id: string, updates: Partial<Service>) => {
      try {
        await updateServiceMutation.mutateAsync({ id, updates })
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [updateServiceMutation],
  )

  const deleteService = useCallback(
    async (id: string) => {
      try {
        await deleteServiceMutation.mutateAsync(id)
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [deleteServiceMutation],
  )

  const getServicesByCategory = useCallback(
    (category: string) => {
      return services.filter((s) => s.category === category)
    },
    [services],
  )

  const updateServicePrice = useCallback(
    async (id: string, newPrice: number) => {
      await updateService(id, { price: newPrice })
    },
    [updateService],
  )

  const bulkUpdatePrices = useCallback(
    async (serviceIds: string[], percentage: number, isIncrease: boolean) => {
      try {
        const updates = services
          .filter((s) => serviceIds.includes(s.id!))
          .map((s) => ({
            id: s.id,
            price: isIncrease ? s.price * (1 + percentage / 100) : s.price * (1 - percentage / 100),
          }))

        for (const update of updates) {
          await updateServicePrice(update.id!, update.price)
        }

        toast.success('Prices updated successfully')
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [services, updateServicePrice],
  )

  return {
    services,
    loading: listQuery.isLoading,
    error: listQuery.error ? listQuery.error.message ?? 'An error occurred' : null,
    fetchServices,
    addService,
    updateService,
    deleteService,
    getServicesByCategory,
    updateServicePrice,
    bulkUpdatePrices,
  }
}