import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTransactions } from '../db/hooks/useTransactions'
import { useServices } from '../db/hooks/useServices'
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
  email: string | null
}

export const Accounts: React.FC = () => {
  const { user, clinicId, role } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [accounts, setAccounts] = useState<StaffAccount[]>([])
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'
  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo, setDateTo] = useState(today)
  const [page, setPage] = useState(0)
  const pageSize = 20

  const [sessions, setSessions] = useState<any[]>([])
  const { transactions } = useTransactions({ dateFrom, dateTo })
  const { services } = useServices()

  // fetch sessions (count only needed)
  useEffect(() => {
    if (!clinicId) return
    ;(async () => {
      try {
        const startUtc = new Date(dateFrom + 'T00:00:00+02:00').toISOString()
        const endExclusive = new Date(new Date(dateTo + 'T00:00:00+02:00').getTime() + 24 * 60 * 60 * 1000).toISOString()
        const { data } = await supabase
          .from('account_sessions')
          .select('id, user_id, auth_user_id')
          .eq('clinic_id', clinicId)
          .gte('login_at', startUtc)
          .lt('login_at', endExclusive)
        setSessions(data || [])
      } catch {
        setSessions([])
      }
    })()
  }, [clinicId, dateFrom, dateTo])

  useEffect(() => {
    if (!user?.id) return
    if (user.id === ADMIN_ID || role === 'admin') setIsAdmin(true)
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('get_staff_users')
        if (error) throw error
        if (data) {
          setAccounts((data as any[]).map((a: any) => ({
            id: a.id,
            auth_user_id: a.auth_user_id,
            name: a.name,
            role: a.role,
            email: a.email,
          })) as StaffAccount[])
        }
        if (user.id === ADMIN_ID || role === 'admin') setIsAdmin(true)
      } catch {
        try {
          const { data } = await supabase.from('admin_auth').select('id, auth_user_id, name, role, email').eq('clinic_id', clinicId)
          if (data) setAccounts(data as StaffAccount[])
        } catch {}
      }
    })()
    if (user.id === ADMIN_ID || role === 'admin') setIsAdmin(true)
  }, [user, clinicId, role])

  const serviceMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of (services || [])) {
      if (s.id) m[s.id] = s.nameAr || s.nameEn || s.id
    }
    return m
  }, [services])

  const serviceNames = (t: any): string => {
    const items = Array.isArray(t?.items) ? t.items : []
    const names = items.map((i: any) => serviceMap[i?.service_id] || i?.name || i?.service_id).filter(Boolean)
    return names.length ? names.join('، ') : (t?.description || '—')
  }

  const nameOf = (uid: string | null) => {
    if (!uid) return 'حساب غير معروف'
    const a = accounts.find((x) => x.auth_user_id === uid || x.id === uid)
    if (a) return a.name || a.email || uid.slice(0, 8)
    return 'حساب غير معروف'
  }

  const roleAccountIds = roleFilter === 'all'
    ? null
    : new Set(accounts.filter((a) => a.role === roleFilter).map((a) => a.auth_user_id))

  const filteredTx = useMemo(() => {
    let list = transactions || []
    if (accountFilter !== 'all') {
      list = list.filter((t: any) => t.created_by === accountFilter)
      if (roleFilter !== 'all' && !roleAccountIds?.has(accountFilter)) list = []
    } else if (roleFilter !== 'all') {
      list = list.filter((t: any) => t.created_by && roleAccountIds?.has(t.created_by))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t: any) => (t.client_name || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
    }
    return list
  }, [transactions, accountFilter, roleFilter, search, accounts])

  const filteredSessions = useMemo(() => {
    let list = sessions || []
    if (accountFilter !== 'all') {
      list = list.filter((s: any) => (s.auth_user_id || s.user_id) === accountFilter)
      if (roleFilter !== 'all' && !roleAccountIds?.has(accountFilter)) list = []
    } else if (roleFilter !== 'all') {
      list = list.filter((s: any) => roleAccountIds?.has(s.auth_user_id || s.user_id))
    }
    return list
  }, [sessions, accountFilter, roleFilter, accounts])

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

  const accountTotals = useMemo(() => {
    const roleFilteredAccounts = roleFilter === 'all' ? accounts : accounts.filter((a) => a.role === roleFilter)
    const selectedAccounts = accountFilter === 'all' ? roleFilteredAccounts : roleFilteredAccounts.filter((a) => a.auth_user_id === accountFilter)

    const map: Record<string, { name: string; uid: string; email: string | null; role: string | null; count: number; total: number; sessions: number }> = {}
    for (const a of selectedAccounts) {
      map[a.auth_user_id] = { name: a.name || a.email || a.auth_user_id.slice(0, 8), uid: a.auth_user_id, email: a.email, role: a.role, count: 0, total: 0, sessions: 0 }
    }
    if (filteredTx.some((t: any) => !t.created_by)) {
      map['unknown'] = { name: 'حساب غير معروف', uid: 'unknown', email: null, role: null, count: 0, total: 0, sessions: 0 }
    }
    for (const r of dailyRows) {
      if (!map[r.uid]) map[r.uid] = { name: r.account, uid: r.uid, email: null, role: null, count: 0, total: 0, sessions: 0 }
      map[r.uid].count += r.count
      map[r.uid].total += r.total
    }
    for (const s of filteredSessions) {
      const uid = s.auth_user_id || s.user_id
      if (!map[uid]) map[uid] = { name: nameOf(uid), uid, email: null, role: null, count: 0, total: 0, sessions: 0 }
      map[uid].sessions += 1
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [accounts, roleFilter, accountFilter, dailyRows, filteredSessions, filteredTx])

  const totalTx = filteredTx.length
  const totalValue = filteredTx.reduce((a: number, t: any) => a + (t.total || 0), 0)
  const activeAccounts = new Set([...filteredSessions.map((s: any) => s.auth_user_id || s.user_id), ...filteredTx.map((t: any) => t.created_by).filter(Boolean)]).size
  const totalSessions = filteredSessions.length

  // Transaction details pagination
  const txPage = filteredTx.slice(page * pageSize, page * pageSize + pageSize)
  const txTotalPages = Math.max(1, Math.ceil(filteredTx.length / pageSize))

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
    <div className="min-h-screen py-6 space-y-6" dir="rtl">
      <h1 className="text-2xl sm:text-3xl font-bold text-white">أكونتات</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الأكونتات', value: accounts.length },
          { label: 'الأكونتات النشطة', value: activeAccounts },
          { label: 'إجمالي جلسات الدخول', value: totalSessions },
          { label: 'إجمالي المعاملات', value: totalTx },
          { label: 'إجمالي قيمة المعاملات', value: formatCurrency(totalValue) },
          { label: 'متوسط المعاملات لكل أكونت', value: (totalTx / (activeAccounts || accounts.length || 1)).toFixed(1) },
          { label: 'متوسط قيمة المعاملة', value: formatCurrency(totalValue / (totalTx || 1)) },
        ].map((c, i) => (
          <GlassCard key={i}>
            <p className="text-gray-400 text-xs mb-1">{c.label}</p>
            <p className="text-white font-bold text-lg">{c.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Filters */}
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
                <option key={a.auth_user_id} value={a.auth_user_id}>{a.name || a.email || a.auth_user_id.slice(0, 8)} ({a.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">الدور</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm">
              <option value="all">جميع الأدوار</option>
              {[...new Set(accounts.map((a) => a.role).filter(Boolean))].map((r) => (
                <option key={r} value={r as string}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <div className="flex items-center gap-2 flex-1">
            <Search size={16} className="text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm" placeholder="بحث عن حساب..." />
          </div>
          <button
            onClick={() => { setDateFrom(monthStart); setDateTo(today); setAccountFilter('all'); setRoleFilter('all'); setSearch('') }}
            className="px-4 py-2 bg-white/10 text-white rounded-lg border border-white/20 text-sm hover:bg-white/20"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      </GlassCard>

      {/* Accounts Summary Table */}
      <GlassCard>
        <h2 className="text-white font-bold mb-3">ملخص الأكونتات ({accountTotals.length})</h2>
        {accountTotals.length === 0 ? (
          <p className="text-gray-400">لا توجد بيانات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="px-3 py-2 text-right">الحساب</th>
                  <th className="px-3 py-2 text-right">الدور</th>
                  <th className="px-3 py-2 text-right">عدد جلسات الدخول</th>
                  <th className="px-3 py-2 text-right">عدد المعاملات</th>
                  <th className="px-3 py-2 text-right">إجمالي قيمة المعاملات</th>
                </tr>
              </thead>
              <tbody>
                {accountTotals.map((a) => (
                  <tr key={a.uid} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white">{a.name}</td>
                    <td className="px-3 py-2 text-gray-300">{a.role || '—'}</td>
                    <td className="px-3 py-2 text-gray-300">{a.sessions}</td>
                    <td className="px-3 py-2 text-gray-300">{a.count}</td>
                    <td className="px-3 py-2 text-emerald-400 font-bold">{formatCurrency(a.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Transaction Details */}
      <GlassCard>
        <h2 className="text-white font-bold mb-3">تفاصيل المعاملات ({filteredTx.length})</h2>
        {filteredTx.length === 0 ? (
          <p className="text-gray-400">لا توجد معاملات في هذا النطاق</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="px-3 py-2 text-right">الحساب</th>
                    <th className="px-3 py-2 text-right">العميل</th>
                    <th className="px-3 py-2 text-right">الخدمة</th>
                    <th className="px-3 py-2 text-right">رقم المعاملة</th>
                    <th className="px-3 py-2 text-right">التاريخ</th>
                    <th className="px-3 py-2 text-right">المبلغ</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {txPage.map((t: any) => (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className="px-3 py-2 text-white">{nameOf(t.created_by)}</td>
                      <td className="px-3 py-2 text-gray-300">{t.client_name || 'عميل غير محدد'}</td>
                      <td className="px-3 py-2 text-gray-300">{serviceNames(t)}</td>
                      <td className="px-3 py-2 text-gray-300">{t.invoice_no || t.id?.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-gray-300">{t.date}</td>
                      <td className="px-3 py-2 text-emerald-400 font-bold">{formatCurrency(t.total)}</td>
                      <td className="px-3 py-2 text-gray-300">{t.status === 'completed' ? 'مكتمل' : t.status === 'pending' ? 'قيد الانتظار' : t.status === 'cancelled' ? 'ملغى' : (t.status || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page <= 0}
                className="px-3 py-1.5 bg-white/10 text-white rounded-lg disabled:opacity-40 text-sm"
              >
                السابق
              </button>
              <span className="text-gray-400 text-sm">
                صفحة {page + 1} من {txTotalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(txTotalPages - 1, page + 1))}
                disabled={page >= txTotalPages - 1}
                className="px-3 py-1.5 bg-white/10 text-white rounded-lg disabled:opacity-40 text-sm"
              >
                التالي
              </button>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  )
}