import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

interface PortalSettings {
  id: string
  shop_id: string
  is_active: boolean
  portal_slug: string
  welcome_message: string | null
  created_at: string
  updated_at: string
}

export const usePortalSettings = () => {
  const { clinicId } = useAuth()
  const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPortalSettings = useCallback(async () => {
    try {
      setLoading(true)
      if (!clinicId) {
        console.log('⏭️ No clinicId available, skipping portal settings fetch')
        setPortalSettings(null)
        return
      }

      console.log('🔍 Fetching portal settings for shop:', clinicId)

      // Use limit(1) instead of single() to avoid 406 errors
      const { data, error } = await supabase
        .from('portal_settings')
        .select('*')
        .eq('clinic_id', clinicId)
        .limit(1)

      if (error) {
        console.error('❌ Fetch error:', error.code, error.message)
        throw error
      }

      if (!data || data.length === 0) {
        console.log('📝 No portal settings found, creating defaults...')
        await createDefaultPortalSettings()
        return
      }

      console.log('✅ Portal settings fetched successfully:', data[0])
      setPortalSettings(data[0] as PortalSettings)
      setError(null)
    } catch (err: any) {
      console.error('💥 Error fetching portal settings:', err)
      console.error('Error code:', err.code)
      console.error('Error message:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  const createDefaultPortalSettings = async () => {
    if (!clinicId) return

    try {
      // Generate slug from shop ID - will be updated when slug is provided
      const randomNum = Math.floor(1000 + Math.random() * 9000)
      const slug = `shop-${randomNum}`

      const { data, error } = await supabase
        .from('portal_settings')
        .insert({
          clinic_id: clinicId,
          is_active: false,
          portal_slug: slug,
          template_id: 1,
          primary_color: '#E91E63',
          secondary_color: '#C2185B',
          accent_color: '#F06292',
          text_color: '#FFFFFF',
        })
        .select()
        .single()

      if (error) throw error
      setPortalSettings(data as PortalSettings)
      toast.success('تم إنشاء إعدادات البوابة')
    } catch (err: any) {
      console.error('Error creating default portal settings:', err)
      setError(err.message)
      throw err
    }
  }

  useEffect(() => {
    fetchPortalSettings()
  }, [fetchPortalSettings])

  const updatePortalSettings = async (updates: Partial<PortalSettings>) => {
    try {
      if (!clinicId) {
        throw new Error('معرّف المحل غير متوفر')
      }

      console.log('💾 Updating portal settings:', updates)

      // If portal settings don't exist, create them first
      let settingsToUpdate = portalSettings
      if (!settingsToUpdate) {
        console.log('📝 Portal settings not found, creating defaults...')
        await createDefaultPortalSettings()
        // Fetch the newly created settings
        await fetchPortalSettings()
        
        // Re-fetch to get the newly created settings
        const { data: freshData } = await supabase
          .from('portal_settings')
          .select('*')
          .eq('clinic_id', clinicId)
          .single()
        
        if (!freshData) {
          throw new Error('فشل إنشاء إعدادات البوابة')
        }
        settingsToUpdate = freshData as PortalSettings
      }

      // Check if slug is being changed and if it's unique
      if (updates.portal_slug && updates.portal_slug !== settingsToUpdate.portal_slug) {
        console.log('🔍 Checking if slug is unique:', updates.portal_slug)
        const { data: existingSlug, error: slugError } = await supabase
          .from('portal_settings')
          .select('id')
          .eq('portal_slug', updates.portal_slug)
          .neq('id', settingsToUpdate.id)
          .maybeSingle()

        if (slugError) throw slugError
        if (existingSlug) {
          throw new Error('هذا المعرّف مستخدم بالفعل')
        }
      }

      console.log('✍️ Updating ID:', settingsToUpdate.id, 'with data:', updates)

      const { data, error } = await supabase
        .from('portal_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settingsToUpdate.id)
        .select()

      if (error) {
        console.error('❌ Update error:', error)
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('فشل تحديث البيانات')
      }

      console.log('✅ Update successful:', data[0])
      setPortalSettings(data[0] as PortalSettings)
      toast.success('تم حفظ إعدادات البوابة')
      return data[0] as PortalSettings
    } catch (err: any) {
      console.error('💥 Error updating portal settings:', err)
      toast.error(err.message)
      throw err
    }
  }

  const togglePortalActive = async () => {
    if (!portalSettings) return
    await updatePortalSettings({ is_active: !portalSettings.is_active })
  }

  const updateSlug = async (slug: string) => {
    // Validate slug format
    if (!slug.match(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)) {
      throw new Error('المعرّف يجب أن يحتوي على أحرف وأرقام وشرطات فقط')
    }
    await updatePortalSettings({ portal_slug: slug })
  }

  return {
    portalSettings,
    loading,
    error,
    fetchPortalSettings,
    updatePortalSettings,
    togglePortalActive,
    updateSlug,
  }
}
