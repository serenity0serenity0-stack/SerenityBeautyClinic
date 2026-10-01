import React, { useEffect, useId, useRef, useState } from 'react'
import { Modal } from './Modal'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { MinusCircle, Loader2, X, Search, User } from 'lucide-react'
import { useBarbers } from '../../db/hooks/useBarbers'

export interface ConsumeBalanceDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (quantity: string, doctorId?: string | null, doctorName?: string | null) => void | Promise<void>
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  defaultQuantity?: string
  placeholder?: string
  loading?: boolean
  availableLabel?: string
}

export const ConsumeBalanceDialog: React.FC<ConsumeBalanceDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  defaultQuantity = '1',
  placeholder = 'الكمية',
  loading = false,
  availableLabel,
}) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [quantity, setQuantity] = useState(defaultQuantity)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null)
  const [doctorSearch, setDoctorSearch] = useState('')
  const [showDoctorList, setShowDoctorList] = useState(false)
  const messageId = useId()
  const { barbers } = useBarbers()

  const activeBarbers = barbers.filter((b) => b.active)

  const filteredBarbers = activeBarbers.filter((b) =>
    b.name.toLowerCase().includes(doctorSearch.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      setQuantity(defaultQuantity)
      setSelectedDoctorId(null)
      setDoctorSearch('')
      setShowDoctorList(false)
    }
  }, [isOpen, defaultQuantity])

  const isValid = quantity.trim().length > 0 && !isNaN(Number(quantity)) && Number(quantity) > 0

  const selectedDoctor = activeBarbers.find((b) => b.id === selectedDoctorId)

  const handleConfirm = () => {
    if (!isValid || loading) return
    onConfirm(quantity, selectedDoctorId, selectedDoctor?.name ?? null)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="md"
      closeOnBackdrop={false}
      closeOnEscape={!loading}
      describedByIds={description ? [messageId] : []}
    >
      <div className="space-y-6">
        {/* Icon and Description */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-pink-500/10 shrink-0">
            <MinusCircle size={24} className="text-pink-400" />
          </div>
          <div className="flex-1 pt-1">
            {description && (
              <p id={messageId} className="text-white/90 leading-relaxed whitespace-pre-line">
                {description}
              </p>
            )}
            {availableLabel && (
              <p className="text-sm text-gray-400 mt-2">{availableLabel}</p>
            )}
          </div>
        </div>

        {/* Quantity Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">الكمية</label>
          <input
            ref={inputRef}
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm()
            }}
            placeholder={placeholder}
            autoFocus
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-pink-400/40"
          />
        </div>

        {/* Doctor Selector */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-300 mb-2">الطبيب (اختياري)</label>
          <div
            onClick={() => !loading && setShowDoctorList(!showDoctorList)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white cursor-pointer flex items-center justify-between hover:bg-white/10 transition"
          >
            <div className="flex items-center gap-2">
              <User size={18} className="text-gray-400" />
              <span className={selectedDoctor ? 'text-white' : 'text-gray-400'}>
                {selectedDoctor ? selectedDoctor.name : 'اختر الطبيب'}
              </span>
            </div>
            <svg
              className={`w-5 h-5 transition-transform ${showDoctorList ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {showDoctorList && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 max-h-64 overflow-hidden"
            >
              {/* Search */}
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    placeholder="البحث عن طبيب..."
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-pink-400/40"
                  />
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto max-h-48">
                <button
                  onClick={() => {
                    setSelectedDoctorId(null)
                    setShowDoctorList(false)
                  }}
                  className="w-full px-4 py-2.5 text-right hover:bg-white/10 transition flex items-center gap-2 text-gray-400"
                >
                  <span>بدون طبيب</span>
                </button>
                {filteredBarbers.length > 0 ? (
                  filteredBarbers.map((barber) => (
                    <button
                      key={barber.id}
                      onClick={() => {
                        setSelectedDoctorId(barber.id!)
                        setShowDoctorList(false)
                      }}
                      className={`w-full px-4 py-2.5 text-right hover:bg-white/10 transition flex items-center gap-2 ${
                        selectedDoctorId === barber.id ? 'bg-pink-500/20 text-pink-300' : 'text-white'
                      }`}
                    >
                      <User size={16} />
                      <span>{barber.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm">لا يوجد طبيب</div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
          <motion.button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border-2 border-white/20 text-white hover:bg-white/5 hover:border-white/30 transition font-medium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
          >
            <div className="flex items-center gap-2">
              <X size={16} />
              {cancelText || t('common.cancel')}
            </div>
          </motion.button>

          <motion.button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className={`px-6 py-2.5 rounded-lg bg-gradient-to-r from-pink-600 to-pink-700 text-white hover:from-pink-700 hover:to-pink-800 border-2 border-pink-500/50 shadow-lg hover:shadow-pink-500/50 font-semibold transition flex items-center gap-2 ${
              !isValid || loading ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            whileHover={isValid && !loading ? { scale: 1.02 } : {}}
            whileTap={isValid && !loading ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <MinusCircle size={16} />
            )}
            {loading ? t('common.loading_short') || 'جاري...' : confirmText || t('common.confirm')}
          </motion.button>
        </div>
      </div>
    </Modal>
  )
}
