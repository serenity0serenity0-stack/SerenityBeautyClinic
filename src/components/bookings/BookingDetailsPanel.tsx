import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, User, FileText, CheckCircle2, XCircle, Edit2, Trash2, Phone } from 'lucide-react'

// Status transition config (style/logic, not business data). Unknown statuses → no action.
const STATUS_TRANSITIONS: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'checked_in',
  checked_in: 'ongoing',
  ongoing: 'completed',
}

export interface BookingDetailsPanelProps {
  booking: any
  onConfirm?: (id: string) => void
  onEdit?: (booking: any) => void
  onCancel?: (id: string) => void
  onDelete?: (id: string) => void
}

export const BookingDetailsPanel: React.FC<BookingDetailsPanelProps> = ({ booking, onConfirm, onEdit, onCancel, onDelete }) => {
  const { t } = useTranslation()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!booking) return null

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
  const source = booking.source || booking.booking_source || null
  const nextStatus = STATUS_TRANSITIONS[booking.status || '']

  return (
    <div id={`details-${booking.id}`} className="px-4 py-4 bg-white/5 border-t border-white/10 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {timeStr && (
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <span className="text-gray-400">{t('bookings.booking_time', 'Time')}:</span>
            <span className="text-white">{timeStr}{endTime ? ` → ${endTime}` : ''} ({duration} {t('bookings.minute', 'min')})</span>
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
        {createdAt && (
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-gray-400" />
            <span className="text-gray-400">{t('bookings.created', 'Created')}:</span>
            <span className="text-white text-xs">{new Date(createdAt).toLocaleString('ar-EG')}</span>
          </div>
        )}
        {source && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{t('bookings.source', 'Source')}:</span>
            <span className="text-white">{source}</span>
          </div>
        )}
      </div>

      {serviceType && (
        <div className="pt-3 border-t border-white/10">
          <p className="text-gray-300 font-semibold mb-2">{t('bookings.service', 'Service')}</p>
          <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
            <span className="text-white">{serviceType}</span>
            <span className="text-gray-400 text-xs">{duration} {t('bookings.minute', 'min')}</span>
          </div>
          {duration > 0 && (
            <div className="text-end text-xs text-gray-400 mt-1">
              {t('bookings.total', 'Total')}: {duration} {t('bookings.minute', 'min')}
            </div>
          )}
        </div>
      )}

      {notes && (
        <div className="pt-3 border-t border-white/10">
          <p className="text-gray-400 text-xs mb-1">{t('bookings.notes', 'Notes')}</p>
          <p className="text-white text-sm">{notes}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
        {nextStatus && onConfirm && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm(booking.id) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 text-xs"
          >
            <CheckCircle2 size={14} /> {t(`bookings.status.${nextStatus}`, nextStatus)}
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
          <>
            {!confirmCancel ? (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmCancel(true) }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs"
              >
                <XCircle size={14} /> {t('bookings.cancel', 'Cancel')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-300">{t('bookings.confirm_cancel', 'Cancel this booking?')} ({booking.client_name})</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(booking.id); setConfirmCancel(false) }}
                  className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                >
                  {t('bookings.confirm', 'Yes')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmCancel(false) }}
                  className="px-2 py-1 rounded bg-white/10 text-white text-xs"
                >
                  {t('bookings.no', 'No')}
                </button>
              </div>
            )}
          </>
        )}
        {onDelete && (
          <>
            {!confirmDelete ? (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 border border-white/10 text-xs"
              >
                <Trash2 size={14} /> {t('bookings.delete_booking', 'Delete')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-300">{t('bookings.confirm_delete', 'Delete this booking?')} ({booking.client_name})</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(booking.id); setConfirmDelete(false) }}
                  className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                >
                  {t('bookings.confirm', 'Yes')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                  className="px-2 py-1 rounded bg-white/10 text-white text-xs"
                >
                  {t('bookings.no', 'No')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}