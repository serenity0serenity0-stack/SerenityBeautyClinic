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
  serviceFilter: string
): GroupedBookingsResult => {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const q = search.trim().toLowerCase()

    const filtered = (bookings || []).filter((b) => {
      // tab filter
      const d = bookingDateOf(b.booking_time)
      if (tab === 'today' && d !== today) return false
      if (tab === 'upcoming' && d < today) return false
      if (tab === 'previous' && d >= today) return false

      // search
      if (q) {
        const name = (b.client_name || '').toLowerCase()
        const phone = (b.client_phone || '').toLowerCase()
        if (!name.includes(q) && !phone.includes(q)) return false
      }
      // status filter
      if (statusFilter && statusFilter !== 'all' && b.status !== statusFilter) return false
      // staff filter
      if (staffFilter && staffFilter !== 'all' && (b.barber_id || b.barber_name) !== staffFilter) return false
      // service filter
      if (serviceFilter && serviceFilter !== 'all') {
        const svc = b.service_type || b.service_name || ''
        if (svc !== serviceFilter) return false
      }
      return true
    })

    // group by date
    const groups: Record<string, any[]> = {}
    for (const b of filtered) {
      const d = bookingDateOf(b.booking_time)
      if (!groups[d]) groups[d] = []
      groups[d].push(b)
    }

    // sort bookings within day by time asc
    for (const d of Object.keys(groups)) {
      groups[d].sort((a, b) => bookingMinutesOf(a.booking_time) - bookingMinutesOf(b.booking_time))
    }

    // sort days
    const dayKeys = Object.keys(groups)
    if (tab === 'upcoming' || tab === 'today') {
      dayKeys.sort((a, b) => a.localeCompare(b)) // nearest first
    } else {
      dayKeys.sort((a, b) => b.localeCompare(a)) // newest first
    }

    const days: GroupedDay[] = dayKeys.map((d) => ({ date: d, bookings: groups[d] }))

    // status counts
    const statusCounts: Record<string, number> = {}
    for (const b of filtered) {
      const s = b.status || 'unknown'
      statusCounts[s] = (statusCounts[s] || 0) + 1
    }

    return { days, totalCount: filtered.length, statusCounts }
  }, [bookings, tab, search, statusFilter, staffFilter, serviceFilter])
}