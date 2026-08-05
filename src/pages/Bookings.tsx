import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useBookings } from '../db/hooks/useBookings'
import { useClients } from '../db/hooks/useClients'
import { useBarbers } from '../db/hooks/useBarbers'
import { useSettings } from '../db/hooks/useSettings'
import { useWaitingList } from '../db/hooks/useWaitingList'
import { Booking } from '../db/supabase'
import { getEgyptDateString } from '../utils/egyptTime'
import {
  buildBookingTime,
  bookingDateOf,
  bookingMinutesOf,
  getBarberWorkingWindow,
  isBarberOffOnDate,
  generateSlots,
} from '../utils/bookingAvailability'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Clock,
  Plus,
  X,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Zap,
} from 'lucide-react'
import { formatDateEgypt, formatTimeEgypt } from '../utils/formatCurrency'
import toast from 'react-hot-toast'
import { QueueStatus } from '../components/ui/QueueStatus'

interface NewBooking {
  searchQuery: string
  client_id: string | null
  client_name: string
  client_phone: string
  barber_id: string | null
  service_type: string
  booking_date: string
  booking_time: string
  duration: number
}

interface TimeSlot {
  time: string
  available: boolean
  reason?: string
  bookingCount?: number
  hasCompletedBooking?: boolean  // True if a completed booking exists at this time
  hasPendingBooking?: boolean     // True if a pending booking exists at this time
}

/** Parse "HH:MM" from an ISO time string into minutes of the day. */
const timeToMinutes = (iso: string) => {
  const t = iso.split('T')[1] || ''
  const h = parseInt(t.substring(0, 2), 10)
  const m = parseInt(t.substring(3, 5), 10)
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

export const Bookings: React.FC = () => {
  const { i18n } = useTranslation()
  const lang: 'ar' | 'en' = i18n.language === 'en' ? 'en' : 'ar'
  const { loading, bookings, getTodayBookings, getUpcomingBookings, addBooking, updateBooking, deleteBooking } = useBookings()
  const { clients } = useClients()
  const { barbers } = useBarbers()
  const { settings, updateSetting } = useSettings()
  const { waiting, fetchWaitingList, setWaitingStatus, removeFromWaitingList } = useWaitingList()

  const [showModal, setShowModal] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<'today' | 'upcoming'>('today')
  const [showWaitingList, setShowWaitingList] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<typeof clients>([])
  const [showSearchResults, setShowSearchResults] = React.useState(false)
  const [workingHours, setWorkingHours] = React.useState({ start: 9, end: 20 }) // 9 AM to 8 PM
  const [showWorkingHoursModal, setShowWorkingHoursModal] = React.useState(false)

  // Load clinic-wide working hours from settings (fallback to defaults).
  React.useEffect(() => {
    const saved = settings['working_hours']
    if (saved && typeof saved.start === 'number' && typeof saved.end === 'number') {
      setWorkingHours({ start: saved.start, end: saved.end })
    }
  }, [settings])

  const [formData, setFormData] = React.useState<NewBooking>({
    searchQuery: '',
    client_id: null,
    client_name: '',
    client_phone: '',
    barber_id: null,
    service_type: '',
    booking_date: getEgyptDateString(),
    booking_time: '10:00',
    duration: 30,
  })

  // Memoized derived data — computed once per bookings change, not on every render
  const todayBookings = getTodayBookings()
  const upcomingBookings = getUpcomingBookings()

  /**
   * Compute available/blocked time slots for a date + doctor.
   * Uses the shared availability util: per-doctor working hours, days off,
   * vacations, duration-aware overlap detection, and Cairo-local past guard.
   */
  const computeSlots = (date: string, selectedbarber_id?: string): TimeSlot[] => {
    const barber = barbers?.find((b) => b.id === selectedbarber_id)

    // Per-doctor working window, falling back to the clinic-wide hours.
    const workingWindow = getBarberWorkingWindow(barber, {
      start: workingHours.start * 60,
      end: workingHours.end * 60,
      active: true,
    })

    // Doctor is off duty (day off / vacation) -> no slots.
    if (isBarberOffOnDate(barber, date)) return []

    const duration = 30
    const slots = generateSlots({
      date,
      barberId: selectedbarber_id,
      bookings,
      duration,
      interval: 30,
      workingWindow,
      skipPast: true,
    })

    // Pre-compute per-hour booking counts (UI badges) in one pass.
    const hourCounts = new Map<number, number>()
    const hourPending = new Set<number>()
    for (const b of bookings) {
      if (bookingDateOf(b.booking_time) !== date) continue
      if (b.barber_id && selectedbarber_id && b.barber_id !== selectedbarber_id) continue
      if (b.status === 'cancelled') continue
      const hour = Math.floor(bookingMinutesOf(b.booking_time) / 60)
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
      if (b.status !== 'completed') hourPending.add(hour)
    }

    return slots.map((s) => {
      const hour = parseInt(s.time.split(':')[0], 10)
      return {
        time: s.time,
        available: s.available,
        reason: s.reason,
        bookingCount: hourCounts.get(hour) || 0,
        hasCompletedBooking: false,
        hasPendingBooking: hourPending.has(hour),
      }
    })
  }

  // Memoized slots for the currently selected doctor/date
  const availableSlots = useMemo<TimeSlot[]>(
    () => (formData.booking_date ? computeSlots(formData.booking_date, formData.barber_id || undefined) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings, barbers, formData.booking_date, formData.barber_id, workingHours.start, workingHours.end]
  )

  // Memoized booking preview info
  const previewInfo = useMemo(() => {
    if (!formData.booking_time) return null
    const dayBookings = bookings.filter(
      (b: any) => bookingDateOf(b.booking_time) === formData.booking_date && b.status !== 'cancelled'
    )
    const before = dayBookings.filter((b: any) => bookingMinutesOf(b.booking_time) < timeToMinutes(formData.booking_time))
    const queue_number = before.length + 1
    const totalWaitMinutes = before.reduce((sum, b: any) => sum + (b.duration || 30), 0)
    return { queue_number, estimatedWait: totalWaitMinutes }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, formData.booking_time, formData.booking_date])

  // اختيار ذكي - إيجاد أفضل طبيب متاح
  const findBestBarberOption = (date: string): { barber_id: string; barber_name: string; firstAvailableTime: string; earliestHour: number } | null => {
    if (!barbers || barbers.length === 0) return null

    let bestOption: { barber_id: string; barber_name: string; firstAvailableTime: string; earliestHour: number } | null = null
    let earliestHour = 24

    barbers?.forEach((barber) => {
      if (!barber.id) return

      const slots = computeSlots(date, barber.id)
      const firstAvailable = slots.find((s) => s.available)

      if (firstAvailable) {
        const hour = parseInt(firstAvailable.time.split(':')[0])
        if (hour < earliestHour) {
          earliestHour = hour
          bestOption = {
            barber_id: barber.id,
            barber_name: barber.name || '',
            firstAvailableTime: firstAvailable.time,
            earliestHour: hour,
          }
        }
      }
    })

    return bestOption
  }

  // Search for clients
  const handleClientSearch = (query: string) => {
    setFormData({ ...formData, searchQuery: query })

    if (query.length < 2) {
      setShowSearchResults(false)
      return
    }

    const filtered = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.phone.includes(query)
    )

    setSearchResults(filtered)
    setShowSearchResults(true)
  }

  const selectClient = (client: typeof clients[0]) => {
    setFormData({
      ...formData,
      searchQuery: '',
      client_id: client.id || null,
      client_name: client.name,
      client_phone: client.phone,
    })
    setShowSearchResults(false)
  }

  const resetForm = () => {
    setFormData({
      searchQuery: '',
      client_id: null,
      client_name: '',
      client_phone: '',
      barber_id: null,
      service_type: '',
      booking_date: getEgyptDateString(),
      booking_time: '10:00',
      duration: 30,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Order: Doctor → Client → Date/Time
    if (!formData.barber_id) {
      toast.error('❌ الرجاء اختيار الطبيب أولاً')
      return
    }

    if (!formData.client_id) {
      toast.error('❌ الرجاء البحث عن العميل واختياره من القائمة')
      return
    }

    if (!formData.booking_date || formData.booking_date.trim() === '') {
      toast.error('❌ الرجاء تحديد التاريخ')
      return
    }

    if (!formData.booking_time || formData.booking_time.trim() === '') {
      toast.error('❌ الرجاء تحديد الوقت من القائمة أعلاه')
      return
    }

    // فحص صيغة التاريخ والوقت
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const timeRegex = /^\d{2}:\d{2}$/

    if (!dateRegex.test(formData.booking_date)) {
      toast.error('❌ صيغة التاريخ غير صحيحة')
      return
    }

    if (!timeRegex.test(formData.booking_time)) {
      toast.error('❌ صيغة الوقت غير صحيحة')
      return
    }

    // فحص إذا كان الوقت متاح
    const selectedSlot = availableSlots.find((s) => s.time === formData.booking_time)
    if (selectedSlot && !selectedSlot.available) {
      toast.error(`⚠️ للأسف هذا الوقت ${selectedSlot.reason}!\nاختر أوقات أخرى في نفس اليوم`)
      return
    }

    try {
      const booking_time = buildBookingTime(formData.booking_date, formData.booking_time)

      // تحقق نهائي من صحة الوقت قبل الإرسال
      if (!booking_time || booking_time.trim() === '') {
        toast.error('❌ خطأ في إنشاء الوقت - يرجى المحاولة مرة أخرى')
        return
      }

      if (editingId) {
        // تعديل الحجز
        const updates: Partial<Booking> = {
          client_id: formData.client_id,
          client_name: formData.client_name,
          client_phone: formData.client_phone,
          barber_id: formData.barber_id || undefined,
          service_type: formData.service_type || undefined,
          booking_time: booking_time,
          duration: formData.duration,
        }

        await updateBooking(editingId, updates)
        setEditingId(null)
        toast.success('✅ تم تحديث الحجز بنجاح')
      } else {
        // إنشاء حجز جديد
        await addBooking({
          client_id: formData.client_id,
          client_name: formData.client_name,
          client_phone: formData.client_phone,
          barber_id: formData.barber_id || undefined,
          barber_name: formData.barber_id
            ? barbers?.find((b) => b.id === formData.barber_id)?.name
            : undefined,
          service_type: formData.service_type || undefined,
          booking_time: booking_time,
          duration: formData.duration,
          status: 'pending',
          queue_number: 0, // Will be calculated by addBooking
        } as any)
        toast.success('✅ تم إنشاء الحجز بنجاح')
      }

      // إعادة تعيين النموذج
      resetForm()
      setShowModal(false)
    } catch (error: any) {
      console.error('Error saving booking:', error)

      // معالجة أخطاء قاعدة البيانات
      if (error.message?.includes('booking_time') || error.message?.includes('NOT NULL')) {
        toast.error('❌ خطأ: الرجاء تحديد التاريخ والوقت بشكل صحيح')
      } else if (error.message?.includes('محجوز') || error.message?.includes('booked')) {
        toast.error('⚠️ هذا الموعد محجوز بالفعل - اختر وقت آخر')
      } else if (error.message?.includes('constraint')) {
        toast.error('❌ خطأ في البيانات - الرجاء التحقق من جميع الحقول')
      } else {
        toast.error(`❌ خطأ: ${error.message || 'حدث خطأ أثناء حفظ الحجز'}`)
      }
    }
  }

  const handleEdit = (booking: any) => {
    const booking_date = booking.booking_time.split('T')[0]
    const booking_time = booking.booking_time.split('T')[1]?.substring(0, 5) || '10:00'

    setFormData({
      searchQuery: '',
      client_id: booking.client_id,
      client_name: booking.client_name,
      client_phone: booking.client_phone,
      barber_id: booking.barber_id || null,
      service_type: booking.service_type || '',
      booking_date,
      booking_time,
      duration: booking.duration || 30,
    })
    setEditingId(booking.id || null)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('هل متأكد من حذف هذا الحجز؟')) {
      await deleteBooking(id)
    }
  }

  const handleStatusChange = async (id: string, status: Booking['status']) => {
    await updateBooking(id, { status })
    // Available slots recompute automatically when bookings refresh
  }

  const currentBookings = viewMode === 'today' ? todayBookings : upcomingBookings

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin">
          <Calendar className="text-pink-400" size={40} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-6">
      {/* Queue Status Widget */}
      <div className="mb-8">
        <QueueStatus bookings={bookings} />
      </div>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">الحجوزات</h1>
        <div className="flex gap-2">
          <motion.button
            onClick={() => setShowWorkingHoursModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg font-semibold hover:bg-blue-500/30 transition border border-blue-500/30"
            title="اضبط ساعات العمل"
          >
            <Clock size={18} />
            <span className="whitespace-nowrap">{workingHours.start}:00 - {workingHours.end}:00</span>
          </motion.button>
          <motion.button
            onClick={() => {
              setShowWaitingList((v) => !v)
              if (!showWaitingList) fetchWaitingList()
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-amber-500/20 text-amber-300 px-4 py-2 rounded-lg font-semibold hover:bg-amber-500/30 transition border border-amber-500/30"
            title="قائمة الانتظار"
          >
            <Clock size={18} />
            <span className="whitespace-nowrap">قائمة الانتظار ({waiting.length})</span>
          </motion.button>
          <motion.button
            onClick={() => {
              setEditingId(null)
              resetForm()
              setShowModal(true)
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-pink-600 hover:to-pink-700 transition shadow-lg hover:shadow-pink-500/50"
          >
            <Plus size={20} />
            حجز جديد
          </motion.button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex flex-wrap gap-4 mb-8">
        <motion.button
          onClick={() => setViewMode('today')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition ${
            viewMode === 'today'
              ? 'bg-gradient-to-r from-pink-600 to-pink-700 text-dark'
              : 'bg-white/10 text-gray-300 hover:bg-white/15'
          }`}
        >
          <Clock size={18} />
          حجوزات اليوم ({todayBookings.length})
        </motion.button>
        <motion.button
          onClick={() => setViewMode('upcoming')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition ${
            viewMode === 'upcoming'
              ? 'bg-gradient-to-r from-pink-600 to-pink-700 text-dark'
              : 'bg-white/10 text-gray-300 hover:bg-white/15'
          }`}
        >
          <Calendar size={18} />
          الحجوزات القادمة ({upcomingBookings.length})
        </motion.button>
      </div>

      {/* Waiting List Panel */}
      <AnimatePresence>
        {showWaitingList && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-dark rounded-lg p-6 mb-8 border border-amber-500/20">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-white">🕐 قائمة الانتظار</h2>
                <span className="text-sm text-gray-400">
                  عملاء ينتظرون في حال توفر موعد
                </span>
              </div>
              {waiting.length === 0 ? (
                <p className="text-gray-400 text-center py-6">لا يوجد عملاء في قائمة الانتظار</p>
              ) : (
                <div className="grid gap-3">
                  {waiting.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap justify-between items-center gap-3 bg-white/5 rounded-lg p-3"
                    >
                      <div className="min-w-0">
                        <h3 className="text-white font-semibold truncate">{entry.client_name}</h3>
                        <p className="text-gray-400 text-sm truncate">
                          {entry.client_phone}
                          {entry.service_type ? ` • ${entry.service_type}` : ''}
                          {entry.barber_name ? ` • ${entry.barber_name}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button
                          onClick={() => {
                            setEditingId(null)
                            resetForm()
                            setFormData((prev) => ({
                              ...prev,
                              client_name: entry.client_name,
                              client_phone: entry.client_phone,
                              service_type: entry.service_type || '',
                              barber_id: entry.barber_id || prev.barber_id,
                            }))
                            setShowModal(true)
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-3 py-1 rounded text-sm bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30"
                          title="احجز موعداً لهذا العميل"
                        >
                          احجز
                        </motion.button>
                        <motion.button
                          onClick={() => {
                            if (entry.id) setWaitingStatus(entry.id, 'notified')
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-3 py-1 rounded text-sm bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30"
                          title="تم إخطار العميل"
                        >
                          إخطار
                        </motion.button>
                        <motion.button
                          onClick={() => {
                            if (entry.id) removeFromWaitingList(entry.id)
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-3 py-1 rounded text-sm bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                          title="إزالة"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bookings Grid */}
      <div className="grid gap-4">
        <AnimatePresence>
          {currentBookings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-gray-400"
            >
              <AlertCircle className="mx-auto mb-4 text-pink-400/50" size={40} />
              <p>لا توجد حجوزات في هذا الوقت</p>
            </motion.div>
          ) : (
            currentBookings.map((booking: any, index: number) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: Math.min(index * 0.04, 0.4) }}
                className={`glass-dark rounded-lg p-6 border-2 transition ${
                  booking.status === 'completed'
                    ? 'border-green-500/50 bg-green-500/5'
                    : booking.status === 'cancelled'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-white/10'
                }`}
              >
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex gap-2">
                      <div className="bg-gradient-to-r from-pink-600 to-pink-700/20 rounded-lg px-3 py-1">
                        <span className="text-pink-400 font-bold">#{booking.queue_number}</span>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-1 text-xs font-bold ${
                          booking.status === 'completed'
                            ? 'bg-green-500/30 text-green-300'
                            : booking.status === 'cancelled'
                            ? 'bg-red-500/30 text-red-300'
                            : booking.status === 'ongoing' || booking.status === 'checked_in'
                            ? 'bg-blue-500/30 text-blue-300'
                            : booking.status === 'confirmed'
                            ? 'bg-purple-500/30 text-purple-300'
                            : 'bg-yellow-500/30 text-yellow-300'
                        }`}
                      >
                        {booking.status === 'completed'
                          ? '✅ اكتمل'
                          : booking.status === 'cancelled'
                          ? '❌ ملغى'
                          : booking.status === 'ongoing' || booking.status === 'checked_in'
                          ? '⏳ جاري'
                          : booking.status === 'confirmed'
                          ? '✔️ مؤكد'
                          : '⏰ انتظار'}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold truncate">{booking.client_name}</h3>
                      <p className="text-gray-400 text-sm truncate">{booking.client_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                      <motion.button
                        onClick={() => handleStatusChange(booking.id, 'completed')}
                        whileHover={{ scale: 1.1 }}
                        className="p-2 hover:bg-green-500/20 rounded transition text-green-400 border border-green-500/30"
                        title="تحديد كمكتمل"
                        aria-label="تحديد كمكتمل"
                      >
                        <CheckCircle2 size={18} />
                      </motion.button>
                    )}
                    <select
                      value={booking.status}
                      onChange={(e) => handleStatusChange(booking.id, e.target.value as Booking['status'])}
                      aria-label="حالة الحجز"
                      className={`px-3 py-1 rounded text-sm border focus:outline-none transition ${
                        booking.status === 'completed'
                          ? 'bg-green-500/20 text-green-300 border-green-500/40'
                          : booking.status === 'cancelled'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-white/10 text-white border-white/20 focus:border-pink-500'
                      }`}
                    >
                      <option value="pending">قيد الانتظار</option>
                      <option value="confirmed">مؤكد</option>
                      <option value="checked_in">حضر</option>
                      <option value="ongoing">جاري</option>
                      <option value="completed">اكتمل</option>
                      <option value="cancelled">ملغى</option>
                    </select>
                    <motion.button
                      onClick={() => handleEdit(booking)}
                      whileHover={{ scale: 1.1 }}
                      className="p-2 hover:bg-white/10 rounded transition text-blue-400"
                      aria-label="تعديل الحجز"
                    >
                      <Edit2 size={18} />
                    </motion.button>
                    <motion.button
                      onClick={() => handleDelete(booking.id)}
                      whileHover={{ scale: 1.1 }}
                      className="p-2 hover:bg-white/10 rounded transition text-red-400"
                      aria-label="حذف الحجز"
                    >
                      <Trash2 size={18} />
                    </motion.button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">الموعد</p>
                    <p className="text-white font-semibold">
                      {formatDateEgypt(booking.booking_time, lang)}
                    </p>
                    <p className="text-pink-400">
                      {formatTimeEgypt(booking.booking_time, lang)}
                    </p>
                  </div>

                  {booking.queueInfo && (
                    <>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">أمامك في الدور</p>
                        <p className="text-white font-semibold text-lg">
                          {booking.queueInfo.peopleAhead}
                        </p>
                        <p className="text-gray-400 text-xs">شخص</p>
                      </div>

                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">الانتظار المتوقع</p>
                        <p className="text-white font-semibold text-lg">
                          {booking.queueInfo.estimatedWaitMinutes}
                        </p>
                        <p className="text-gray-400 text-xs">دقيقة</p>
                      </div>

                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">الوقت المتوقع</p>
                        <p className="text-pink-400 font-semibold text-sm">
                          {booking.queueInfo.estimatedStartTime}
                        </p>
                      </div>
                    </>
                  )}

                  {!booking.queueInfo && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">المدة</p>
                      <p className="text-white font-semibold">{booking.duration || 30}</p>
                      <p className="text-gray-400 text-xs">دقيقة</p>
                    </div>
                  )}
                </div>

                {(booking.barber_name || booking.service_type) && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {booking.barber_name && (
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded">
                        <span className="text-gray-400">الطبيب:</span>
                        <span className="text-white font-semibold">{booking.barber_name}</span>
                      </div>
                    )}
                    {booking.service_type && (
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded">
                        <span className="text-gray-400">النوع:</span>
                        <span className="text-white font-semibold">{booking.service_type}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-dark rounded-lg p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-pink-500/20"
              role="dialog"
              aria-modal="true"
              aria-label={editingId ? 'تعديل الحجز' : 'حجز جديد'}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {editingId ? 'تعديل الحجز' : 'حجز جديد'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/10 rounded transition"
                  aria-label="إغلاق"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Barber Selection - FIRST STEP */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    💼 اختر الطبيب *
                  </label>
                  <div className="space-y-2">
                    <select
                      value={formData.barber_id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFormData({ ...formData, barber_id: e.target.value })
                        }
                      }}
                      className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border-2 border-white/20 focus:border-pink-500 focus:outline-none focus:bg-white/15 transition"
                    >
                      <option value="">-- اختر الطبيب --</option>
                      {barbers
                        ?.filter((b) => b.active)
                        .map((barber) => (
                          <option key={barber.id} value={barber.id}>
                            💼 {barber.name}
                          </option>
                        ))}
                    </select>

                    {/* Smart Choice Button */}
                    {formData.booking_date && !formData.barber_id && (
                      <motion.button
                        type="button"
                        onClick={() => {
                          const best = findBestBarberOption(formData.booking_date)
                          if (best) {
                            setFormData({
                              ...formData,
                              barber_id: best.barber_id,
                              booking_time: best.firstAvailableTime,
                            })
                            toast.success(
                              `⚡ اختيار ذكي: ${best.barber_name} متاح الساعة ${best.firstAvailableTime}`
                            )
                          } else {
                            toast.error('❌ لا توجد أوقات متاحة في هذا اليوم')
                          }
                        }}
                        whileHover={{ scale: 1.02 }}
                        className="w-full bg-purple-500/20 text-purple-300 px-4 py-2 rounded-lg border-2 border-purple-500/30 hover:bg-purple-500/30 transition font-semibold flex items-center justify-center gap-2"
                      >
                        <Zap size={16} />
                        اختيار ذكي
                      </motion.button>
                    )}
                  </div>

                  {formData.barber_id && (
                    <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm font-semibold">
                        ✓ {barbers?.find((b) => b.id === formData.barber_id)?.name}
                      </p>
                    </div>
                  )}
                </div>

                {/* Client Search */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    البحث عن عميل *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ابحث عن الاسم أو رقم الهاتف"
                      value={formData.searchQuery}
                      onChange={(e) => handleClientSearch(e.target.value)}
                      className="w-full bg-white/15 text-white px-4 py-2 rounded-lg border-2 border-white/30 focus:border-pink-500 focus:outline-none focus:bg-white/20 transition placeholder-gray-300 pe-10"
                    />
                    <Search className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                    {/* Search Results Dropdown */}
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="absolute top-full start-0 w-full mt-1 bg-gray-900 border-2 border-pink-500 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                        {searchResults.map((client) => (
                          <motion.button
                            key={client.id}
                            type="button"
                            onClick={() => selectClient(client)}
                            whileHover={{ backgroundColor: '#D4AF37' }}
                            className="w-full text-start px-4 py-3 text-white hover:bg-gradient-to-r from-pink-600 to-pink-700 hover:text-dark transition border-b border-gray-700 last:border-b-0 font-medium"
                          >
                            <div className="font-semibold text-base">{client.name}</div>
                            <div className="text-xs text-gray-300">{client.phone}</div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>

                  {formData.client_id && (
                    <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm font-semibold">
                        ✓ {formData.client_name} ({formData.client_phone})
                      </p>
                    </div>
                  )}
                </div>

                {/* Date & Time Selection */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        📅 التاريخ *
                      </label>
                      <input
                        type="date"
                        value={formData.booking_date}
                        onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                        className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border-2 border-white/20 focus:border-pink-500 focus:outline-none focus:bg-white/15 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        ⏰ الوقت (اختر من القائمة) *
                      </label>
                      <select
                        value={formData.booking_time || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            setFormData({ ...formData, booking_time: e.target.value })
                          }
                        }}
                        className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border-2 border-white/20 focus:border-pink-500 focus:outline-none focus:bg-white/15 transition"
                      >
                        {availableSlots.length === 0 ? (
                          <option value="">-- اختر التاريخ أولاً --</option>
                        ) : (
                          <>
                            <option value="" disabled>-- اختر وقت متاح --</option>
                            {availableSlots.map((slot) => (
                              <option
                                key={slot.time}
                                value={slot.time}
                                disabled={!slot.available}
                              >
                                {slot.time} {slot.available ? '✓ متاح' : '✗ محجوب'}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Available Times Grid */}
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <p className="text-xs text-gray-400 mb-3">
                      🟢 = متاح | 🔴 = محجوز (قيد الانتظار) | ✅ = اكتمل
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                      {availableSlots.map((slot) => (
                        <motion.button
                          key={slot.time}
                          type="button"
                          onClick={() => {
                            if (slot.available || slot.hasCompletedBooking) {
                              setFormData({ ...formData, booking_time: slot.time })
                            }
                          }}
                          whileHover={slot.available && !slot.hasCompletedBooking ? { scale: 1.05 } : {}}
                          className={`py-2 px-1 rounded text-xs font-semibold text-center transition ${
                            slot.hasCompletedBooking
                              ? 'bg-green-500/40 text-green-300 border border-green-500/70 font-bold'
                              : slot.available
                              ? formData.booking_time === slot.time
                                ? 'bg-gradient-to-r from-pink-600 to-pink-700 text-dark border-2 border-pink-500'
                                : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                              : 'bg-red-500/40 text-red-300 border border-red-500/70 cursor-not-allowed opacity-75'
                          }`}
                          disabled={!slot.available && !slot.hasCompletedBooking}
                          title={
                            slot.hasCompletedBooking
                              ? 'تم بالفعل ✅'
                              : !slot.available
                              ? slot.reason
                              : 'متاح'
                          }
                        >
                          {slot.hasCompletedBooking ? '✅' : slot.available ? slot.time : '❌'}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Preview Info */}
                  {previewInfo && formData.booking_time && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={18} className="text-blue-400" />
                        <p className="text-sm font-semibold text-blue-300">معاينة الحجز</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">رقمك في الدور:</span>
                          <p className="text-lg font-bold text-pink-400">#{previewInfo.queue_number}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">الانتظار المتوقع:</span>
                          <p className="text-lg font-bold text-white">{previewInfo.estimatedWait} دقيقة</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    مدة الخدمة (دقيقة)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-pink-500 focus:outline-none focus:bg-white/15 transition"
                  />
                </div>

                {/* Service Type (Optional) */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    💇 نوع الخدمة (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثل: عناية بالبشرة، جلسة تفتيح..."
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                    className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border-2 border-white/20 focus:border-pink-500 focus:outline-none focus:bg-white/15 transition"
                  />
                </div>

                {/* Submit */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-pink-700 transition shadow-lg hover:shadow-pink-500/50"
                  >
                    {editingId ? '✅ تحديث الحجز' : '✅ إنشاء الحجز'}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowModal(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition"
                  >
                    إلغاء
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Working Hours Configuration Modal */}
      <AnimatePresence>
        {showWorkingHoursModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowWorkingHoursModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 shadow-2xl max-w-md w-full border border-white/10"
              role="dialog"
              aria-modal="true"
              aria-label="ساعات العمل"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">⏰ ساعات العمل</h2>
                <button
                  onClick={() => setShowWorkingHoursModal(false)}
                  className="p-2 hover:bg-white/10 rounded transition"
                  aria-label="إغلاق"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    وقت البداية (من الساعة)
                  </label>
                  <select
                    value={workingHours.start}
                    onChange={(e) =>
                      setWorkingHours({
                        ...workingHours,
                        start: Math.min(parseInt(e.target.value), workingHours.end),
                      })
                    }
                    className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-pink-500 focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    وقت النهاية (إلى الساعة)
                  </label>
                  <select
                    value={workingHours.end}
                    onChange={(e) =>
                      setWorkingHours({
                        ...workingHours,
                        end: Math.max(parseInt(e.target.value), workingHours.start),
                      })
                    }
                    className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-pink-500 focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-300">
                  💡 الساعات من {String(workingHours.start).padStart(2, '0')}:00 إلى{' '}
                  {String(workingHours.end).padStart(2, '0')}:00 ({workingHours.end - workingHours.start}{' '}
                  ساعة عمل)
                </div>

                <motion.button
                  type="button"
                  onClick={() => {
                    updateSetting('working_hours', {
                      start: workingHours.start,
                      end: workingHours.end,
                    }).catch(() => {})
                    toast.success(
                      `✅ تم تحديث ساعات العمل: ${String(workingHours.start).padStart(2, '0')}:00 - ${String(workingHours.end).padStart(2, '0')}:00`
                    )
                    setShowWorkingHoursModal(false)
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-pink-600 to-pink-700 text-dark px-6 py-3 rounded-lg font-semibold hover:from-pink-700 hover:to-pink-800 transition mt-6"
                >
                  حفظ ساعات العمل
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
