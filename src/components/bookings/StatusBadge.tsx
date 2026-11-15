import React from 'react'
import { useTranslation } from 'react-i18next'

// Style config keyed by status value. Unknown statuses fall back to the default.
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/40' },
  confirmed: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
  checked_in: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40' },
  ongoing: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/40' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/40' },
}

const DEFAULT_STYLE = { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/40' }

export const StatusBadge: React.FC<{ status: string | null | undefined; className?: string }> = ({ status, className = '' }) => {
  const { i18n } = useTranslation()
  const value = status || ''
  const style = STATUS_STYLES[value] || DEFAULT_STYLE
  const label = i18n.t(`bookings.status.${value}`, { defaultValue: value || '—' })
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {label}
    </span>
  )
}