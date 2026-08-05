import { useState, useEffect } from 'react'
import { supabase } from '@/db/supabase'

const PORTAL_SESSION_KEY = 'portal_session'

export interface PortalCustomer {
  id: string
  clinicId: string
  slug: string
  fullName: string
  email: string
  phone: string
  authUserId: string
}

/**
 * Portal Auth Hook - Completely independent from Supabase Auth
 * Uses localStorage for session persistence
 * Portal users maintain separate sessions from main app users
 */
export function usePortalAuth(slug: string) {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`${PORTAL_SESSION_KEY}_${slug}`)
    if (stored) {
      try {
        const parsedCustomer = JSON.parse(stored)
        setCustomer(parsedCustomer)
      } catch {
        localStorage.removeItem(`${PORTAL_SESSION_KEY}_${slug}`)
      }
    }
    setLoading(false)
  }, [slug])

  // Sign in - verify against customer_users table
  const signIn = async (email: string, password: string, clinicId: string) => {
    try {
      setError(null)

      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        const errorMsg = translateError(authError.message)
        setError(errorMsg)
        return { error: errorMsg }
      }

      if (!authData.user) {
        setError('فشل تسجيل الدخول')
        return { error: 'فشل تسجيل الدخول' }
      }

      // Verify this customer belongs to THIS shop
      const { data: customerData, error: customerError } = await supabase
        .from('customer_users')
        .select('id, shop_id, full_name, email, phone, auth_user_id')
        .eq('auth_user_id', authData.user.id)
        .eq('shop_id', clinicId)
        .maybeSingle()

      if (customerError || !customerData) {
        // Sign out from Supabase but don't error on app - just session mismatch
        await supabase.auth.signOut()
        const errorMsg = 'هذا الحساب غير مسجل في هذا المحل'
        setError(errorMsg)
        return { error: errorMsg }
      }

      // Save to localStorage - this is the local portal session
      const session: PortalCustomer = {
        id: customerData.id,
        clinicId: customerData.shop_id,
        slug,
        fullName: customerData.full_name,
        email: customerData.email,
        phone: customerData.phone,
        authUserId: customerData.auth_user_id,
      }

      localStorage.setItem(`${PORTAL_SESSION_KEY}_${slug}`, JSON.stringify(session))
      setCustomer(session)
      setError(null)

      return { error: null }
    } catch (err: any) {
      const errorMsg = 'خطأ في الاتصال، يرجى المحاولة مرة أخرى'
      setError(errorMsg)
      return { error: errorMsg }
    }
  }

  // Sign up - create new customer
  const signUp = async (
    name: string,
    email: string,
    phone: string,
    password: string,
    birthday: string,
    clinicId: string
  ) => {
    try {
      setError(null)

      // Check duplicate email in this shop
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from('customer_users')
        .select('id')
        .eq('shop_id', clinicId)
        .eq('email', email)
        .maybeSingle()

      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        throw emailCheckError
      }

      if (existingEmail) {
        const errorMsg = 'البريد الإلكتروني مسجل بالفعل في هذا المحل'
        setError(errorMsg)
        return { error: errorMsg }
      }

      // Check duplicate phone in this shop
      const { data: existingPhone, error: phoneCheckError } = await supabase
        .from('customer_users')
        .select('id')
        .eq('shop_id', clinicId)
        .eq('phone', phone)
        .maybeSingle()

      if (phoneCheckError && phoneCheckError.code !== 'PGRST116') {
        throw phoneCheckError
      }

      if (existingPhone) {
        const errorMsg = 'رقم الهاتف مسجل بالفعل في هذا المحل'
        setError(errorMsg)
        return { error: errorMsg }
      }

      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            shop_id: clinicId,
            role: 'customer',
            full_name: name,
          },
        },
      })

      if (authError) {
        const errorMsg = translateError(authError.message)
        setError(errorMsg)
        return { error: errorMsg }
      }

      if (!authData.user) {
        const errorMsg = 'حدث خطأ في إنشاء الحساب'
        setError(errorMsg)
        return { error: errorMsg }
      }

      // Insert into customer_users table
      const { data: newCustomer, error: insertError } = await supabase
        .from('customer_users')
        .insert({
          shop_id: clinicId,
          auth_user_id: authData.user.id,
          full_name: name,
          email,
          phone,
          birth_date: birthday || null,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert customer error:', insertError)
        const errorMsg = 'حدث خطأ في حفظ البيانات، يرجى المحاولة مرة أخرى'
        setError(errorMsg)
        return { error: errorMsg }
      }

      // Check if client exists in clients table (by phone)
      const { data: existingClient, error: clientCheckError } = await supabase
        .from('clients')
        .select('id')
        .eq('shop_id', clinicId)
        .eq('phone', phone)
        .maybeSingle()

      if (clientCheckError && clientCheckError.code !== 'PGRST116') {
        console.error('Client check error:', clientCheckError)
      }

      // If no existing client, create one
      if (!existingClient) {
        const { error: createClientError } = await supabase.from('clients').insert({
          shop_id: clinicId,
          name,
          phone,
          email,
          birth_date: birthday || null,
          source: 'من البوربتال',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (createClientError) {
          console.error('Create client error:', createClientError)
          // Don't fail signup if client creation fails
        }
      }

      // Save to localStorage
      const session: PortalCustomer = {
        id: newCustomer.id,
        clinicId,
        slug: '', // Will be set by caller if needed
        fullName: name,
        email,
        phone,
        authUserId: authData.user.id,
      }

      localStorage.setItem(`${PORTAL_SESSION_KEY}_${slug}`, JSON.stringify(session))
      setCustomer(session)
      setError(null)

      return { error: null }
    } catch (err: any) {
      console.error('Sign up error:', err)
      const errorMsg = 'خطأ في الاتصال، يرجى المحاولة مرة أخرى'
      setError(errorMsg)
      return { error: errorMsg }
    }
  }

  // Sign out
  const signOut = () => {
    localStorage.removeItem(`${PORTAL_SESSION_KEY}_${slug}`)
    setCustomer(null)
    setError(null)
  }

  return {
    customer,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!customer,
  }
}

// Translate Supabase errors to Arabic
function translateError(error: string): string {
  if (error.includes('Invalid login credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
  }
  if (error.includes('Email not confirmed')) {
    return 'يرجى تأكيد بريدك الإلكتروني أولاً'
  }
  if (error.includes('User already registered')) {
    return 'هذا الحساب مسجل بالفعل'
  }
  if (error.includes('Password should be at least')) {
    return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
  }
  if (error.includes('rate limit')) {
    return 'تم تجاوز الحد المسموح، حاول لاحقاً'
  }
  if (error.includes('network') || error.includes('fetch')) {
    return 'خطأ في الاتصال، يرجى المحاولة مرة أخرى'
  }
  return 'حدث خطأ، يرجى المحاولة مرة أخرى'
}
