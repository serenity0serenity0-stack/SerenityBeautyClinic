import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'

export interface ProfileData {
  id: string
  name: string
  email: string
  phone?: string
  phone_verified?: boolean
  email_verified?: boolean
}

export function usePortalProfile(customerId?: string) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!customerId) return

    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('customer_users')
        .select('id, full_name, email, phone')
        .eq('id', customerId)
        .single()

      if (err) throw err
      if (data) {
        setProfile({
          id: data.id,
          name: data.full_name,
          email: data.email,
          phone: data.phone,
          phone_verified: false,
          email_verified: false
        })
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('خطأ في تحميل البيانات الشخصية')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const updateProfile = useCallback(
    async (name: string, phone: string) => {
      if (!customerId) {
        setError('خطأ في البيانات')
        return false
      }

      setLoading(true)
      try {
        const { error: err } = await supabase
          .from('customer_users')
          .update({ full_name: name, phone })
          .eq('id', customerId)

        if (err) throw err

        setProfile(prev => prev ? { ...prev, name, phone } : null)
        return true
      } catch (err: any) {
        console.error('Error updating profile:', err)
        setError(err.message || 'خطأ في تحديث البيانات')
        return false
      } finally {
        setLoading(false)
      }
    },
    [customerId]
  )

  const sendPhoneVerification = useCallback(
    async () => {
      if (!customerId) {
        setError('خطأ في البيانات')
        return false
      }

      setLoading(true)
      try {
        // In a real app, send SMS verification code
        // For now, we'll just mark as verified
        const { error: err } = await supabase
          .from('customer_users')
          .update({ verified: true })
          .eq('id', customerId)

        if (err) throw err
        setProfile(prev => prev ? { ...prev, phone_verified: true } : null)
        return true
      } catch (err: any) {
        console.error('Error verifying phone:', err)
        setError(err.message || 'خطأ في التحقق من الهاتف')
        return false
      } finally {
        setLoading(false)
      }
    },
    [customerId]
  )

  const sendEmailVerification = useCallback(
    async () => {
      if (!customerId) {
        setError('خطأ في البيانات')
        return false
      }

      setLoading(true)
      try {
        // In a real app, send email verification code
        // For now, we'll just mark as verified
        const { error: err } = await supabase
          .from('customer_users')
          .update({ verified: true })
          .eq('id', customerId)

        if (err) throw err
        setProfile(prev => prev ? { ...prev, email_verified: true } : null)
        return true
      } catch (err: any) {
        console.error('Error verifying email:', err)
        setError(err.message || 'خطأ في التحقق من البريد الإلكتروني')
        return false
      } finally {
        setLoading(false)
      }
    },
    [customerId]
  )

  return {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
    sendPhoneVerification,
    sendEmailVerification
  }
}
