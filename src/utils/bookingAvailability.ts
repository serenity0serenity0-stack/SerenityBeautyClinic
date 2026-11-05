import { getEgyptDateString, getEgyptTimeString } from './egyptTime'
import type { Booking, Barber } from '../db/supabase'

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'ongoing',
  'completed',
  'cancelled',
] as const

export type Slot = {
  time: string
  available: boolean
  reason?: string
}

/**
 * Booking states that occupy the doctor's time (a slot is blocked while one exists).
 * Must match the DB trigger backstop (bookings_before_write), which blocks any
 * overlapping booking whose status <> 'cancelled' — so 'completed' is included too.
 */
export const ACTIVE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'ongoing',
  'completed',
] as const

/**
 * Canonical booking_time builder.
 * Convention: booking_time is stored as a NAIVE timestamp in clinic (Cairo)
 * wall time, formatted "YYYY-MM-DDTHH:MM:SS" (no timezone suffix).
 * The DB trigger validates against NOW() AT TIME ZONE 'Africa/Cairo'.
 */
export const buildBookingTime = (date: string, time: string): string =>
  `${date}T${time}:00`

/** Extract the "YYYY-MM-DD" date part of a booking_time value. */
export const bookingDateOf = (booking_time: string): string =>
  booking_time?.split('T')[0] ?? ''

/** Minutes since midnight of the naive (Cairo wall-clock) booking_time. */
export const bookingMinutesOf = (booking_time: string): number => {
  const t = booking_time?.split('T')[1] || ''
  const h = parseInt(t.substring(0, 2), 10)
  const m = parseInt(t.substring(3, 5), 10)
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

/** "HH:MM" (or "HH:MM:SS") -> minutes since midnight. NaN-safe. */
export const timeToMinutes = (value: string): number => {
  if (!value) return 0
  const h = parseInt(value.substring(0, 2), 10)
  const m = parseInt(value.substring(3, 5), 10)
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

/** minutes since midnight -> "HH:MM" (Cairo wall clock). */
export const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export interface WorkingWindow {
  start: number
  end: number
  active: boolean
}

/**
 * Doctor working window from barber.working_hours_start/end ("HH:MM").
 * Falls back to the clinic default (09:00 -> 21:00) when not set.
 * Returns active=false when the window is invalid/empty (doctor unavailable).
 */
export const getBarberWorkingWindow = (
  barber?: Barber | null,
  defaults: WorkingWindow = { start: 9 * 60, end: 21 * 60, active: true }
): WorkingWindow => {
  if (!barber) return defaults

  const start = barber.working_hours_start ? timeToMinutes(barber.working_hours_start) : defaults.start
  const end = barber.working_hours_end ? timeToMinutes(barber.working_hours_end) : defaults.end

  if (isNaN(start) || isNaN(end) || end <= start) {
    return { start: 0, end: 0, active: false }
  }
  return { start, end, active: true }
}

/**
 * Is the doctor off duty on the given date?
 * - days_off: array of weekday numbers (0 = Sunday ... 6 = Saturday)
 * - vacation_start / vacation_end: inclusive date window (YYYY-MM-DD)
 */
export const isBarberOffOnDate = (barber: Barber | null | undefined, date: string): boolean => {
  if (!barber || !date) return false

  if (barber.days_off?.length) {
    const dow = new Date(`${date}T12:00:00`).getDay()
    if (barber.days_off.includes(dow)) return true
  }

  if (barber.vacation_start && barber.vacation_end) {
    if (date >= barber.vacation_start && date <= barber.vacation_end) return true
  }

  return false
}

export interface GenerateSlotsOptions {
  date: string
  barberId?: string
  bookings: Booking[]
  /** Length of the appointment being placed (minutes). */
  duration?: number
  workingWindow?: WorkingWindow
  /** When true, slots earlier than the current Cairo time are marked unavailable. */
  skipPast?: boolean
}

/** Normalise a caller-supplied duration to a usable appointment length. */
const normalizeDuration = (duration?: number): number =>
  Number.isFinite(duration) && (duration as number) >= 5 ? Math.floor(duration as number) : 30

/** [start, end) in minutes-of-day for one doctor's active appointments on a date. */
export interface BusyInterval {
  start: number
  end: number
}

/**
 * Active, merged busy intervals for one doctor on a date.
 * Overlapping/touching appointments are merged so callers can walk the free gaps.
 * Cancelled appointments are ignored (they release their time, matching the DB trigger).
 */
export const getBusyIntervals = ({
  date,
  barberId,
  bookings,
}: {
  date: string
  barberId?: string
  bookings: Booking[]
}): BusyInterval[] => {
  if (!date) return []

  const intervals = bookings
    .filter((b) => bookingDateOf(b.booking_time) === date)
    .filter((b) => (barberId ? b.barber_id === barberId : true))
    .filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status as any))
    .map((b) => {
      const start = bookingMinutesOf(b.booking_time)
      return { start, end: start + normalizeDuration(b.duration) }
    })
    .sort((a, b) => a.start - b.start)

  const merged: BusyInterval[] = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }
  return merged
}

/**
 * Continuous, duration-aware slot generation.
 *
 * Starts are not forced onto a 30-minute grid:
 *   - inside a free gap, candidates begin at the gap start and step by the
 *     appointment duration (back-to-back bookings, no rounding);
 *   - after a booking the cursor jumps to that booking's END, so the next
 *     available start is exactly when the previous appointment finishes;
 *   - an unavailable entry is still emitted at each busy start so the UI can
 *     show why that time is blocked.
 *
 * A slot is unavailable when it overlaps an active booking of the same doctor,
 * has already passed (Cairo wall clock), or the duration does not fit before
 * the doctor's shift ends.
 */
export const generateSlots = (options: GenerateSlotsOptions): Slot[] => {
  const { date, barberId, bookings, duration, workingWindow, skipPast = true } = options
  const slotDuration = normalizeDuration(duration)

  const window = workingWindow || { start: 9 * 60, end: 21 * 60, active: true }
  if (!window.active) return []

  const nowMinutes = skipPast ? timeToMinutes(getEgyptTimeString()) : -1
  const today = getEgyptDateString()
  const isPast = (minute: number) =>
    skipPast && (date < today || (date === today && minute < nowMinutes))

  const busy = getBusyIntervals({ date, barberId, bookings })
  const slots: Slot[] = []
  const push = (start: number, available: boolean, reason?: string) => {
    const time = minutesToTime(start)
    if (slots.some((s) => s.time === time)) return
    slots.push({ time, available, reason })
  }

  // For today the first candidate can never be earlier than the current minute.
  let cursor = window.start
  if (skipPast && date === today) cursor = Math.max(cursor, nowMinutes)

  for (const interval of busy) {
    if (interval.end <= cursor) continue

    // Free gap before this booking: pack candidates back-to-back.
    const gapEnd = Math.min(interval.start, window.end)
    for (let start = cursor; start + slotDuration <= gapEnd; start += slotDuration) {
      if (isPast(start)) push(start, false, 'الوقت عدا بالفعل')
      else push(start, true)
    }

    // Keep a blocked entry at the booking start for UI visibility.
    if (interval.start >= window.start && interval.start + slotDuration <= window.end) {
      push(interval.start, false, 'محجوز بالفعل')
    }

    cursor = Math.max(cursor, interval.end)
    if (cursor >= window.end) break
  }

  for (let start = cursor; start + slotDuration <= window.end; start += slotDuration) {
    if (isPast(start)) push(start, false, 'الوقت عدا بالفعل')
    else push(start, true)
  }

  return slots.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
}

/**
 * First start at or after `after` where an appointment of `duration` fits.
 * Used to show "the next session after this customer will be at ...".
 */
export const nextAvailableStart = (
  options: GenerateSlotsOptions & { after: string }
): string | null => {
  const { date, barberId, bookings, duration, workingWindow, after, skipPast = true } = options
  const slotDuration = normalizeDuration(duration)

  const window = workingWindow || { start: 9 * 60, end: 21 * 60, active: true }
  if (!window.active) return null

  const startFrom = timeToMinutes(after)
  let earliest = startFrom
  if (skipPast) {
    const today = getEgyptDateString()
    if (date < today) return null
    if (date === today) earliest = Math.max(earliest, timeToMinutes(getEgyptTimeString()))
  }

  const busy = getBusyIntervals({ date, barberId, bookings })
  let cursor = Math.max(earliest, window.start)

  for (const interval of busy) {
    if (interval.end <= cursor) continue
    if (cursor + slotDuration <= interval.start) break
    cursor = Math.max(cursor, interval.end)
  }

  return cursor + slotDuration <= window.end ? minutesToTime(cursor) : null
}

/** Single-slot check (used by edit forms / conflict guard before insert). */
export const isSlotAvailable = (options: GenerateSlotsOptions & { time: string }): boolean => {
  const { date, barberId, bookings, duration, time, workingWindow } = options
  const slotDuration = normalizeDuration(duration)

  if (workingWindow && !workingWindow.active) return false
  if (workingWindow && timeToMinutes(time) + slotDuration > workingWindow.end) return false

  if (barberId) {
    const slotStart = timeToMinutes(time)
    const slotEnd = slotStart + slotDuration
    const conflicting = getBusyIntervals({ date, barberId, bookings }).some(
      (interval) => slotStart < interval.end && slotEnd > interval.start
    )
    if (conflicting) return false
  }

  return true
}
