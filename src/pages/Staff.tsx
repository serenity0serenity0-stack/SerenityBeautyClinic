import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { useBarbers } from '../db/hooks/useBarbers'
import { useTransactions } from '../db/hooks/useTransactions'
import { motion } from 'framer-motion'
import { Trash2, Edit2, Plus, DollarSign, Users, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { appEmitter } from '../utils/eventEmitter'

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
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [staffStats, setStaffStats] = useState<{
    [barberId: string]: StaffStats
  }>({})

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

  // Calculate staff statistics
  useEffect(() => {
    const stats: typeof staffStats = {}
    
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
    
    setStaffStats(stats)
  }, [barbers, transactions])

  const handleEditClick = (barber: any) => {
    setEditingBarberId(barber.id)
    setFormData({
      name: barber.name,
      phone: barber.phone || '',
    })
    setIsModalOpen(true)
  }

  const handleSaveStaff = async () => {
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
    if (confirm('هل تريد حذف هذا الموظف؟')) {
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
      toast.success(!currentActive ? 'تم تفعيل الموظف' : 'تم تعطيل الموظف')
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const openAddModal = () => {
    setEditingBarberId(null)
    setFormData({ name: '', phone: '' })
    setIsModalOpen(true)
  }

  const totalMonthlyRevenue = Object.values(staffStats).reduce((sum, s) => sum + s.monthlyRevenue, 0)
  const totalRevenue = Object.values(staffStats).reduce((sum, s) => sum + s.totalRevenue, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t('pages.staff_title')}</h1>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-gold-400 text-black rounded-lg font-semibold hover:bg-gold-500 transition flex items-center gap-2"
        >
          <Plus size={20} />
          {t('common.add')} {t('pages.staff_title')}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="bg-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('pages.staff_count')}</p>
              <p className="text-3xl font-bold text-white mt-2">{barbers.length}</p>
            </div>
            <Users size={40} className="text-gold-400" />
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

      {/* Staff Grid */}
      {barbers.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <p className="text-gray-400">لا يوجد موظفين بعد</p>
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 bg-gold-400 text-black rounded-lg font-semibold hover:bg-gold-500 transition"
            >
              إضافة موظف الآن
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
                <GlassCard>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg">{barber.name}</h3>
                        {barber.phone && (
                          <p className="text-gray-400 text-sm mt-1">📱 {barber.phone}</p>
                        )}
                      </div>
                      <div 
                        onClick={() => handleToggleActive(barber.id!, barber.active)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap cursor-pointer transition hover:opacity-80 ${
                          barber.active 
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
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
          setFormData({ name: '', phone: '' })
        }}
        title={editingBarberId ? 'تعديل الموظف' : 'إضافة موظف جديد'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">اسم الموظف *</label>
            <input
              type="text"
              placeholder="مثال: أحمد"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">رقم الهاتف</label>
            <input
              type="tel"
              placeholder="مثال: 01012345678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveStaff}
              className="flex-1 px-4 py-2 bg-gold-400 text-black rounded-lg font-semibold hover:bg-gold-500 transition"
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
    </div>
  )
}
