import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { usePortalBookings } from '@/hooks/usePortalBookings'
import { ArrowRight, X, CheckCircle, Clock, User, Calendar } from 'lucide-react'

type TabType = 'new' | 'existing'

interface BookingForm {
  serviceId: string
  barberId: string | null
  date: string
  time: string
}

interface BookingConfirmation {
  show: boolean
  serviceName: string
  date: string
  time: string
}

export function PortalBookings() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  
  // Auth & Settings
  const { customer, loading: authLoading } = usePortalAuthSecure(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)
  
  // Booking data
  const { 
    services, 
    barbers, 
    bookings, 
    loading: bookingsLoading, 
    error: bookingsError,
    createBooking,
    cancelBooking,
    getAvailableSlots
  } = usePortalBookings(customer?.shop_id, customer?.id)

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('new')
  const [form, setForm] = useState<BookingForm>({ serviceId: '', barberId: null, date: '', time: '' })
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<BookingConfirmation>({ show: false, serviceName: '', date: '', time: '' })
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !customer) {
      navigate(`/shop/${slug}/login`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - احجز موعد`
    }
  }, [settings?.shop_name])

  // Calculate available time slots when date or service changes
  useEffect(() => {
    if (form.date && form.serviceId) {
      const loadSlots = async () => {
        const slots = await getAvailableSlots(form.date, form.barberId || undefined)
        setAvailableSlots(slots)
      }
      loadSlots()
    }
  }, [form.date, form.serviceId, form.barberId, getAvailableSlots])

  // Get min & max dates for input
  const getMinDate = useCallback(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }, [])

  const getMaxDate = useCallback(() => {
    const later = new Date()
    later.setDate(later.getDate() + 30)
    return later.toISOString().split('T')[0]
  }, [])

  // Handle booking submission
  const handleBooking = async () => {
    setSubmitError('')

    if (!form.serviceId || !form.date || !form.time) {
      setSubmitError('الرجاء اختيار جميع البيانات المطلوبة')
      return
    }

    setSubmitting(true)
    try {
      const selectedService = services.find(s => s.id === form.serviceId)
      if (!selectedService) throw new Error('الخدمة غير متاحة')

      await createBooking(
        form.serviceId,
        form.date,
        form.time,
        form.barberId || undefined,
        customer?.id
      )

      // Show confirmation
      setConfirmation({
        show: true,
        serviceName: selectedService.nameAr,
        date: form.date,
        time: form.time
      })

      // Reset form
      setForm({ serviceId: '', barberId: null, date: '', time: '' })
      setAvailableSlots([])

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setConfirmation({ show: false, serviceName: '', date: '', time: '' })
        setActiveTab('existing')
      }, 3000)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'الحجز فشل')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle cancellation
  const handleCancel = async (bookingId: string) => {
    try {
      await cancelBooking(bookingId)
      setCancelConfirm(null)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'فشل الإلغاء')
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { bg: string; text: string; label: string } } = {
      pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', label: 'قيد الانتظار' },
      confirmed: { bg: 'bg-green-900/30', text: 'text-green-400', label: 'مؤكد' },
      completed: { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'مكتمل' },
      cancelled: { bg: 'bg-red-900/30', text: 'text-red-400', label: 'ملغى' }
    }
    const badge = badges[status] || badges.pending
    return badge
  }

  if (authLoading || settingsLoading || bookingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  const primaryColor = settings?.primary_color || '#FFD700'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      <div className="max-w-5xl mx-auto p-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/shop/${slug}/dashboard`)}
          className="flex items-center gap-2 mb-8 text-white/70 hover:text-white transition"
        >
          <ArrowRight size={20} />
          العودة للرئيسة
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">احجز موعدك</h1>
          <p className="text-white/60">مع {settings?.shop_name}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-6 py-3 font-bold transition ${
              activeTab === 'new'
                ? 'text-white border-b-2 border-b-gold-400 -mb-[2px]'
                : 'text-white/50 hover:text-white/70'
            }`}
            style={activeTab === 'new' ? { borderBottomColor: primaryColor } : {}}
          >
            حجز جديد
          </button>
          <button
            onClick={() => setActiveTab('existing')}
            className={`px-6 py-3 font-bold transition ${
              activeTab === 'existing'
                ? 'text-white border-b-2 border-b-gold-400 -mb-[2px]'
                : 'text-white/50 hover:text-white/70'
            }`}
            style={activeTab === 'existing' ? { borderBottomColor: primaryColor } : {}}
          >
            مواعيدك ({bookings.length})
          </button>
        </div>

        {/* Error Messages */}
        {(bookingsError || submitError) && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400">
            {bookingsError || submitError}
          </div>
        )}

        {/* Booking Confirmation */}
        {confirmation.show && (
          <div className="mb-6 p-6 bg-green-900/30 border border-green-500/50 rounded-lg flex items-start gap-4">
            <CheckCircle size={24} className="text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-green-400 mb-2">تم حجز الموعد بنجاح!</h3>
              <p className="text-green-400/90 text-sm">
                الخدمة: <span className="font-bold">{confirmation.serviceName}</span>
              </p>
              <p className="text-green-400/90 text-sm">
                التاريخ: <span className="font-bold">{new Date(confirmation.date).toLocaleDateString('ar-EG')}</span>
              </p>
              <p className="text-green-400/90 text-sm">
                الوقت: <span className="font-bold">{confirmation.time}</span>
              </p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'new' && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-6">
              <div>
                <label className="block text-white/70 text-sm font-bold mb-2">الخدمة المطلوبة *</label>
                <select
                  value={form.serviceId}
                  onChange={(e) => setForm({ ...form, serviceId: e.target.value, time: '' })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                    placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                >
                  <option value="">اختر الخدمة</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.nameAr} - {service.price} ج.م ({service.durationMinutes} دقيقة)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/70 text-sm font-bold mb-2">الحلاق (اختياري)</label>
                <select
                  value={form.barberId || ''}
                  onChange={(e) => setForm({ ...form, barberId: e.target.value || null, time: '' })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                    placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                >
                  <option value="">أي حلاق متاح</option>
                  {barbers.map(barber => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/70 text-sm font-bold mb-2">التاريخ *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value, time: '' })}
                  min={getMinDate()}
                  max={getMaxDate()}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                    placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                />
                <p className="text-white/40 text-xs mt-2">من غد إلى 30 يوم</p>
              </div>

              <div>
                <label className="block text-white/70 text-sm font-bold mb-2">الوقت *</label>
                <select
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  disabled={!form.date || !form.serviceId}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                    placeholder:text-white/40 focus:outline-none focus:border-white/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">اختر الوقت</option>
                  {availableSlots.map(slot => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                {!form.date && (
                  <p className="text-white/40 text-xs mt-2">اختر التاريخ أولاً</p>
                )}
                {form.date && availableSlots.length === 0 && (
                  <p className="text-yellow-400/70 text-xs mt-2">لا توجد أوقات متاحة في هذا التاريخ</p>
                )}
              </div>

              <button
                onClick={handleBooking}
                disabled={submitting || !form.serviceId || !form.date || !form.time}
                className="w-full py-3 px-4 rounded-lg font-bold text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: primaryColor,
                  opacity: submitting || !form.serviceId || !form.date || !form.time ? 0.5 : 1
                }}
              >
                {submitting ? 'جاري الحجز...' : 'تأكيد الحجز'}
              </button>
            </div>

            {/* Time Slots Preview */}
            {form.date && form.serviceId && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Clock size={20} />
                  الأوقات المتاحة - {new Date(form.date).toLocaleDateString('ar-EG')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {availableSlots.length > 0 ? (
                    availableSlots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setForm({ ...form, time: slot })}
                        className={`py-2 px-3 rounded-lg text-sm font-bold transition ${
                          form.time === slot
                            ? 'bg-gold-400 text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                        style={form.time === slot ? { backgroundColor: primaryColor, color: 'black' } : {}}
                      >
                        {slot}
                      </button>
                    ))
                  ) : (
                    <p className="text-white/50 col-span-2 text-center py-8">لا توجد أوقات متاحة</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing Bookings Tab */}
        {activeTab === 'existing' && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
                <div className="text-5xl mb-4">📅</div>
                <h3 className="text-xl font-bold text-white/70 mb-2">لا توجد مواعيد</h3>
                <p className="text-white/50 mb-6">لم تقم بحجز أي مواعيد بعد</p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="px-6 py-2 rounded-lg font-bold text-black"
                  style={{ backgroundColor: primaryColor }}
                >
                  احجز موعدك الآن
                </button>
              </div>
            ) : (
              bookings.map(booking => {
                const statusBadge = getStatusBadge(booking.status)
                const serviceInfo = services.find(s => s.id === booking.serviceId)
                const barberInfo = barbers.find(b => b.id === booking.barberId)

                return (
                  <div key={booking.id} className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/[0.08] transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-3">
                          {serviceInfo?.nameAr || 'خدمة'}
                        </h3>
                        
                        <div className="space-y-2 text-sm text-white/70 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            {new Date(booking.bookingDate).toLocaleDateString('ar-EG')}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={16} />
                            {booking.bookingTime}
                          </div>
                          {barberInfo && (
                            <div className="flex items-center gap-2">
                              <User size={16} />
                              {barberInfo.name}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.bg} ${statusBadge.text}`}
                          >
                            {statusBadge.label}
                          </div>
                          <div className="text-xs text-white/40">
                            السعر: {serviceInfo?.price} ج.م
                          </div>
                        </div>
                      </div>

                      {booking.status === 'pending' && (
                        <div className="relative">
                          {cancelConfirm === booking.id ? (
                            <div className="absolute left-0 top-full mt-2 bg-slate-800 border border-white/10 rounded-lg p-3 min-w-48 z-10">
                              <p className="text-white/70 text-sm mb-3">هل تريد إلغاء الموعد؟</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCancel(booking.id)}
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-bold transition"
                                >
                                  نعم، ألغِ
                                </button>
                                <button
                                  onClick={() => setCancelConfirm(null)}
                                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 px-3 rounded text-sm font-bold transition"
                                >
                                  لا
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setCancelConfirm(booking.id)}
                              className="p-2 hover:bg-white/10 rounded-lg text-red-400 hover:text-red-300 transition"
                            >
                              <X size={20} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
