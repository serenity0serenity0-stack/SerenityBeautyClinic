import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { usePortalHistory } from '@/hooks/usePortalHistory'
import { ArrowRight, Filter, Calendar, DollarSign, Scissors } from 'lucide-react'
import { PortalBottomNav } from './PortalBottomNav'

type SortType = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
type Language = 'ar' | 'en'

const translations = {
  ar: {
    back: 'العودة للرئيسة',
    transactionHistory: 'سجل المواعيد',
    with: 'مع',
    totalVisits: 'إجمالي الزيارات',
    totalSpent: 'إجمالي الإنفاق',
    averageSpent: 'متوسط النفقة',
    lastVisit: 'آخر زيارة',
    filterSort: 'التصفية والفرز',
    sort: 'الفرز',
    newest: 'الأحدث أولاً',
    oldest: 'الأقدم أولاً',
    highestPrice: 'الأعلى سعراً',
    lowestPrice: 'الأقل سعراً',
    status: 'الحالة',
    all: 'جميع',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    service: 'الخدمة',
    searchService: 'ابحث عن الخدمة',
    dateFrom: 'من التاريخ',
    dateTo: 'إلى التاريخ',
    clearFilters: 'مسح الفلاتر',
    noHistory: 'لا توجد مواعيد',
    noVisitsYet: 'لم تزر المحل بعد',
    noResults: 'لا توجد نتائج تطابق الفلاتر',
    barber: 'الحلاق',
    date: 'التاريخ',
    amount: 'المبلغ',
    notes: 'ملاحظات'
  },
  en: {
    back: 'Back to Dashboard',
    transactionHistory: 'Transaction History',
    with: 'at',
    totalVisits: 'Total Visits',
    totalSpent: 'Total Spent',
    averageSpent: 'Average Per Visit',
    lastVisit: 'Last Visit',
    filterSort: 'Filter & Sort',
    sort: 'Sort By',
    newest: 'Newest First',
    oldest: 'Oldest First',
    highestPrice: 'Highest Price',
    lowestPrice: 'Lowest Price',
    status: 'Status',
    all: 'All',
    completed: 'Completed',
    cancelled: 'Cancelled',
    service: 'Service',
    searchService: 'Search services...',
    dateFrom: 'Date From',
    dateTo: 'Date To',
    clearFilters: 'Clear Filters',
    noHistory: 'No History',
    noVisitsYet: 'You haven\'t visited yet',
    noResults: 'No results matching your filters',
    barber: 'Barber',
    date: 'Date',
    amount: 'Amount',
    notes: 'Notes'
  }
}

export function PortalHistory() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // Language state (default to Arabic)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(`portal_lang_${slug}`)
    return (saved === 'en' ? 'en' : 'ar') as Language
  })

  // Set default language to Arabic if not already set
  useEffect(() => {
    if (!localStorage.getItem(`portal_lang_${slug}`)) {
      localStorage.setItem(`portal_lang_${slug}`, 'ar')
    }
  }, [slug])

  const t = translations[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  // Auth & Settings
  const { customer, loading: authLoading } = usePortalAuthSecure(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  // History data
  const { history, loading: historyLoading, error: historyError, getStats } = usePortalHistory(customer?.shop_id, customer?.id, slug)

  // Filters & Sorting
  const [sortBy, setSortBy] = useState<SortType>('date-desc')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')

  // Save language preference
  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem(`portal_lang_${slug}`, newLang)
  }

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - ${lang === 'ar' ? 'سجل المواعيد' : 'Transaction History'}`
    }
  }, [settings?.shop_name, lang])

  useEffect(() => {
    if (!authLoading && !customer) {
      navigate(`/shop/${slug}/login`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let filtered = [...history]

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
        filtered.sort((a, b) => b.totalSpent - a.totalSpent)
        break
      case 'amount-asc':
        filtered.sort((a, b) => a.totalSpent - b.totalSpent)
        break
    }

    return filtered
  }, [history, sortBy, dateFromFilter, dateToFilter])

  const stats = getStats()
  const primaryColor = settings?.primary_color || '#FFD700'

  if (authLoading || settingsLoading || historyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24" dir={dir}>
      <div className="max-w-6xl mx-auto p-8">
        {/* Top Bar with Back Button and Language Toggle */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(`/shop/${slug}/dashboard`)}
            className="flex items-center gap-2 text-white/70 hover:text-white transition"
          >
            <ArrowRight size={20} />
            {t.back}
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => handleLanguageChange(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-bold transition"
          >
            <span>{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t.transactionHistory}</h1>
          <p className="text-white/60">{t.with} {settings?.shop_name}</p>
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
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/[0.08] transition">
              <div className="text-white/70 text-sm mb-2">{t.totalVisits}</div>
              <div className="text-3xl font-bold text-white">{stats.totalVisits}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/[0.08] transition">
              <div className="text-white/70 text-sm mb-2">{t.totalSpent}</div>
              <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                {stats.totalSpent} ج.م
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/[0.08] transition">
              <div className="text-white/70 text-sm mb-2">{t.averageSpent}</div>
              <div className="text-3xl font-bold text-white">
                {stats.averageSpent.toFixed(2)} ج.م
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/[0.08] transition">
              <div className="text-white/70 text-sm mb-2">{t.lastVisit}</div>
              <div className="text-lg font-bold text-white">
                {stats.lastVisit ? new Date(stats.lastVisit).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : '-'}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-4 text-white font-bold">
            <Filter size={20} />
            {t.filterSort}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Sort */}
            <div>
              <label className="block text-white/70 text-sm font-bold mb-2">{t.sort}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 transition"
              >
                <option value="date-desc">{t.newest}</option>
                <option value="date-asc">{t.oldest}</option>
                <option value="amount-desc">{t.highestPrice}</option>
                <option value="amount-asc">{t.lowestPrice}</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-white/70 text-sm font-bold mb-2">{t.dateFrom}</label>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 transition"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-white/70 text-sm font-bold mb-2">{t.dateTo}</label>
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 transition"
              />
            </div>
          </div>

          {/* Clear Filters */}
          {(dateFromFilter || dateToFilter) && (
            <button
              onClick={() => {
                setDateFromFilter('')
                setDateToFilter('')
              }}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm rounded-lg transition"
            >
              {t.clearFilters}
            </button>
          )}
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-white/70 mb-2">{t.noHistory}</h2>
            <p className="text-white/50">
              {history.length === 0 ? t.noVisitsYet : t.noResults}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map(visit => {
              return (
                <div key={visit.id} className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/[0.08] transition">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Scissors size={20} />
                        {visit.servicesCount} {t.service}
                      </h3>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-white/70">
                      <Calendar size={16} />
                      <div>
                        <div className="text-white/50 text-xs">{t.date}</div>
                        <div className="text-white font-semibold">
                          {new Date(visit.visitDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-white/70">
                      <DollarSign size={16} />
                      <div>
                        <div className="text-white/50 text-xs">{t.amount}</div>
                        <div className="text-white font-semibold">
                          {visit.totalSpent} ج.م
                        </div>
                      </div>
                    </div>

                    {visit.notes && (
                      <div className="flex items-start gap-2 text-white/70">
                        <div className="mt-0.5">
                          <div className="text-white/50 text-xs">{t.notes}</div>
                          <div className="text-white text-xs line-clamp-2">
                            {visit.notes}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <PortalBottomNav primaryColor={primaryColor} />
    </div>
  )
}
