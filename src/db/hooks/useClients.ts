import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase, Client } from '../supabase'
import toast from 'react-hot-toast'

// Explicit columns only — avoids transferring unused full-table payloads.
const CLIENT_COLUMNS =
  'id, clinic_id, name, phone, email, birthday, is_vip, total_visits, total_spent, last_visit, created_at, updated_at'

// The list view only needs the most recent clients; searching covers the rest.
const LIST_LIMIT = 50
const SEARCH_LIMIT = 50

// Keep the dataset reasonably fresh for the POS-facing flows, but still cache
// across navigation so we don't re-download on every tab switch.
const STALE_TIME = 30_000

// Normalize search input — fix Arabic keyboard/IME issues (same as POS).
const normalizeSearchInput = (value: string): string => {
  if (!value) return ''

  const arabicToEnglish: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  }

  let normalized = value
  for (const [arabic, english] of Object.entries(arabicToEnglish)) {
    normalized = normalized.replace(new RegExp(arabic, 'g'), english)
  }
  normalized = normalized.replace(/[^\u0621-\u064Ea-zA-Z0-9\s\-+]/g, '')

  return normalized
}

export const useClients = () => {
  const { clinicId } = useAuth()
  const queryClient = useQueryClient()

  const queryKey: ['clients', string | null | undefined] = ['clients', clinicId]

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clinicId) return []
      const { data, error } = await supabase
        .from('clients')
        .select(CLIENT_COLUMNS)
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT)
      if (error) throw error
      return (data || []) as Client[]
    },
    enabled: !!clinicId,
    staleTime: STALE_TIME,
  })

  const clients = (listQuery.data || []) as Client[]

  // Server-side search: prefers the optimized search_clients RPC, falls back to
  // a plain PostgREST ILIKE query so search still works without the RPC.
  const searchClients = useCallback(
    async (query: string): Promise<Client[]> => {
      const normalized = normalizeSearchInput(query.trim())
      if (!normalized || !clinicId) return []

      return queryClient.fetchQuery({
        queryKey: ['clients', clinicId, 'search', normalized],
        queryFn: async () => {
          try {
            const { data, error } = await supabase.rpc('search_clients', {
              p_clinic_id: clinicId,
              p_query: normalized,
            })
            if (!error) return (data || []) as Client[]
          } catch {
            // fall through to the ILIKE fallback below
          }

          const { data, error } = await supabase
            .from('clients')
            .select(CLIENT_COLUMNS)
            .eq('clinic_id', clinicId)
            .or(`name.ilike.%${normalized}%,phone.ilike.%${normalized}%`)
            .limit(SEARCH_LIMIT)
          if (error) throw error
          return (data || []) as Client[]
        },
        staleTime: STALE_TIME,
      })
    },
    [clinicId, queryClient],
  )

  const addClientMutation = useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
      if (!clinicId) throw new Error('Clinic ID is required')
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...client,
          birthday: client.birthday || null,
          clinic_id: clinicId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
      if (error) throw error
      return data?.[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Client> }) => {
      const { error } = await supabase
        .from('clients')
        .update({
          ...updates,
          birthday: updates.birthday || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const fetchClients = listQuery.refetch

  const addClient = useCallback(
    async (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        return await addClientMutation.mutateAsync(client)
      } catch (err: any) {
        toast.error(err.message)
        throw err
      }
    },
    [addClientMutation],
  )

  const updateClient = useCallback(
    async (id: string, updates: Partial<Client>) => {
      try {
        await updateClientMutation.mutateAsync({ id, updates })
      } catch (err: any) {
        toast.error(err.message)
      }
    },
    [updateClientMutation],
  )

  const deleteClient = useCallback(
    async (id: string) => {
      try {
        await deleteClientMutation.mutateAsync(id)
      } catch (err: any) {
        toast.error(err.message)
      }
    },
    [deleteClientMutation],
  )

  const getClientByPhone = useCallback(async (phone: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(CLIENT_COLUMNS)
        .eq('phone', phone)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (err: any) {
      throw err
    }
  }, [])

  return {
    clients,
    loading: listQuery.isLoading,
    error: listQuery.error ? listQuery.error.message ?? 'An error occurred' : null,
    fetchClients,
    addClient,
    updateClient,
    deleteClient,
    searchClients,
    getClientByPhone,
  }
}