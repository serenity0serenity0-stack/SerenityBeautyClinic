import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Clock,
  Zap,
  Calendar,
  Save,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Timer,
  CalendarDays,
  TrendingUp,
  Pencil,
  X,
} from 'lucide-react'
import { useDoctorShifts } from '../db/hooks/useDoctorShifts'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Barber, DoctorShift } from '../db/supabase'
import { getEgyptDateString, getEgyptTimeString } from '../utils/egyptTime'

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const toDateStr = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })

const shiftTime = (value?: string | null): string => (value ? String(value).slice(0, 5) : '')

const formatArabicDate = (date: string): string => {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00`))
  } catch {
    return date
  }
}

const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return `${MONTH_NAMES_AR[m - 1]} ${y}`
}

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

const addMonths = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthBounds = (month: string): { from: string; to: string } => {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

const dayOfWeek = (date: string): string => DAY_NAMES_AR[new Date(`${date}T12:00:00`).getDay()] || ''

// Worked hours of one shift, tolerating a shift that crosses midnight.
const hoursOf = (shift: { shift_start?: string | null; shift_end?: string | null }): number => {
  const start = shiftTime(shift.shift_start)
  const end = shiftTime(shift.shift_end)
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  return Math.round((minutes / 60) * 100) / 100
}

const pulsesOf = (shift: { start_pulse: number; end_pulse?: number | null }): number | null => {
  if (shift.end_pulse === null || shift.end_pulse === undefined) return null
  return Math.max(0, Number(shift.end_pulse) - Number(shift.start_pulse || 0))
}

const hoursLabel = (hours: number): string => {
  if (!hours) return '0 س'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m ? `${h} س ${m} د` : `${h} س`
}

const parseTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '')
  if (!match) return null
  const h24 = Number(match[1])
  if (Number.isNaN(h24)) return null
  return { hour: h24 % 12 === 0 ? 12 : h24 % 12, minute: Number(match[2]), isPm: h24 >= 12 }
}

const buildTime = (hour: number, minute: number, isPm: boolean) => {
  const h24 = (hour % 12) + (isPm ? 12 : 0)
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const timeLabel = (value: string) => {
  const parsed = parseTime(value)
  if (!parsed) return ''
  const minutes = String(parsed.minute).padStart(2, '0')
  return `${String(parsed.hour).padStart(2, '0')}:${minutes} ${parsed.isPm ? 'م' : 'ص'}`
}

interface Props {
  doctor: Barber
}

const DIAL = 200
const CX = DIAL / 2
const CY = DIAL / 2
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const NUMBERS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

// 0° points to 12 o'clock, growing clockwise
const polar = (angleDeg: number, radius: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

/** Material-style analog clock time picker: circular dial + number panel, Cancel/OK. */
const ClockDialInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'hour' | 'minute'>('hour')
  const [dragging, setDragging] = useState(false)
  const [draft, setDraft] = useState(() => {
    const p = parseTime(value)
    return { hour: p?.hour ?? 12, minute: p?.minute ?? 0, isPm: p?.isPm ?? false }
  })

  const draftLabel = timeLabel(buildTime(draft.hour, draft.minute, draft.isPm))

  // Opens with the saved value, falling back to the current Egypt time
  const openDialog = () => {
    const p = parseTime(value) ?? parseTime(getEgyptTimeString().slice(0, 5))
    setDraft({ hour: p?.hour ?? 12, minute: p?.minute ?? 0, isPm: p?.isPm ?? false })
    setMode('hour')
    setOpen(true)
  }

  const commit = () => {
    onChange(buildTime(draft.hour, draft.minute, draft.isPm))
    setOpen(false)
  }

  // Enter confirms, Escape cancels (the draft is discarded)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'Enter') {
        onChange(buildTime(draft.hour, draft.minute, draft.isPm))
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, draft, onChange])

  const applyPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = ((e.clientX - rect.left) / rect.width) * DIAL
    const y = ((e.clientY - rect.top) / rect.height) * DIAL
    let deg = (Math.atan2(y - CY, x - CX) * 180) / Math.PI + 90
    deg = (deg + 360) % 360
    const index = Math.round(deg / 30) % 12
    if (mode === 'hour') setDraft((d) => ({ ...d, hour: index === 0 ? 12 : index, isPm: deg < 180 }))
    else setDraft((d) => ({ ...d, minute: index * 5 }))
  }

  const pickNow = () => {
    const p = parseTime(getEgyptTimeString().slice(0, 5))
    if (!p) return
    setDraft({ hour: p.hour, minute: p.minute, isPm: p.isPm })
    setMode('minute')
  }

  const activeIndex = mode === 'hour' ? draft.hour % 12 : Math.round(draft.minute / 5) % 12
  const handEnd = polar(activeIndex * 30, mode === 'hour' ? 52 : 62)
  const dialLabels =
    mode === 'hour'
      ? HOURS_12.map(String)
      : MINUTE_STEPS.map((m) => String(m).padStart(2, '0'))

  return (
    <>
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          onClick={openDialog}
          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm flex items-center gap-2 hover:bg-white/15 focus:outline-none focus:border-pink-500"
        >
          <Clock size={15} className="text-pink-400 shrink-0" />
          {value ? (
            <span className="font-semibold">{timeLabel(value)}</span>
          ) : (
            <span className="text-gray-400">اختر الوقت</span>
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="مسح الوقت"
            className="shrink-0 px-2 py-2 bg-white/5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false)
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              dir="rtl"
              className="w-full max-w-[540px] bg-[#1e1b24] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 pt-5 pb-2 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">اختر الوقت</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {mode === 'hour' ? 'اسحب عقرب الساعة أو اختر رقماً' : 'اسحب عقرب الدقيقة أو اختر رقماً'}
                  </p>
                </div>
                <span className="text-2xl font-semibold text-white tabular-nums leading-none">{draftLabel}</span>
              </div>

              {/* Landscape body: clock on one side, numbers + AM/PM on the other */}
              <div className="px-6 pb-2 flex flex-col sm:flex-row items-center gap-5">
                <svg
                  viewBox={`0 0 ${DIAL} ${DIAL}`}
                  width={192}
                  height={192}
                  className="shrink-0 touch-none select-none"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    setDragging(true)
                    applyPointer(e)
                  }}
                  onPointerMove={(e) => {
                    if (dragging) applyPointer(e)
                  }}
                  onPointerUp={(e) => {
                    if (!dragging) return
                    setDragging(false)
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    } catch {
                      /* pointer already released */
                    }
                    if (mode === 'hour') setMode('minute')
                  }}
                  onPointerCancel={() => setDragging(false)}
                >
                  <circle cx={CX} cy={CY} r={92} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />

                  {Array.from({ length: 60 }).map((_, i) => {
                    const major = i % 5 === 0
                    const a = polar(i * 6, 92)
                    const b = polar(i * 6, major ? 80 : 86)
                    return (
                      <line
                        key={i}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={major ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'}
                        strokeWidth={major ? 2 : 1}
                      />
                    )
                  })}

                  {dialLabels.map((label, i) => {
                    const p = polar(i * 30, 66)
                    const active = i === activeIndex
                    return (
                      <g key={i}>
                        {active && <circle cx={p.x} cy={p.y} r={19} fill="rgba(236,72,153,0.28)" />}
                        <text
                          x={p.x}
                          y={p.y + 5}
                          textAnchor="middle"
                          fontSize="15"
                          fontWeight="bold"
                          fill={active ? '#fbcfe8' : 'rgba(255,255,255,0.65)'}
                        >
                          {label}
                        </text>
                      </g>
                    )
                  })}

                  <line
                    x1={CX}
                    y1={CY}
                    x2={handEnd.x}
                    y2={handEnd.y}
                    stroke="#ec4899"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <circle cx={CX} cy={CY} r={5} fill="#ec4899" />
                </svg>

                {/* Number panel */}
                <div className="flex-1 w-full min-w-0 flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMode('hour')}
                      className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${
                        mode === 'hour' ? 'bg-pink-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/15'
                      }`}
                    >
                      الساعة
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('minute')}
                      className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${
                        mode === 'minute' ? 'bg-pink-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/15'
                      }`}
                    >
                      الدقيقة
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {mode === 'hour'
                      ? NUMBERS_12.map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => {
                              setDraft((d) => ({ ...d, hour: h }))
                              setMode('minute')
                            }}
                            className={`h-9 rounded-full text-sm font-bold transition ${
                              h === draft.hour
                                ? 'bg-pink-500 text-white'
                                : 'bg-white/5 text-gray-300 hover:bg-white/15'
                            }`}
                          >
                            {h}
                          </button>
                        ))
                      : MINUTE_STEPS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setDraft((d) => ({ ...d, minute: m }))}
                            className={`h-9 rounded-full text-sm font-bold transition ${
                              m === draft.minute
                                ? 'bg-pink-500 text-white'
                                : 'bg-white/5 text-gray-300 hover:bg-white/15'
                            }`}
                          >
                            {String(m).padStart(2, '0')}
                          </button>
                        ))}
                  </div>

                  {/* AM / PM segmented control */}
                  <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, isPm: false }))}
                      className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${
                        !draft.isPm ? 'bg-pink-500 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      ص
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, isPm: true }))}
                      className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${
                        draft.isPm ? 'bg-pink-500 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      م
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 py-3 mt-1 flex items-center gap-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={pickNow}
                  className="px-4 py-2 rounded-full text-xs font-bold text-pink-300 hover:bg-pink-500/15 transition"
                >
                  الآن
                </button>
                <div className="flex items-center gap-1 mr-auto">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-gray-300 hover:bg-white/10 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={commit}
                    className="px-5 py-2 rounded-full text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 transition"
                  >
                    تم
                  </button>
                </div>
              </div>
            </motion.div>
          </div>,
          document.body,
        )}
    </>
  )
}

export const DoctorShiftPanel: React.FC<Props> = ({ doctor }) => {
  const today = getEgyptDateString()
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [useCustomDate, setUseCustomDate] = useState(false)
  const [month, setMonth] = useState<string>(today.slice(0, 7))

  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')
  const [startPulse, setStartPulse] = useState('')
  const [endPulse, setEndPulse] = useState('')
  const [notes, setNotes] = useState('')
  const [pendingDelete, setPendingDelete] = useState<DoctorShift | null>(null)

  const { from, to } = useMemo(() => monthBounds(month), [month])
  const { shifts, loading, saveShift, deleteShift, saving } = useDoctorShifts(doctor.id, from, to)

  const loadShiftIntoForm = (shift: DoctorShift | null) => {
    if (!shift) {
      setShiftStart('')
      setShiftEnd('')
      setStartPulse('')
      setEndPulse('')
      setNotes('')
      return
    }
    setShiftStart(shiftTime(shift.shift_start))
    setShiftEnd(shiftTime(shift.shift_end))
    setStartPulse(String(shift.start_pulse ?? 0))
    setEndPulse(
      shift.end_pulse === null || shift.end_pulse === undefined ? '' : String(shift.end_pulse),
    )
    setNotes(shift.notes || '')
  }

  const dayShift = useMemo(
    () => shifts.find((s) => String(s.work_date).slice(0, 10) === selectedDate) || null,
    [shifts, selectedDate],
  )

  // Moving to another day loads that day's record. Re-picking the SAME day is
  // handled by handleEdit, which loads it directly.
  useEffect(() => {
    if (loading) return
    loadShiftIntoForm(
      shifts.find((s) => String(s.work_date).slice(0, 10) === selectedDate) || null,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, loading])

  // Month totals reset every month: they only aggregate this month's rows
  const monthShifts = useMemo(
    () => shifts.filter((s) => String(s.work_date).slice(0, 7) === month),
    [shifts, month],
  )
  const monthPulses = useMemo(
    () => monthShifts.reduce((sum, s) => sum + (pulsesOf(s) ?? 0), 0),
    [monthShifts],
  )
  const monthHours = useMemo(
    () => Math.round(monthShifts.reduce((sum, s) => sum + hoursOf(s), 0) * 100) / 100,
    [monthShifts],
  )
  const monthDays = monthShifts.filter((s) => hoursOf(s) > 0 || pulsesOf(s) !== null).length

  // Live preview of the day being edited
  const previewPulses =
    endPulse.trim() === '' ? null : Math.max(0, Number(endPulse || 0) - Number(startPulse || 0))
  const previewHours =
    shiftStart && shiftEnd ? hoursOf({ shift_start: shiftStart, shift_end: shiftEnd }) : null

  const lastKnownPulse = useMemo(() => {
    const withEnd = [...shifts].filter((s) => s.end_pulse !== null && s.end_pulse !== undefined)
    if (!withEnd.length) return null
    return withEnd[withEnd.length - 1].end_pulse as number
  }, [shifts])

  const clearForm = () => {
    setShiftStart('')
    setShiftEnd('')
    setStartPulse('')
    setEndPulse('')
    setNotes('')
  }

  const handleSave = async () => {
    await saveShift({
      barberId: doctor.id as string,
      workDate: selectedDate,
      shiftStart: shiftStart || null,
      shiftEnd: shiftEnd || null,
      startPulse: Number(startPulse || 0),
      endPulse: endPulse.trim() === '' ? null : Number(endPulse),
      notes: notes || null,
    })
    // Saved: empty the fields so the next day can be entered immediately.
    clearForm()
  }

  const handleDelete = async () => {
    if (pendingDelete?.id) {
      await deleteShift(pendingDelete.id)
      setPendingDelete(null)
      return
    }
    if (dayShift?.id) {
      await deleteShift(dayShift.id)
    }
  }

  // Load a day for editing (used by the list rows and the pencil button)
  const handleEdit = (shift: DoctorShift) => {
    const date = String(shift.work_date).slice(0, 10)
    setSelectedDate(date)
    setMonth(date.slice(0, 7))
    setUseCustomDate(date !== today)
    loadShiftIntoForm(shift)
  }

  // Browsing to another month clears the form if its day is out of view
  const changeMonth = (next: string) => {
    setMonth(next)
    if (!selectedDate.startsWith(next)) clearForm()
  }

  const inputClass =
    'w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-pink-500 [color-scheme:dark]'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Timer size={20} className="text-pink-400" />
          الورديات والنبضات
        </h3>
        <span className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-full">
          يتصفّر الملخص تلقائياً مع بداية كل شهر
        </span>
      </div>

      {/* Day picker: today (with date) or a specific date */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setUseCustomDate(false)
              setSelectedDate(today)
              setMonth(today.slice(0, 7))
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-1.5 ${
              !useCustomDate && selectedDate === today
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <Calendar size={14} />
            اليوم
          </button>
          <button
            onClick={() => setUseCustomDate(true)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-1.5 ${
              useCustomDate
                ? 'bg-pink-500 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <CalendarDays size={14} />
            تاريخ محدد
          </button>

          {useCustomDate && (
            <input
              type="date"
              value={selectedDate}
              max="2100-12-31"
              onChange={(e) => {
                const value = e.target.value
                if (!value) return
                setSelectedDate(value)
                setMonth(value.slice(0, 7))
              }}
              className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-pink-500 [color-scheme:dark]"
            />
          )}

          <div className="flex items-center gap-1 mr-auto">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white transition"
              title="اليوم السابق"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white transition"
              title="اليوم التالي"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-pink-400 font-semibold">{dayOfWeek(selectedDate)}</span>
          <span className="text-white">{formatArabicDate(selectedDate)}</span>
          {dayShift && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
              مسجّل — يمكنك التعديل أو الحذف
            </span>
          )}
        </div>

        {/* Shift form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <Clock size={12} /> بداية الوردية
            </span>
            <ClockDialInput value={shiftStart} onChange={setShiftStart} />
          </div>
          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <Clock size={12} /> نهاية الوردية
            </span>
            <ClockDialInput value={shiftEnd} onChange={setShiftEnd} />
          </div>
          <label className="block">
            <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <Zap size={12} /> نبضة البداية
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={startPulse}
              onChange={(e) => setStartPulse(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <Zap size={12} /> نبضة النهاية
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={endPulse}
              onChange={(e) => setEndPulse(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </label>
        </div>

        {/* Live day result */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-pink-300">
              {previewPulses === null ? '—' : previewPulses}
            </p>
            <p className="text-xs text-gray-300">نبضات اليوم (النهاية − البداية)</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-300">
              {previewHours === null ? '—' : hoursLabel(previewHours)}
            </p>
            <p className="text-xs text-gray-300">ساعات اليوم</p>
          </div>
        </div>

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات (اختياري)"
          className={inputClass}
        />

        {lastKnownPulse !== null && (
          <p className="text-[11px] text-gray-400">
            آخر نبضة نهاية مسجّلة: <span className="text-gray-200 font-bold">{lastKnownPulse}</span>
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            onClick={handleSave}
            whileTap={{ scale: 0.97 }}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {dayShift ? <Pencil size={16} /> : <Save size={16} />}
            {dayShift ? 'تعديل الوردية' : 'حفظ الوردية'}
          </motion.button>
          {dayShift?.id && (
            <>
              <motion.button
                onClick={handleDelete}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-sm flex items-center gap-2"
              >
                <Trash2 size={16} />
                حذف الوردية
              </motion.button>
              <button
                onClick={clearForm}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-sm flex items-center gap-1.5"
              >
                <X size={14} />
                تفريغ الحقول
              </button>
            </>
          )}
        </div>
      </div>

      {/* Month summary */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => changeMonth(addMonths(month, -1))}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white transition"
          >
            <ChevronRight size={16} />
          </button>
          <span className="text-white font-bold flex items-center gap-2">
            <Calendar size={16} className="text-pink-400" />
            {monthLabel(month)}
          </span>
          <button
            onClick={() => changeMonth(addMonths(month, 1))}
            disabled={month >= today.slice(0, 7)}
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white transition disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4 text-center">
            <Zap size={20} className="text-pink-300 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{monthPulses}</p>
            <p className="text-xs text-gray-300">نبضات الشهر</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <CalendarDays size={20} className="text-blue-300 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{monthDays}</p>
            <p className="text-xs text-gray-300">أيام العمل</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center">
            <TrendingUp size={20} className="text-amber-300 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{hoursLabel(monthHours)}</p>
            <p className="text-xs text-gray-300">إجمالي ساعات الشهر</p>
          </div>
        </div>
      </div>

      {/* Month days list */}
      <div className="space-y-2">
        <h4 className="text-white font-bold text-sm">سجل أيام {monthLabel(month)}</h4>
        {loading ? (
          <p className="text-gray-400 text-sm">جاري التحميل...</p>
        ) : monthShifts.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد ورديات مسجّلة في هذا الشهر</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {monthShifts
              .slice()
              .reverse()
              .map((s) => {
                const date = String(s.work_date).slice(0, 10)
                const pulses = pulsesOf(s)
                const hours = hoursOf(s)
                const active = date === selectedDate
                return (
                  <div
                    key={s.id || date}
                    className={`flex items-stretch gap-1 rounded-lg border transition ${
                      active
                        ? 'bg-pink-500/15 border-pink-500/40'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <button
                      onClick={() => handleEdit(s)}
                      className="flex-1 text-right p-3 min-w-0"
                      title="اضغط للتعديل"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar size={14} className="text-pink-400 shrink-0" />
                          <span className="text-white font-semibold text-sm truncate">
                            {dayOfWeek(date)} — {formatArabicDate(date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-300">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            {shiftTime(s.shift_start) || '—'} → {shiftTime(s.shift_end) || '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap size={12} className="text-pink-400" />
                            {s.start_pulse ?? 0} → {s.end_pulse ?? '—'}
                          </span>
                          <span className="font-bold text-pink-300">
                            {pulses === null ? '—' : `${pulses} نبضة`}
                          </span>
                          <span className="text-amber-300">{hoursLabel(hours)}</span>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleEdit(s)}
                      title="تعديل الوردية"
                      className="px-2 text-gray-400 hover:text-pink-300 transition shrink-0"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(s)}
                      title="حذف الوردية"
                      className="px-2 text-gray-400 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="حذف الوردية"
        description={
          pendingDelete
            ? `سيتم حذف وردية ${dayOfWeek(String(pendingDelete.work_date).slice(0, 10))} — ${formatArabicDate(String(pendingDelete.work_date).slice(0, 10))} نهائياً.`
            : ''
        }
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />
    </div>
  )
}
