import { useState, useEffect } from 'react'
import { supabase, Settings } from '../supabase'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

export const useSettings = () => {
  const { clinicId } = useAuth()
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = async () => {
    try {
      setLoading(true)
      
      // Only fetch if we have a shop ID
      if (!clinicId) {
        setSettings({})
        setError(null)
        return
      }

      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('clinic_id', clinicId)

      if (error) throw error
      
      const settingsMap: Record<string, any> = {}
      data?.forEach((item: Settings) => {
        settingsMap[item.key] = item.value
      })
      
      setSettings(settingsMap)
      setError(null)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching settings:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [clinicId])

  const updateSetting = async (key: string, value: any) => {
    try {
      if (!clinicId) {
        throw new Error('No shop ID available')
      }

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
      
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }))
      
      return true
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  const getSetting = (key: string, defaultValue?: any) => {
    return settings[key] ?? defaultValue
  }

  const getBarbershipName = () => {
    return getSetting('barbershipName', 'My Barbershop')
  }

  const getVIPThreshold = () => {
    return getSetting('vipThreshold', { type: 'visits', value: 10 })
  }

  const getTheme = () => {
    return getSetting('theme', 'dark')
  }

  const getLanguage = () => {
    return getSetting('language', 'ar')
  }

  const initializeSettings = async () => {
    if (!clinicId) return

    const defaultSettings = {
      barbershipName: 'My Barbershop',
      barbershipAddress: '',
      barbershipPhone: '',
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
  }

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSetting,
    getSetting,
    getBarbershipName,
    getVIPThreshold,
    getTheme,
    getLanguage,
    initializeSettings,
  }
}
