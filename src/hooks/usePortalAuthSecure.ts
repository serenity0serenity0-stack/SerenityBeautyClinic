import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/db/supabase'

export interface PortalCustomer {
  id: string // auth.uid()
  shop_id: string
  phone: string
  name?: string
  email?: string
}

/**
 * Secure Portal Authentication Hook
 * Uses Supabase Auth with RLS for data protection
 * 
 * Features:
 * - Phone-based login (treats phone as username)
 * - Automatic portal_users row creation
 * - Session persistence
 * - RLS-enforced data isolation
 */
export function usePortalAuthSecure(slug?: string) {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check current session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true)
        const { data, error: err } = await supabase.auth.getSession()
        
        if (err) throw err
        if (data.session?.user) {
          // Load portal user data
          await loadPortalUser(data.session.user.id)
        } else {
          setCustomer(null)
        }
      } catch (err) {
        console.error('❌ Session check error:', err)
        setError('خطأ في التحقق من الجلسة')
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [])

  // Load portal user data from database
  const loadPortalUser = useCallback(async (userId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('portal_users')
        .select('id, shop_id, phone, name, email')
        .eq('id', userId)
        .single()

      if (err) {
        if (err.code === 'PGRST116') {
          // User doesn't exist in portal_users yet
          console.warn('⚠️ Portal user record missing for:', userId)
          return null
        }
        throw err
      }

      setCustomer(data)
      return data
    } catch (err) {
      console.error('❌ Error loading portal user:', err)
      setError('خطأ في تحميل بيانات المستخدم')
      return null
    }
  }, [])

  // Register new portal user
  const registerPortalUser = useCallback(
    async (phone: string, password: string, name?: string, email?: string, shopId?: string) => {
      try {
        setLoading(true)
        setError(null)

        // 1. Create Supabase auth user (using phone as email)
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: `${phone}@portal.local`, // Email format from phone
          password,
          options: {
            data: {
              phone,
              name,
              email
            }
          }
        })

        if (authErr) throw authErr
        if (!authData.user) throw new Error('Failed to create user')

        console.log('✅ Auth user created:', authData.user.id)

        // 2. Create portal_users record (RLS will allow because auth.uid() matches)
        const portalUserData = {
          id: authData.user.id,
          shop_id: shopId || slug?.split('-')[0], // Extract shop ID from slug or use provided
          phone,
          name: name || null,
          email: email || null
        }

        const { data: portalUser, error: portalErr } = await supabase
          .from('portal_users')
          .insert([portalUserData])
          .select()
          .single()

        if (portalErr) {
          // Clean up auth user if portal_users insert fails
          await supabase.auth.admin.deleteUser(authData.user.id).catch(console.error)
          throw portalErr
        }

        console.log('✅ Portal user created:', portalUser)
        setCustomer(portalUser)
        return portalUser
      } catch (err: any) {
        const message = err.message || 'خطأ في التسجيل'
        console.error('❌ Registration error:', err)
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [slug]
  )

  // Login portal user
  const loginPortalUser = useCallback(
    async (phone: string, password: string) => {
      try {
        setLoading(true)
        setError(null)

        // Sign in with Supabase auth
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: `${phone}@portal.local`,
          password
        })

        if (signInErr) {
          throw new Error('فشل تسجيل الدخول - تحقق من رقم الهاتف وكلمة المرور')
        }

        if (!data.user) throw new Error('Failed to get user')

        console.log('✅ User signed in:', data.user.id)

        // Load portal user data
        const portalUser = await loadPortalUser(data.user.id)
        return portalUser
      } catch (err: any) {
        const message = err.message || 'خطأ في تسجيل الدخول'
        console.error('❌ Login error:', err)
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [loadPortalUser]
  )

  // Logout
  const logoutPortalUser = useCallback(async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      console.log('✅ User logged out')
      setCustomer(null)
      setError(null)
    } catch (err: any) {
      console.error('❌ Logout error:', err)
      setError('خطأ في تسجيل الخروج')
    } finally {
      setLoading(false)
    }
  }, [])

  // Update portal user profile
  const updateProfile = useCallback(
    async (updates: Partial<PortalCustomer>) => {
      if (!customer) throw new Error('No user logged in')

      try {
        setLoading(true)
        const { data, error: err } = await supabase
          .from('portal_users')
          .update(updates)
          .eq('id', customer.id)
          .select()
          .single()

        if (err) throw err

        console.log('✅ Profile updated')
        setCustomer(data)
        return data
      } catch (err: any) {
        console.error('❌ Update error:', err)
        setError('خطأ في تحديث الملف الشخصي')
        return null
      } finally {
        setLoading(false)
      }
    },
    [customer]
  )

  // Reset password via phone verification
  const resetPasswordViaPhone = useCallback(
    async (phone: string, email: string, newPassword: string) => {
      try {
        setLoading(true)
        setError(null)

        if (!phone || !email || !newPassword) {
          setError('يرجى ملء جميع الحقول')
          return false
        }

        console.log('🔍 Checking if phone exists:', phone)

        // Step 1: Check if phone is registered at all
        const { data: phoneCheck, error: phoneCheckErr } = await supabase
          .from('portal_users')
          .select('id, email, phone, name')
          .eq('phone', phone)
          .maybeSingle()

        if (phoneCheckErr && phoneCheckErr.code !== 'PGRST116') {
          console.error('❌ Database error:', phoneCheckErr)
          throw phoneCheckErr
        }

        if (!phoneCheck) {
          console.error('❌ Phone not registered:', phone)
          setError('رقم الهاتف غير مسجل. يرجى التسجيل أولاً')
          return false
        }

        console.log('✅ Phone found:', { phone, dbEmail: phoneCheck.email, providedEmail: email })

        // Step 2: Check if email exists for this phone
        if (!phoneCheck.email) {
          console.error('❌ Phone registered but NO EMAIL stored')
          setError('لم يتم تسجيل بريد إلكتروني لهذا الرقم. يرجى تحديث ملفك الشخصي أولاً')
          return false
        }

        // Step 3: Verify that email matches this phone (case-insensitive)
        const dbEmailLower = phoneCheck.email.toLowerCase().trim()
        const providedEmailLower = email.toLowerCase().trim()

        if (dbEmailLower !== providedEmailLower) {
          console.error('❌ Email does not match phone:', { 
            phone, 
            providedEmail: providedEmailLower, 
            dbEmail: dbEmailLower 
          })
          setError(`البريد الإلكتروني غير متطابق. البريد المسجل: ${phoneCheck.email}`)
          return false
        }

        console.log('✅ Email and phone verified, updating password')

        // Step 4: Update the password for the authenticated user
        const { error: updateErr } = await supabase.auth.updateUser({
          password: newPassword
        })

        if (updateErr) {
          console.error('❌ Password update error:', updateErr)
          throw updateErr
        }

        console.log('✅ Password updated successfully for:', phoneCheck.name)
        setError(null)
        return true
      } catch (err: any) {
        console.error('❌ Reset password error:', err)
        const message = err.message || 'خطأ في إعادة تعيين كلمة المرور'
        setError(message)
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return {
    customer,
    loading,
    error,
    registerPortalUser,
    loginPortalUser,
    logoutPortalUser,
    updateProfile,
    resetPasswordViaPhone
  }
}
