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
  security_version?: number | null
}

const HEARTBEAT_INTERVAL_MS = 45_000
// Backoff for a failed authorization lookup during initial resolution.
const RESOLVE_RETRY_DELAYS_MS = [400, 1200, 2500]
// Retry cadence used while the session exists but could not be resolved yet.
const UNRESOLVED_RETRY_MS = 6_000
// A heartbeat must fail this many times in a row before we even warn.
const MAX_TRANSIENT_FAILURES = 3
// "No session row" must be confirmed twice before we destroy the session.
const MISSING_ROW_CONFIRMATIONS = 2

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * admin_auth.role is free text (no CHECK constraint), so accounts can hold
 * values other than admin/cashier. Only a missing/blank role is "no access";
 * any other role is a limited, permission-driven role. canAccess() still gates
 * every page by the stored permissions list.
 */
const normalizeRole = (raw: unknown): UserRole => {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (value === 'admin') return 'admin'
  if (value) return 'cashier'
  return null
}

type AuthProfile =
  | {
      ok: true
      clinicId: string | null
      role: UserRole
      permissions: string[]
      userName: string | null
      active: boolean
      securityVersion: number
    }
  | { ok: false; reason: string }

/**
 * Reads the caller's authorization data. `supabase.rpc()` resolves with
 * { data: null, error } instead of throwing, so an unreachable/errored RPC is
 * reported as ok:false and is NEVER treated as "not authorized".
 */
const fetchAuthProfile = async (userId: string): Promise<AuthProfile> => {
  const clinicRes = await supabase.rpc('get_clinic_id_for_user', { user_id: userId })
  if (clinicRes.error) return { ok: false, reason: clinicRes.error.message }

  const infoRes = await supabase.rpc('get_my_auth_info')
  if (infoRes.error) return { ok: false, reason: infoRes.error.message }

  const info = (Array.isArray(infoRes.data) ? infoRes.data[0] : infoRes.data) as
    | MyAuthInfo
    | null
    | undefined

  const clinicId =
    typeof clinicRes.data === 'string' ? clinicRes.data : ((clinicRes.data as string) ?? null)
  const role = normalizeRole(info?.role)

  return {
    ok: true,
    clinicId: clinicId || null,
    role,
    permissions: normalizePermissions(role, info?.permissions),
    userName: info?.name || null,
    active: info?.active !== false,
    securityVersion: info?.security_version ?? 1,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthUser>(initialState)
  const [hasSession, setHasSession] = useState(false)
  const resolvingRef = useRef(false)
  const resolvedUserIdRef = useRef<string | null>(null)
  const securityVersionRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transientFailuresRef = useRef(0)
  const missingRowCountRef = useRef(0)
  const logoutReasonRef = useRef<string | null>(null)

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  const clearResolveRetry = useCallback(() => {
    if (resolveRetryTimerRef.current) {
      clearTimeout(resolveRetryTimerRef.current)
      resolveRetryTimerRef.current = null
    }
  }, [])

  const clearSessionRefs = useCallback(() => {
    resolvedUserIdRef.current = null
    securityVersionRef.current = null
    transientFailuresRef.current = 0
    missingRowCountRef.current = 0
  }, [])

  const forceSignOut = useCallback(
    async (reason: string) => {
      logoutReasonRef.current = reason
      clearHeartbeat()
      clearResolveRetry()
      clearSessionRefs()
      setHasSession(false)
      setState((prev) => ({
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
    },
    [clearHeartbeat, clearResolveRetry, clearSessionRefs],
  )

  const scheduleResolveRetry = useCallback(() => {
    clearResolveRetry()
    resolveRetryTimerRef.current = setTimeout(async () => {
      resolveRetryTimerRef.current = null
      if (resolvedUserIdRef.current) return
      const { data } = await supabase.auth.getSession()
      if (data.session) resolveUser(data.session)
    }, UNRESOLVED_RETRY_MS)
  }, [clearResolveRetry])

  const resolveUser = useCallback(
    async (session: Session | null) => {
      if (resolvingRef.current) return
      resolvingRef.current = true

      try {
        if (!session) {
          const hadSession = resolvedUserIdRef.current !== null
          clearSessionRefs()
          clearHeartbeat()
          clearResolveRetry()
          setHasSession(false)
          setState((prev) => ({
            ...prev,
            user: null,
            session: null,
            role: null,
            clinicId: null,
            permissions: [],
            userName: null,
            loading: false,
            error: null,
            logoutReason: hadSession
              ? 'انتهت جلسة الدخول - يرجى تسجيل الدخول مرة أخرى'
              : null,
          }))
          return
        }

        const userId = session.user.id
        setHasSession(true)
        setState((prev) => (prev.user ? { ...prev, session } : prev))

        // Already authorized for this user (e.g. access token refreshed):
        // keep the working session and only refresh role/permissions in the
        // background. A failed refresh must never end the session.
        if (resolvedUserIdRef.current === userId) {
          const profile = await fetchAuthProfile(userId)
          if (profile.ok) {
            if (!profile.role) return // no row: leave state untouched, heartbeat decides
            if (!profile.active) {
              await forceSignOut('Your account has been disabled by an administrator')
              return
            }
            if (
              securityVersionRef.current !== null &&
              profile.securityVersion > securityVersionRef.current
            ) {
              await forceSignOut('Your session has been invalidated — please sign in again')
              return
            }
            securityVersionRef.current = profile.securityVersion
            setState((prev) =>
              prev.user
                ? {
                    ...prev,
                    session,
                    role: profile.role,
                    permissions: profile.permissions,
                    userName: profile.userName,
                    clinicId: profile.clinicId ?? prev.clinicId,
                    loading: false,
                    error: null,
                  }
                : prev,
            )
          }
          return
        }

        // First authorization for this session: confirm with the server.
        let profile: AuthProfile | null = null
        for (let attempt = 0; attempt <= RESOLVE_RETRY_DELAYS_MS.length; attempt++) {
          if (attempt > 0) await delay(RESOLVE_RETRY_DELAYS_MS[attempt - 1])
          const result = await fetchAuthProfile(userId)
          if (result.ok) {
            profile = result
            break
          }
          console.warn(`[auth] authorization lookup failed (attempt ${attempt + 1}):`, result.reason)
        }

        // Could not reach the server at all: keep the Supabase session alive,
        // surface a soft error and retry shortly. No signOut() here.
        if (!profile) {
          setState((prev) => ({
            ...prev,
            session,
            loading: false,
            error: 'تعذر التحقق من الحساب الآن - جارٍ المحاولة مرة أخرى',
          }))
          scheduleResolveRetry()
          return
        }

        const { clinicId, role, permissions, userName, active, securityVersion } = profile

        // Confirmed by the server: only these cases end the session.
        if (!clinicId || !role) {
          console.warn('[auth] access denied', { clinicId, role })
          await forceSignOut(
            !clinicId
              ? 'حسابك غير مُفعّل أو غير موجود - يرجى مراجعة إدارة العيادة'
              : 'Not authorized',
          )
          return
        }

        if (!active) {
          await forceSignOut('Your account has been disabled by an administrator')
          return
        }

        resolvedUserIdRef.current = userId
        securityVersionRef.current = securityVersion
        transientFailuresRef.current = 0
        missingRowCountRef.current = 0
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
    },
    [clearSessionRefs, clearHeartbeat, clearResolveRetry, forceSignOut, scheduleResolveRetry],
  )

  // Heartbeat: verifies the session, and self-heals an unresolved session.
  const startHeartbeat = useCallback(() => {
    clearHeartbeat()
    heartbeatTimerRef.current = setInterval(async () => {
      // Session exists but was never authorized (RPC was down at login):
      // keep trying to resolve it instead of destroying the session.
      if (!resolvedUserIdRef.current) {
        const { data } = await supabase.auth.getSession()
        if (data.session) await resolveUser(data.session)
        return
      }

      try {
        const { data, error } = await supabase.rpc('check_session_valid')

        if (error) {
          transientFailuresRef.current += 1
          console.warn(
            `[auth] session check failed (${transientFailuresRef.current}/${MAX_TRANSIENT_FAILURES}):`,
            error.message,
          )
          return // network/RPC problem: keep the session
        }

        transientFailuresRef.current = 0
        const info = Array.isArray(data) ? data[0] : data

        if (!info) {
          missingRowCountRef.current += 1
          console.warn(
            `[auth] no session row (${missingRowCountRef.current}/${MISSING_ROW_CONFIRMATIONS})`,
          )
          if (missingRowCountRef.current >= MISSING_ROW_CONFIRMATIONS) {
            await forceSignOut('انتهت جلستك - يرجى تسجيل الدخول مرة أخرى')
          }
          return
        }

        missingRowCountRef.current = 0

        if (info.is_active === false) {
          await forceSignOut('Your account has been disabled by an administrator')
          return
        }

        // A NULL version means "unknown", never "revoked".
        const remoteVersion = info.security_version
        if (
          typeof remoteVersion === 'number' &&
          securityVersionRef.current !== null &&
          remoteVersion > securityVersionRef.current
        ) {
          await forceSignOut('Your session has been invalidated — please sign in again')
        }
      } catch (e) {
        transientFailuresRef.current += 1
        console.warn('[auth] session check threw:', e)
      }
    }, HEARTBEAT_INTERVAL_MS)
  }, [clearHeartbeat, forceSignOut, resolveUser])

  const handleSignIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null, logoutReason: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }))
      return { error }
    }
    return { error: null }
  }, [])

  const handleSignOut = useCallback(
    async (reason?: string) => {
      if (reason) {
        logoutReasonRef.current = reason
      }
      clearHeartbeat()
      clearResolveRetry()
      clearSessionRefs()
      setHasSession(false)
      setState((prev) => ({ ...prev, loading: true }))
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
    },
    [handleSignIn, clearHeartbeat, clearResolveRetry, clearSessionRefs],
  )

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'TOKEN_REFRESHED' && resolvedUserIdRef.current && session) {
        // Refresh in place, never re-authorize from scratch.
        setState((prev) => ({ ...prev, session }))
        return
      }
      resolveUser(session)
    })

    const timeout = setTimeout(() => {
      if (mounted) setState((prev) => (prev.loading ? { ...prev, loading: false, error: null } : prev))
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
      clearHeartbeat()
      clearResolveRetry()
    }
  }, [resolveUser, clearHeartbeat, clearResolveRetry])

  // Heartbeat runs while a Supabase session exists (resolved or not)
  useEffect(() => {
    if (!hasSession) {
      clearHeartbeat()
      return
    }
    startHeartbeat()
    return () => clearHeartbeat()
  }, [hasSession, startHeartbeat, clearHeartbeat])

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
          const row = payload.new as
            | { active?: boolean; security_version?: number | null }
            | undefined
          if (!row) return

          // Immediate force signout if disabled
          if (row.active === false) {
            void forceSignOut('Your account has been disabled by an administrator')
            return
          }

          // If security_version bumped (password reset, account toggled, etc.)
          if (
            typeof row.security_version === 'number' &&
            securityVersionRef.current !== null &&
            row.security_version > securityVersionRef.current
          ) {
            void forceSignOut('Your session has been invalidated — please sign in again')
          }
        },
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
