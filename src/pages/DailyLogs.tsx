import React, { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassCard } from '../components/ui/GlassCard'
import {
  useDailyRecords,
  computeSummary,
  type DailyTransaction,
  type DailyVisit,
  type DailyAdjustment,
  type ActivityType,
  type DailyInvoiceLine,
} from '../db/hooks/useDailyRecords'
import { getEgyptDateString, getEgyptFormattedDate } from '../utils/egyptTime'
import {
  ShoppingCart,
  CalendarCheck,
  Droplets,
  CreditCard,
  FileText,
  Scale,
  Search,
  Filter,
  X,
  User,
  Phone,
  Stethoscope,
  Package,
  ArrowLeftRight,
  Clock,
  Receipt,
  Wallet,
  CheckCircle2,
  XCircle,
  Hash,
  ListChecks,
  ClipboardList,
  Trash2,
} from 'lucide-react'

type TabKey = 'all' | 'sales' | 'visits' | 'consumption' | 'payments' | 'invoices' | 'adjustments'

interface TabDef {
  key: TabKey
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  accent: string
}

const TABS: TabDef[] = [
  { key: 'all', label: 'الكل', icon: ClipboardList, accent: 'text-white' },
  { key: 'sales', label: 'المبيعات', icon: ShoppingCart, accent: 'text-emerald-400' },
  { key: 'visits', label: 'الزيارات', icon: CalendarCheck, accent: 'text-cyan-400' },
  { key: 'consumption', label: 'صرف الأرصدة', icon: Droplets, accent: 'text-sky-400' },
  { key: 'payments', label: 'المدفوعات', icon: CreditCard, accent: 'text-amber-400' },
  { key: 'invoices', label: 'الفواتير', icon: FileText, accent: 'text-violet-400' },
  { key: 'adjustments', label: 'التعديلات', icon: Scale, accent: 'text-orange-400' },
]

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقد',
  card: 'بطاقة',
  wallet: 'محفظة',
}

const unitLabel = (l?: string | null) => l || 'جلسة'

export const DailyLogs: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(getEgyptDateString())
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [doctorFilter, setDoctorFilter] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<string>('')
  const [invoiceFilter, setInvoiceFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [detail, setDetail] = useState<{
    type: ActivityType
    tx?: DailyTransaction
    visit?: DailyVisit
    adj?: DailyAdjustment
  } | null>(null)

  const { sales, visits, consumptions, adjustments, loading, error, fetchRecords, clientNames, deleteRecord } =
    useDailyRecords()

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(id)
  }, [search])

  // Reload day when date changes
  useEffect(() => {
    fetchRecords(selectedDate)
  }, [selectedDate, fetchRecords])

  // Client-side filtering so search / filters apply consistently to EVERY tab
  // and the KPI cards — matches client name, phone, service name, invoice # and
  // doctor/employee across sales, visits and adjustments.
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const inv = invoiceFilter.trim()
    const dm = (s?: string | null) => (s || '').toLowerCase()

    let fSales = sales
    if (q) fSales = fSales.filter((s: any) =>
      [s.client_name, s.client_phone, invoiceNoText(s.invoice_no)].some((x) => dm(x).includes(q))
    )
    if (inv) fSales = fSales.filter((s: any) => invoiceNoText(s.invoice_no) === inv)

    let fVisits = visits
    if (q) fVisits = fVisits.filter((v: any) =>
      [clientName(v.client_id), v.service_name, v.doctor_name, v.employee_name].some((x) => dm(x).includes(q))
    )

    let fConsumptions = consumptions.filter((v) =>
      fVisits.some((fv) => fv.id === v.id)
    )

    let fAdjustments = adjustments
    if (q) fAdjustments = fAdjustments.filter((a: any) =>
      [clientName(a.client_id), a.service_name].some((x) => dm(x).includes(q))
    )

    // doctor / payment filters (applied across relevant types)
    if (doctorFilter) {
      fVisits = fVisits.filter((v: any) => v.doctor_name === doctorFilter || v.employee_name === doctorFilter)
      fConsumptions = fConsumptions.filter((v) => fVisits.some((fv) => fv.id === v.id))
      fSales = fSales.filter((s: any) => s.barber_name === doctorFilter)
    }
    if (paymentFilter) {
      fSales = fSales.filter((s: any) => s.payment_method === paymentFilter)
    }

    const fInvoices = fSales
    const fPayments = fSales

    const summary = computeSummary(fSales, fVisits)

    return { fSales, fVisits, fConsumptions, fAdjustments, fInvoices, fPayments, summary }
  }, [sales, visits, consumptions, adjustments, debouncedSearch, invoiceFilter, doctorFilter, paymentFilter, clientNames])

  const { fSales, fVisits, fConsumptions, fAdjustments, fInvoices, fPayments, summary } = filtered

  const money = (n?: number | null) => `${(n ?? 0).toFixed(n ? n % 1 === 0 ? 0 : 2 : 0)} ج.م`
  const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : '—')

  // Build unified feed for "all" tab (filtered)
  const allItems = useMemo(() => {
    const items: { key: string; ts: number }[] = []
    fSales.forEach((s) => items.push({ key: `sale:${s.id}`, ts: new Date(s.created_at || 0).getTime() }))
    fVisits.forEach((v) => items.push({ key: `visit:${v.id}`, ts: new Date(v.created_at || 0).getTime() }))
    fAdjustments.forEach((a) =>
      items.push({ key: `adj:${a.id}`, ts: new Date(a.created_at || 0).getTime() })
    )
    return items.sort((a, b) => b.ts - a.ts)
  }, [fSales, fVisits, fAdjustments])

  const hasActiveFilters = search !== '' || doctorFilter !== '' || paymentFilter !== '' || invoiceFilter !== ''

  const clearFilters = () => {
    setSearch('')
    setDoctorFilter('')
    setPaymentFilter('')
    setInvoiceFilter('')
  }

  const handleDelete = async (type: 'transaction' | 'consumption', id: string) => {
    const ok = window.confirm('هل أنت متأكد من الحذف؟ سيتم عكس الرصيد المرتبط بهذا السجل.')
    if (!ok) return
    try {
      await deleteRecord(type, id)
      toast.success('✅ تم الحذف وعكس الرصيد')
      setDetail(null)
      fetchRecords(selectedDate)
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء الحذف')
    }
  }

  const renderInvoicesTab = () => (
    <div className="space-y-3">
      {(fInvoices || []).length === 0 && (
        <EmptyState text="لا توجد فواتير في هذا التاريخ" />
      )}
      {(fInvoices || []).map((tx) => (
        <ActivityRow
          key={tx.id}
          icon={FileText}
          accent="text-violet-400"
          badge="فاتورة"
          badgeClass="bg-violet-500/20 text-violet-300 border-violet-400/30"
          title={tx.client_name || 'عميل'}
          time={fmtTime(tx.time) || (tx.created_at ? new Date(tx.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '')}
          subtitle={invoiceLineSummary(tx.lines || [])}
          trailing={
            <div className="text-left">
              <p className="text-gold-400 font-bold">{money(tx.total)}</p>
              <p className="text-xs text-gray-400">#{tx.invoice_no}</p>
            </div>
          }
          status={tx.is_completed === false ? 'غير مكتملة' : 'مكتملة'}
          statusOk={tx.is_completed !== false}
          onClick={() => setDetail({ type: 'invoice', tx })}
          onDelete={() => handleDelete('transaction', tx.id)}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-6" dir="rtl">
      {/* Title */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-3xl font-bold text-white">سجلات اليوم</h1>
        <p className="text-gray-400 text-sm mt-1">{getEgyptFormattedDate(new Date(selectedDate + 'T12:00:00'))}</p>
      </motion.div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="إجمالي المبيعات" value={money(summary.totalSales)} icon={ShoppingCart} accent="text-emerald-400" />
        <KpiCard label="عدد عمليات البيع" value={`${summary.saleCount}`} icon={Receipt} accent="text-teal-400" />
        <KpiCard label="إجمالي التحصيل" value={money(summary.totalCollected)} icon={Wallet} accent="text-amber-400" />
        <KpiCard label="عدد الزيارات" value={`${summary.visitCount}`} icon={CalendarCheck} accent="text-cyan-400" />
        <KpiCard label="الخدمات المنفذة" value={`${summary.servicesPerformed}`} icon={ListChecks} accent="text-sky-400" />
        <KpiCard label="الجلسات المصروفة" value={`${summary.sessionsConsumed}`} icon={Droplets} accent="text-blue-400" />
      </div>

      {/* Controls: date + filters */}
      <GlassCard animated={false} className="cursor-default">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-gray-300 font-semibold whitespace-nowrap">التاريخ:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-400/40"
            />
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" style={{ left: 'auto', right: '0.75rem' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم العميل أو الهاتف..."
              className="w-full bg-white/5 border border-white/10 rounded-lg ps-10 px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gold-400/40 text-sm"
            />
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition ${
              showFilters || hasActiveFilters
                ? 'bg-gold-400/20 border-gold-400/40 text-gold-400'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            <Filter size={16} />
            تصفية
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-gold-400" />}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-300 text-xs mb-1">رقم الفاتورة</label>
                  <input
                    value={invoiceFilter}
                    onChange={(e) => setInvoiceFilter(e.target.value)}
                    placeholder="مثال: 202609020021"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gold-400/40 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-xs mb-1">الطبيب / الموظف</label>
                  <select
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-400/40 text-sm"
                  >
                    <option value="">الكل</option>
                    {uniqueDoctors().map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-xs mb-1">طريقة الدفع</label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-400/40 text-sm"
                  >
                    <option value="">الكل</option>
                    <option value="cash">نقد</option>
                    <option value="card">بطاقة</option>
                    <option value="wallet">محفظة</option>
                  </select>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="sm:col-span-3 flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 text-sm hover:bg-red-500/10 w-fit"
                  >
                    <X size={14} /> مسح كل الفلاتر
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Error / loading */}
      {error && (
        <div className="p-4 bg-red-500/15 border border-red-400/40 rounded-xl text-red-300 text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-white/10 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-semibold transition border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon size={16} className={activeTab === tab.key ? 'text-gold-400' : tab.accent} />
            {tab.label}
            <span className="text-xs bg-white/10 rounded-full px-2 py-0.5">
              {countForTab(tab.key)}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">جاري التحميل...</div>
      ) : (
        <div>
          {activeTab === 'all' && (
            <div className="space-y-3">
              {allItems.length === 0 && <EmptyState text="لا توجد أي نشاطات في هذا التاريخ" />}
              {allItems.map((item) => {
                const [type, id] = item.key.split(':')
                if (type === 'sale') {
                  const tx = fSales.find((s) => s.id === id)
                  if (!tx) return null
                  return (
                    <ActivityRow
                      key={item.key}
                      icon={ShoppingCart}
                      accent="text-emerald-400"
                      badge="بيع"
                      badgeClass="bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                      title={tx.client_name || 'عميل'}
                      time={fmtTime(tx.time) || timeFromIso(tx.created_at)}
                      subtitle={invoiceLineSummary(tx.lines || [])}
                      trailing={<p className="text-gold-400 font-bold">{money(tx.total)}</p>}
                      onClick={() => setDetail({ type: 'sale', tx })}
                      onDelete={() => handleDelete('transaction', tx.id)}
                    />
                  )
                }
                if (type === 'visit') {
                  const v = fVisits.find((vv) => vv.id === id)
                  if (!v) return null
                  const isConsumption = v.visit_type === 'consumption'
                  return (
                    <ActivityRow
                      key={item.key}
                      icon={isConsumption ? Droplets : CalendarCheck}
                      accent={isConsumption ? 'text-sky-400' : 'text-cyan-400'}
                      badge={isConsumption ? 'صرف رصيد' : 'زيارة'}
                      badgeClass={
                        isConsumption
                          ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30'
                      }
                      title={clientName(v.client_id)}
                      time={fmtTime(v.visitTime) || v.start_time || timeFromIso(v.created_at)}
                      subtitle={`${v.service_name || 'خدمة'} · ${v.quantity ?? 1} ${unitLabel(v.unit_label)}`}
                      trailing={
                        v.visit_type === 'consumption' ? (
                          <div className="text-left">
                            <p className="text-sky-400 font-semibold text-sm">{v.quantity ?? 1} {unitLabel(v.unit_label)}</p>
                            <p className="text-[11px] text-gray-500">
                              رصيد: {v.balance_before ?? '—'} ← {v.balance_after ?? '—'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-cyan-400 font-semibold text-sm">زيارة</p>
                        )
                      }
                      onClick={() => setDetail({ type: isConsumption ? 'consumption' : 'visit', visit: v })}
                      onDelete={isConsumption ? () => handleDelete('consumption', v.id) : undefined}
                    />
                  )
                }
                const adj = fAdjustments.find((a) => a.id === id)
                if (!adj) return null
                return (
                  <ActivityRow
                    key={item.key}
                    icon={Scale}
                    accent="text-orange-400"
                    badge="تعديل"
                    badgeClass="bg-orange-500/15 text-orange-300 border-orange-400/30"
                    title={clientName(adj.client_id)}
                    time={fmtTime(adj.created_at ? adj.created_at.slice(11, 16) : '')}
                    subtitle={`${adj.service_name || 'رصيد'} · ${adj.delta > 0 ? '+' : ''}${adj.delta}`}
                    trailing={
                      <p className={`font-bold ${adj.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {adj.delta > 0 ? '+' : ''}{adj.delta}
                      </p>
                    }
                    onClick={() => setDetail({ type: 'adjustment', adj })}
                  />
                )
              })}
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-3">
              {fSales.length === 0 && <EmptyState text="لا توجد مبيعات في هذا التاريخ" />}
              {fSales.map((tx) => (
                <ActivityRow
                  key={tx.id}
                  icon={ShoppingCart}
                  accent="text-emerald-400"
                  badge="بيع"
                  badgeClass="bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                  title={tx.client_name || 'عميل'}
                  time={fmtTime(tx.time) || timeFromIso(tx.created_at)}
                  subtitle={invoiceLineSummary(tx.lines || [])}
                  trailing={<p className="text-gold-400 font-bold">{money(tx.total)}</p>}
                  status={tx.is_completed === false ? 'غير مكتملة' : undefined}
                  statusOk={tx.is_completed !== false}
                  onClick={() => setDetail({ type: 'sale', tx })}
                  onDelete={() => handleDelete('transaction', tx.id)}
                />
              ))}
            </div>
          )}

          {activeTab === 'visits' && (
            <div className="space-y-3">
              {fVisits.length === 0 && <EmptyState text="لا توجد زيارات في هذا التاريخ" />}
              {fVisits.map((v) => {
                const isConsumption = v.visit_type === 'consumption'
                return (
                  <ActivityRow
                    key={v.id}
                    icon={isConsumption ? Droplets : CalendarCheck}
                    accent={isConsumption ? 'text-sky-400' : 'text-cyan-400'}
                    badge={isConsumption ? 'صرف رصيد' : 'زيارة'}
                    badgeClass={
                      isConsumption
                        ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30'
                    }
                    title={clientName(v.client_id)}
                    time={fmtTime(v.visitTime) || v.start_time || timeFromIso(v.created_at)}
                    subtitle={`${v.service_name || 'خدمة'} · ${v.quantity ?? 1} ${unitLabel(v.unit_label)}`}
                    trailing={
                      isConsumption ? (
                        <p className="text-sky-400 font-semibold text-sm">{v.quantity ?? 1} {unitLabel(v.unit_label)}</p>
                      ) : (
                        <p className="text-cyan-400 font-semibold text-sm">زيارة</p>
                      )
                    }
                    doctor={v.doctor_name || undefined}
                    onClick={() => setDetail({ type: isConsumption ? 'consumption' : 'visit', visit: v })}
                    onDelete={isConsumption ? () => handleDelete('consumption', v.id) : undefined}
                  />
                )
              })}
            </div>
          )}

          {activeTab === 'consumption' && (
            <div className="space-y-3">
              {fConsumptions.length === 0 && <EmptyState text="لا يوجد صرف أرصدة في هذا التاريخ" />}
              {fConsumptions.map((v) => (
                <ActivityRow
                  key={v.id}
                  icon={Droplets}
                  accent="text-sky-400"
                  badge="صرف رصيد"
                  badgeClass="bg-sky-500/15 text-sky-300 border-sky-400/30"
                  title={clientName(v.client_id)}
                  time={fmtTime(v.visitTime) || v.start_time || timeFromIso(v.created_at)}
                  subtitle={`${v.service_name || 'خدمة'} · ${v.quantity ?? 1} ${unitLabel(v.unit_label)}`}
                  trailing={
                    <div className="text-left">
                      <p className="text-sky-400 font-semibold text-sm">{v.quantity ?? 1} {unitLabel(v.unit_label)}</p>
                      <p className="text-[11px] text-gray-500">
                        {v.balance_before ?? '—'} ← {v.balance_after ?? '—'}
                      </p>
                    </div>
                  }
                  doctor={v.doctor_name || undefined}
                  onClick={() => setDetail({ type: 'consumption', visit: v })}
                  onDelete={() => handleDelete('consumption', v.id)}
                />
              ))}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-3">
              {(fPayments || []).length === 0 && <EmptyState text="لا توجد مدفوعات في هذا التاريخ" />}
              {(fPayments || []).map((tx) => (
                <ActivityRow
                  key={tx.id}
                  icon={CreditCard}
                  accent="text-amber-400"
                  badge={PAYMENT_LABELS[tx.payment_method || 'cash'] || tx.payment_method || 'الدفع'}
                  badgeClass="bg-amber-500/15 text-amber-300 border-amber-400/30"
                  title={tx.client_name || 'عميل'}
                  time={fmtTime(tx.time) || timeFromIso(tx.created_at)}
                  subtitle={invoiceLineSummary(tx.lines || [])}
                  trailing={<p className="text-gold-400 font-bold">{money(tx.total)}</p>}
                  onClick={() => setDetail({ type: 'payment', tx })}
                  onDelete={() => handleDelete('transaction', tx.id)}
                />
              ))}
            </div>
          )}

          {activeTab === 'invoices' && renderInvoicesTab()}

          {activeTab === 'adjustments' && (
            <div className="space-y-3">
              {fAdjustments.length === 0 && <EmptyState text="لا توجد تعديلات في هذا التاريخ" />}
              {fAdjustments.map((adj) => (
                <ActivityRow
                  key={adj.id}
                  icon={Scale}
                  accent="text-orange-400"
                  badge="تعديل"
                  badgeClass="bg-orange-500/15 text-orange-300 border-orange-400/30"
                  title={clientName(adj.client_id)}
                  time={fmtTime(adj.created_at ? adj.created_at.slice(11, 16) : '')}
                  subtitle={`${adj.service_name || 'رصيد'} · ${adj.delta > 0 ? 'إضافة' : 'خصم'}`}
                  trailing={
                    <p className={`font-bold ${adj.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {adj.delta > 0 ? '+' : ''}{adj.delta}
                    </p>
                  }
                  onClick={() => setDetail({ type: 'adjustment', adj })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Drawer / Bottom Sheet */}
      <DetailPanel detail={detail} onClose={() => setDetail(null)} clientName={clientName} />
    </div>
  )

  function countForTab(tab: TabKey): number {
    switch (tab) {
      case 'all': return allItems.length
      case 'sales': return fSales.length
      case 'visits': return fVisits.length
      case 'consumption': return fConsumptions.length
      case 'payments': return fPayments.length
      case 'invoices': return fInvoices.length
      case 'adjustments': return fAdjustments.length
      default: return 0
    }
  }

  function clientName(id?: string | null): string {
    if (!id) return 'عميل'
    const fromTx = sales.find((x) => x.client_id === id)?.client_name
    if (fromTx) return fromTx
    return clientNames[id] || 'عميل'
  }

  function uniqueDoctors(): string[] {
    const set = new Set<string>()
    visits.forEach((v) => v.doctor_name && set.add(v.doctor_name))
    sales.forEach((s) => s.barber_name && set.add(s.barber_name))
    return Array.from(set)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function invoiceNoText(n?: number | null): string {
  if (n == null) return ''
  return String(n)
}

function invoiceLineSummary(lines: DailyInvoiceLine[]): string {
  if (!lines || lines.length === 0) return '—'
  return lines
    .map((l) => `${l.service_name} × ${l.quantity}${l.bonus_quantity ? ` (+${l.bonus_quantity})` : ''}`)
    .join(' · ')
}

function timeFromIso(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

function EmptyState({ text }: { text: string }) {
  return (
    <GlassCard animated={false} className="cursor-default">
      <p className="text-center text-gray-400 py-10">{text}</p>
    </GlassCard>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  accent: string
}) {
  return (
    <GlassCard animated={false} className="cursor-default p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Icon size={22} className={accent} />
        <div className="min-w-0">
          <p className="text-[11px] text-gray-400 truncate">{label}</p>
          <p className="text-white font-bold text-lg truncate">{value}</p>
        </div>
      </div>
    </GlassCard>
  )
}

function ActivityRow({
  icon: Icon,
  accent,
  badge,
  badgeClass,
  title,
  time,
  subtitle,
  trailing,
  status,
  statusOk = true,
  doctor,
  onClick,
  onDelete,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  accent: string
  badge: string
  badgeClass: string
  title: string
  time?: string
  subtitle?: string
  trailing?: React.ReactNode
  status?: string
  statusOk?: boolean
  doctor?: string
  onClick?: () => void
  onDelete?: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard animated={false} onClick={onClick} className="cursor-pointer py-3.5 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0`}>
            <Icon size={22} className={accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badgeClass}`}>{badge}</span>
              <p className="text-white font-semibold truncate">{title}</p>
              {doctor && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Stethoscope size={12} /> {doctor}
                </span>
              )}
            </div>
            {time && <p className="text-xs text-gray-500 mt-0.5">{time}</p>}
            {subtitle && <p className="text-sm text-gray-300 mt-1 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {status && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                statusOk ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' : 'bg-amber-500/15 text-amber-300 border-amber-400/30'
              }`}>
                {status}
              </span>
            )}
            {trailing}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                title="حذف"
                className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 transition"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Detail Panel (side drawer on desktop, bottom sheet on mobile) + full content
// ---------------------------------------------------------------------------

function DetailPanel({
  detail,
  onClose,
  clientName,
}: {
  detail: { type: ActivityType; tx?: DailyTransaction; visit?: DailyVisit; adj?: DailyAdjustment } | null
  onClose: () => void
  clientName: (id?: string | null) => string
}) {
  if (!detail) return null
  const isDrawer = typeof window !== 'undefined' && window.innerWidth >= 1024

  return (
    <AnimatePresence>
      {detail && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed z-50 bg-slate-950 border-white/10 shadow-2xl ${
              isDrawer
                ? 'inset-y-0 right-0 w-full max-w-lg border-l'
                : 'inset-x-0 bottom-0 max-h-[92vh] rounded-t-3xl border-t overflow-y-auto'
            }`}
            initial={isDrawer ? { x: '100%' } : { y: '100%' }}
            animate={isDrawer ? { x: 0 } : { y: 0 }}
            exit={isDrawer ? { x: '100%' } : { y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-white">{titleFor(detail.type)}</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="space-y-6 text-sm">
                {detail.tx && <SaleDetail tx={detail.tx} clientName={clientName} />}
                {detail.visit && <VisitDetail visit={detail.visit} clientName={clientName} />}
                {detail.adj && <AdjustmentDetail adj={detail.adj} clientName={clientName} />}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function titleFor(type: ActivityType): string {
  switch (type) {
    case 'sale': return 'تفاصيل المبيعة'
    case 'visit': return 'تفاصيل الزيارة'
    case 'consumption': return 'تفاصيل صرف الرصيد'
    case 'payment': return 'تفاصيل الدفعة'
    case 'invoice': return 'تفاصيل الفاتورة'
    case 'adjustment': return 'تفاصيل التعديل'
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-white font-medium">{children}</p>
    </div>
  )
}

function SaleDetail({ tx, clientName }: { tx: DailyTransaction; clientName: (id?: string | null) => string }) {
  const lines = tx.lines || []
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="العميل"><span className="flex items-center gap-1"><User size={14} />{clientName(tx.client_id) || tx.client_name}</span></Field>
        <Field label="الهاتف"><span className="flex items-center gap-1"><Phone size={14} />{tx.client_phone || '—'}</span></Field>
        <Field label="التاريخ"><span className="flex items-center gap-1"><CalendarCheck size={14} />{tx.date}</span></Field>
        <Field label="الوقت"><span className="flex items-center gap-1"><Clock size={14} />{tx.time || '—'}</span></Field>
        <Field label="الكاشير / الموظف"><span className="flex items-center gap-1"><User size={14} />{tx.description || '—'}</span></Field>
        <Field label="الطبيب">{tx.barber_name || '—'}</Field>
        <Field label="رقم الفاتورة"><span className="flex items-center gap-1"><Hash size={14} />{tx.invoice_no || '—'}</span></Field>
        <Field label="رقم العملية">{tx.visit_number || '—'}</Field>
        <Field label="طريقة الدفع">{PAYMENT_LABELS[tx.payment_method || 'cash'] || tx.payment_method || '—'}</Field>
        <Field label="الحالة">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${
            tx.is_completed === false ? 'bg-amber-500/15 text-amber-300 border-amber-400/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
          }`}>
            {tx.is_completed === false ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
            {tx.is_completed === false ? 'غير مكتملة' : 'مكتملة'}
          </span>
        </Field>
      </div>

      <div className="pt-4 border-t border-white/10">
        <p className="text-gray-300 font-semibold mb-3 flex items-center gap-2">
          <Package size={16} className="text-gold-400" /> الخدمات ({lines.length})
        </p>
        {lines.length === 0 ? (
          <p className="text-gray-500 text-sm">لا توجد عناصر مفصلة</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <div>
                  <p className="text-white font-medium">{l.service_name}</p>
                  <p className="text-[11px] text-gray-400">سعر الوحدة: {money(l.unit_price)} · نوع: {l.service_type === 'package' ? 'باقة' : 'خدمة'}</p>
                </div>
                <div className="text-left">
                  <p className="text-gold-400 font-semibold">{l.quantity} × {money(l.unit_price)}</p>
                  <p className="text-xs text-gray-400">المجموع: {money(l.line_total)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
        <Field label="Subtotal">{money(tx.subtotal)}</Field>
        <Field label="الخصم"><span className="text-red-400">- {money(tx.discount)}</span></Field>
        <Field label="الإجمالي"><span className="text-gold-400 font-bold">{money(tx.total)}</span></Field>
      </div>
    </>
  )
}

function VisitDetail({ visit, clientName }: { visit: DailyVisit; clientName: (id?: string | null) => string }) {
  const isConsumption = visit.visit_type === 'consumption'
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="العميل">{clientName(visit.client_id)}</Field>
        <Field label="نوع النشاط">{isConsumption ? 'صرف رصيد / استخدام خدمة' : 'زيارة'}</Field>
        <Field label="الخدمة">{visit.service_name || '—'}</Field>
        <Field label="الوحدة">{unitLabel(visit.unit_label)}</Field>
        <Field label="الكمية المستهلكة">{visit.quantity ?? 0}</Field>
        <Field label="تاريخ الزيارة">{visit.visit_date || '—'}</Field>
        <Field label="وقت البداية">{visit.start_time || visit.visitTime || '—'}</Field>
        <Field label="وقت النهاية">{visit.end_time || '—'}</Field>
        <Field label="الطبيب">{visit.doctor_name || '—'}</Field>
        <Field label="الموظف">{visit.employee_name || '—'}</Field>
        <Field label="رقم الزيارة">{visit.visit_number || '—'}</Field>
        <Field label="رقم الحجز">{visit.booking_id || '—'}</Field>
      </div>

      {isConsumption && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-gray-300 font-semibold mb-3 flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-sky-400" /> الرصيد قبل / بعد
          </p>
          <div className="flex items-center justify-around bg-white/5 rounded-xl px-4 py-3">
            <div className="text-center">
              <p className="text-[11px] text-gray-500">قبل</p>
              <p className="text-white font-bold text-xl">{visit.balance_before ?? '—'}</p>
            </div>
            <ArrowLeftRight className="text-gold-400" />
            <div className="text-center">
              <p className="text-[11px] text-gray-500">بعد</p>
              <p className="text-sky-400 font-bold text-xl">{visit.balance_after ?? '—'}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">مرجع الشراء: {visit.purchase_id || '—'}</p>
        </div>
      )}

      {visit.notes && (
        <div className="pt-4 border-t border-white/10">
          <Field label="ملاحظات">{visit.notes}</Field>
        </div>
      )}
    </>
  )
}

function AdjustmentDetail({ adj, clientName }: { adj: DailyAdjustment; clientName: (id?: string | null) => string }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="العميل">{clientName(adj.client_id)}</Field>
        <Field label="الخدمة">{adj.service_name || '—'}</Field>
        <Field label="الوحدة">{unitLabel(adj.unit_label)}</Field>
        <Field label="القيمة">
          <span className={`font-bold ${adj.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {adj.delta > 0 ? '+' : ''}{adj.delta} {unitLabel(adj.unit_label)}
          </span>
        </Field>
        <Field label="الاتجاه">{adj.delta > 0 ? 'إضافة إلى الرصيد' : 'خصم من الرصيد'}</Field>
        <Field label="التاريخ">{adj.created_at ? adj.created_at.slice(0, 16) : '—'}</Field>
      </div>
      {adj.reason && (
        <div className="pt-4 border-t border-white/10">
          <Field label="السبب">{adj.reason}</Field>
        </div>
      )}
    </>
  )
}

function money(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return '0 ج.م'
  const v = Math.round(n * 100) / 100
  return `${v} ج.م`
}
