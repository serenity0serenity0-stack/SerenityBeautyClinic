import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTransactions } from '../db/hooks/useTransactions'
import { supabase } from '../db/supabase'
import { formatCurrency } from '../utils/formatCurrency'
import { Search } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'

const ADMIN_ID = '9bf6605a-db64-4024-9245-f23ef16cae37'

interface StaffAccount {
  id: string
  auth_user_id: string
  name: string | null
  role: string | null
}

export const Accounts: React.FC = () => {
  const { user, clinicId } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [accounts, setAccounts] = useState<StaffAccount[]>([])
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'
  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo, setDateTo] = useState(today)

  const { transactions, loading } = useTransactions({ dateFrom, dateTo })

  useEffect(() => {
    if (!user?.id) return
    if (user.id === ADMIN_ID) setIsAdmin(true)
    ;(async () => {
      try {
        const { data } = await supabase.from('admin_auth').select('id, auth_user_id, name, role').eq('clinic_id', clinicId)
        if (data) setAccounts(data as StaffAccount[])
        const me = (data || []).find((a: any) => a.auth_user_id === user.id || a.id === ADMIN_ID)
        if (me && me.id === ADMIN_ID) setIsAdmin(true)
      } catch {
        // ignore
      }
    })()
    if (user.id === ADMIN_ID) setIsAdmin(true)
  }, [user, clinicId])

  // Map auth_user_id -> display name
  const nameOf = (uid: string | null) => {
    if (!uid) return 'غير معروف'
    const a = accounts.find((x) => x.auth_user_id === uid)
    return a?.name || uid.slice(0, 8)
  }

  const filteredTx = useMemo(() => {
    let list = transactions || []
    if (accountFilter !== 'all') list = list.filter((t: any) => t.created_by === accountFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t: any) => (t.client_name || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
    }
    return list
  }, [transactions, accountFilter, search])

  // Daily breakdown per account
  const dailyRows = useMemo(() => {
    const map: Record<string, { account: string; uid: string; date: string; count: number; total: number }> = {}
    for (const t of filteredTx) {
      const uid = (t as any).created_by || 'unknown'
      const key = `${uid}__${t.date}`
      if (!map[key]) map[key] = { account: nameOf(uid), uid, date: t.date, count: 0, total: 0 }
      map[key].count += 1
      map[key].total += t.total || 0
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date) || a.account.localeCompare(b.account))
  }, [filteredTx])

  // Per-account totals
  const accountTotals = useMemo(() => {
    const map: Record<string, { name: string; uid: string; count: number; total: number; days: number }> = {}
    for (const r of dailyRows) {
      if (!map[r.uid]) map[r.uid] = { name: r.account, uid: r.uid, count: 0, total: 0, days: 0 }
      map[r.uid].count += r.count
      map[r.uid].total += r.total
      map[r.uid].days += 1
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [dailyRows])

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
      <h1 className="text-2xl sm:text-3xl font-bold text-white">حسابات الموظفين / Staff Accounts</h1>

      <GlassCard>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">من تاريخ</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">الحساب</label>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="w-full bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm">
              <option value="all">جميع الحسابات</option>
              {accounts.map((a) => (
                <option key={a.auth_user_id} value={a.auth_user_id}>{a.name || a.auth_user_id.slice(0, 8)} ({a.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">بحث</label>
            <div className="flex items-center gap-2">
              <Search size={16} className="text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm" placeholder="اسم العميل..." />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Per-account summary */}
      <GlassCard>
        <h2 className="text-white font-bold mb-3">ملخص الحسابات</h2>
        {accountTotals.length === 0 ? (
          <p className="text-gray-400">لا توجد بيانات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="px-3 py-2 text-right">الحساب</th>
                  <th className="px-3 py-2 text-right">عدد الأيام</th>
                  <th className="px-3 py-2 text-right">عدد المعاملات</th>
                  <th className="px-3 py-2 text-right">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {accountTotals.map((a) => (
                  <tr key={a.uid} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white">{a.name}</td>
                    <td className="px-3 py-2 text-gray-300">{a.days}</td>
                    <td className="px-3 py-2 text-gray-300">{a.count}</td>
                    <td className="px-3 py-2 text-emerald-400 font-bold">{formatCurrency(a.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Daily breakdown */}
      <GlassCard>
        <h2 className="text-white font-bold mb-3">الاستخدام اليومي ({dailyRows.length} سجل)</h2>
        {loading ? (
          <p className="text-gray-400">جاري التحميل...</p>
        ) : dailyRows.length === 0 ? (
          <p className="text-gray-400">لا توجد معاملات في هذا النطاق</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="px-3 py-2 text-right">التاريخ</th>
                  <th className="px-3 py-2 text-right">الحساب</th>
                  <th className="px-3 py-2 text-right">عدد المعاملات</th>
                  <th className="px-3 py-2 text-right">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-3 py-2 text-gray-300">{r.date}</td>
                    <td className="px-3 py-2 text-white">{r.account}</td>
                    <td className="px-3 py-2 text-gray-300">{r.count}</td>
                    <td className="px-3 py-2 text-emerald-400 font-bold">{formatCurrency(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}