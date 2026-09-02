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
  logoutReason: string | null
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: (reason?: string) => Promise<{ error: null }>
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
  logoutReason: null,
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
  security_version?: number
}

const HEARTBEAT_INTERVAL_MS = 45_000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthUser>(initialState)
  const resolvingRef = useRef(false)
  const resolvedUserIdRef = useRef<string | null>(null)
  const resolvedTokenRef = useRef<string | null>(null)
  const securityVersionRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logoutReasonRef = useRef<string | null>(null)

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  const forceSignOut = useCallback(async (reason: string) => {
    logoutReasonRef.current = reason
    clearHeartbeat()
    resolvedUserIdRef.current = null
    resolvedTokenRef.current = null
    securityVersionRef.current = null
    setState(prev => ({
      ...prev,
      user: null,
      session: null,
      role: null,
      clinicId: null,
      permissions: [],
      userName: null,
      loading: false,
      error: null,
      logoutReason: reason,
    }))
    await supabase.auth.signOut()
  }, [clearHeartbeat])

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
        securityVersionRef.current = null
        clearHeartbeat()
        setState(prev => ({ ...prev, user: null, session: null, role: null, clinicId: null, permissions: [], userName: null, loading: false, error: null, logoutReason: null }))
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
        securityVersionRef.current = null
        clearHeartbeat()
        setState(prev => ({ ...prev, user: null, session: null, role: null, clinicId: null, permissions: [], userName: null, loading: false, error: 'Not authorized', logoutReason: null }))
        return
      }

      let role: UserRole = null
      let permissions: string[] = []
      let userName: string | null = null
      let active = true
      let securityVersion = 1

      try {
        const { data } = await supabase.rpc('get_my_auth_info')
        const info: MyAuthInfo | undefined = Array.isArray(data) ? data[0] : (data ?? undefined)
        if (info) {
          role = info.role === 'admin' || info.role === 'cashier' ? info.role : null
          permissions = normalizePermissions(role, info.permissions)
          userName = info.name || null
          active = info.active !== false
          securityVersion = info.security_version ?? 1
        }
      } catch { /* keep defaults */ }

      if (!role || !active) {
        setTimeout(() => supabase.auth.signOut(), 0)
        resolvedUserIdRef.current = null
        resolvedTokenRef.current = null
        securityVersionRef.current = null
        clearHeartbeat()
        setState(prev => ({ ...prev, user: null, session: null, role: null, clinicId: null, permissions: [], userName: null, loading: false, error: !role ? 'Not authorized' : 'Account disabled', logoutReason: null }))
        return
      }

      resolvedUserIdRef.current = userId
      resolvedTokenRef.current = token
      securityVersionRef.current = securityVersion
      setState({
        user: session.user,
        session,
        role,
        clinicId,
        permissions,
        userName,
        loading: false,
        error: null,
        logoutReason: null,
        signIn: initialState.signIn,
        signOut: initialState.signOut,
      })
    } finally {
      resolvingRef.current = false
    }
  }, [checkIfAdmin, clearHeartbeat])

  // Heartbeat: periodically verify session validity
  const startHeartbeat = useCallback(() => {
    clearHeartbeat()
    heartbeatTimerRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.rpc('check_session_valid')
        if (error || !data) return

        const info = Array.isArray(data) ? data[0] : data
        if (!info) {
          forceSignOut('Session expired — no session info found')
          return
        }

        if (info.is_active === false) {
          forceSignOut('Your account has been disabled by an administrator')
          return
        }

        const remoteVersion = info.security_version ?? 1
        if (securityVersionRef.current !== null && remoteVersion > securityVersionRef.current) {
          forceSignOut('Your session has been invalidated — please sign in again')
          return
        }
      } catch {
        // Network error — don't force signout, wait for next heartbeat
      }
    }, HEARTBEAT_INTERVAL_MS)
  }, [clearHeartbeat, forceSignOut])

  const handleSignIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null, logoutReason: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      return { error }
    }
    return { error: null }
  }, [])

  const handleSignOut = useCallback(async (reason?: string) => {
    if (reason) {
      logoutReasonRef.current = reason
    }
    clearHeartbeat()
    resolvedUserIdRef.current = null
    resolvedTokenRef.current = null
    securityVersionRef.current = null
    setState(prev => ({ ...prev, loading: true }))
    await supabase.auth.signOut()
    setState({
      ...initialState,
      loading: false,
      logoutReason: logoutReasonRef.current,
      signIn: handleSignIn,
      signOut: handleSignOut,
    })
    logoutReasonRef.current = null
    return { error: null }
  }, [handleSignIn, clearHeartbeat])

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
      clearHeartbeat()
    }
  }, [resolveUser, clearHeartbeat])

  // Start/stop heartbeat when user resolves
  useEffect(() => {
    if (state.user?.id && state.role) {
      startHeartbeat()
    } else {
      clearHeartbeat()
    }
    return () => clearHeartbeat()
  }, [state.user?.id, state.role, startHeartbeat, clearHeartbeat])

  // Realtime subscription: listen to admin_auth changes for current user
  useEffect(() => {
    if (!state.user?.id || !state.role) return

    const channel = supabase
      .channel('auth-security')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'admin_auth',
          filter: `auth_user_id=eq.${state.user.id}`,
        },
        (payload) => {
          const row = payload.new as { active?: boolean; security_version?: number } | undefined
          if (!row) return

          // Immediate force signout if disabled
          if (row.active === false) {
            forceSignOut('Your account has been disabled by an administrator')
            return
          }

          // If security_version bumped (password reset, etc.)
          if (row.security_version && securityVersionRef.current !== null && row.security_version > securityVersionRef.current) {
            forceSignOut('Your session has been invalidated — please sign in again')
            return
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [state.user?.id, state.role, forceSignOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthUser {
  return useContext(AuthContext)
}
