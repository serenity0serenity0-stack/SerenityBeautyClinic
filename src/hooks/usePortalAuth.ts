import { useEffect, useState, useCallback, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/db/supabase'
import toast from 'react-hot-toast'

export interface CustomerAuthUser {
  user: User | null
  session: Session | null
  customerId: string | null
  shopId: string | null
  customerName: string | null
  email: string | null
  phone: string | null
  clientId: string | null
  loading: boolean
  error: string | null
}

// LocalStorage portal session management
interface PortalSessionData {
  customerId: string
  shopId: string
  customerName: string
  email: string
  phone: string | null
  clientId: string | null
  savedAt: number
}

const PORTAL_SESSION_KEY = 'portal_session'
const SESSION_VALIDITY_DAYS = 30

const getPortalSession = (): PortalSessionData | null => {
  try {
    const stored = localStorage.getItem(PORTAL_SESSION_KEY)
    if (!stored) return null
    
    const data = JSON.parse(stored) as PortalSessionData
    
    // Check if session is still valid (30 days)
    const ageInDays = (Date.now() - data.savedAt) / (1000 * 60 * 60 * 24)
    if (ageInDays > SESSION_VALIDITY_DAYS) {
      localStorage.removeItem(PORTAL_SESSION_KEY)
      return null
    }
    
    return data
  } catch (err) {
    console.error('Error reading portal session:', err)
    return null
  }
}

const savePortalSession = (data: PortalSessionData): void => {
  try {
    localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Error saving portal session:', err)
  }
}

const clearPortalSession = (): void => {
  try {
    localStorage.removeItem(PORTAL_SESSION_KEY)
  } catch (err) {
    console.error('Error clearing portal session:', err)
  }
}

export function usePortalAuth(expectedShopId?: string) {
  const mountedRef = useRef(true)
  
  const [state, setState] = useState<CustomerAuthUser>({
    user: null,
    session: null,
    customerId: null,
    shopId: null,
    customerName: null,
    email: null,
    phone: null,
    clientId: null,
    loading: true,
    error: null,
  })

  const getCustomerData = useCallback(async (userId: string): Promise<any | null> => {
    try {
      const { data } = await supabase
        .from('customer_users')
        .select('id, shop_id, full_name, email, phone, client_id')
        .eq('auth_user_id', userId)
        .maybeSingle()
      
      return data || null
    } catch (err) {
      console.error('Error fetching customer data:', err)
      return null
    }
  }, [])

  const verifyCustomerBelongsToShop = useCallback(async (customerId: string, shopId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('customer_users')
        .select('shop_id')
        .eq('id', customerId)
        .eq('shop_id', shopId)
        .maybeSingle()
      
      return !!data
    } catch (err) {
      console.error('Error verifying customer shop:', err)
      return false
    }
  }, [])

  useEffect(() => {
    const resolveCustomer = async (session: Session | null, portalSessionData?: PortalSessionData | null) => {
      // If we have a saved portal session in localStorage, try to use it first
      if (portalSessionData) {
        // Verify the saved session is still valid in the database
        const isValid = await verifyCustomerBelongsToShop(portalSessionData.customerId, portalSessionData.shopId)
        
        if (isValid) {
          // Session is still valid, restore from localStorage
          if (mountedRef.current) {
            setState({
              user: session?.user || null, // Can be null for localStorage-only sessions
              session: session || null,
              customerId: portalSessionData.customerId,
              shopId: portalSessionData.shopId,
              customerName: portalSessionData.customerName,
              email: portalSessionData.email,
              phone: portalSessionData.phone,
              clientId: portalSessionData.clientId,
              loading: false,
              error: null,
            })
          }
          return
        } else {
          // Stored session is no longer valid, clear it
          clearPortalSession()
        }
      }

      // No session - clear state
      if (!session) {
        if (mountedRef.current) {
          setState({
            user: null,
            session: null,
            customerId: null,
            shopId: null,
            customerName: null,
            email: null,
            phone: null,
            clientId: null,
            loading: false,
            error: null,
          })
        }
        return
      }

      const userId = session.user.id
      const customerRole = session.user.user_metadata?.role

      // Check if user is a customer
      if (customerRole !== 'customer') {
        // Not a customer - sign out
        await supabase.auth.signOut()
        clearPortalSession()
        if (mountedRef.current) {
          setState({
            user: null,
            session: null,
            customerId: null,
            shopId: null,
            customerName: null,
            email: null,
            phone: null,
            clientId: null,
            loading: false,
            error: 'Invalid user role for portal',
          })
          toast.error('انتهت جلستك - رجاء تسجيل دخول مجدداً')
        }
        return
      }

      // Get customer data from database
      const customerData = await getCustomerData(userId)
      
      if (!customerData) {
        // Customer record not found
        await supabase.auth.signOut()
        clearPortalSession()
        if (mountedRef.current) {
          setState({
            user: null,
            session: null,
            customerId: null,
            shopId: null,
            customerName: null,
            email: null,
            phone: null,
            clientId: null,
            loading: false,
            error: 'Customer record not found',
          })
          toast.error('حسابك غير موجود - رجاء التواصل مع المحل')
        }
        return
      }

      // If expectedShopId provided, verify customer belongs to that shop
      if (expectedShopId) {
        const belongsToShop = await verifyCustomerBelongsToShop(customerData.id, expectedShopId)
        
        if (!belongsToShop) {
          // Customer shop mismatch - potential security issue
          await supabase.auth.signOut()
          clearPortalSession()
          if (mountedRef.current) {
            setState({
              user: null,
              session: null,
              customerId: null,
              shopId: null,
              customerName: null,
              email: null,
              phone: null,
              clientId: null,
              loading: false,
              error: 'Customer does not belong to this shop',
            })
            toast.error('حسابك غير متوافق مع هذا المحل')
          }
          return
        }
      }

      // All good - set customer data and save to localStorage
      const portalData: PortalSessionData = {
        customerId: customerData.id,
        shopId: customerData.shop_id,
        customerName: customerData.full_name,
        email: customerData.email,
        phone: customerData.phone,
        clientId: customerData.client_id,
        savedAt: Date.now(),
      }
      savePortalSession(portalData)

      if (mountedRef.current) {
        setState({
          user: session.user,
          session,
          customerId: customerData.id,
          shopId: customerData.shop_id,
          customerName: customerData.full_name,
          email: customerData.email,
          phone: customerData.phone,
          clientId: customerData.client_id,
          loading: false,
          error: null,
        })
      }
    }

    // Step 1: Check localStorage first for portal session
    const savedSession = getPortalSession()
    
    // Step 2: Check Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveCustomer(session, savedSession)
    })

    // Step 3: Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mountedRef.current) {
        const saved = getPortalSession()
        resolveCustomer(session, saved)
      }
    })

    // Step 4: Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        setState(prev => prev.loading ? { ...prev, loading: false, error: null } : prev)
      }
    }, 5000)

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [getCustomerData, verifyCustomerBelongsToShop, expectedShopId])

  // Sign in as customer
  const signIn = useCallback(async (email: string, password: string, shopId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        if (mountedRef.current) {
          setState(prev => ({ ...prev, loading: false, error: error.message }))
        }
        throw error
      }

      // Get session and verify customer belongs to shop
      const sessionResult = await supabase.auth.getSession()
      if (sessionResult.data.session) {
        const customerData = await getCustomerData(sessionResult.data.session.user.id)
        
        if (!customerData || customerData.shop_id !== shopId) {
          await supabase.auth.signOut()
          clearPortalSession()
          if (mountedRef.current) {
            setState(prev => ({ ...prev, loading: false, error: 'Customer not found in this shop' }))
          }
          throw new Error('Customer not found in this shop')
        }

        // Save to localStorage for portal session persistence
        const portalData: PortalSessionData = {
          customerId: customerData.id,
          shopId: customerData.shop_id,
          customerName: customerData.full_name,
          email: customerData.email,
          phone: customerData.phone,
          clientId: customerData.client_id,
          savedAt: Date.now(),
        }
        savePortalSession(portalData)
      }
    } catch (err: any) {
      console.error('Sign in error:', err)
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: err.message }))
      }
      throw err
    }
  }, [getCustomerData])

  // Register as new customer
  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    birthDate: string,
    shopId: string
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      // Create auth user with customer role
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'customer',
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user')

      // Create customer_users record
      const { data: customerData, error: customerError } = await supabase
        .from('customer_users')
        .insert({
          auth_user_id: authData.user.id,
          shop_id: shopId,
          full_name: fullName,
          email,
          phone,
          birth_date: birthDate,
          verified: false,
        })
        .select()
        .single()

      if (customerError) throw customerError

      // Check if customer phone matches existing client in this shop
      let clientId = null
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('shop_id', shopId)
        .eq('phone', phone)
        .maybeSingle()

      if (existingClient) {
        // Link existing client
        clientId = existingClient.id
        await supabase
          .from('customer_users')
          .update({ client_id: clientId })
          .eq('id', customerData.id)
      } else {
        // Create new client
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            shop_id: shopId,
            name: fullName,
            phone,
            email,
            source: 'من البوربتال', // From Portal
          })
          .select()
          .single()

        if (newClient) {
          clientId = newClient.id
          await supabase
            .from('customer_users')
            .update({ client_id: clientId })
            .eq('id', customerData.id)
        }
      }

      // Auto-login after signup
      await signIn(email, password, shopId)
      
      // Get the final customer data for portal session
      const sessionResult = await supabase.auth.getSession()
      if (sessionResult.data.session) {
        const finalCustomerData = await getCustomerData(sessionResult.data.session.user.id)
        if (finalCustomerData) {
          const portalData: PortalSessionData = {
            customerId: finalCustomerData.id,
            shopId: finalCustomerData.shop_id,
            customerName: finalCustomerData.full_name,
            email: finalCustomerData.email,
            phone: finalCustomerData.phone,
            clientId: finalCustomerData.client_id,
            savedAt: Date.now(),
          }
          savePortalSession(portalData)
        }
      }
      
      return customerData
    } catch (err: any) {
      console.error('Sign up error:', err)
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: err.message }))
      }
      throw err
    }
  }, [signIn])

  // Sign out customer
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      await supabase.auth.signOut()
      clearPortalSession()
      if (mountedRef.current) {
        setState({
          user: null,
          session: null,
          customerId: null,
          shopId: null,
          customerName: null,
          email: null,
          phone: null,
          clientId: null,
          loading: false,
          error: null,
        })
      }
    } catch (err: any) {
      console.error('Sign out error:', err)
      // Always clear localStorage even if signOut fails
      clearPortalSession()
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: err.message }))
      }
    }
  }, [])

  // Update customer profile
  const updateProfile = useCallback(async (
    customerId: string,
    updates: {
      full_name?: string
      phone?: string
      email?: string
      birth_date?: string
    }
  ) => {
    try {
      const { data, error } = await supabase
        .from('customer_users')
        .update(updates)
        .eq('id', customerId)
        .select()
        .single()

      if (error) throw error

      // Update local state
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          customerName: updates.full_name || prev.customerName,
          phone: updates.phone || prev.phone,
          email: updates.email || prev.email,
        }))
      }

      return data
    } catch (err: any) {
      console.error('Update profile error:', err)
      throw err
    }
  }, [])

  // Request password reset
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/portal-reset-password`,
      })

      if (error) throw error
      return true
    } catch (err: any) {
      console.error('Reset password error:', err)
      throw err
    }
  }, [])

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    updateProfile,
    resetPassword,
    isAuthenticated: !!state.user,
  }
}
