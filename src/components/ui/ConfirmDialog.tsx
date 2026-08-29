import React, { useId } from 'react'
import { Modal } from './Modal'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Trash2,
  Check,
  X,
  Info,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success' | 'default'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** @deprecated use `description` */
  message?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
  /** Backwards-compatible alias for variant="danger". */
  isDangerous?: boolean
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  /** Close the dialog when the user clicks the backdrop (defaults to false). */
  closeOnBackdrop?: boolean
}

interface VariantStyle {
  iconWrap: string
  iconColor: string
  button: string
  icon: React.ReactNode
}

const variantStyles = (iconSize: number): Record<ConfirmVariant, VariantStyle> => ({
  danger: {
    iconWrap: 'bg-red-500/10',
    iconColor: 'text-red-400',
    button:
      'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 border-2 border-red-500/50 shadow-lg hover:shadow-red-500/50',
    icon: <Trash2 size={iconSize} />,
  },
  warning: {
    iconWrap: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    button:
      'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 border-2 border-amber-500/50 shadow-lg hover:shadow-amber-500/50',
    icon: <AlertTriangle size={iconSize} />,
  },
  info: {
    iconWrap: 'bg-pink-500/10',
    iconColor: 'text-pink-400',
    button:
      'bg-gradient-to-r from-pink-600 to-pink-700 text-white hover:from-pink-700 hover:to-pink-800 border-2 border-pink-500/50 shadow-lg hover:shadow-pink-500/50',
    icon: <Info size={iconSize} />,
  },
  success: {
    iconWrap: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    button:
      'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 border-2 border-emerald-500/50 shadow-lg hover:shadow-emerald-500/50',
    icon: <CheckCircle2 size={iconSize} />,
  },
  default: {
    iconWrap: 'bg-pink-500/10',
    iconColor: 'text-pink-400',
    button:
      'bg-gradient-to-r from-pink-600 to-pink-700 text-white hover:from-pink-700 hover:to-pink-800 border-2 border-pink-500/50 shadow-lg hover:shadow-pink-500/50',
    icon: <Check size={iconSize} />,
  },
})

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmText,
  cancelText,
  variant,
  isDangerous = false,
  loading = false,
  disabled = false,
  icon,
  closeOnBackdrop = false,
}) => {
  const { t } = useTranslation()
  const messageId = useId()

  const effectiveVariant: ConfirmVariant = variant ?? (isDangerous ? 'danger' : 'default')
  const style = variantStyles(24)[effectiveVariant]
  const body = description ?? message ?? ''

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      closeOnBackdrop={closeOnBackdrop && !loading}
      closeOnEscape={!loading}
      describedByIds={body ? [messageId] : []}
    >
      <div className="space-y-6">
        {/* Icon and Message */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg shrink-0 ${style.iconWrap}`}>
            {icon || <span className={`${style.iconColor}`}>{style.icon}</span>}
          </div>
          <p id={messageId} className="text-white/90 leading-relaxed flex-1 pt-2">
            {body}
          </p>
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
            onClick={onConfirm}
            disabled={loading || disabled}
            className={`px-6 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 ${style.button} ${
              loading || disabled ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            whileHover={!loading && !disabled ? { scale: 1.02 } : {}}
            whileTap={!loading && !disabled ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <span className={`${style.iconColor} !text-current`}>{icon || style.icon}</span>
            )}
            {loading ? t('common.loading_short') || 'جاري...' : confirmText || t('common.confirm')}
          </motion.button>
        </div>
      </div>
    </Modal>
  )
}