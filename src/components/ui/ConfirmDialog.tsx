import React from 'react'
import { Modal } from './Modal'
import { motion } from 'framer-motion'
import { AlertCircle, Trash2, Check, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
  loading?: boolean
  icon?: React.ReactNode
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  loading = false,
  icon,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-6">
        {/* Icon and Message */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${isDangerous ? 'bg-red-500/10' : 'bg-pink-500/10'}`}>
            {icon || (isDangerous ? (
              <Trash2 className={isDangerous ? 'text-red-400' : 'text-pink-400'} size={24} />
            ) : (
              <AlertCircle className={isDangerous ? 'text-red-400' : 'text-pink-400'} size={24} />
            ))}
          </div>
          <p className="text-white/90 leading-relaxed flex-1 pt-2">{message}</p>
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
              {cancelText}
            </div>
          </motion.button>

          <motion.button
            onClick={onConfirm}
            disabled={loading}
            className={`px-6 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 ${
              isDangerous
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 border-2 border-red-500/50 shadow-lg hover:shadow-red-500/50'
                : 'bg-gradient-to-r from-pink-600 to-pink-700 text-white hover:from-pink-700 hover:to-pink-800 border-2 border-pink-500/50 shadow-lg hover:shadow-pink-500/50'
            } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            {isDangerous ? (
              <Trash2 size={16} />
            ) : (
              <Check size={16} />
            )}
            {loading ? 'جاري...' : confirmText}
          </motion.button>
        </div>
      </div>
    </Modal>
  )
}
