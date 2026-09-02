import React, { useEffect, useId, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'wide'
  /** Close when clicking the backdrop (defaults to true for form modals). */
  closeOnBackdrop?: boolean
  /** Close when pressing ESC (defaults to true). */
  closeOnEscape?: boolean
  /** Hide the ✕ close button in the header (used by dialogs with explicit actions). */
  hideCloseButton?: boolean
  /** IDs used for accessible linking (aria-describedby). */
  describedByIds?: string[]
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  hideCloseButton = false,
  describedByIds = [],
}) => {
  const { t } = useTranslation()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  // Keep the latest onClose in a ref so the keydown handler never goes stale.
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    wide: 'max-w-[1440px] max-h-[92vh]',
  }

  const focusableSelector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current = document.activeElement as HTMLElement | null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onCloseRef.current()
        return
      }

      // Keep focus inside the dialog while it is open.
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        ).filter((el) => !el.hasAttribute('disabled'))
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Move focus into the dialog on open.
    const panel = panelRef.current
    if (panel) {
      const firstFocusable = panel.querySelector<HTMLElement>(focusableSelector)
      if (firstFocusable) {
        firstFocusable.focus()
      } else {
        panel.focus()
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, closeOnEscape])

  const describedBy = describedByIds.filter(Boolean).join(' ') || undefined

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={describedBy}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', duration: 0.3 }}
          >
            <div
              ref={panelRef}
              tabIndex={-1}
              className={`glass rounded-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto outline-none`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 id={titleId} className="text-xl font-semibold text-white">
                  {title}
                </h2>
                {!hideCloseButton && (
                  <button
                    onClick={onClose}
                    aria-label={t('common.close')}
                    className="p-1 hover:bg-white/10 rounded-full transition"
                  >
                    <X size={24} className="text-gray-400" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-6">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}