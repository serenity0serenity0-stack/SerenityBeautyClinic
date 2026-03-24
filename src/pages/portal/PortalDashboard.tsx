import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { usePortalDashboardStats } from '@/hooks/usePortalDashboardStats'
import { LogOut, Calendar, TrendingUp, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export function PortalDashboard() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // Auth & Settings - use lazy initialization with localStorage
  const { customer, loading: authLoading, logoutPortalUser } = usePortalAuthSecure(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  // Stats
  const { stats, loading: statsLoading } = usePortalDashboardStats(customer?.shop_id, customer?.id)

  const [loggingOut, setLoggingOut] = useState(false)

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - حسابي`
    }
  }, [settings?.shop_name])

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
      toast.success('تم تسجيل الخروج بنجاح')
      navigate(`/shop/${slug}`, { replace: true })
    } catch (err) {
      toast.error('خطأ في تسجيل الخروج')
      setLoggingOut(false)
    }
  }

  if (authLoading || settingsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return null
  }

  const primaryColor = settings?.primary_color || '#FFD700'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">مرحباً {customer.name || customer.phone}</h1>
            {settings && <p className="text-white/70 text-lg">{settings.shop_name}</p>}
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded hover:bg-red-500/30 transition disabled:opacity-50"
          >
            <LogOut size={18} />
            {loggingOut ? 'جاري...' : 'خروج'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white/70 text-sm mb-2">إجمالي الزيارات</div>
                <div className="text-3xl font-bold text-white">{stats.totalVisits}</div>
                <p className="text-white/40 text-xs mt-2">
                  {stats.lastVisit ? `آخر زيارة: ${new Date(stats.lastVisit).toLocaleDateString('ar-EG')}` : 'لا توجد زيارات بعد'}
                </p>
              </div>
              <TrendingUp size={24} className="text-white/30" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white/70 text-sm mb-2">إجمالي الإنفاق</div>
                <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {stats.totalSpent}ج
                </div>
                <p className="text-white/40 text-xs mt-2">متوسط: {stats.totalVisits > 0 ? (stats.totalSpent / stats.totalVisits).toFixed(0) : 0}ج</p>
              </div>
              <TrendingUp size={24} className="text-white/30" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white/70 text-sm mb-2">المواعيد القادمة</div>
                <div className="text-3xl font-bold text-white">{stats.upcomingBookingsCount}</div>
                <p className="text-white/40 text-xs mt-2">مواعيد معلقة</p>
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
                <div className="text-white/70 text-sm mb-2">احجز موعد</div>
                <div className="text-2xl font-bold text-white">جديد</div>
                <p className="text-white/40 text-xs mt-2">اضغط للحجز الآن</p>
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
              موعدك القادم
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <div className="text-green-400/70 text-sm mb-1">التاريخ</div>
                <div className="text-xl font-bold text-white">
                  {new Date(stats.nextBooking.bookingDate).toLocaleDateString('ar-EG')}
                </div>
              </div>
              <div>
                <div className="text-green-400/70 text-sm mb-1">الوقت</div>
                <div className="text-xl font-bold text-white" dir="ltr">
                  {stats.nextBooking.bookingTime}
                </div>
              </div>
              <div>
                <div className="text-green-400/70 text-sm mb-1">الخدمة</div>
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
            <h3 className="font-bold mb-2 text-lg text-white">احجز موعد</h3>
            <p className="text-sm text-white/70">احجز الآن</p>
          </button>

          <button
            onClick={() => navigate(`/shop/${slug}/history`)}
            className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-6 hover:border-green-500/60 transition transform hover:scale-105"
          >
            <div className="text-5xl mb-3">📊</div>
            <h3 className="font-bold mb-2 text-lg text-white">السجل</h3>
            <p className="text-sm text-white/70">مواعيدك السابقة</p>
          </button>

          <button
            onClick={() => navigate(`/shop/${slug}/profile`)}
            className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg p-6 hover:border-purple-500/60 transition transform hover:scale-105"
          >
            <div className="text-5xl mb-3">👤</div>
            <h3 className="font-bold mb-2 text-lg text-white">البيانات</h3>
            <p className="text-sm text-white/70">معلوماتك الشخصية</p>
          </button>
        </div>

        {/* Welcome Section */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4 text-white">مرحباً بك في {settings?.shop_name}</h2>
          <p className="text-white/70 mb-6">{settings?.welcome_message || 'نسعد بخدمتك'}</p>
        </div>
      </div>
    </div>
  )
}
