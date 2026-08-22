import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/db/supabase'
import { UserRole, normalizePermissions } from '@/lib/permissions'

export interface AuthUser {
  user: User | null
  session: Session | null
  role: UserRole
  clinicId: string | null
  permissions: string[]
  userName: string | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: null }>
}

const initialState: AuthUser = {
  user: null,
  session: null,
  role: null,
  clinicId: null,
  permissions: [],
  userName: null,
  loading: true,
  error: null,
  signIn: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
}

const AuthContext = createContext<AuthUser>(initialState)

interface MyAuthInfo {
  role?: string | null
  name?: string | null
  permissions?: unknown
  clinic_id?: string | null
  active?: boolean
  email?: string | null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthUser>(initialState)
  const resolvingRef = useRef(false)
  const resolvedUserIdRef = useRef<string | null>(null)
  const resolvedTokenRef = useRef<string | null>(null)

  const checkIfAdmin = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const { data } = await supabase.rpc('get_clinic_id_for_user', { user_id: userId })
      return data || null
    } catch { return null }
  }, [])

  const resolveUser = useCallback(async (session: Session | null) => {
    if (resolvingRef.current) return
    resolvingRef.current = true

    try {
      if (!session) {
        resolvedUserIdRef.current = null
        resolvedTokenRef.current = null
        setState(prev => ({ ...prev, user: null, session: null, role: null, clinicId: null, permissions: [], userName: null, loading: false, error: null }))
        return
      }

      const userId = session.user.id
      const token = session.access_token

      // Skip re-resolution if same user + same token already resolved
      if (resolvedUserIdRef.current === userId && resolvedTokenRef.current === token) {
        setState(prev => ({ ...prev, session }))
        return
      }

      const clinicId = await checkIfAdmin(userId)

      if (!clinicId) {
        setTimeout(() => supabase.auth.signOut(), 0)
        resolvedUserIdRef.current = null
        resolvedTokenRef.current = null
        setState(prev => ({ ...prev, user: null, session: null, role: null, clinicId: null, permissions: [], userName: null, loading: false, error: 'Not authorized' }))
        return
      }

      let role: UserRole = null
      let permissions: string[] = []
      let userName: string | null = null
      let active = true

      try {
        const { data } = await supabase.rpc('get_my_auth_info')
        const info: MyAuthInfo | undefined = Array.isArray(data) ? data[0] : (data ?? undefined)
        if (info) {
          role = info.role === 'admin' || info.role === 'cashier' ? info.role : null
          permissions = normalizePermissions(role, info.permissions)
          userName = info.name || null
          active = info.active !== false
        }
      } catch { /* keep defaults */ }

      if (!role || !active) {
        setTimeout(() => supabase.auth.signOut(), 0)
        resolvedUserIdRef.current = null
        resolvedTokenRef.current = null
        setState(prev => ({ ...prev, user: null, session: null, role: null, clinicId: null, permissions: [], userName: null, loading: false, error: !role ? 'Not authorized' : 'Account disabled' }))
        return
      }

      resolvedUserIdRef.current = userId
      resolvedTokenRef.current = token
      setState({
        user: session.user,
        session,
        role,
        clinicId,
        permissions,
        userName,
        loading: false,
        error: null,
        signIn: initialState.signIn,
        signOut: initialState.signOut,
      })
    } finally {
      resolvingRef.current = false
    }
  }, [checkIfAdmin])

  const handleSignIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      return { error }
    }
    return { error: null }
  }, [])

  const handleSignOut = useCallback(async () => {
    resolvedUserIdRef.current = null
    resolvedTokenRef.current = null
    setState(prev => ({ ...prev, loading: true }))
    await supabase.auth.signOut()
    setState({ ...initialState, loading: false, signIn: handleSignIn, signOut: handleSignOut })
    return { error: null }
  }, [handleSignIn])

  // Wire up signIn/signOut into state after they're defined
  const value: AuthUser = {
    ...state,
    signIn: handleSignIn,
    signOut: handleSignOut,
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) resolveUser(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) resolveUser(session)
    })

    const timeout = setTimeout(() => {
      if (mounted) setState(prev => prev.loading ? { ...prev, loading: false, error: null } : prev)
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [resolveUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthUser {
  return useContext(AuthContext)
}
