import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'

export interface PortalSettingsWithShop {
  id: string
  clinic_id: string
  clinic_name: string
  is_active: boolean
  template_id: number
  primary_color: string
  secondary_color: string
  accent_color: string
  text_color: string
  logo_url?: string
  portal_slug: string
  welcome_message?: string
}

export function usePortalSettingsWithShop(slug?: string) {
  const [settings, setSettings] = useState<PortalSettingsWithShop | null>(null)
  const [loading, setLoading] = useState(!!slug)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async (portalSlug: string) => {
    try {
      setLoading(true)
      setError(null)

      console.log('� fetchSettings called with slug:', portalSlug)
      console.log('🟢 Type of slug:', typeof portalSlug)
      console.log('🟢 Slug length:', portalSlug?.length)

      if (!portalSlug || portalSlug === ':slug') {
        console.error('❌ Invalid slug:', portalSlug)
        setError('معرّف البوابة غير صحيح')
        return null
      }

      console.log('�🔍 Fetching portal settings for slug:', portalSlug)

      // First check if portal settings exist with this slug
      const { data: portalDataArray, error: portalErr } = await supabase
        .from('portal_settings')
        .select()
        .eq('portal_slug', portalSlug)
        .limit(1)

      if (portalErr) {
        console.error('❌ Error fetching portal settings:', portalErr)
        console.log('📊 Query params - slug:', portalSlug)
        setError('البوابة غير موجودة')
        return null
      }

      if (!portalDataArray || portalDataArray.length === 0) {
        console.warn('⚠️ Port data is null for slug:', portalSlug)
        setError('البوابة غير موجودة')
        return null
      }

      const portalData = portalDataArray[0]

      console.log('✅ Portal data found:', {
        slug: portalData.portal_slug,
        is_active: portalData.is_active,
        clinic_id: portalData.clinic_id,
      })

      // Check if portal is active
      if (!portalData.is_active) {
        console.warn('🔒 Portal exists but is not active:', portalSlug)
        setError('البوابة معطلة حالياً')
        return null
      }

      // Now fetch the clinic name
      const { data: clinicData } = await supabase
        .from('clinic')
        .select('name')
        .eq('id', portalData.clinic_id)
        .single()

      console.log('✅ Clinic found:', clinicData?.name)

      const settingsWithShop: PortalSettingsWithShop = {
        id: portalData.id,
        clinic_id: portalData.clinic_id,
        clinic_name: clinicData?.name || 'Serenity Beauty Clinic',
        is_active: portalData.is_active,
        template_id: portalData.template_id || 1,
        primary_color: portalData.primary_color || '#E91E63',
        secondary_color: portalData.secondary_color || '#C2185B',
        accent_color: portalData.accent_color || '#F06292',
        text_color: portalData.text_color || '#FFFFFF',
        logo_url: portalData.logo_url,
        portal_slug: portalData.portal_slug,
        welcome_message: portalData.welcome_message,
      }

      setSettings(settingsWithShop)
      return settingsWithShop
    } catch (err) {
      console.error('💥 Error in fetchSettings:', err)
      setError('حدث خطأ في تحميل البيانات')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (slug) {
      fetchSettings(slug)
    }
  }, [slug, fetchSettings])

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
  }
}
