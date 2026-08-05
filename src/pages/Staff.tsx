import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { useBarbers } from '../db/hooks/useBarbers'
import { useTransactions } from '../db/hooks/useTransactions'
import { motion } from 'framer-motion'
import { Trash2, Edit2, Plus, DollarSign, Users, TrendingUp, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { appEmitter } from '../utils/eventEmitter'
import { getEgyptYearMonth } from '../utils/egyptTime'

interface StaffStats {
  clientCount: number
  monthlyRevenue: number
  totalRevenue: number
  lastVisit?: string
}

export const Staff: React.FC = () => {
  const { t } = useTranslation()
  const { barbers, addBarber, updateBarber, deleteBarber } = useBarbers()
  const { transactions, fetchTransactions } = useTransactions()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    phone: string
    working_hours_start: string
    working_hours_end: string
    days_off: number[]
    vacation_start: string
    vacation_end: string
  }>({
    name: '',
    phone: '',
    working_hours_start: '09:00',
    working_hours_end: '21:00',
    days_off: [],
    vacation_start: '',
    vacation_end: '',
  })
  const [staffStats, setStaffStats] = useState<{
    [barberId: string]: StaffStats
  }>({})
  const [selectedMonth, setSelectedMonth] = useState(getEgyptYearMonth())

  // Load transactions on mount
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Listen for new transactions and refresh
  useEffect(() => {
    const handleNewTransaction = async () => {
      console.log('New transaction detected, refreshing data...')
      await fetchTransactions()
    }

    appEmitter.on('transaction:created', handleNewTransaction)

    return () => {
      appEmitter.off('transaction:created', handleNewTransaction)
    }
  }, [fetchTransactions])

  // Calculate staff statistics for the selected month.
  // Doctor totals are scoped to the selected month so the numbers reset
  // at the start of each month.
  useEffect(() => {
    const stats: typeof staffStats = {}
    
    barbers.forEach(barber => {
      const barberTransactions = transactions.filter(
        t => t.barber_id === barber.id && String(t.date).startsWith(selectedMonth)
      )
      
      // All unique clients in the selected month
      const allUniqueClients = new Set(barberTransactions.map(t => t.client_id))
      
      // Revenue in the selected month
      const monthRevenue = barberTransactions.reduce((sum, t) => sum + t.total, 0)
      
      // Last visit in the selected month
      const lastTransaction = barberTransactions[0]
      
      stats[barber.id!] = {
        clientCount: allUniqueClients.size,
        monthlyRevenue: monthRevenue,
        totalRevenue: monthRevenue,
        lastVisit: lastTransaction?.date
      }
    })
    
    setStaffStats(stats)
  }, [barbers, transactions, selectedMonth])

  const handleEditClick = (barber: any) => {
    setEditingBarberId(barber.id)
    setFormData({
      name: barber.name,
      phone: barber.phone || '',
      working_hours_start: barber.working_hours_start || '09:00',
      working_hours_end: barber.working_hours_end || '21:00',
      days_off: Array.isArray(barber.days_off) ? barber.days_off : [],
      vacation_start: barber.vacation_start || '',
      vacation_end: barber.vacation_end || '',
    })
    setIsModalOpen(true)
  }

  const handleSaveStaff = async () => {
    if (!formData.name) {
      toast.error(t('errors.required_field'))
      return
    }

    const schedule = {
      working_hours_start: formData.working_hours_start || null,
      working_hours_end: formData.working_hours_end || null,
      days_off: formData.days_off.length > 0 ? formData.days_off : null,
      vacation_start: formData.vacation_start || null,
      vacation_end: formData.vacation_end || null,
    }

    try {
      if (editingBarberId) {
        await updateBarber(editingBarberId, {
          name: formData.name,
          phone: formData.phone,
          ...schedule,
        })
      } else {
        await addBarber({
          name: formData.name,
          phone: formData.phone,
          active: true,
          ...schedule,
        })
      }
      setFormData({
        name: '',
        phone: '',
        working_hours_start: '09:00',
        working_hours_end: '21:00',
        days_off: [],
        vacation_start: '',
        vacation_end: '',
      })
      setIsModalOpen(false)
      setEditingBarberId(null)
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('هل تريد حذف هذا الطبيب؟')) {
      try {
        await deleteBarber(id)
      } catch (err) {
        toast.error(t('errors.database_error'))
      }
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
    setFormData({
      name: '',
      phone: '',
      working_hours_start: '09:00',
      working_hours_end: '21:00',
      days_off: [],
      vacation_start: '',
      vacation_end: '',
    })
    setIsModalOpen(true)
  }

  const DAYS_LABELS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

  const toggleDayOff = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      days_off: prev.days_off.includes(day)
        ? prev.days_off.filter((d) => d !== day)
        : [...prev.days_off, day],
    }))
  }

  const totalMonthlyRevenue = Object.values(staffStats).reduce((sum, s) => sum + s.monthlyRevenue, 0)
  const monthTransactionCount = transactions.filter(t => String(t.date).startsWith(selectedMonth)).length
  const activeBarbers = barbers.filter(b => b.active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t('pages.staff_title')}</h1>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-pink-500 text-white rounded-lg font-semibold hover:bg-pink-600 transition flex items-center gap-2"
        >
          <Plus size={20} />
          {t('common.add')} {t('pages.staff_title')}
        </button>
      </div>

      {/* Month Filter - totals reset at the start of each month */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-gray-400">فلترة حسب الشهر</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-pink-400/40"
        />
        <span className="text-xs text-gray-500">
          أرباح كل طبيب تُحسب من أول الشهر حتى نهايته ويُصفَّر الإجمالي مع بداية كل شهر
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('pages.staff_count')}</p>
              <p className="text-3xl font-bold text-white mt-2">{barbers.length}</p>
              <p className="text-xs text-gray-500 mt-1">{activeBarbers} نشط</p>
            </div>
            <Users size={40} className="text-pink-400" />
          </div>
        </GlassCard>

        <GlassCard className="bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">أرباح الشهر</p>
              <p className="text-3xl font-bold text-white mt-2">
                {totalMonthlyRevenue.toLocaleString('en-US')}
              </p>
              <p className="text-xs text-gray-500 mt-1">{t('common.currency')} - {selectedMonth}</p>
            </div>
            <DollarSign size={40} className="text-green-400" />
          </div>
        </GlassCard>

        <GlassCard className="bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">عدد عمليات الشهر</p>
              <p className="text-3xl font-bold text-white mt-2">
                {monthTransactionCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">{selectedMonth}</p>
            </div>
            <TrendingUp size={40} className="text-blue-400" />
          </div>
        </GlassCard>
      </div>

      {/* Staff Grid */}
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
            const stats = staffStats[barber.id!] || {
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
                <GlassCard className={!barber.active ? 'opacity-75' : ''}>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg">{barber.name}</h3>
                        {barber.phone && (
                          <p className="text-gray-400 text-sm mt-1">📱 {barber.phone}</p>
                        )}
                        {barber.working_hours_start && barber.working_hours_end && (
                          <p className="text-gray-500 text-xs mt-1">
                            🕐 {barber.working_hours_start.slice(0, 5)} - {barber.working_hours_end.slice(0, 5)}
                          </p>
                        )}
                        {Array.isArray(barber.days_off) && barber.days_off.length > 0 && (
                          <p className="text-amber-400/80 text-xs mt-1">
                            إجازة: {barber.days_off.map((d) => DAYS_LABELS[d]).filter(Boolean).join('، ')}
                          </p>
                        )}
                        {barber.vacation_start && barber.vacation_end && (
                          <p className="text-amber-400/80 text-xs mt-1">
                            🏖 إجازة من {barber.vacation_start} إلى {barber.vacation_end}
                          </p>
                        )}
                      </div>
                      <div 
                        onClick={() => handleToggleActive(barber.id!, barber.active)}
                        title="اضغط لتبديل حالة الطبيب"
                        className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap cursor-pointer transition hover:opacity-80 ${
                          barber.active 
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                        {barber.active ? 'نشط' : 'غير نشط'}
                      </div>
                    </div>

                    {/* Inactive banner */}
                    {!barber.active && (
                      <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2">
                        <UserX size={14} className="shrink-0" />
                        هذا الطبيب غير نشط ولا يظهر في قائمة أطباء الكاشير
                      </div>
                    )}

                    {/* Stats */}
                    <div className="space-y-3 border-t border-white/10 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">عدد العملاء</span>
                        <span className="text-white font-bold">{stats.clientCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">أرباح الشهر</span>
                        <span className="text-green-400 font-bold">
                          {stats.monthlyRevenue.toLocaleString('ar-EG')} ج.م
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
                        onClick={() => handleEditClick(barber)}
                        className="flex-1 px-3 py-2 bg-blue-500/20 text-blue-300 border border-blue-400/50 rounded hover:bg-blue-500/30 transition flex items-center justify-center gap-2 text-sm"
                      >
                        <Edit2 size={16} />
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(barber.id!)}
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingBarberId(null)
          setFormData({
            name: '',
            phone: '',
            working_hours_start: '09:00',
            working_hours_end: '21:00',
            days_off: [],
            vacation_start: '',
            vacation_end: '',
          })
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-2">بداية العمل</label>
              <input
                type="time"
                value={formData.working_hours_start}
                onChange={(e) => setFormData({ ...formData, working_hours_start: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">نهاية العمل</label>
              <input
                type="time"
                value={formData.working_hours_end}
                onChange={(e) => setFormData({ ...formData, working_hours_end: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">أيام الإجازة الأسبوعية</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDayOff(i)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition ${
                    formData.days_off.includes(i)
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                      : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/15'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-2">إجازة من</label>
              <input
                type="date"
                value={formData.vacation_start}
                onChange={(e) => setFormData({ ...formData, vacation_start: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">إجازة إلى</label>
              <input
                type="date"
                value={formData.vacation_end}
                onChange={(e) => setFormData({ ...formData, vacation_end: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveStaff}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-700 text-black rounded-lg font-semibold hover:from-pink-700 hover:to-pink-800 transition"
            >
              {editingBarberId ? 'حفظ التعديلات' : 'إضافة'}
            </button>
            <button
              onClick={() => {
                setIsModalOpen(false)
                setEditingBarberId(null)
                setFormData({
                  name: '',
                  phone: '',
                  working_hours_start: '09:00',
                  working_hours_end: '21:00',
                  days_off: [],
                  vacation_start: '',
                  vacation_end: '',
                })
              }}
              className="flex-1 px-4 py-2 bg-gray-600/50 text-gray-300 rounded-lg font-semibold hover:bg-gray-600 transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
