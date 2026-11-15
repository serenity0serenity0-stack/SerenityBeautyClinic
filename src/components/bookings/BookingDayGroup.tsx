import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { BookingDetailsPanel } from './BookingDetailsPanel'
import { BookingRow } from './BookingRow'

export interface BookingDayGroupProps {
  date: string
  bookings: any[]
  lang: 'ar' | 'en'
  expanded: boolean
  onToggleExpand: (date: string) => void
  openBookingId: string | null
  onToggleBooking: (id: string) => void
  onConfirm?: (id: string) => void
  onEdit?: (b: any) => void
  onCancel?: (id: string) => void
  onDelete?: (id: string) => void
}

const formatDayLabel = (dateStr: string, lang: 'ar' | 'en'): string => {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
  } catch {
    return dateStr
  }
}

const relativeLabel = (dateStr: string, lang: 'ar' | 'en'): string => {
  try {
    const today = new Date()
    const d = new Date(dateStr + 'T12:00:00')
    const diffDays = Math.round((d.getTime() - new Date(today.toDateString()).getTime()) / 86400000)
    if (diffDays === 0) return lang === 'ar' ? 'اليوم' : 'Today'
    if (diffDays === 1) return lang === 'ar' ? 'غداً' : 'Tomorrow'
    if (diffDays === -1) return lang === 'ar' ? 'أمس' : 'Yesterday'
    const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { numeric: 'auto' })
    return rtf.format(diffDays, 'day')
  } catch {
    return ''
  }
}

export const BookingDayGroup: React.FC<BookingDayGroupProps> = ({
  date,
  bookings,
  lang,
  expanded,
  onToggleExpand,
  openBookingId,
  onToggleBooking,
  onConfirm,
  onEdit,
  onCancel,
  onDelete,
}) => {
  const statusCounts: Record<string, number> = {}
  for (const b of bookings) {
    const s = b.status || 'unknown'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }

  return (
    <div className="glass-dark rounded-lg border border-white/10 mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => onToggleExpand(date)}
        aria-expanded={expanded}
        aria-controls={`day-${date}`}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition"
      >
        <span className="text-gray-400">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
        <div className="flex-1 text-start">
          <div className="text-white font-semibold text-sm">
            {formatDayLabel(date, lang)}
            <span className="ms-2 text-xs text-pink-400">{relativeLabel(date, lang)}</span>
          </div>
          <div className="text-gray-400 text-xs mt-0.5">
            {bookings.length} {lang === 'ar' ? 'حجز' : 'bookings'}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span key={status} className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
              {status}: {count}
            </span>
          ))}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={`day-${date}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-white/5">
              {bookings.map((b) => (
                <React.Fragment key={b.id}>
                  <BookingRow
                    booking={b}
                    isOpen={openBookingId === b.id}
                    onToggle={onToggleBooking}
                  />
                  {openBookingId === b.id && (
                    <BookingDetailsPanel
                      booking={b}
                      onConfirm={onConfirm}
                      onEdit={onEdit}
                      onCancel={onCancel}
                      onDelete={onDelete}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}