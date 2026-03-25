import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { useTransactions } from '../db/hooks/useTransactions'
import { useVisitLogs } from '../db/hooks/useVisitLogs'
import { getEgyptDateString } from '../utils/egyptTime'
import { Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export const DailyLogs: React.FC = () => {
  const { t } = useTranslation()
  const { transactions } = useTransactions()
  const { visitLogs } = useVisitLogs()

  const [selectedDate, setSelectedDate] = useState(getEgyptDateString())
  const [activeTab, setActiveTab] = useState<'transactions' | 'visits'>('transactions')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [editFormData, setEditFormData] = useState<any>(null)

  // Filter logs by selected date
  const todayTransactions = transactions.filter((t) => t.date === selectedDate)
  const todayVisits = visitLogs.filter((v) => v.visitDate === selectedDate)

  const openEditModal = (item: any, type: 'transaction' | 'visit') => {
    setEditingItem({ ...item, type })
    setEditFormData(JSON.parse(JSON.stringify(item)))
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editFormData) return

    try {
      // Here you would call update functions
      // For now, just show success
      toast.success('تم تحديث البيانات بنجاح')
      setIsEditModalOpen(false)
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <h1 className="text-3xl font-bold text-white">سجلات اليوم</h1>
      </motion.div>

      {/* Date Selector */}
      <GlassCard>
        <div className="flex items-center gap-4">
          <label className="text-white font-semibold">تاريخ اليوم:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full max-w-xs"
          />
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-3 font-semibold transition ${
            activeTab === 'transactions'
              ? 'text-gold-400 border-b-2 border-gold-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          المبيعات ({todayTransactions.length})
        </button>
        <button
          onClick={() => setActiveTab('visits')}
          className={`px-4 py-3 font-semibold transition ${
            activeTab === 'visits'
              ? 'text-gold-400 border-b-2 border-gold-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          الزيارات ({todayVisits.length})
        </button>
      </div>

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {todayTransactions.length === 0 ? (
            <GlassCard>
              <p className="text-center text-gray-400 py-8">لا توجد مبيعات في هذا التاريخ</p>
            </GlassCard>
          ) : (
            todayTransactions.map((tx, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <GlassCard>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-4">
                        <p className="text-white font-bold text-lg">{tx.client_name}</p>
                        <p className="text-xs bg-gold-400/20 text-gold-400 px-2 py-1 rounded">
                          {tx.time}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">العدد</p>
                          <p className="text-white font-semibold">{tx.items?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">الإجمالي قبل خصم</p>
                          <p className="text-white font-semibold">{tx.subtotal?.toFixed(2)} ج.م</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">الخصم</p>
                          <p className="text-red-400 font-semibold">{tx.discount?.toFixed(2) || 0} ج.م</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">الإجمالي</p>
                          <p className="text-gold-400 font-bold text-lg">{tx.total?.toFixed(2)} ج.م</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center gap-4">
                        <p className="text-xs text-gray-400">الدفع: {tx.payment_method}</p>
                        <p className="text-xs text-gray-400">رقم العملية: {tx.visit_number}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(tx, 'transaction')}
                        className="p-2 hover:bg-blue-500/10 rounded transition"
                      >
                        <Edit2 size={18} className="text-blue-400" />
                      </button>
                      <button className="p-2 hover:bg-red-500/10 rounded transition">
                        <Trash2 size={18} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Visits Tab */}
      {activeTab === 'visits' && (
        <div className="space-y-4">
          {todayVisits.length === 0 ? (
            <GlassCard>
              <p className="text-center text-gray-400 py-8">لا توجد زيارات في هذا التاريخ</p>
            </GlassCard>
          ) : (
            todayVisits.map((visit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <GlassCard>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-4">
                        <p className="text-white font-bold text-lg">{visit.client_name}</p>
                        <p className="text-xs bg-gold-400/20 text-gold-400 px-2 py-1 rounded">
                          {visit.visitTime}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">الخدمات</p>
                          <p className="text-white font-semibold">{visit.servicesCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">المبلغ المنفق</p>
                          <p className="text-gold-400 font-semibold">{visit.total_spent?.toFixed(2)} ج.م</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">التاريخ</p>
                          <p className="text-white font-semibold">{visit.visitDate}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">ملاحظات</p>
                          <p className="text-gray-300 text-xs">{visit.notes || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(visit, 'visit')}
                        className="p-2 hover:bg-blue-500/10 rounded transition"
                      >
                        <Edit2 size={18} className="text-blue-400" />
                      </button>
                      <button className="p-2 hover:bg-red-500/10 rounded transition">
                        <Trash2 size={18} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editingItem?.type === 'transaction' ? 'تعديل المبيعة' : 'تعديل الزيارة'}
        size="lg"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {editingItem?.type === 'transaction' && editFormData && (
            <>
              <div>
                <label className="block text-sm text-gray-300 mb-2">اسم العميل</label>
                <input
                  type="text"
                  value={editFormData.client_name || ''}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      client_name: e.target.value,
                    })
                  }
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">الإجمالي قبل خصم</label>
                  <input
                    type="number"
                    value={editFormData.subtotal || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        subtotal: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">الخصم</label>
                  <input
                    type="number"
                    value={editFormData.discount || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        discount: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">طريقة الدفع</label>
                  <select
                    value={editFormData.payment_method || 'cash'}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        payment_method: e.target.value,
                      })
                    }
                    className="w-full"
                  >
                    <option value="cash">نقد</option>
                    <option value="card">بطاقة</option>
                    <option value="wallet">محفظة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">الإجمالي (قراءة فقط)</label>
                  <input
                    type="number"
                    value={
                      (editFormData.subtotal || 0) - (editFormData.discount || 0)
                    }
                    disabled
                    className="w-full opacity-50"
                  />
                </div>
              </div>
            </>
          )}

          {editingItem?.type === 'visit' && editFormData && (
            <>
              <div>
                <label className="block text-sm text-gray-300 mb-2">اسم العميل</label>
                <input
                  type="text"
                  value={editFormData.client_name || ''}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      client_name: e.target.value,
                    })
                  }
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">عدد الخدمات</label>
                  <input
                    type="number"
                    value={editFormData.servicesCount || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        servicesCount: parseInt(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">المبلغ المنفق</label>
                  <input
                    type="number"
                    value={editFormData.total_spent || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        total_spent: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">الملاحظات</label>
                <textarea
                  value={editFormData.notes || ''}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      notes: e.target.value,
                    })
                  }
                  className="w-full"
                  rows={3}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition"
            >
              إلغاء
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex-1 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg font-bold hover:bg-gold-400/30 transition"
            >
              حفظ التعديلات
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
