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
  duration?: number
  interval?: number
  workingWindow?: WorkingWindow
  /** When true, slots earlier than the current Cairo time are marked unavailable. */
  skipPast?: boolean
}

/**
 * Per-doctor, duration-aware slot generation.
 * A slot is unavailable when:
 *   - it overlaps an active booking of the same doctor (pending/confirmed/checked_in/ongoing), or
 *   - it has already passed (Cairo wall clock), or
 *   - the requested duration does not fit before the doctor's shift ends.
 */
export const generateSlots = (options: GenerateSlotsOptions): Slot[] => {
  const {
    date,
    barberId,
    bookings,
    duration = 30,
    interval = 30,
    workingWindow,
    skipPast = true,
  } = options

  const window = workingWindow || { start: 9 * 60, end: 21 * 60, active: true }
  if (!window.active) return []

  const slots: Slot[] = []
  const nowMinutes = skipPast ? timeToMinutes(getEgyptTimeString()) : -1
  const today = getEgyptDateString()

  for (let minute = window.start; minute + duration <= window.end; minute += interval) {
    const time = minutesToTime(minute)

    let reason: string | undefined
    let available = true

    if (skipPast && (date < today || (date === today && minute < nowMinutes))) {
      reason = 'الوقت عدا بالفعل'
      available = false
    }

    if (available && barberId) {
      const slotStart = minute
      const slotEnd = minute + duration
      const conflicting = bookings.some((b) => {
        if (bookingDateOf(b.booking_time) !== date) return false
        if (b.barber_id !== barberId) return false
        if (!ACTIVE_BOOKING_STATUSES.includes(b.status as any)) return false

        const bStart = bookingMinutesOf(b.booking_time)
        const bEnd = bStart + (b.duration || 30)
        return slotStart < bEnd && slotEnd > bStart
      })

      if (conflicting) {
        reason = 'محجوز بالفعل'
        available = false
      }
    }

    slots.push({ time, available, reason })
  }

  return slots
}

/** Single-slot check (used by edit forms / conflict guard before insert). */
export const isSlotAvailable = (options: GenerateSlotsOptions & { time: string }): boolean => {
  const { date, barberId, bookings, duration = 30, time, workingWindow } = options
  if (barberId) {
    const slotStart = timeToMinutes(time)
    const slotEnd = slotStart + duration
    const conflicting = bookings.some((b) => {
      if (bookingDateOf(b.booking_time) !== date) return false
      if (b.barber_id !== barberId) return false
      if (!ACTIVE_BOOKING_STATUSES.includes(b.status as any)) return false

      const bStart = bookingMinutesOf(b.booking_time)
      const bEnd = bStart + (b.duration || 30)
      return slotStart < bEnd && slotEnd > bStart
    })
    if (conflicting) return false
  }

  if (workingWindow && !workingWindow.active) return false

  const window = workingWindow
  if (window && timeToMinutes(time) + duration > window.end) return false

  return true
}
