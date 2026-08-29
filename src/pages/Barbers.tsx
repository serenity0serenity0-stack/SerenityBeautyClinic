import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { useBarbers } from '../db/hooks/useBarbers'
import { useTransactions } from '../db/hooks/useTransactions'
import { supabase, Barber } from '../db/supabase'
import { useAuth } from '../hooks/useAuth'
import { getEgyptDateString } from '../utils/egyptTime'
import { motion } from 'framer-motion'
import {
  Trash2,
  Edit2,
  Plus,
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  User,
  Phone,
  Briefcase,
  Ban,
  CheckCircle2,
  XCircle,
  ListChecks,
  Search,
  CreditCard,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { appEmitter } from '../utils/eventEmitter'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

interface BarberStats {
  clientCount: number
  monthlyRevenue: number
  totalRevenue: number
  lastVisit?: string
}

type HistoryFilter = 'all' | 'today' | 'week' | 'month'

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

const bookingStatusLabel: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  checked_in: 'تم الحضور',
  ongoing: 'جاري',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
}

const paymentMethodLabel = (m: string): string =>
  ({ cash: 'نقداً', card: 'بطاقة', wallet: 'محفظة' }[m] || m || '—')

const formatMoney = (amount: number): string =>
  `${Number(amount || 0).toLocaleString('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`

const formatArabicDate = (date: string): string => {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00`))
  } catch {
    return date
  }
}

const formatArabicTime = (time: string): string => {
  const parts = (time || '').split(':')
  if (parts.length < 2) return time || ''
  let hours = parseInt(parts[0], 10)
  if (isNaN(hours)) return time
  const suffix = hours >= 12 ? 'مساءً' : 'صباحاً'
  hours = hours % 12 || 12
  return `${String(hours).padStart(2, '0')}:${parts[1]} ${suffix}`
}

const formatHours = (h?: string | null): string => {
  if (!h) return '—'
  const parts = h.split(':')
  let hours = parseInt(parts[0], 10)
  if (isNaN(hours)) return h
  const suffix = hours >= 12 ? 'مساءً' : 'صباحاً'
  hours = hours % 12 || 12
  return `${String(hours).padStart(2, '0')}:${parts[1]} ${suffix}`
}

const workingDaysLabel = (daysOff?: number[] | null): string => {
  if (!Array.isArray(daysOff) || daysOff.length === 0) return 'كل الأيام'
  const off = new Set(daysOff)
  const days = DAY_NAMES_AR.filter((_, i) => !off.has(i))
  return days.length ? days.join('، ') : 'لا يوجد'
}

export const Barbers: React.FC = () => {
  const { t } = useTranslation()
  const { clinicId } = useAuth()
  const { barbers, addBarber, updateBarber, deleteBarber } = useBarbers()
  const { transactions, fetchTransactions } = useTransactions()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [barberStats, setBarberStats] = useState<{
    [barberId: string]: BarberStats
  }>({})
  const [barberToDelete, setBarberToDelete] = useState<string | null>(null)

  // Doctor detail modal state
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [doctorBookings, setDoctorBookings] = useState<any[]>([])
  const [doctorWaiting, setDoctorWaiting] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [historySearch, setHistorySearch] = useState('')

  // Load transactions on mount
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Listen for new transactions and refresh
  useEffect(() => {
    const handleNewTransaction = async () => {
      await fetchTransactions()
    }

    appEmitter.on('transaction:created', handleNewTransaction)

    return () => {
      appEmitter.off('transaction:created', handleNewTransaction)
    }
  }, [fetchTransactions])

  // Lazy-load the doctor's bookings + waiting list only when the detail opens
  useEffect(() => {
    if (!isDetailOpen || !selectedBarber?.id || !clinicId) return
    let cancelled = false
    setDetailLoading(true)

    const load = async () => {
      try {
        const [bRes, wRes] = await Promise.all([
          supabase
            .from('bookings')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('barber_id', selectedBarber.id)
            .order('booking_time', { ascending: true }),
          supabase
            .from('waiting_list')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('barber_id', selectedBarber.id)
            .in('status', ['waiting', 'notified']),
        ])
        if (cancelled) return
        setDoctorBookings(bRes.data || [])
        setDoctorWaiting(wRes.data || [])
      } catch (err) {
        console.error('Error loading doctor details:', err)
        if (!cancelled) toast.error('خطأ في تحميل بيانات الطبيب')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isDetailOpen, selectedBarber, clinicId])

  // Calculate barber statistics
  useEffect(() => {
    const stats: typeof barberStats = {}

    barbers.forEach(barber => {
      const barberTransactions = transactions.filter(t => t.barber_id === barber.id)

      // Current month transactions
      const today = new Date()
      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const currentMonthTransactions = barberTransactions.filter(t => {
        const tDate = new Date(String(t.date))
        return tDate >= currentMonthStart && tDate <= today
      })

      // All unique clients
      const allUniqueClients = new Set(barberTransactions.map(t => t.client_id))

      // Monthly revenue
      const monthlyRevenue = currentMonthTransactions.reduce((sum, t) => sum + t.total, 0)

      // Total revenue
      const totalRevenue = barberTransactions.reduce((sum, t) => sum + t.total, 0)

      // Last visit
      const lastTransaction = barberTransactions[0]

      stats[barber.id!] = {
        clientCount: allUniqueClients.size,
        monthlyRevenue,
        totalRevenue,
        lastVisit: lastTransaction?.date
      }
    })

    setBarberStats(stats)
  }, [barbers, transactions])

  const handleEditClick = (barber: any) => {
    setEditingBarberId(barber.id)
    setFormData({
      name: barber.name,
      phone: barber.phone || '',
    })
    setIsModalOpen(true)
  }

  const handleSaveBarber = async () => {
    if (!formData.name) {
      toast.error(t('errors.required_field'))
      return
    }

    try {
      if (editingBarberId) {
        await updateBarber(editingBarberId, {
          name: formData.name,
          phone: formData.phone,
        })
      } else {
        await addBarber({
          name: formData.name,
          phone: formData.phone,
          active: true,
        })
      }
      setFormData({ name: '', phone: '' })
      setIsModalOpen(false)
      setEditingBarberId(null)
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const handleDelete = async (id: string) => {
    setBarberToDelete(id)
  }

  const handleConfirmDelete = async () => {
    if (!barberToDelete) return
    try {
      await deleteBarber(barberToDelete)
      toast.success('✅ تم حذف الطبيب بنجاح')
    } catch (err) {
      toast.error(t('errors.database_error'))
    } finally {
      setBarberToDelete(null)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateBarber(id, { active: !currentActive })
      toast.success(!currentActive ? 'تم تفعيل الطبيب' : 'تم تعطيل الطبيب')
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const openAddModal = () => {
    setEditingBarberId(null)
    setFormData({ name: '', phone: '' })
    setIsModalOpen(true)
  }

  const openDetail = (barber: Barber) => {
    setSelectedBarber(barber)
    setHistoryFilter('all')
    setHistorySearch('')
    setDoctorBookings([])
    setDoctorWaiting([])
    setIsDetailOpen(true)
  }

  const totalMonthlyRevenue = Object.values(barberStats).reduce((sum, s) => sum + s.monthlyRevenue, 0)
  const totalRevenue = Object.values(barberStats).reduce((sum, s) => sum + s.totalRevenue, 0)

  // Derived detail data
  const barberTransactions = selectedBarber
    ? transactions.filter(t => t.barber_id === selectedBarber.id)
    : []
  const totalPatients = new Set(barberTransactions.map(t => t.client_id).filter(Boolean)).size
  const totalAppointments = barberTransactions.length
  const revenueGenerated = barberTransactions.reduce((s, t) => s + (t.total || 0), 0)
  const cancelledCount = doctorBookings.filter(b => b.status === 'cancelled').length
  const noShowCount = doctorBookings.filter(b => b.status === 'no_show').length
  const waitingCount = doctorWaiting.length

  const today = getEgyptDateString()
  const onVacation =
    selectedBarber?.vacation_start && selectedBarber?.vacation_end
      ? today >= String(selectedBarber.vacation_start) && today <= String(selectedBarber.vacation_end)
      : false

  const upcoming = doctorBookings
    .filter(b => {
      const d = b.booking_date || String(b.booking_time || '').slice(0, 10)
      return d >= today && ['pending', 'confirmed', 'checked_in', 'ongoing'].includes(b.status)
    })
    .sort((a, b) => String(a.booking_time).localeCompare(String(b.booking_time)))

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
  const currentMonth = today.slice(0, 7)

  const serviceNames = (trx: any): string[] => {
    if (Array.isArray(trx.items)) {
      return (trx.items as any[]).map((i: any) => i?.name).filter(Boolean)
    }
    return trx.service_type ? [trx.service_type] : []
  }

  const filteredHistory = barberTransactions
    .filter(trx => {
      if (historyFilter === 'today') return trx.date === today
      if (historyFilter === 'week') return trx.date >= weekAgoStr && trx.date <= today
      if (historyFilter === 'month') return String(trx.date).startsWith(currentMonth)
      return true
    })
    .filter(trx => {
      if (!historySearch) return true
      return String(trx.client_name || '')
        .toLowerCase()
        .includes(historySearch.toLowerCase())
    })

  const filterChips: { key: HistoryFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'today', label: 'اليوم' },
    { key: 'week', label: 'هذا الأسبوع' },
    { key: 'month', label: 'هذا الشهر' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t('pages.barbers_title')}</h1>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-pink-500 text-white rounded-lg font-semibold hover:bg-pink-600 transition flex items-center gap-2"
        >
          <Plus size={20} />
          {t('common.add')} {t('pages.barbers_title')}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('pages.barbers_count')}</p>
              <p className="text-3xl font-bold text-white mt-2">{barbers.length}</p>
            </div>
            <Users size={40} className="text-pink-400" />
          </div>
        </GlassCard>

        <GlassCard className="bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('pages.monthly_revenue')}</p>
              <p className="text-3xl font-bold text-white mt-2">
                {totalMonthlyRevenue.toLocaleString('en-US')}
              </p>
              <p className="text-xs text-gray-500 mt-1">{t('common.currency')}</p>
            </div>
            <DollarSign size={40} className="text-green-400" />
          </div>
        </GlassCard>

        <GlassCard className="bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">إجمالي الأرباح</p>
              <p className="text-3xl font-bold text-white mt-2">
                {totalRevenue.toLocaleString('ar-EG')}
              </p>
              <p className="text-xs text-gray-500 mt-1">ج.م</p>
            </div>
            <TrendingUp size={40} className="text-blue-400" />
          </div>
        </GlassCard>
      </div>

      {/* Barbers Grid */}
      {barbers.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <p className="text-gray-400">لا يوجد أطباء بعد</p>
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-700 text-black rounded-lg font-semibold hover:from-pink-700 hover:to-pink-800 transition"
            >
              إضافة طبيب الآن
            </button>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {barbers.map((barber, idx) => {
            const stats = barberStats[barber.id!] || {
              clientCount: 0,
              monthlyRevenue: 0,
              totalRevenue: 0,
            }

            return (
              <motion.div
                key={barber.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <GlassCard
                  onClick={() => openDetail(barber)}
                  className="cursor-pointer"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg hover:text-pink-400 transition">
                          {barber.name}
                        </h3>
                        {barber.phone && (
                          <p className="text-gray-400 text-sm mt-1">📱 {barber.phone}</p>
                        )}
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleActive(barber.id!, barber.active)
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap cursor-pointer transition hover:opacity-80 ${
                          barber.active
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}
                      >
                        {barber.active ? 'نشط' : 'غير نشط'}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-3 border-t border-white/10 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">عدد العملاء</span>
                        <span className="text-white font-bold">{stats.clientCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">الأرباح هذا الشهر</span>
                        <span className="text-green-400 font-bold">
                          {stats.monthlyRevenue.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">إجمالي الأرباح</span>
                        <span className="text-blue-400 font-bold">
                          {stats.totalRevenue.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      {stats.lastVisit && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">آخر عملية</span>
                          <span className="text-gray-300 text-sm">{stats.lastVisit}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-white/10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openDetail(barber)
                        }}
                        className="flex-1 px-3 py-2 bg-pink-500/20 text-pink-300 border border-pink-400/50 rounded hover:bg-pink-500/30 transition flex items-center justify-center gap-2 text-sm"
                      >
                        <Users size={16} />
                        التفاصيل
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditClick(barber)
                        }}
                        className="flex-1 px-3 py-2 bg-blue-500/20 text-blue-300 border border-blue-400/50 rounded hover:bg-blue-500/30 transition flex items-center justify-center gap-2 text-sm"
                      >
                        <Edit2 size={16} />
                        تعديل
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(barber.id!)
                        }}
                        className="flex-1 px-3 py-2 bg-red-500/20 text-red-300 border border-red-400/50 rounded hover:bg-red-500/30 transition flex items-center justify-center gap-2 text-sm"
                      >
                        <Trash2 size={16} />
                        حذف
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingBarberId(null)
          setFormData({ name: '', phone: '' })
        }}
        title={editingBarberId ? 'تعديل الطبيب' : 'إضافة طبيب جديد'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">اسم الطبيب *</label>
            <input
              type="text"
              placeholder="مثال: أحمد"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">رقم الهاتف</label>
            <input
              type="tel"
              placeholder="مثال: 01012345678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveBarber}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-700 text-black rounded-lg font-semibold hover:from-pink-700 hover:to-pink-800 transition"
            >
              {editingBarberId ? 'حفظ التعديلات' : 'إضافة'}
            </button>
            <button
              onClick={() => {
                setIsModalOpen(false)
                setEditingBarberId(null)
                setFormData({ name: '', phone: '' })
              }}
              className="flex-1 px-4 py-2 bg-gray-600/50 text-gray-300 rounded-lg font-semibold hover:bg-gray-600 transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* Doctor Detail Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedBarber(null)
          setDoctorBookings([])
          setDoctorWaiting([])
        }}
        title={`${selectedBarber?.name || ''} — ملف الطبيب`}
        size="xl"
      >
        {selectedBarber && (
          <div className="space-y-6">
            {/* Doctor Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                <User size={18} className="text-pink-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">الاسم</p>
                  <p className="text-white font-bold truncate">{selectedBarber.name}</p>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                <Phone size={18} className="text-pink-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">الهاتف</p>
                  <p className="text-white font-bold truncate">{selectedBarber.phone || '—'}</p>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                <Briefcase size={18} className="text-pink-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">التخصص</p>
                  <p className="text-white font-bold truncate">{selectedBarber.specialization || '—'}</p>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                <Clock size={18} className="text-pink-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">ساعات العمل</p>
                  <p className="text-white font-bold">
                    {formatHours(selectedBarber.working_hours_start)} — {formatHours(selectedBarber.working_hours_end)}
                  </p>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                <Calendar size={18} className="text-pink-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">أيام العمل</p>
                  <p className="text-white font-bold text-sm">
                    {workingDaysLabel(selectedBarber.days_off)}
                  </p>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                <Ban size={18} className={onVacation ? 'text-red-400 shrink-0' : 'text-green-400 shrink-0'} />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">حالة الإجازة</p>
                  <p className={`font-bold ${onVacation ? 'text-red-400' : 'text-green-300'}`}>
                    {onVacation
                      ? `في إجازة (${formatArabicDate(String(selectedBarber.vacation_start))} — ${formatArabicDate(String(selectedBarber.vacation_end))})`
                      : selectedBarber.vacation_start
                        ? `غير في إجازة (إجازة: ${formatArabicDate(String(selectedBarber.vacation_start))})`
                        : 'غير في إجازة'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex gap-2 flex-wrap">
              {selectedBarber.active ? (
                <Badge label="نشط" variant="success" size="sm" />
              ) : (
                <Badge label="غير نشط" variant="danger" size="sm" />
              )}
              {onVacation && <Badge label="في إجازة" variant="danger" size="sm" />}
            </div>

            {/* Statistics */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">الإحصائيات</h3>
              {detailLoading ? (
                <p className="text-gray-400 text-sm">جاري التحميل...</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <Users size={20} className="text-pink-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{totalPatients}</p>
                    <p className="text-xs text-gray-400">إجمالي المرضى</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <Calendar size={20} className="text-pink-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{totalAppointments}</p>
                    <p className="text-xs text-gray-400">إجمالي المواعيد</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <CheckCircle2 size={20} className="text-green-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{totalAppointments}</p>
                    <p className="text-xs text-gray-400">مواعيد مكتملة</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <XCircle size={20} className="text-red-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{cancelledCount}</p>
                    <p className="text-xs text-gray-400">مواعيد ملغاة</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <Clock size={20} className="text-amber-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{noShowCount}</p>
                    <p className="text-xs text-gray-400">لم يحضروا</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-center">
                    <ListChecks size={20} className="text-blue-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{waitingCount}</p>
                    <p className="text-xs text-gray-400">قائمة الانتظار</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-center col-span-2 md:col-span-3">
                    <DollarSign size={20} className="text-green-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{formatMoney(revenueGenerated)}</p>
                    <p className="text-xs text-gray-400">الإيرادات المحققة</p>
                  </div>
                </div>
              )}
            </div>

            {/* Upcoming Appointments */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">المواعيد القادمة</h3>
              {upcoming.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {upcoming.slice(0, 10).map(b => (
                    <div key={b.id} className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <User size={16} className="text-pink-400 shrink-0" />
                        <span className="text-white font-semibold truncate">{b.client_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Clock size={14} className="text-pink-400" />
                        <span>{b.booking_time ? formatArabicTime(String(b.booking_time).split('T')[1]?.slice(0, 5) || String(b.booking_time).slice(11, 16) || '') : '—'}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-300 truncate max-w-[140px]">{b.service_type || '—'}</span>
                      </div>
                      <Badge
                        label={bookingStatusLabel[b.status] || b.status}
                        variant={b.status === 'confirmed' ? 'success' : 'info'}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">لا توجد مواعيد قادمة</p>
              )}
            </div>

            {/* Appointment History */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">سجل المواعيد</h3>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {filterChips.map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => setHistoryFilter(chip.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                      historyFilter === chip.key
                        ? 'bg-pink-500 text-white'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
                <div className="relative flex-1 min-w-[160px]">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ابحث عن عميل..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-3 pr-9 py-1.5 bg-white/10 border border-white/20 rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              {filteredHistory.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredHistory.slice(0, 20).map(trx => (
                    <div key={trx.id} className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar size={16} className="text-pink-400 shrink-0" />
                          <span className="text-white font-semibold">{formatArabicDate(trx.date)}</span>
                          <span className="text-gray-500 text-sm">•</span>
                          <span className="text-gray-300 text-sm">{formatArabicTime(trx.time || '')}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-300 text-sm">
                          <CreditCard size={14} className="text-pink-400" />
                          <span>{paymentMethodLabel(trx.payment_method || '')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-2">
                        <User size={14} className="text-pink-400 shrink-0" />
                        <span className="text-gray-200 font-semibold truncate">{trx.client_name || '—'}</span>
                        <span className="text-pink-400 font-bold mr-auto">{formatMoney(trx.total)}</span>
                      </div>
                      {serviceNames(trx).length > 0 && (
                        <div className="mt-1 text-xs text-gray-400">
                          {serviceNames(trx).slice(0, 3).join('، ')}
                          {serviceNames(trx).length > 3 && ` +${serviceNames(trx).length - 3}`}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <Badge label="مكتمل" variant="success" size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">لا توجد مواعيد في هذا النطاق</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Barber Confirmation */}
      <ConfirmDialog
        isOpen={!!barberToDelete}
        onClose={() => setBarberToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="حذف الطبيب"
        description="هل تريد حذف هذا الطبيب؟ سيتم إزالته من النظام ولا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />
    </div>
  )
}
