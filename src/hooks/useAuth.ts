import { useEffect, useState, useCallback } from 'react'
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
}

interface MyAuthInfo {
  role?: string | null
  name?: string | null
  permissions?: unknown
  clinic_id?: string | null
  active?: boolean
  email?: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthUser>(initialState)

  const checkIfAdmin = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const { data } = await supabase.rpc('get_clinic_id_for_user', { user_id: userId })
      return data || null
    } catch { return null }
  }, [])

  useEffect(() => {
    let mounted = true

    const resolveUser = async (session: Session | null) => {
      if (!session) {
        if (mounted) setState({ ...initialState, loading: false })
        return
      }

      const userId = session.user.id
      const clinicId = await checkIfAdmin(userId)

      if (!clinicId) {
        await supabase.auth.signOut()
        if (mounted) setState({ ...initialState, loading: false, error: 'Not authorized' })
        return
      }

      // Fetch the user's role / permissions / name
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
        await supabase.auth.signOut()
        if (mounted) setState({ ...initialState, loading: false, error: !role ? 'Not authorized' : 'Account disabled' })
        return
      }

      if (mounted) setState({ user: session.user, session, role, clinicId, permissions, userName, loading: false, error: null })
    }

    // ✅ Step 1: Check existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveUser(session)
    })

    // ✅ Step 2: Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) resolveUser(session)
    })

    // ✅ Step 3: Fallback timeout
    const timeout = setTimeout(() => {
      if (mounted) setState(prev => prev.loading ? { ...prev, loading: false, error: null } : prev)
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [checkIfAdmin])

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      return { error }
    }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    await supabase.auth.signOut()
    setState({ ...initialState, loading: false })
    return { error: null }
  }, [])

  return {
    ...state,
    signIn,
    signOut,
  }
}
