import { useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/db/supabase'

export type UserRole = 'admin' | 'shop' | null

export interface AuthUser {
  user: User | null
  session: Session | null
  role: UserRole
  shopId: string | null
  loading: boolean
  error: string | null
}

/**
 * useAuth Hook
 * 
 * Manages authentication state and role detection
 * - Detects if user is admin or shop owner
 * - Gets shop_id for shop owners
 * - Handles login/logout
 * - Provides loading and error states
 */
export function useAuth() {
  const [state, setState] = useState<AuthUser>({
    user: null,
    session: null,
    role: null,
    shopId: null,
    loading: true,
    error: null,
  })

  // Check if user is admin
  const checkIfAdmin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_user_id', userId)
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (not an admin)
        console.error('Error checking admin status:', error)
        return false
      }

      return !!data
    } catch (err) {
      console.error('Error checking admin status:', err)
      return false
    }
  }, [])

  // Get shop_id for shop owner
  const getShopId = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('id')
        .eq('auth_user_id', userId)
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting shop_id:', error)
        return null
      }

      return data?.id || null
    } catch (err) {
      console.error('Error getting shop_id:', err)
      return null
    }
  }, [])

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session) {
          if (mounted) {
            setState(prev => ({
              ...prev,
              user: null,
              session: null,
              role: null,
              shopId: null,
              loading: false,
            }))
          }
          return
        }

        // User is logged in, determine role
        const userId = session.user.id
        const isAdmin = await checkIfAdmin(userId)

        if (isAdmin) {
          if (mounted) {
            setState(prev => ({
              ...prev,
              user: session.user,
              session,
              role: 'admin',
              shopId: null,
              loading: false,
            }))
          }
        } else {
          // Check if is shop owner
          const shopId = await getShopId(userId)

          if (shopId) {
            if (mounted) {
              setState(prev => ({
                ...prev,
                user: session.user,
                session,
                role: 'shop',
                shopId,
                loading: false,
              }))
            }
          } else {
            // Not admin, not shop owner - should not happen
            if (mounted) {
              setState(prev => ({
                ...prev,
                user: null,
                session: null,
                role: null,
                shopId: null,
                loading: false,
                error: 'User not found in system',
              }))
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Authentication error',
          }))
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return

        if (!session) {
          setState({
            user: null,
            session: null,
            role: null,
            shopId: null,
            loading: false,
            error: null,
          })
          return
        }

        // User logged in, determine role
        const userId = session.user.id
        const isAdmin = await checkIfAdmin(userId)

        if (isAdmin) {
          setState({
            user: session.user,
            session,
            role: 'admin',
            shopId: null,
            loading: false,
            error: null,
          })
        } else {
          const shopId = await getShopId(userId)

          if (shopId) {
            setState({
              user: session.user,
              session,
              role: 'shop',
              shopId,
              loading: false,
              error: null,
            })
          } else {
            // User exists but not admin or shop
            await supabase.auth.signOut()
            setState({
              user: null,
              session: null,
              role: null,
              shopId: null,
              loading: false,
              error: 'User not found in system',
            })
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [checkIfAdmin, getShopId])

  // Sign in function
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: error.message,
          }))
          return { error }
        }

        // Auth state will be updated via onAuthStateChange listener
        return { error: null }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign in failed'
        setState(prev => ({
          ...prev,
          loading: false,
          error: message,
        }))
        return { error: { message } }
      }
    },
    []
  )

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }))

      const { error } = await supabase.auth.signOut()

      if (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error.message,
        }))
        return { error }
      }

      setState({
        user: null,
        session: null,
        role: null,
        shopId: null,
        loading: false,
        error: null,
      })

      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed'
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }))
      return { error: { message } }
    }
  }, [])

  return {
    ...state,
    signIn,
    signOut,
  }
}
