import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'

/**
 * Template 1: Modern Minimalist
 * Clean, spacious, light background, sans-serif
 */
function Template1({ settings, slug, navigate }: any) {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <div
            className="text-5xl font-light mb-4"
            style={{ color: settings.primary_color }}
          >
            {settings.shop_name}
          </div>
          <p className="text-lg text-gray-600">
            {settings.welcome_message || 'احجز موعدك الآن'}
          </p>
        </div>

        <div className="space-y-4 mb-12">
          <button
            onClick={() => navigate(`/shop/${slug}/login`)}
            className="w-full py-4 rounded text-white text-lg transition hover:shadow-lg"
            style={{ backgroundColor: settings.primary_color }}
          >
            دخول
          </button>
          <button
            onClick={() => navigate(`/shop/${slug}/register`)}
            className="w-full py-4 rounded border-2 text-lg transition hover:shadow-lg"
            style={{
              borderColor: settings.primary_color,
              color: settings.primary_color,
            }}
          >
            إنشاء حساب جديد
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 text-center text-sm text-gray-500">
          <p>✓ احجز مواعيدك بسهولة</p>
          <p>✓ تواصل مع المحل مباشرة</p>
          <p>✓ احصل على التذكيرات</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Template 2: Luxury Premium
 * Gold accents, serif font, elegant spacing
 */
function Template2({ settings, slug, navigate }: any) {
  return (
    <div className="min-h-screen bg-gray-900 text-white" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div
          className="h-20 w-20 rounded-full mx-auto mb-8"
          style={{ backgroundColor: settings.primary_color }}
        />

        <div className="text-center mb-16">
          <h1 className="text-5xl font-serif mb-4" style={{ color: settings.primary_color }}>
            {settings.shop_name}
          </h1>
          <div className="h-1 w-12 mx-auto mb-6" style={{ backgroundColor: settings.secondary_color }} />
          <p className="text-lg text-gray-400">
            {settings.welcome_message || 'تجربة فاخرة في الحجز الإلكتروني'}
          </p>
        </div>

        <div className="space-y-4 mb-16">
          <button
            onClick={() => navigate(`/shop/${slug}/login`)}
            className="w-full py-4 px-8 text-lg font-serif transition hover:opacity-90"
            style={{
              backgroundColor: settings.primary_color,
              color: '#000',
              border: `2px solid ${settings.primary_color}`,
            }}
          >
            دخول
          </button>
          <button
            onClick={() => navigate(`/shop/${slug}/register`)}
            className="w-full py-4 px-8 text-lg font-serif transition"
            style={{
              borderBottom: `2px solid ${settings.primary_color}`,
            }}
          >
            تسجيل جديد
          </button>
        </div>

        <div className="text-center space-y-3 text-sm text-gray-500">
          <p>★★★★★</p>
          <p>تجربة حجز فريدة</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Template 3: Playful & Fun
 * Bright colors, rounded elements, emoji icons
 */
function Template3({ settings, slug, navigate }: any) {
  return (
    <div
      className="min-h-screen text-white"
      dir="rtl"
      style={{
        background: `linear-gradient(135deg, ${settings.primary_color} 0%, ${settings.secondary_color} 100%)`,
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">✨</div>
          <h1 className="text-5xl font-bold mb-2">{settings.shop_name}</h1>
          <p className="text-lg opacity-90">
            {settings.welcome_message || 'احجز بطريقة مرحة وسهلة!'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => navigate(`/shop/${slug}/login`)}
            className="p-6 rounded-3xl bg-white/20 backdrop-blur border-2 border-white/30 hover:bg-white/30 transition transform hover:scale-105 text-center"
          >
            <div className="text-4xl mb-2">👋</div>
            <h2 className="text-xl font-bold">مرحباً بك!</h2>
            <p className="text-sm opacity-85">دخول الحساب</p>
          </button>

          <button
            onClick={() => navigate(`/shop/${slug}/register`)}
            className="p-6 rounded-3xl bg-white/20 backdrop-blur border-2 border-white/30 hover:bg-white/30 transition transform hover:scale-105 text-center"
          >
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-xl font-bold">جديد؟</h2>
            <p className="text-sm opacity-85">انضم الآن</p>
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm">📅 احجز موعدك</p>
          <p className="text-sm">💬 تواصل معنا</p>
          <p className="text-sm">🎁 احصل على عروض</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Template 4: Professional Corporate
 * Grid layout, structured, formal
 */
function Template4({ settings, slug, navigate }: any) {
  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      <div
        className="py-12 text-white"
        style={{ backgroundColor: settings.primary_color }}
      >
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-2">{settings.shop_name}</h1>
          <p className="text-lg opacity-90">نظام الحجز الإلكتروني</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="border-l-4" style={{ borderColor: settings.primary_color }}>
            <h3 className="text-xl font-bold mb-4 mr-4">المميزات</h3>
            <ul className="space-y-2 mr-4 text-gray-700 text-sm">
              <li>✓ حجز مواعيد سهل وسريع</li>
              <li>✓ تذكيرات تلقائية</li>
              <li>✓ إدارة سجل المواعيد</li>
              <li>✓ دعم عملاء متخصص</li>
            </ul>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => navigate(`/shop/${slug}/login`)}
              className="w-full py-4 font-bold text-lg text-white rounded transition hover:shadow-lg"
              style={{ backgroundColor: settings.primary_color }}
            >
              دخول الحساب
            </button>
            <button
              onClick={() => navigate(`/shop/${slug}/register`)}
              className="w-full py-4 font-bold text-lg rounded border-2 transition hover:shadow-lg"
              style={{
                borderColor: settings.primary_color,
                color: settings.primary_color,
              }}
            >
              إنشاء حساب جديد
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Template 5: Dark Modern Tech
 * High contrast, geometric, tech-forward
 */
function Template5({ settings, slug, navigate }: any) {
  return (
    <div className="min-h-screen bg-slate-950 text-white" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-24">
        {/* Geometric header */}
        <div className="mb-16">
          <div className="flex items-end gap-3 mb-6">
            <div
              className="w-16 h-16 rounded-lg"
              style={{ backgroundColor: settings.primary_color }}
            />
            <div
              className="w-12 h-12 rounded-lg"
              style={{ backgroundColor: settings.secondary_color }}
            />
            <div
              className="w-8 h-8 rounded-lg"
              style={{ backgroundColor: settings.accent_color }}
            />
          </div>
          <h1 className="text-5xl font-bold mb-2">{settings.shop_name}</h1>
          <p className="text-gray-400">{settings.welcome_message || 'Platform.Next'}</p>
        </div>

        {/* Call to action */}
        <div className="space-y-4 mb-12">
          <button
            onClick={() => navigate(`/shop/${slug}/login`)}
            className="w-full group relative overflow-hidden rounded text-white font-bold py-4 transition"
            style={{ backgroundColor: settings.primary_color }}
          >
            <span className="relative z-10">تسجيل الدخول</span>
            <div className="absolute inset-0 bg-white/20 -z-0 opacity-0 group-hover:opacity-100 transition" />
          </button>

          <button
            onClick={() => navigate(`/shop/${slug}/register`)}
            className="w-full py-4 rounded border border-gray-600 font-bold transition hover:border-white hover:bg-white/5"
          >
            حساب جديد
          </button>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
          <div className="border border-gray-700 rounded p-3">
            <div className="text-lg mb-2">⚡</div>
            <p>سريع</p>
          </div>
          <div className="border border-gray-700 rounded p-3">
            <div className="text-lg mb-2">🔒</div>
            <p>آمن</p>
          </div>
          <div className="border border-gray-700 rounded p-3">
            <div className="text-lg mb-2">🎯</div>
            <p>سهل</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PortalLanding() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { settings, loading, error } = usePortalSettingsWithShop(slug)

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - احجز الآن`
    }
  }, [settings?.shop_name])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'البوربتال غير موجود'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-gold-400 text-black rounded hover:bg-gold-500 transition"
          >
            العودة للرئيسة
          </button>
        </div>
      </div>
    )
  }

  // Check if portal is inactive
  if (settings.is_active === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 text-white">قريباً</h1>
          <p className="text-xl text-gray-400 mb-8">{settings.shop_name}</p>
          <p className="text-gray-500">سيعود البوربتال قريباً</p>
        </div>
      </div>
    )
  }

  // Render based on template_id
  const templateProps = { settings, slug, navigate }

  switch (settings.template_id) {
    case 1:
      return <Template1 {...templateProps} />
    case 2:
      return <Template2 {...templateProps} />
    case 3:
      return <Template3 {...templateProps} />
    case 4:
      return <Template4 {...templateProps} />
    case 5:
      return <Template5 {...templateProps} />
    default:
      return <Template1 {...templateProps} />
  }
}
