import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, Settings } from '../supabase'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

// Explicit columns only — settings is a flat key/value map.
const SETTINGS_COLUMNS = 'key, value, updated_at'

export const useSettings = () => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const queryKey: ['settings', string | null | undefined] = ['settings', clinicId]

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinicId) return {}
      const { data, error } = await supabase
        .from('settings')
        .select(SETTINGS_COLUMNS)
        .eq('clinic_id', clinicId)
      if (error) throw error

      const settingsMap: Record<string, any> = {}
      data?.forEach((item: Settings) => {
        settingsMap[item.key] = item.value
      })

      return settingsMap
    },
    enabled: !!clinicId,
  })

  const settings = (listQuery.data || {}) as Record<string, any>

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      if (!clinicId) throw new Error('No shop ID available')

      // First, try to delete existing record with this key and clinic_id
      await supabase
        .from('settings')
        .delete()
        .eq('key', key)
        .eq('clinic_id', clinicId)

      // Then insert the new record
      const { error } = await supabase
        .from('settings')
        .insert({
          key,
          value,
          clinic_id: clinicId,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
    },
    onSuccess: (_data, { key, value }) => {
      // Optimistically update the cache so saving a setting costs zero refetches.
      queryClient.setQueryData(queryKey, (prev: Record<string, any> | undefined) => ({
        ...(prev || {}),
        [key]: value,
      }))
    },
  })

  const fetchSettings = listQuery.refetch

  const updateSetting = useCallback(
    async (key: string, value: any) => {
      try {
        await updateSettingMutation.mutateAsync({ key, value })
        return true
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [updateSettingMutation],
  )

  const getSetting = useCallback(
    (key: string, defaultValue?: any) => {
      return settings[key] ?? defaultValue
    },
    [settings],
  )

  const getClinicName = useCallback(() => {
    return getSetting('clinicName', 'Serenity Beauty Clinic')
  }, [getSetting])

  const getVIPThreshold = useCallback(() => {
    return getSetting('vipThreshold', { type: 'visits', value: 10 })
  }, [getSetting])

  const getTheme = useCallback(() => {
    return getSetting('theme', 'dark')
  }, [getSetting])

  const getLanguage = useCallback(() => {
    return getSetting('language', 'ar')
  }, [getSetting])

  const initializeSettings = useCallback(async () => {
    if (!clinicId) return

    const defaultSettings = {
      clinicName: 'Serenity Beauty Clinic',
      clinicAddress: '',
      clinicPhone: '',
      language: localStorage.getItem('language') || 'ar',
      theme: localStorage.getItem('theme') || 'dark',
      vipThreshold: { type: 'visits', value: 10 },
      numberFormat: 'western',
    }

    try {
      for (const [key, value] of Object.entries(defaultSettings)) {
        const existing = await supabase
          .from('settings')
          .select('key')
          .eq('clinic_id', clinicId)
          .eq('key', key)
          .maybeSingle()

        if (!existing.data) {
          await updateSetting(key, value)
        }
      }
    } catch (err: any) {
      console.error('Error initializing settings:', err)
    }
  }, [clinicId, updateSetting])

  return {
    settings,
    loading: listQuery.isLoading,
    error: listQuery.error ? listQuery.error.message ?? 'An error occurred' : null,
    fetchSettings,
    updateSetting,
    getSetting,
    getClinicName,
    getVIPThreshold,
    getTheme,
    getLanguage,
    initializeSettings,
  }
}