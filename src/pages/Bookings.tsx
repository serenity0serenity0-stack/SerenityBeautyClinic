import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBookings } from '../db/hooks/useBookings'
import { useClients } from '../db/hooks/useClients'
import { useBarbers } from '../db/hooks/useBarbers'
import { Booking } from '../db/supabase'
import { getEgyptDateString } from '../utils/egyptTime'
import { appEmitter } from '../utils/eventEmitter'
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

export const Bookings: React.FC = () => {
  useTranslation()
  const { loading, getTodayBookings, getUpcomingBookings, addBooking, updateBooking, deleteBooking } = useBookings()
  const { clients } = useClients()
  const { barbers } = useBarbers()

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'today' | 'upcoming'>('today')
  const [searchResults, setSearchResults] = useState<typeof clients>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [previewInfo, setPreviewInfo] = useState<any>(null)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [workingHours, setWorkingHours] = useState({ start: 9, end: 20 }) // 9 AM to 8 PM
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false)

  const [formData, setFormData] = useState<NewBooking>({
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

  const todayBookings = getTodayBookings()
  const upcomingBookings = getUpcomingBookings()

  // حساب الأوقات المتاحة والمشغولة لحلاق محدد
  const calculateAvailableSlots = (date: string, selectedbarber_id?: string) => {
    const slots: TimeSlot[] = []
    const intervalMinutes = 30
    const now = new Date()

    // الحجوزات في هذا اليوم للحلاق المحدد (فقط pending/ongoing)
    const dayBookings = getTodayBookings().filter((b: any) => {
      const isCorrectDate = new Date(b.booking_time).toLocaleDateString('en-CA') === date
      const isCorrectBarber = !selectedbarber_id || b.barber_id === selectedbarber_id
      // استبعد الحجوزات المكتملة والملغاة - لا تحجز الوقت
      const isActive = b.status !== 'completed' && b.status !== 'cancelled'
      return isCorrectDate && isCorrectBarber && isActive
    })

    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      for (let min = 0; min < 60; min += intervalMinutes) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`

        // Check if time has already passed in real-time
        const slotDateTime = new Date(`${date}T${timeStr}:00+02:00`)
        const timeHasPassed = slotDateTime <= now

        // تحقق من التضاربات باستخدام المنطق الصحيح
        // إذا كان الحجز من 10:00-10:30، لا يمكن حجز أي وقت يتداخل
        const slotStart = slotDateTime.getTime()
        const slotEnd = slotStart + 30 * 60000 // 30 minute service duration

        const hasConflict = dayBookings.some((booking: any) => {
          const bookingStart = new Date(booking.booking_time).getTime()
          const bookingEnd = bookingStart + (booking.duration || 30) * 60000

          // Check overlap: slot starts before booking ends AND slot ends after booking starts
          const overlap = slotStart < bookingEnd && slotEnd > bookingStart
          
          if (overlap) {
            console.log(
              `[Conflict] Slot ${timeStr} conflicts with booking at ${new Date(bookingStart).toLocaleTimeString()}`
            )
          }
          
          return overlap
        })

        slots.push({
          time: timeStr,
          available: !hasConflict && !timeHasPassed,
          reason: timeHasPassed ? 'الوقت عدا بالفعل' : (hasConflict ? 'محجوز بالفعل' : undefined),
          bookingCount: dayBookings.filter((b: any) => {
            const bHour = parseInt(b.booking_time.split('T')[1].substring(0, 2))
            return bHour === hour
          }).length,
          hasCompletedBooking: !!dayBookings.find((b: any) => {
            const bookingHour = parseInt(b.booking_time.split('T')[1].substring(0, 2))
            return bookingHour === hour && b.status === 'completed'
          }),
          hasPendingBooking: !!dayBookings.find((b: any) => {
            const bookingHour = parseInt(b.booking_time.split('T')[1].substring(0, 2))
            return bookingHour === hour && b.status !== 'completed' && b.status !== 'cancelled'
          }),
        })
      }
    }

    return slots
  }

  // تحديث الأوقات عند تغيير التاريخ أو الحلاق أو عند تحديث الحجوزات
  React.useEffect(() => {
    if (formData.booking_date) {
      const slots = calculateAvailableSlots(formData.booking_date, formData.barber_id || undefined)
      setAvailableSlots(slots)
    }
  }, [formData.booking_date, formData.barber_id, todayBookings])

  // تحديث معاينة الدور عند تغيير الوقت
  React.useEffect(() => {
    if (formData.booking_time) {
      const dayBookings = getTodayBookings().filter(
        (b: any) => new Date(b.booking_time).toLocaleDateString('en-CA') === formData.booking_date
      )
      const queue_number = (dayBookings.filter((b: any) => 
        parseInt(b.booking_time.split('T')[1]) < parseInt(formData.booking_time)
      ).length || 0) + 1

      const totalWaitMinutes = dayBookings
        .filter((b: any) => parseInt(b.booking_time.split('T')[1]) < parseInt(formData.booking_time))
        .reduce((sum, b: any) => sum + (b.duration || 30), 0)

      setPreviewInfo({
        queue_number,
        estimatedWait: totalWaitMinutes,
      })
    }
  }, [formData.booking_time, formData.booking_date])

  // Listen for real-time booking status changes and refresh slots
  React.useEffect(() => {
    const handleStatusChange = () => {
      if (formData.booking_date) {
        const slots = calculateAvailableSlots(formData.booking_date, formData.barber_id || undefined)
        setAvailableSlots(slots)
      }
    }
    appEmitter.on('booking:statusChanged', handleStatusChange)
    return () => {
      appEmitter.off('booking:statusChanged', handleStatusChange)
    }
  }, [formData.booking_date, formData.barber_id])

  // اختيار ذكي - إيجاد أفضل حلاق متاح
  const findBestBarberOption = (date: string): { barber_id: string; barber_name: string; firstAvailableTime: string; earliestHour: number } | null => {
    if (!barbers || barbers.length === 0) return null

    let bestOption: { barber_id: string; barber_name: string; firstAvailableTime: string; earliestHour: number } | null = null
    let earliestHour = 24

    barbers?.forEach((barber) => {
      if (!barber.id) return
      
      const slots = calculateAvailableSlots(date, barber.id)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Order: Barber → Client → Date/Time
    if (!formData.barber_id) {
      toast.error('❌ الرجاء اختيار الحلاق أولاً')
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
      const booking_time = `${formData.booking_date}T${formData.booking_time}:00+02:00`

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
    // Refresh available slots after status change
    if (formData.booking_date) {
      const slots = calculateAvailableSlots(formData.booking_date, formData.barber_id || undefined)
      setAvailableSlots(slots)
    }
  }

  const currentBookings = viewMode === 'today' ? todayBookings : upcomingBookings

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin">
          <Calendar className="text-gold-400" size={40} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      {/* Queue Status Widget */}
      <div className="mb-8">
        <QueueStatus />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">الحجوزات</h1>
        <div className="flex gap-2">
          <motion.button
            onClick={() => setShowWorkingHoursModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg font-semibold hover:bg-blue-500/30 transition border border-blue-500/30"
            title="اضبط ساعات العمل"
          >
            <Clock size={18} />
            {workingHours.start}:00 - {workingHours.end}:00
          </motion.button>
          <motion.button
            onClick={() => {
              setEditingId(null)
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
              setShowModal(true)
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-gold-400 text-dark px-6 py-2 rounded-lg font-semibold hover:bg-gold-500 transition"
          >
            <Plus size={20} />
            حجز جديد
          </motion.button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-4 mb-8">
        <motion.button
          onClick={() => setViewMode('today')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition ${
            viewMode === 'today'
              ? 'bg-gold-400 text-dark'
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
              ? 'bg-gold-400 text-dark'
              : 'bg-white/10 text-gray-300 hover:bg-white/15'
          }`}
        >
          <Calendar size={18} />
          الحجوزات القادمة ({upcomingBookings.length})
        </motion.button>
      </div>

      {/* Bookings Grid */}
      <div className="grid gap-4">
        <AnimatePresence>
          {currentBookings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-gray-400"
            >
              <AlertCircle className="mx-auto mb-4 text-gold-400/50" size={40} />
              <p>لا توجد حجوزات في هذا الوقت</p>
            </motion.div>
          ) : (
            currentBookings.map((booking: any, index: number) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className={`glass-dark rounded-lg p-6 border-2 transition ${
                  booking.status === 'completed'
                    ? 'border-green-500/50 bg-green-500/5'
                    : booking.status === 'cancelled'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex gap-2">
                      <div className="bg-gold-400/20 rounded-lg px-3 py-1">
                        <span className="text-gold-400 font-bold">#{booking.queue_number}</span>
                      </div>
                      <div
                        className={`rounded-lg px-3 py-1 text-xs font-bold ${
                          booking.status === 'completed'
                            ? 'bg-green-500/30 text-green-300'
                            : booking.status === 'cancelled'
                            ? 'bg-red-500/30 text-red-300'
                            : booking.status === 'ongoing'
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'bg-yellow-500/30 text-yellow-300'
                        }`}
                      >
                        {booking.status === 'completed'
                          ? '✅ اكتمل'
                          : booking.status === 'cancelled'
                          ? '❌ ملغى'
                          : booking.status === 'ongoing'
                          ? '⏳ جاري'
                          : '⏰ انتظار'}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{booking.client_name}</h3>
                      <p className="text-gray-400 text-sm">{booking.client_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                      <motion.button
                        onClick={() => handleStatusChange(booking.id, 'completed')}
                        whileHover={{ scale: 1.1 }}
                        className="p-2 hover:bg-green-500/20 rounded transition text-green-400 border border-green-500/30"
                        title="تحديد كمكتمل"
                      >
                        <CheckCircle2 size={18} />
                      </motion.button>
                    )}
                    <select
                      value={booking.status}
                      onChange={(e) => handleStatusChange(booking.id, e.target.value as Booking['status'])}
                      className={`px-3 py-1 rounded text-sm border focus:outline-none transition ${
                        booking.status === 'completed'
                          ? 'bg-green-500/20 text-green-300 border-green-500/40'
                          : booking.status === 'cancelled'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-white/10 text-white border-white/20 focus:border-gold-400'
                      }`}
                    >
                      <option value="pending">قيد الانتظار</option>
                      <option value="ongoing">جاري</option>
                      <option value="completed">اكتمل</option>
                      <option value="cancelled">ملغى</option>
                    </select>
                    <motion.button
                      onClick={() => handleEdit(booking)}
                      whileHover={{ scale: 1.1 }}
                      className="p-2 hover:bg-white/10 rounded transition text-blue-400"
                    >
                      <Edit2 size={18} />
                    </motion.button>
                    <motion.button
                      onClick={() => handleDelete(booking.id)}
                      whileHover={{ scale: 1.1 }}
                      className="p-2 hover:bg-white/10 rounded transition text-red-400"
                    >
                      <Trash2 size={18} />
                    </motion.button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">الموعد</p>
                    <p className="text-white font-semibold">
                      {new Date(booking.booking_time).toLocaleDateString('ar-EG')}
                    </p>
                    <p className="text-gold-400">
                      {new Date(booking.booking_time).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
                        <p className="text-gold-400 font-semibold text-sm">
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
                  <div className="flex gap-4 text-sm">
                    {booking.barber_name && (
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded">
                        <span className="text-gray-400">الحلاق:</span>
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
              className="glass-dark rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gold-400/20"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingId ? 'تعديل الحجز' : 'حجز جديد'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/10 rounded transition"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Barber Selection - FIRST STEP */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    ✂️ اختر الحلاق *
                  </label>
                  <div className="space-y-2">
                    <select
                      value={formData.barber_id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFormData({ ...formData, barber_id: e.target.value })
                          setAvailableSlots([]) // إعادة تعيين الأوقات
                        }
                      }}
                      className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border-2 border-white/20 focus:border-gold-400 focus:outline-none"
                    >
                      <option value="">-- اختر الحلاق --</option>
                      {barbers
                        ?.filter((b) => b.active)
                        .map((barber) => (
                          <option key={barber.id} value={barber.id}>
                            ✂️ {barber.name}
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
                      className="w-full bg-white/15 text-white px-4 py-2 rounded-lg border-2 border-white/30 focus:border-gold-400 focus:outline-none focus:bg-white/20 transition placeholder-gray-300"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                    {/* Search Results Dropdown */}
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="absolute top-full right-0 w-full mt-1 bg-gray-900 border-2 border-gold-400 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                        {searchResults.map((client) => (
                          <motion.button
                            key={client.id}
                            type="button"
                            onClick={() => selectClient(client)}
                            whileHover={{ backgroundColor: '#D4AF37' }}
                            className="w-full text-right px-4 py-3 text-white hover:bg-gold-400 hover:text-dark transition border-b border-gray-700 last:border-b-0 font-medium"
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        📅 التاريخ *
                      </label>
                      <input
                        type="date"
                        value={formData.booking_date}
                        onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                        className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border-2 border-white/20 focus:border-gold-400 focus:outline-none"
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
                        className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border-2 border-white/20 focus:border-gold-400 focus:outline-none"
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
                                {slot.time} {slot.available ? '✓ متاح' : '✗ محجوز'}
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
                    <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
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
                                ? 'bg-gold-400 text-dark border-2 border-gold-400'
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
                          <p className="text-lg font-bold text-gold-400">#{previewInfo.queue_number}</p>
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
                    className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-gold-400 focus:outline-none"
                  />
                </div>

                {/* Service Type (Optional) */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    نوع الخدمة (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثل: حلاقة عادية، حلاقة + لحية..."
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                    className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-gold-400 focus:outline-none"
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-4 pt-4">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-gold-400 text-dark px-6 py-3 rounded-lg font-semibold hover:bg-gold-500 transition"
                  >
                    {editingId ? 'تحديث الحجز' : 'إنشاء الحجز'}
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
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">⏰ ساعات العمل</h2>
                <button
                  onClick={() => setShowWorkingHoursModal(false)}
                  className="p-2 hover:bg-white/10 rounded transition"
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
                    className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-gold-400 focus:outline-none"
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
                    className="w-full bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:border-gold-400 focus:outline-none"
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
                    toast.success(
                      `✅ تم تحديث ساعات العمل: ${String(workingHours.start).padStart(2, '0')}:00 - ${String(workingHours.end).padStart(2, '0')}:00`
                    )
                    setShowWorkingHoursModal(false)
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gold-400 text-dark px-6 py-3 rounded-lg font-semibold hover:bg-gold-500 transition mt-6"
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
