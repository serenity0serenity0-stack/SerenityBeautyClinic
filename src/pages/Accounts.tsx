import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useClients } from '../db/hooks/useClients'
import { useTransactions } from '../db/hooks/useTransactions'
import { formatCurrency } from '../utils/formatCurrency'
import { Search } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'

const ADMIN_ID = '9bf6605a-db64-4024-9245-f23ef16cae37'

export const Accounts: React.FC = () => {
  const { user } = useAuth()
  const { clients, loading: clientsLoading } = useClients()
  const { transactions, loading: txLoading } = useTransactions()

  const [isAdmin, setIsAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    if (user.id === ADMIN_ID) { setIsAdmin(true); return }
    // fallback: check admin_auth row id
    import('../db/supabase').then(({ supabase }) => {
      supabase.from('admin_auth').select('id').eq('auth_user_id', user.id).single().then(({ data }) => {
        if (data?.id === ADMIN_ID) setIsAdmin(true)
      })
    }).catch(() => {})
  }, [user])

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = clients || []
    if (q) list = list.filter((c: any) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q))
    return list
  }, [clients, search])

  const clientTotals = useMemo(() => {
    const map: Record<string, { count: number; total: number; last: string }> = {}
    for (const t of transactions || []) {
      const key = t.client_id || t.client_phone || t.client_name || 'unknown'
      if (!map[key]) map[key] = { count: 0, total: 0, last: '' }
      map[key].count += 1
      map[key].total += t.total || 0
      if (!map[key].last || (t.created_at && t.created_at > map[key].last)) map[key].last = t.created_at || ''
    }
    return map
  }, [transactions])

  const selectedTx = useMemo(() => {
    if (!selectedClient) return []
    return (transactions || []).filter((t: any) => (t.client_id || t.client_phone || t.client_name) === selectedClient)
  }, [transactions, selectedClient])

  if (!isAdmin) {
    return (
      <div className="min-h-screen py-6">
        <GlassCard>
          <p className="text-red-400">غير مصرح: هذه الصفحة متاحة للمدير فقط.</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-6 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-white">الحسابات / Transactions</h1>

      <GlassCard>
        <div className="flex items-center gap-2">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="بحث عن عميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm"
          />
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts list */}
        <GlassCard>
          <h2 className="text-white font-bold mb-3">الحسابات ({filteredClients.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {clientsLoading || txLoading ? (
              <p className="text-gray-400">جاري التحميل...</p>
            ) : filteredClients.length === 0 ? (
              <p className="text-gray-400">لا توجد حسابات</p>
            ) : (
              filteredClients.map((c: any) => {
                const key = c.id || c.phone || c.name
                const tot = clientTotals[key] || { count: 0, total: 0, last: '' }
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedClient(key)}
                    className={`w-full text-right p-3 rounded-lg border transition ${
                      selectedClient === key ? 'border-pink-500 bg-pink-500/10' : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-semibold">{c.name}</p>
                        <p className="text-gray-400 text-xs">{c.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold">{formatCurrency(tot.total)}</p>
                        <p className="text-gray-400 text-xs">{tot.count} معاملة</p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </GlassCard>

        {/* Transactions for selected */}
        <GlassCard>
          <h2 className="text-white font-bold mb-3">
            معاملات {selectedClient ? '' : '(اختر حساباً)'}
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedTx.length === 0 ? (
              <p className="text-gray-400">لا توجد معاملات</p>
            ) : (
              selectedTx.map((t: any) => (
                <div key={t.id} className="p-3 rounded-lg border border-white/10 bg-white/5">
                  <div className="flex justify-between">
                    <span className="text-white text-sm">{t.description || t.payment_method || 'معاملة'}</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(t.total)}</span>
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {t.date} {t.time} — {t.payment_method}
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}