import React from 'react'
import { Phone, Clock, User, Calendar, FileText, CheckCircle2, XCircle, Edit2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from './StatusBadge'

export interface BookingDetailsPanelProps {
  booking: any
  onConfirm?: (id: string) => void
  onEdit?: (booking: any) => void
  onCancel?: (id: string) => void
  onDelete?: (id: string) => void
}

export const BookingDetailsPanel: React.FC<BookingDetailsPanelProps> = ({ booking, onConfirm, onEdit, onCancel, onDelete }) => {
  const { t } = useTranslation()

  if (!booking) return null

  const dateStr = booking.booking_time ? booking.booking_time.split('T')[0] : ''
  const timeStr = booking.booking_time ? booking.booking_time.split('T')[1]?.substring(0, 5) : ''
  const duration = booking.duration || 0
  const endTime = (() => {
    if (!timeStr || !duration) return ''
    const [h, m] = timeStr.split(':').map(Number)
    const total = h * 60 + m + duration
    const eh = Math.floor(total / 60) % 24
    const em = total % 60
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
  })()

  const serviceType = booking.service_type || booking.service_name
  const barberName = booking.barber_name
  const notes = booking.notes
  const createdAt = booking.created_at

  return (
    <div id={`details-${booking.id}`} className="px-4 py-4 bg-white/5 border-t border-white/10 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-gray-400">{t('bookings.booking_date', 'Date')}:</span>
          <span className="text-white">{dateStr} {timeStr}</span>
        </div>
        {endTime && (
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <span className="text-gray-400">{t('bookings.expectedTime', 'End')}:</span>
            <span className="text-white">{endTime} ({duration} {t('bookings.minute', 'min')})</span>
          </div>
        )}
        {barberName && (
          <div className="flex items-center gap-2">
            <User size={14} className="text-gray-400" />
            <span className="text-gray-400">{t('bookings.barber', 'Doctor')}:</span>
            <span className="text-white">{barberName}</span>
          </div>
        )}
        {booking.client_phone && (
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-gray-400" />
            <a href={`tel:${booking.client_phone}`} className="text-pink-400 hover:underline" dir="ltr">
              {booking.client_phone}
            </a>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{t('bookings.status', 'Status')}:</span>
          <StatusBadge status={booking.status} />
        </div>
        {createdAt && (
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-gray-400" />
            <span className="text-gray-400">{t('bookings.created_at', 'Created')}:</span>
            <span className="text-white text-xs">{new Date(createdAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {serviceType && (
        <div className="pt-3 border-t border-white/10">
          <p className="text-gray-300 font-semibold mb-2 flex items-center gap-2">
            {t('bookings.service', 'Service')}
          </p>
          <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
            <span className="text-white">{serviceType}</span>
            <span className="text-gray-400 text-xs">{duration} {t('bookings.minute', 'min')}</span>
          </div>
        </div>
      )}

      {notes && (
        <div className="pt-3 border-t border-white/10">
          <p className="text-gray-400 text-xs mb-1">{t('bookings.notes', 'Notes')}</p>
          <p className="text-white text-sm">{notes}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
        {booking.status !== 'completed' && booking.status !== 'cancelled' && onConfirm && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(booking.id) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 text-xs"
          >
            <CheckCircle2 size={14} /> {t('bookings.complete', 'Complete')}
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(booking) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs"
          >
            <Edit2 size={14} /> {t('bookings.edit_booking', 'Edit')}
          </button>
        )}
        {booking.client_phone && (
          <a
            href={`tel:${booking.client_phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-white border border-white/20 text-xs"
          >
            <Phone size={14} /> {t('bookings.call', 'Call')}
          </a>
        )}
        {booking.status !== 'cancelled' && onCancel && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(booking.id) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs"
          >
            <XCircle size={14} /> {t('bookings.cancel', 'Cancel')}
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(booking.id) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs"
          >
            <Trash2 size={14} /> {t('bookings.delete_booking', 'Delete')}
          </button>
        )}
      </div>
    </div>
  )
}