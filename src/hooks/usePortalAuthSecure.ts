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
  // Helper function to get session key based on shop slug
  const getSessionKey = () => slug ? `portal_session_${slug}` : 'portal_session'
  
  // Initialize customer from localStorage on mount
  const [customer, setCustomer] = useState<PortalCustomer | null>(() => {
    try {
      const stored = localStorage.getItem(getSessionKey())
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync session to localStorage
  const saveSession = (data: PortalCustomer | null) => {
    if (data) {
      localStorage.setItem(getSessionKey(), JSON.stringify(data))
    } else {
      localStorage.removeItem(getSessionKey())
    }
  }

  // Check current session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // If we have customer from localStorage, skip auth check
        if (customer) {
          return
        }
        
        setLoading(true)
        const { data, error: err } = await supabase.auth.getSession()
        
        if (err) throw err
        if (data.session?.user) {
          // Load portal user data
          const userData = await loadPortalUser(data.session.user.id)
          if (userData) {
            saveSession(userData)
          }
        } else {
          setCustomer(null)
          saveSession(null)
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
      saveSession(data)
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

        // Determine shop ID
        const finalShopId = shopId || (slug ? slug.split('-')[0] : 'default')
        
        console.log('📱 Registering with phone:', phone, 'for shop:', finalShopId)

        // 1. Check for duplicate phone in THIS shop
        const { data: phoneExists, error: phoneCheckErr } = await supabase
          .from('portal_users')
          .select('phone')
          .eq('shop_id', finalShopId)
          .eq('phone', phone)
          .maybeSingle()

        if (phoneCheckErr && phoneCheckErr.code !== 'PGRST116') {
          throw phoneCheckErr
        }

        if (phoneExists) {
          console.error('❌ Phone already registered in this shop:', phone)
          setError('رقم الهاتف مسجل بالفعل')
          setLoading(false)
          return null
        }

        // 2. Check for duplicate email in THIS shop (only if email provided)
        if (email?.trim()) {
          const emailLower = email.toLowerCase().trim()
          const { data: emailExists, error: emailCheckErr } = await supabase
            .from('portal_users')
            .select('email')
            .eq('shop_id', finalShopId)
            .ilike('email', emailLower)
            .maybeSingle()

          if (emailCheckErr && emailCheckErr.code !== 'PGRST116') {
            throw emailCheckErr
          }

          if (emailExists) {
            console.error('❌ Email already registered in this shop:', email)
            setError('البريد الإلكتروني مسجل بالفعل')
            setLoading(false)
            return null
          }
        }

        // 3. Create auth email with correct format: phone@shopId.portal
        const authEmail = email?.trim() || `${phone}@${finalShopId}.portal`
        console.log('📧 Auth email:', authEmail)

        // 4. Create Supabase auth user
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: authEmail,
          password,
          options: {
            data: {
              phone,
              name: name || null,
              email: authEmail
            }
          }
        })

        if (authErr) throw authErr
        if (!authData.user) throw new Error('Failed to create user')

        console.log('✅ Auth user created:', authData.user.id)

        // 5. Create portal_users record
        const portalUserData = {
          id: authData.user.id,
          shop_id: finalShopId,
          phone,
          name: name || null,
          email: authEmail
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

        // 6. Create/update client record in clients table
        try {
          // Check if client already exists by phone + shop_id
          const { data: existingClient, error: checkErr } = await supabase
            .from('clients')
            .select('id')
            .eq('shop_id', finalShopId)
            .eq('phone', phone)
            .maybeSingle()

          if (checkErr && checkErr.code !== 'PGRST116') {
            console.warn('⚠️ Error checking existing client:', checkErr)
          } else if (!existingClient) {
            // Create new client record
            const { error: insertErr } = await supabase
              .from('clients')
              .insert({
                shop_id: finalShopId,
                name: name || phone, // use phone as name if no name provided
                phone: phone,
                birthday: null,
                "totalVisits": 0,
                "totalSpent": 0,
                "isVIP": false,
                notes: 'مسجل عبر البوابة الإلكترونية',
                "createdAt": new Date().toISOString(),
                "updatedAt": new Date().toISOString()
              })

            if (insertErr) {
              console.warn('⚠️ Warning: Failed to create client record:', insertErr)
              // Don't throw - portal registration is complete, client record is optional
            } else {
              console.log('✅ Client record created')
            }
          } else {
            // Update existing client with portal info
            const { error: updateErr } = await supabase
              .from('clients')
              .update({
                "updatedAt": new Date().toISOString()
              })
              .eq('id', existingClient.id)

            if (updateErr) {
              console.warn('⚠️ Warning: Failed to update client record:', updateErr)
            } else {
              console.log('✅ Client record updated')
            }
          }
        } catch (clientErr) {
          console.warn('⚠️ Error managing client record:', clientErr)
          // Don't throw - portal registration should succeed even if client record creation fails
        }

        setCustomer(portalUser)
        saveSession(portalUser)
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

  // Login portal user by phone
  const loginPortalUser = useCallback(
    async (phone: string, password: string) => {
      try {
        setLoading(true)
        setError(null)

        console.log('🔍 Looking up email for phone:', phone)

        // Step 1: Lookup email using phone from portal_users
        const { data: portalUser, error: lookupErr } = await supabase
          .from('portal_users')
          .select('id, email, phone, name, shop_id')
          .eq('phone', phone)
          .maybeSingle()

        if (lookupErr && lookupErr.code !== 'PGRST116') {
          throw lookupErr
        }

        if (!portalUser || !portalUser.email) {
          console.error('❌ Phone not found or no email registered:', phone)
          setError('رقم الهاتف غير مسجل')
          return null
        }

        // ⭐ SECURITY CHECK: Validate user is accessing correct shop
        // Get the shop ID from slug (same logic as registration)
        const expectedShopId = slug ? slug.split('-')[0] : 'default'
        
        if (portalUser.shop_id !== expectedShopId) {
          console.error('❌ SECURITY: Phone registered in different shop', {
            phone,
            attemptedShopId: expectedShopId,
            actualShopId: portalUser.shop_id
          })
          setError('رقم الهاتف غير مسجل في هذا المتجر')
          return null
        }

        console.log('✅ Email found for phone:', portalUser.email)
        console.log('✅ Shop validation passed:', portalUser.shop_id)

        // Step 2: Login using the email we found
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: portalUser.email,
          password
        })

        if (signInErr) {
          console.error('❌ Sign in failed:', signInErr)
          throw new Error('كلمة المرور غير صحيحة')
        }

        if (!data.user) throw new Error('فشل تسجيل الدخول')

        console.log('✅ User signed in. Auth UID:', data.user.id)

        // Step 3: Set customer data directly and save to session
        const customerData: PortalCustomer = {
          id: data.user.id,
          shop_id: portalUser.shop_id,
          phone: portalUser.phone,
          name: portalUser.name,
          email: portalUser.email
        }

        setCustomer(customerData)
        saveSession(customerData)
        console.log('✅ Customer state updated and session saved:', customerData)
        
        return customerData
      } catch (err: any) {
        const message = err.message || 'خطأ في تسجيل الدخول'
        console.error('❌ Login error:', message)
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Logout
  const logoutPortalUser = useCallback(async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      console.log('✅ User logged out')
      setCustomer(null)
      saveSession(null)
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
        saveSession(data)
        return data
      } catch (err: any) {
        console.error('❌ Profile update error:', err)
        setError('خطأ في تحديث البيانات')
        throw err
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
