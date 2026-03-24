import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { usePortalHistory } from '@/hooks/usePortalHistory'
import { ArrowRight, Filter, Calendar, DollarSign, Scissors } from 'lucide-react'

type SortType = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export function PortalHistory() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // Auth & Settings
  const { customer, loading: authLoading } = usePortalAuthSecure(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  // History data
  const { history, loading: historyLoading, error: historyError, getStats } = usePortalHistory(customer?.shop_id, customer?.id)

  // Filters & Sorting
  const [sortBy, setSortBy] = useState<SortType>('date-desc')
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - سجل المواعيد`
    }
  }, [settings?.shop_name])

  useEffect(() => {
    if (!authLoading && !customer) {
      navigate(`/shop/${slug}/login`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let filtered = [...history]

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(h => h.status === statusFilter)
    }

    // Filter by service name
    if (serviceFilter) {
      filtered = filtered.filter(h =>
        h.serviceName.toLowerCase().includes(serviceFilter.toLowerCase())
      )
    }

    // Filter by date range
    if (dateFromFilter) {
      filtered = filtered.filter(h => new Date(h.visitDate) >= new Date(dateFromFilter))
    }
    if (dateToFilter) {
      filtered = filtered.filter(h => new Date(h.visitDate) <= new Date(dateToFilter))
    }

    // Sort
    switch (sortBy) {
      case 'date-desc':
        filtered.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
        break
      case 'date-asc':
        filtered.sort((a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime())
        break
      case 'amount-desc':
        filtered.sort((a, b) => b.amount - a.amount)
        break
      case 'amount-asc':
        filtered.sort((a, b) => a.amount - b.amount)
        break
    }

    return filtered
  }, [history, sortBy, serviceFilter, statusFilter, dateFromFilter, dateToFilter])

  const stats = getStats()
  const primaryColor = settings?.primary_color || '#FFD700'

  if (authLoading || settingsLoading || historyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      <div className="max-w-6xl mx-auto p-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/shop/${slug}/dashboard`)}
          className="flex items-center gap-2 mb-8 text-white/70 hover:text-white transition"
        >
          <ArrowRight size={20} />
          العودة للرئيسة
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">سجل المواعيد</h1>
          <p className="text-white/60">مع {settings?.shop_name}</p>
        </div>

        {/* Error */}
        {historyError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400">
            {historyError}
          </div>
        )}

        {/* Stats Cards */}
        {history.length > 0 && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-white/70 text-sm mb-2">إجمالي الزيارات</div>
              <div className="text-3xl font-bold text-white">{stats.totalVisits}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-white/70 text-sm mb-2">إجمالي الإنفاق</div>
              <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                {stats.totalSpent} ج.م
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-white/70 text-sm mb-2">متوسط النفقة</div>
              <div className="text-3xl font-bold text-white">
                {stats.averageSpent.toFixed(2)} ج.م
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-white/70 text-sm mb-2">آخر زيارة</div>
              <div className="text-lg font-bold text-white">
                {stats.lastVisit ? new Date(stats.lastVisit).toLocaleDateString('ar-EG') : '-'}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-4 text-white font-bold">
            <Filter size={20} />
            التصفية والفرز
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Sort */}
            <div>
              <label className="block text-white/70 text-sm font-bold mb-2">الفرز</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 transition"
              >
                <option value="date-desc">الأحدث أولاً</option>
                <option value="date-asc">الأقدم أولاً</option>
                <option value="amount-desc">الأعلى سعراً</option>
                <option value="amount-asc">الأقل سعراً</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-white/70 text-sm font-bold mb-2">الحالة</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 transition"
              >
                <option value="all">جميع</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغى</option>
              </select>
            </div>

            {/* Service Filter */}
            <div>
              <label className="block text-white/70 text-sm font-bold mb-2">الخدمة</label>
              <input
                type="text"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                placeholder="ابحث عن الخدمة"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
              />
            </div>

            {/* Date From */}
            <div>
              <label className="block text-white/70 text-sm font-bold mb-2">من التاريخ</label>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 transition"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-white/70 text-sm font-bold mb-2">إلى التاريخ</label>
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 transition"
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(serviceFilter || statusFilter !== 'all' || dateFromFilter || dateToFilter) && (
            <button
              onClick={() => {
                setServiceFilter('')
                setStatusFilter('all')
                setDateFromFilter('')
                setDateToFilter('')
              }}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm rounded-lg transition"
            >
              مسح الفلاتر
            </button>
          )}
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-white/70 mb-2">لا توجد مواعيد</h2>
            <p className="text-white/50">
              {history.length === 0 ? 'لم تزر المحل بعد' : 'لا توجد نتائج تطابق الفلاتر'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map(visit => (
              <div key={visit.id} className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/[0.08] transition">
                <div className="grid md:grid-cols-3 gap-4 items-start">
                  {/* Visit Info */}
                  <div>
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <Scissors size={20} />
                      {visit.serviceName}
                    </h3>
                    <div className="space-y-2 text-sm text-white/70">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {new Date(visit.visitDate).toLocaleDateString('ar-EG')}
                      </div>
                      {visit.barberName && (
                        <div>
                          من قِبل: <span className="text-white font-semibold">{visit.barberName}</span>
                        </div>
                      )}
                      {visit.notes && (
                        <div>
                          ملاحظات: <span className="text-white/80">{visit.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-white/70 text-sm mb-2 flex items-center justify-center gap-1">
                        <DollarSign size={16} />
                        المبلغ
                      </div>
                      <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                        {visit.amount} ج.م
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-end">
                    <div
                      className={`px-4 py-2 rounded-full text-sm font-bold ${
                        visit.status === 'completed'
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}
                    >
                      {visit.status === 'completed' ? '✓ مكتمل' : '✗ ملغى'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
