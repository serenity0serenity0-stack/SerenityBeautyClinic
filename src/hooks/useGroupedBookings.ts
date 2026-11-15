import { useMemo } from 'react'
import { bookingDateOf, bookingMinutesOf } from '../utils/bookingAvailability'

export interface GroupedDay {
  date: string
  bookings: any[]
}

export interface GroupedBookingsResult {
  days: GroupedDay[]
  totalCount: number
  statusCounts: Record<string, number>
}

/**
 * Group bookings by date (YYYY-MM-DD), sort days per tab, filter by search/status/staff/service.
 * Pure data hook — no UI state.
 */
export const useGroupedBookings = (
  bookings: any[],
  tab: 'today' | 'upcoming' | 'previous',
  search: string,
  statusFilter: string,
  staffFilter: string,
  serviceFilter: string,
  selectedDate: string | null
): GroupedBookingsResult => {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const q = search.trim().toLowerCase()

    const filtered = (bookings || []).filter((b) => {
      const d = bookingDateOf(b.booking_time)
      if (tab === 'today' && d !== today) return false
      if (tab === 'upcoming' && d < today) return false
      if (tab === 'previous' && d >= today) return false

      if (selectedDate && d !== selectedDate) return false

      if (q) {
        const name = (b.client_name || '').toLowerCase()
        const phone = (b.client_phone || '').toLowerCase()
        if (!name.includes(q) && !phone.includes(q)) return false
      }
      if (statusFilter && statusFilter !== 'all' && b.status !== statusFilter) return false
      if (staffFilter && staffFilter !== 'all' && (b.barber_id || b.barber_name) !== staffFilter) return false
      if (serviceFilter && serviceFilter !== 'all') {
        const svc = b.service_type || b.service_name || ''
        if (svc !== serviceFilter) return false
      }
      return true
    })

    const groups: Record<string, any[]> = {}
    for (const b of filtered) {
      const d = bookingDateOf(b.booking_time)
      if (!groups[d]) groups[d] = []
      groups[d].push(b)
    }
    for (const d of Object.keys(groups)) {
      groups[d].sort((a, b) => bookingMinutesOf(a.booking_time) - bookingMinutesOf(b.booking_time))
    }
    const dayKeys = Object.keys(groups)
    if (tab === 'upcoming' || tab === 'today') {
      dayKeys.sort((a, b) => a.localeCompare(b))
    } else {
      dayKeys.sort((a, b) => b.localeCompare(a))
    }
    const days: GroupedDay[] = dayKeys.map((d) => ({ date: d, bookings: groups[d] }))

    const statusCounts: Record<string, number> = {}
    for (const b of filtered) {
      const s = b.status || 'unknown'
      statusCounts[s] = (statusCounts[s] || 0) + 1
    }

    return { days, totalCount: filtered.length, statusCounts }
  }, [bookings, tab, search, statusFilter, staffFilter, serviceFilter, selectedDate])
}