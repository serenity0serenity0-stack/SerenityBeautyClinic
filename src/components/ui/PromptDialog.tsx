import React, { useEffect, useId, useRef, useState } from 'react'
import { Modal } from './Modal'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { MinusCircle, Loader2, X } from 'lucide-react'

export interface PromptDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (value: string) => void | Promise<void>
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  defaultValue?: string
  placeholder?: string
  type?: 'number' | 'text'
  loading?: boolean
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  defaultValue = '',
  placeholder,
  type = 'text',
  loading = false,
}) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue)
  const messageId = useId()

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
    }
  }, [isOpen, defaultValue])

  const isValid = value.trim().length > 0

  const handleConfirm = () => {
    if (!isValid || loading) return
    onConfirm(value)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
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
          </div>
        </div>

        {/* Input */}
        <div>
          <input
            ref={inputRef}
            type={type}
            min={type === 'number' ? '1' : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm()
            }}
            placeholder={placeholder}
            autoFocus
            className="w-full"
          />
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