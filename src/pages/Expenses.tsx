import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { useExpenses } from '../db/hooks/useExpenses'
import { getEgyptDateString } from '../utils/egyptTime'
import { motion } from 'framer-motion'
import { Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export const Expenses: React.FC = () => {
  const { t } = useTranslation()
  const { expenses, addExpense, deleteExpense } = useExpenses()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    category: 'supplies',
    amount: 0,
    date: getEgyptDateString(),
    note: '',
  })

  const categories = ['supplies', 'rent', 'utilities', 'salary', 'maintenance', 'other']

  const handleAddExpense = async () => {
    if (!formData.amount) {
      toast.error(t('errors.required_field'))
      return
    }

    try {
      await addExpense({
        ...formData,
        amount: parseFloat(String(formData.amount)),
      })
      toast.success(t('notifications.expense_added'))
      setFormData({
        category: 'supplies',
        amount: 0,
        date: getEgyptDateString(),
        note: '',
      })
      setIsModalOpen(false)
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id)
      toast.success(t('notifications.expense_deleted'))
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t('expenses.title')}</h1>
        <motion.button
          onClick={() => setIsModalOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg"
        >
          <Plus size={20} />
          {t('expenses.add_expense')}
        </motion.button>
      </motion.div>

      {/* Total Card */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">{t('expenses.total_expenses')}</p>
            <h2 className="text-3xl font-bold text-gold-400">{totalExpenses.toFixed(2)} ج.م</h2>
          </div>
        </div>
      </GlassCard>

      {/* Expenses List */}
      <div className="space-y-3">
        {expenses.map((expense, idx) => (
          <motion.div
            key={expense.id || idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <GlassCard>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{t(`expenses.categories.${expense.category}`)}</p>
                  <p className="text-xs text-gray-400">{expense.date}</p>
                  {expense.note && <p className="text-xs text-gray-500 mt-1">{expense.note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-gold-400 font-bold text-lg">{expense.amount.toFixed(2)} ج.م</p>
                  <button
                    onClick={() => handleDelete(expense.id!)}
                    aria-label={t('common.delete')}
                    className="p-2 hover:bg-red-500/10 rounded transition"
                  >
                    <Trash2 size={18} className="text-red-400" />
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('expenses.add_expense')}
      >
        <div className="space-y-4">
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {t(`expenses.categories.${cat}`)}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder={t('common.amount')}
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
            className="w-full"
          />
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full"
          />
          <textarea
            placeholder={t('common.notes')}
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            className="w-full h-20"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-4 py-2 border border-white/20 rounded-lg"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleAddExpense}
              className="flex-1 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg font-bold"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
