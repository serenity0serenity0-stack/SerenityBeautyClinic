import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { usePortalDashboardStats } from '@/hooks/usePortalDashboardStats'
import { LogOut, Calendar, TrendingUp, Clock } from 'lucide-react'
import { PortalBottomNav } from './PortalBottomNav'
import toast from 'react-hot-toast'

type Language = 'ar' | 'en'

const translations = {
  ar: {
    myAccount: 'حسابي',
    logoutSuccess: 'تم تسجيل الخروج بنجاح',
    logoutError: 'خطأ في تسجيل الخروج',
    loading: 'جاري التحميل...',
    welcome: 'مرحباً',
    total_visits: 'إجمالي الزيارات',
    noVisitsYet: 'لا توجد زيارات بعد',
    total_spent: 'إجمالي الإنفاق',
    average: 'متوسط',
    upcomingAppointments: 'المواعيد القادمة',
    pendingAppointments: 'مواعيد معلقة',
    bookAppointment: 'احجز موعد',
    new: 'جديد',
    clickToBookNow: 'اضغط للحجز الآن',
    yourNextAppointment: 'موعدك القادم',
    date: 'التاريخ',
    time: 'الوقت',
    service: 'الخدمة',
    history: 'السجل',
    yourPreviousAppointments: 'مواعيدك السابقة',
    profile: 'البيانات',
    yourPersonalInfo: 'معلوماتك الشخصية',
    welcomeTo: 'مرحباً بك في',
    delightedToServe: 'نسعد بخدمتك',
    loggingOut: 'جاري...',
    logout: 'خروج'
  },
  en: {
    myAccount: 'My Account',
    logoutSuccess: 'Logged out successfully',
    logoutError: 'Error logging out',
    loading: 'Loading...',
    welcome: 'Welcome',
    total_visits: 'Total Visits',
    noVisitsYet: 'No visits yet',
    total_spent: 'Total Spent',
    average: 'Average',
    upcomingAppointments: 'Upcoming Appointments',
    pendingAppointments: 'Pending Appointments',
    bookAppointment: 'Book Appointment',
    new: 'New',
    clickToBookNow: 'Click to book now',
    yourNextAppointment: 'Your Next Appointment',
    date: 'Date',
    time: 'Time',
    service: 'Service',
    history: 'History',
    yourPreviousAppointments: 'Your Previous Appointments',
    profile: 'Profile',
    yourPersonalInfo: 'Your Personal Information',
    welcomeTo: 'Welcome to',
    delightedToServe: 'We\'re delighted to serve you',
    loggingOut: 'Loading...',
    logout: 'Logout'
  }
}

export function PortalDashboard() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // Language state - Listen for changes in localStorage (default to Arabic)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(`portal_lang_${slug}`)
    // Default to 'ar' (Arabic) if not explicitly set to 'en'
    return (saved === 'en' ? 'en' : 'ar') as Language
  })

  // Set default language to Arabic if not already set
  useEffect(() => {
    if (!localStorage.getItem(`portal_lang_${slug}`)) {
      localStorage.setItem(`portal_lang_${slug}`, 'ar')
    }
  }, [slug])

  // Listen for language changes from toggle button
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(`portal_lang_${slug}`)
      const newLang = (saved === 'en' ? 'en' : 'ar') as Language
      setLang(newLang)
      console.log('🔄 Dashboard language changed to:', newLang)
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

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem(`portal_lang_${slug}`, newLang)
  }

  // Auth & Settings - use lazy initialization with localStorage
  const { customer, loading: authLoading, logoutPortalUser } = usePortalAuthSecure(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  // Stats
  const { stats, loading: statsLoading } = usePortalDashboardStats(customer?.shop_id, customer?.id, slug)

  const [loggingOut, setLoggingOut] = useState(false)

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - ${t.myAccount}`
    }
  }, [settings?.shop_name, lang, t])

  // Redirect to login if not authenticated (only after initial load)
  useEffect(() => {
    if (!authLoading && !customer) {
      navigate(`/shop/${slug}/login`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logoutPortalUser()
      toast.success(t.logoutSuccess)
      navigate(`/shop/${slug}`, { replace: true })
    } catch (err) {
      toast.error(t.logoutError)
      setLoggingOut(false)
    }
  }

  if (authLoading || settingsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">{t.loading}</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return null
  }

  const primaryColor = settings?.primary_color || '#FFD700'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24" dir={dir}>
      <div className="max-w-5xl mx-auto p-8">
        {/* Header with language toggle and logout */}
        <div className="flex justify-between items-center mb-8">
          {/* Language Toggle */}
          <button
            onClick={() => handleLanguageChange(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-bold transition"
          >
            <span>{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded hover:bg-red-500/30 transition disabled:opacity-50"
          >
            <LogOut size={18} />
            {loggingOut ? t.loggingOut : t.logout}
          </button>
        </div>

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t.welcome} {customer.name || customer.phone}</h1>
          {settings && <p className="text-white/70 text-lg">{settings.shop_name}</p>}
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white/70 text-sm mb-2">{t.total_visits}</div>
                <div className="text-3xl font-bold text-white">{stats.total_visits}</div>
                <p className="text-white/40 text-xs mt-2">
                  {stats.last_visit ? `${lang === 'ar' ? 'آخر زيارة' : 'Last visit'}: ${new Date(stats.last_visit).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}` : t.noVisitsYet}
                </p>
              </div>
              <TrendingUp size={24} className="text-white/30" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white/70 text-sm mb-2">{t.total_spent}</div>
                <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {stats.total_spent}ج
                </div>
                <p className="text-white/40 text-xs mt-2">{t.average}: {stats.total_visits > 0 ? (stats.total_spent / stats.total_visits).toFixed(0) : 0}ج</p>
              </div>
              <TrendingUp size={24} className="text-white/30" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white/70 text-sm mb-2">{t.upcomingAppointments}</div>
                <div className="text-3xl font-bold text-white">{stats.upcomingBookingsCount}</div>
                <p className="text-white/40 text-xs mt-2">{t.pendingAppointments}</p>
              </div>
              <Calendar size={24} className="text-white/30" />
            </div>
          </div>

          <div 
            className="rounded-lg p-6 hover:opacity-80 transition cursor-pointer border-2"
            style={{ 
              backgroundColor: `${primaryColor}20`,
              borderColor: primaryColor 
            }}
            onClick={() => navigate(`/shop/${slug}/bookings`)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white/70 text-sm mb-2">{t.bookAppointment}</div>
                <div className="text-2xl font-bold text-white">{t.new}</div>
                <p className="text-white/40 text-xs mt-2">{t.clickToBookNow}</p>
              </div>
              <Clock size={24} className="text-white/30" />
            </div>
          </div>
        </div>

        {/* Next Booking Card */}
        {stats.nextBooking && (
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={20} />
              {t.yourNextAppointment}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <div className="text-green-400/70 text-sm mb-1">{t.date}</div>
                <div className="text-xl font-bold text-white">
                  {new Date(stats.nextBooking.booking_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                </div>
              </div>
              <div>
                <div className="text-green-400/70 text-sm mb-1">{t.time}</div>
                <div className="text-xl font-bold text-white" dir="ltr">
                  {stats.nextBooking.booking_time}
                </div>
              </div>
              <div>
                <div className="text-green-400/70 text-sm mb-1">{t.service}</div>
                <div className="text-xl font-bold text-white">
                  {stats.nextBooking.serviceName}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => navigate(`/shop/${slug}/bookings`)}
            className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg p-6 hover:border-blue-500/60 transition transform hover:scale-105"
          >
            <div className="text-5xl mb-3">📅</div>
            <h3 className="font-bold mb-2 text-lg text-white">{t.bookAppointment}</h3>
            <p className="text-sm text-white/70">{t.clickToBookNow}</p>
          </button>

          <button
            onClick={() => navigate(`/shop/${slug}/history`)}
            className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-6 hover:border-green-500/60 transition transform hover:scale-105"
          >
            <div className="text-5xl mb-3">📊</div>
            <h3 className="font-bold mb-2 text-lg text-white">{t.history}</h3>
            <p className="text-sm text-white/70">{t.yourPreviousAppointments}</p>
          </button>

          <button
            onClick={() => navigate(`/shop/${slug}/profile`)}
            className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg p-6 hover:border-purple-500/60 transition transform hover:scale-105"
          >
            <div className="text-5xl mb-3">👤</div>
            <h3 className="font-bold mb-2 text-lg text-white">{t.profile}</h3>
            <p className="text-sm text-white/70">{t.yourPersonalInfo}</p>
          </button>
        </div>

        {/* Welcome Section */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4 text-white">{t.welcomeTo} {settings?.shop_name}</h2>
          <p className="text-white/70 mb-6">{settings?.welcome_message || t.delightedToServe}</p>
        </div>
      </div>

      <PortalBottomNav primaryColor={primaryColor} />
    </div>
  )
}
