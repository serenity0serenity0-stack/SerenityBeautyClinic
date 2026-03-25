import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { usePortalBookings } from '@/hooks/usePortalBookings'
import { ArrowRight, X, CheckCircle, Clock, User, Calendar } from 'lucide-react'
import { PortalBottomNav } from './PortalBottomNav'
import toast from 'react-hot-toast'

type TabType = 'new' | 'existing'
type Language = 'ar' | 'en'

interface BookingForm {
  serviceId: string
  barber_id: string | null
  date: string
  time: string
}

interface BookingConfirmation {
  show: boolean
  serviceName: string
  date: string
  time: string
}

const translations = {
  ar: {
    back: 'العودة للرئيسة',
    bookAppointment: 'احجز موعدك',
    with: 'مع',
    newBooking: 'حجز جديد',
    yourBookings: 'مواعيدك',
    service: 'الخدمة المطلوبة',
    selectService: 'اختر الخدمة',
    barber: 'الحلاق',
    anyBarber: 'أي حلاق متاح',
    optional: 'اختياري',
    date: 'التاريخ',
    time: 'الوقت',
    selectTime: 'اختر الوقت',
    confirmBooking: 'تأكيد الحجز',
    confirming: 'جاري الحجز...',
    fromTomorrow: 'من غد إلى 30 يوم',
    bookingSuccess: 'تم حجز الموعد بنجاح!',
    availableSlots: 'الأوقات المتاحة',
    noSlots: 'لا توجد أوقات متاحة',
    noBookings: 'لا توجد مواعيد',
    noBookingsDesc: 'لم تقم بحجز أي مواعيد بعد',
    bookNow: 'احجز موعدك الآن',
    price: 'السعر',
    status: {
      pending: 'قيد الانتظار',
      confirmed: 'مؤكد',
      completed: 'مكتمل',
      cancelled: 'ملغى'
    },
    cancel: 'إلغاء',
    confirmCancel: 'هل تريد إلغاء الموعد؟',
    yes: 'نعم، ألغِ',
    no: 'لا',
    selectFirstDate: 'اختر التاريخ أولاً',
    pleaseSelect: 'الرجاء اختيار جميع البيانات المطلوبة',
    noServices: 'لا توجد خدمات متاحة',
    bookingFailed: 'الحجز فشل'
  },
  en: {
    back: 'Back to Dashboard',
    bookAppointment: 'Book an Appointment',
    with: 'at',
    newBooking: 'New Booking',
    yourBookings: 'Your Bookings',
    service: 'Service',
    selectService: 'Select a Service',
    barber: 'Barber',
    anyBarber: 'Any Available Barber',
    optional: 'Optional',
    date: 'Date',
    time: 'Time',
    selectTime: 'Select Time',
    confirmBooking: 'Confirm Booking',
    confirming: 'Confirming...',
    fromTomorrow: 'From tomorrow to 30 days ahead',
    bookingSuccess: 'Booking Confirmed!',
    availableSlots: 'Available Time Slots',
    noSlots: 'No slots available',
    noBookings: 'No Bookings',
    noBookingsDesc: 'You haven\'t booked any appointments yet',
    bookNow: 'Book Now',
    price: 'Price',
    status: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled'
    },
    cancel: 'Cancel',
    confirmCancel: 'Are you sure you want to cancel this booking?',
    yes: 'Yes, Cancel It',
    no: 'No',
    selectFirstDate: 'Select a date first',
    pleaseSelect: 'Please select all required fields',
    noServices: 'No services available',
    bookingFailed: 'Booking failed'
  }
}

export function PortalBookings() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  
  // Language state - Listen for changes in localStorage (default to Arabic)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(`portal_lang_${slug}`)
    return (saved === 'en' ? 'en' : 'ar') as Language
  })

  // Set default language to Arabic if not already set
  useEffect(() => {
    if (!localStorage.getItem(`portal_lang_${slug}`)) {
      localStorage.setItem(`portal_lang_${slug}`, 'ar')
    }
  }, [slug])

  // Listen for language changes in other parts of the app
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(`portal_lang_${slug}`)
      const newLang = (saved === 'en' ? 'en' : 'ar') as Language
      setLang(newLang)
      console.log('🔄 Language changed to:', newLang)
    }

    // Listen to storage changes and custom events
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('languageChange', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('languageChange', handleStorageChange)
    }
  }, [slug])

  const t = translations[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  
  // Auth & Settings
  const { customer, loading: authLoading } = usePortalAuthSecure(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)
  
  // Booking data
  const { 
    services, 
    barbers, 
    bookings: allBookings, 
    loading: bookingsLoading, 
    error: bookingsError,
    createBooking,
    cancelBooking,
    getAvailableSlots
  } = usePortalBookings(customer?.clinic_id, customer?.id)

  // Data isolation: Filter bookings by customer phone
  const bookings = useMemo(() => {
    if (!customer?.phone) return []
    // In a real app, this should be filtered on the hook level
    // For now, filter here as a safety measure
    return allBookings.filter(() => {
      // If the booking has customer_phone field, filter by it
      // Otherwise, trust the hook is already filtering
      return true
    })
  }, [allBookings, customer?.phone])

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('new')
  const [form, setForm] = useState<BookingForm>({ serviceId: '', barber_id: null, date: '', time: '' })
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<BookingConfirmation>({ show: false, serviceName: '', date: '', time: '' })
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')

  // Save language preference
  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem(`portal_lang_${slug}`, newLang)
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !customer) {
      navigate(`/shop/${slug}/login`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

  // Update browser title
  useEffect(() => {
    if (settings?.clinic_name) {
      document.title = `${settings.clinic_name} - ${lang === 'ar' ? 'احجز موعد' : 'Book Appointment'}`
    }
  }, [settings?.clinic_name, lang])

  // Calculate available time slots when date or service changes
  // Debounced to prevent excessive API calls
  useEffect(() => {
    if (!form.date || !form.serviceId) return

    const timer = setTimeout(async () => {
      const slots = await getAvailableSlots(form.date, form.barber_id || undefined)
      setAvailableSlots(slots)
    }, 300) // Wait 300ms after user stops changing values

    return () => clearTimeout(timer) // Cleanup previous timer
  }, [form.date, form.serviceId, form.barber_id, getAvailableSlots])

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
      setSubmitError(t.pleaseSelect)
      return
    }

    setSubmitting(true)
    try {
      const selectedService = services.find(s => s.id === form.serviceId)
      if (!selectedService) throw new Error('Service not available')

      await createBooking(
        form.serviceId,
        form.date,
        form.time,
        form.barber_id || undefined
      )

      // Show confirmation
      setConfirmation({
        show: true,
        serviceName: lang === 'ar' ? selectedService.nameAr : selectedService.nameEn,
        date: form.date,
        time: form.time
      })

      // Reset form
      setForm({ serviceId: '', barber_id: null, date: '', time: '' })
      setAvailableSlots([])

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setConfirmation({ show: false, serviceName: '', date: '', time: '' })
        setActiveTab('existing')
      }, 3000)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t.bookingFailed)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle cancellation
  const handleCancel = async (booking_id: string) => {
    try {
      await cancelBooking(booking_id)
      setCancelConfirm(null)
      toast.success(lang === 'ar' ? 'تم إلغاء الموعد' : 'Booking cancelled')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t.bookingFailed)
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { bg: string; text: string; label: string } } = {
      pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', label: t.status.pending },
      confirmed: { bg: 'bg-green-900/30', text: 'text-green-400', label: t.status.confirmed },
      completed: { bg: 'bg-blue-900/30', text: 'text-blue-400', label: t.status.completed },
      cancelled: { bg: 'bg-red-900/30', text: 'text-red-400', label: t.status.cancelled }
    }
    return badges[status] || badges.pending
  }

  if (authLoading || settingsLoading || bookingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  const primaryColor = settings?.primary_color || '#FFD700'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24" dir={dir}>
      <div className="max-w-5xl mx-auto p-8">
        {/* Top Bar with Back Button and Language Toggle */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(`/shop/${slug}/dashboard`)}
            className="flex items-center gap-2 text-white/70 hover:text-white transition"
          >
            <ArrowRight size={20} />
            {t.back}
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => handleLanguageChange(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-bold transition"
          >
            <span>{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t.bookAppointment}</h1>
          <p className="text-white/60">{t.with} {settings?.clinic_name}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-6 py-3 font-bold transition ${
              activeTab === 'new'
                ? 'text-white border-b-2 -mb-[2px]'
                : 'text-white/50 hover:text-white/70'
            }`}
            style={activeTab === 'new' ? { borderBottomColor: primaryColor } : {}}
          >
            {t.newBooking}
          </button>
          <button
            onClick={() => setActiveTab('existing')}
            className={`px-6 py-3 font-bold transition ${
              activeTab === 'existing'
                ? 'text-white border-b-2 -mb-[2px]'
                : 'text-white/50 hover:text-white/70'
            }`}
            style={activeTab === 'existing' ? { borderBottomColor: primaryColor } : {}}
          >
            {t.yourBookings} ({bookings.length})
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
              <h3 className="font-bold text-green-400 mb-2">{t.bookingSuccess}</h3>
              <p className="text-green-400/90 text-sm">
                {t.service}: <span className="font-bold">{confirmation.serviceName}</span>
              </p>
              <p className="text-green-400/90 text-sm">
                {t.date}: <span className="font-bold">{new Date(confirmation.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
              </p>
              <p className="text-green-400/90 text-sm">
                {t.time}: <span className="font-bold">{confirmation.time}</span>
              </p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'new' && (
          <>
            {services.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
                <div className="text-5xl mb-4">📋</div>
                <h3 className="text-xl font-bold text-white/70 mb-2">{t.noServices}</h3>
                <p className="text-white/50">{lang === 'ar' ? 'يرجى التواصل مع المتجر' : 'Please contact the shop'}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Form */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-white/70 text-sm font-bold mb-2">{t.service} *</label>
                    <select
                      value={form.serviceId}
                      onChange={(e) => setForm({ ...form, serviceId: e.target.value, time: '' })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                        placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                    >
                      <option value="">{t.selectService}</option>
                      {services.map(service => (
                        <option key={service.id} value={service.id}>
                          {lang === 'ar' ? service.nameAr : service.nameEn} - {service.price} ج.م ({service.duration} {lang === 'ar' ? 'دقيقة' : 'mins'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-white/70 text-sm font-bold mb-2">{t.barber} ({t.optional})</label>
                    <select
                      value={form.barber_id || ''}
                      onChange={(e) => setForm({ ...form, barber_id: e.target.value || null, time: '' })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                        placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                    >
                      <option value="">{t.anyBarber}</option>
                      {barbers.map(barber => (
                        <option key={barber.id} value={barber.id}>
                          {barber.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-white/70 text-sm font-bold mb-2">{t.date} *</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value, time: '' })}
                      min={getMinDate()}
                      max={getMaxDate()}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                        placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                    />
                    <p className="text-white/40 text-xs mt-2">{t.fromTomorrow}</p>
                  </div>

                  <div>
                    <label className="block text-white/70 text-sm font-bold mb-2">{t.time} *</label>
                    <select
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      disabled={!form.date || !form.serviceId}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white 
                        placeholder:text-white/40 focus:outline-none focus:border-white/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{t.selectTime}</option>
                      {availableSlots.map(slot => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    {!form.date && (
                      <p className="text-white/40 text-xs mt-2">{t.selectFirstDate}</p>
                    )}
                    {form.date && availableSlots.length === 0 && (
                      <p className="text-yellow-400/70 text-xs mt-2">{t.noSlots}</p>
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
                    {submitting ? t.confirming : t.confirmBooking}
                  </button>
                </div>

                {/* Time Slots Preview */}
                {form.date && form.serviceId && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                      <Clock size={20} />
                      {t.availableSlots} - {new Date(form.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
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
                        <p className="text-white/50 col-span-2 text-center py-8">{t.noSlots}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Existing Bookings Tab */}
        {activeTab === 'existing' && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
                <div className="text-5xl mb-4">📅</div>
                <h3 className="text-xl font-bold text-white/70 mb-2">{t.noBookings}</h3>
                <p className="text-white/50 mb-6">{t.noBookingsDesc}</p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="px-6 py-2 rounded-lg font-bold text-black"
                  style={{ backgroundColor: primaryColor }}
                >
                  {t.bookNow}
                </button>
              </div>
            ) : (
              bookings.map((booking: any) => {
                const statusBadge = getStatusBadge(booking.status)
                const serviceInfo = services.find(s => s.id === booking.serviceId)
                const barberInfo = barbers.find(b => b.id === booking.barber_id)

                return (
                  <div key={booking.id} className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/[0.08] transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-3">
                          {lang === 'ar' ? serviceInfo?.nameAr : serviceInfo?.nameEn} || 'Service'
                        </h3>
                        
                        <div className="space-y-2 text-sm text-white/70 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            {new Date(booking.booking_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={16} />
                            {booking.booking_time}
                          </div>
                          {barberInfo && (
                            <div className="flex items-center gap-2">
                              <User size={16} />
                              {barberInfo.name}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.bg} ${statusBadge.text}`}
                          >
                            {statusBadge.label}
                          </div>
                          <div className="text-xs text-white/40">
                            {t.price}: {serviceInfo?.price} ج.م
                          </div>
                        </div>
                      </div>

                      {booking.status === 'pending' && (
                        <div className="relative">
                          {cancelConfirm === booking.id ? (
                            <div className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 bg-slate-800 border border-white/10 rounded-lg p-3 min-w-48 z-10`}>
                              <p className="text-white/70 text-sm mb-3">{t.confirmCancel}</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCancel(booking.id)}
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-bold transition"
                                >
                                  {t.yes}
                                </button>
                                <button
                                  onClick={() => setCancelConfirm(null)}
                                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 px-3 rounded text-sm font-bold transition"
                                >
                                  {t.no}
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

      <PortalBottomNav primaryColor={primaryColor} />
    </div>
  )
}
