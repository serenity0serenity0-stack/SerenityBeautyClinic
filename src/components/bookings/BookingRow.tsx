import React, { memo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { StatusBadge } from './StatusBadge'

export interface BookingRowProps {
  booking: any
  isOpen: boolean
  onToggle: (id: string) => void
  highlightedText?: string
}

const BookingRowInner: React.FC<BookingRowProps> = ({ booking, isOpen, onToggle }) => {
  const time = booking.booking_time ? booking.booking_time.split('T')[1]?.substring(0, 5) : ''
  const phone = booking.client_phone || ''
  const serviceSummary = booking.service_type || booking.service_name || ''
  const extraCount = 0 // single service per booking in current schema

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-controls={`details-${booking.id}`}
      onClick={() => onToggle(booking.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(booking.id)
        }
      }}
      className={`flex items-center gap-2 px-3 py-2 border-b border-white/5 cursor-pointer transition-colors ${
        isOpen ? 'bg-pink-500/5 border-s-2 border-s-pink-500' : 'hover:bg-white/5'
      }`}
      style={{ minHeight: 44 }}
    >
      <span className="text-gray-400 shrink-0">
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </span>
      <span className="text-white font-mono text-sm shrink-0 w-12">{time}</span>
      <span className="text-white font-medium truncate flex-1 min-w-0">{booking.client_name || '—'}</span>
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={(e) => e.stopPropagation()}
          className="text-gray-400 text-xs shrink-0 hover:text-pink-400 hidden sm:inline"
          dir="ltr"
        >
          {phone}
        </a>
      )}
      {serviceSummary && (
        <span className="text-gray-300 text-xs truncate max-w-[120px] hidden md:inline">
          {serviceSummary}
          {extraCount > 0 && <span className="ms-1 text-pink-400">+{extraCount}</span>}
        </span>
      )}
      <StatusBadge status={booking.status} />
    </div>
  )
}

export const BookingRow = memo(BookingRowInner)