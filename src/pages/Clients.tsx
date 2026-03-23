import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { useClients } from '../db/hooks/useClients'
import { useVisitLogs, VisitLog } from '../db/hooks/useVisitLogs'
import { Client } from '../db/supabase'
import { motion } from 'framer-motion'
import { Trash2, Edit2, Plus, Calendar, Clock, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

type SortBy = 'name' | 'visits' | 'spent' | 'recent'

export const Clients: React.FC = () => {
  const { t } = useTranslation()
  const { clients, addClient, updateClient, deleteClient } = useClients()
  const { getClientVisitLogs } = useVisitLogs()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<any>(null)
  const [clientVisitLogs, setClientVisitLogs] = useState<VisitLog[]>([])
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', birthday: '', isVIP: false })
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', email: '', birthday: '', isVIP: false })

  // Filter states
  const [vipFilter, setVipFilter] = useState<'all' | 'vip' | 'regular'>('all')
  const [birthdayMonth, setBirthdayMonth] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortBy>('recent')

  // Fetch visit logs when opening detail modal
  useEffect(() => {
    if (isDetailModalOpen && selectedClientForDetail?.id) {
      const fetchLogs = async () => {
        try {
          const logs = await getClientVisitLogs(selectedClientForDetail.id)
          setClientVisitLogs(logs)
        } catch (err) {
          toast.error('Failed to load visit history')
        }
      }
      fetchLogs()
    }
  }, [isDetailModalOpen, selectedClientForDetail, getClientVisitLogs])

  const handleAddClient = async () => {
    if (!formData.name || !formData.phone) {
      toast.error(t('errors.required_field'))
      return
    }

    try {
      await addClient({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        birthday: formData.birthday,
        totalVisits: 0,
        totalSpent: 0,
        isVIP: formData.isVIP,
      })
      toast.success(t('notifications.client_added'))
      setFormData({ name: '', phone: '', email: '', birthday: '', isVIP: false })
      setIsModalOpen(false)
    } catch (err: any) {
      // Check if error is due to duplicate phone number
      if (err.message && err.message.includes('unique')) {
        toast.error('⚠️ رقم الهاتف هذا مسجل بالفعل لعميل آخر')
      } else {
        toast.error(t('errors.database_error'))
      }
    }
  }

  const handleEditClick = (client: Client) => {
    setEditingClientId(client.id!)
    setEditFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      birthday: client.birthday || '',
      isVIP: client.isVIP || false,
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateClient = async () => {
    if (!editFormData.name || !editFormData.phone) {
      toast.error(t('errors.required_field'))
      return
    }

    try {
      await updateClient(editingClientId!, {
        name: editFormData.name,
        phone: editFormData.phone,
        email: editFormData.email || null,
        birthday: editFormData.birthday,
        isVIP: editFormData.isVIP,
      })
      toast.success(t('notifications.client_updated'))
      setEditingClientId(null)
      setEditFormData({ name: '', phone: '', email: '', birthday: '', isVIP: false })
      setIsEditModalOpen(false)
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id)
      toast.success(t('notifications.client_deleted'))
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const handleViewDetails = (client: any) => {
    setSelectedClientForDetail(client)
    setIsDetailModalOpen(true)
  }

  const filteredClients = clients
    .filter((c) => {
      // Search filter
      if (searchQuery) {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
        if (!matchesSearch) return false
      }

      // VIP filter
      if (vipFilter === 'vip' && !c.isVIP) return false
      if (vipFilter === 'regular' && c.isVIP) return false

      // Birthday month filter
      if (birthdayMonth) {
        if (!c.birthday) return false
        const birthMonth = new Date(c.birthday).getMonth() + 1
        if (birthMonth !== parseInt(birthdayMonth)) return false
      }

      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'visits':
          return b.totalVisits - a.totalVisits
        case 'spent':
          return b.totalSpent - a.totalSpent
        case 'recent':
          return 0 // Keep original order
      }
    })

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t('clients.title')}</h1>
        <motion.button
          onClick={() => setIsModalOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg"
        >
          <Plus size={20} />
          {t('clients.add_client')}
        </motion.button>
      </motion.div>

      {/* Search */}
      <GlassCard>
        <input
          type="text"
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </GlassCard>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4"
      >
        <div className="flex items-center gap-2 text-white font-bold mb-3">
          <Filter size={20} />
          تصفية النتائج
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* VIP Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">الحالة</label>
            <select
              value={vipFilter}
              onChange={(e) => setVipFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
            >
              <option value="all">الكل</option>
              <option value="vip">VIP فقط</option>
              <option value="regular">عملاء عاديين</option>
            </select>
          </div>

          {/* Birthday Month Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">شهر الميلاد</label>
            <select
              value={birthdayMonth}
              onChange={(e) => setBirthdayMonth(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
            >
              <option value="">جميع الأشهر</option>
              <option value="1">يناير</option>
              <option value="2">فبراير</option>
              <option value="3">مارس</option>
              <option value="4">أبريل</option>
              <option value="5">مايو</option>
              <option value="6">يونيو</option>
              <option value="7">يوليو</option>
              <option value="8">أغسطس</option>
              <option value="9">سبتمبر</option>
              <option value="10">أكتوبر</option>
              <option value="11">نوفمبر</option>
              <option value="12">ديسمبر</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">ترتيب حسب</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
            >
              <option value="recent">الأحدث</option>
              <option value="name">الاسم (أ-ي)</option>
              <option value="visits">عدد الزيارات</option>
              <option value="spent">الإنفاق</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            {(vipFilter !== 'all' || birthdayMonth || sortBy !== 'recent') && (
              <button
                onClick={() => {
                  setVipFilter('all')
                  setBirthdayMonth('')
                  setSortBy('recent')
                  setSearchQuery('')
                }}
                className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-white text-sm transition"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Clients List */}
      <div className="grid gap-3">
        {filteredClients.map((client, idx) => (
          <motion.div
            key={client.id || idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05}}
          >
            <GlassCard 
              onClick={() => handleViewDetails(client)}
              className="cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-white font-semibold hover:text-gold-400 transition">{client.name}</p>
                  <p className="text-xs text-gray-400">{client.phone}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {client.isVIP && <Badge label="VIP" variant="gold" />}
                    <Badge label={`${client.totalVisits} visits`} variant="info" />
                    <Badge label={`${client.totalSpent.toFixed(2)} ج.م`} variant="success" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditClick(client)
                    }}
                    className="p-2 hover:bg-white/10 rounded transition"
                    title="Edit"
                  >
                    <Edit2 size={18} className="text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(client.id!)
                    }}
                    className="p-2 hover:bg-red-500/10 rounded transition"
                    title="Delete"
                  >
                    <Trash2 size={18} className="text-red-400" />
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Add Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('clients.add_client')}
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder={t('common.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <input
            type="tel"
            placeholder={t('common.phone')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <input
            type="email"
            placeholder="البريد الإلكتروني (اختياري)"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <input
            type="date"
            value={formData.birthday}
            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
          />
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <label className="text-white text-sm font-medium">VIP عميل</label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isVIP: !formData.isVIP })}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: '24px',
                width: '44px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                overflow: 'hidden',
                backgroundColor: formData.isVIP ? '#22c55e' : '#4b5563',
                transition: 'background-color 0.2s',
                flexShrink: 0
              }}
            >
              <span style={{
                position: 'absolute',
                top: '3px',
                left: formData.isVIP ? '23px' : '3px',
                height: '18px',
                width: '18px',
                borderRadius: '50%',
                backgroundColor: 'white',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
              }} />
            </button>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-4 py-3 border border-white/20 rounded-lg hover:bg-white/5 transition font-medium text-gray-300"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleAddClient}
              className="flex-1 px-4 py-3 bg-gold-400/20 text-gold-400 border border-gold-400/30 rounded-lg hover:bg-gold-400/30 transition font-bold"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingClientId(null)
          setEditFormData({ name: '', phone: '', email: '', birthday: '', isVIP: false })
        }}
        title={t('clients.edit_client')}
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder={t('common.name')}
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
          />
          <input
            type="tel"
            placeholder={t('common.phone')}
            value={editFormData.phone}
            onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
          />
          <input
            type="email"
            placeholder="البريد الإلكتروني (اختياري)"
            value={editFormData.email}
            onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
          />
          <input
            type="date"
            value={editFormData.birthday}
            onChange={(e) => setEditFormData({ ...editFormData, birthday: e.target.value })}
          />
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <label className="text-white text-sm font-medium">VIP عميل</label>
            <button
              type="button"
              onClick={() => setEditFormData({ ...editFormData, isVIP: !editFormData.isVIP })}
              style={{
                position: 'relative',
                display: 'inline-flex',
                height: '24px',
                width: '44px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                overflow: 'hidden',
                backgroundColor: editFormData.isVIP ? '#22c55e' : '#4b5563',
                transition: 'background-color 0.2s',
                flexShrink: 0
              }}
            >
              <span style={{
                position: 'absolute',
                top: '3px',
                left: editFormData.isVIP ? '23px' : '3px',
                height: '18px',
                width: '18px',
                borderRadius: '50%',
                backgroundColor: 'white',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
              }} />
            </button>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingClientId(null)
                setEditFormData({ name: '', phone: '', email: '', birthday: '', isVIP: false })
              }}
              className="flex-1 px-4 py-3 border border-white/20 rounded-lg hover:bg-white/5 transition font-medium text-gray-300"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleUpdateClient}
              className="flex-1 px-4 py-3 bg-gold-400/20 text-gold-400 border border-gold-400/30 rounded-lg hover:bg-gold-400/30 transition font-bold"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Client Detail Modal with Visit History */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedClientForDetail(null)
          setClientVisitLogs([])
        }}
        title={`${selectedClientForDetail?.name} - ${t('clients.visit_history')}`}
        size="lg"
      >
        {selectedClientForDetail && (
          <div className="space-y-6">
            {/* Client Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Total Visits</p>
                <p className="text-2xl font-bold text-gold-400">{selectedClientForDetail.totalVisits}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Total Spent</p>
                <p className="text-2xl font-bold text-gold-400">{selectedClientForDetail.totalSpent.toFixed(2)} ج.م</p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <p className="text-2xl font-bold text-gold-400">{selectedClientForDetail.isVIP ? 'VIP ⭐' : 'Regular'}</p>
              </div>
            </div>

            {/* Visit History */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Visit Logs</h3>
              {clientVisitLogs.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {clientVisitLogs.map((log, idx) => (
                    <div key={idx} className="bg-white/5 p-4 rounded-lg border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-gold-400" />
                          <span className="text-white font-semibold">{log.visitDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-gold-400" />
                          <span className="text-gray-300">{log.visitTime}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{log.servicesCount} services • {log.totalSpent.toFixed(2)} ج.م</p>
                      {log.notes && <p className="text-xs text-gray-500">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>No visit history yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
