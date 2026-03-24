import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'

type Language = 'ar' | 'en'

const translations = {
  ar: {
    loading: 'جاري التحميل...',
    error: 'حدث خطأ',
    unknownError: 'خطأ غير معروف',
    tryAgain: 'إعادة المحاولة',
    portalInactive: 'هذه البوابة غير نشطة حالياً',
    contactAdmin: 'يرجى التواصل مع مدير المحل',
    welcome: 'مرحباً',
    defaultWelcome: 'أهلاً وسهلاً وأنت معنا',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب جديد'
  },
  en: {
    loading: 'Loading...',
    error: 'Error',
    unknownError: 'Unknown error',
    tryAgain: 'Try Again',
    portalInactive: 'This portal is currently inactive',
    contactAdmin: 'Please contact the shop manager',
    welcome: 'Welcome',
    defaultWelcome: 'Welcome to us',
    login: 'Sign In',
    register: 'Create Account'
  }
}

const animationStyles = `
  @keyframes float-particle {
    0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.5; }
    25% { transform: translateY(-30px) translateX(15px); opacity: 0.8; }
    50% { transform: translateY(-60px) translateX(-20px); opacity: 0.3; }
    75% { transform: translateY(-30px) translateX(30px); opacity: 0.6; }
  }

  .float-particle {
    animation: float-particle 6s ease-in-out infinite;
  }
`

export function PortalLanding() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // Language state (default to Arabic)
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

  const t = translations[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const { settings, loading, error } = usePortalSettingsWithShop(slug)

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem(`portal_lang_${slug}`, newLang)
  }

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - ${t.welcome}`
    }
  }, [settings?.shop_name, lang, t])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">{t.loading}</p>
        </div>
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center" dir={dir}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || t.unknownError}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-gold-400 text-black rounded hover:bg-gold-500 transition"
          >
            {t.tryAgain}
          </button>
        </div>
      </div>
    )
  }

  // Check if portal is inactive
  if (settings.is_active === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center" dir={dir}>
        <div className="text-center">
          <p className="text-3xl text-red-400 font-bold">
            {t.portalInactive}
          </p>
          <p className="text-gray-400 mt-4">{t.contactAdmin}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundColor: "#0A0F1E",
        background: `radial-gradient(ellipse at center, #0A0F1E 0%, #000 100%)`,
      }}
      dir={dir}
    >
      <style>{animationStyles}</style>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute float-particle"
            style={{
              width: Math.random() * 100 + 50 + "px",
              height: Math.random() * 100 + 50 + "px",
              borderRadius: "50%",
              backgroundColor: "#D4AF37",
              opacity: 0.05,
              right: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              animationDelay: Math.random() * 2 + "s",
            }}
          />
        ))}
      </div>

      {/* Unified Glassmorphism Card */}
      <div className="w-full max-w-[420px] relative z-10">
        <div
          className="rounded-3xl"
          style={{
            backdropFilter: "blur(20px)",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "40px",
            boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)"
          }}
        >
          {/* Scissors Icon */}
          <div className="text-center mb-6">
            <div
              style={{
                fontSize: "48px",
                color: "#D4AF37",
                marginBottom: "16px"
              }}
            >
              ✂️
            </div>
          </div>

          {/* Shop Name */}
          <h1
            className="text-center font-bold mb-4"
            style={{
              fontSize: "2rem",
              color: "#D4AF37",
              fontFamily: "Cairo, sans-serif",
              fontWeight: 700
            }}
          >
            {settings.shop_name}
          </h1>

          {/* Welcome Message */}
          <p
            className="text-center mb-6"
            style={{
              fontSize: "0.9rem",
              color: "rgba(255, 255, 255, 0.6)",
              lineHeight: "1.5"
            }}
          >
            {settings.welcome_message || t.defaultWelcome}
          </p>

          {/* Divider */}
          <div
            style={{
              height: "1px",
              background: "rgba(255, 255, 255, 0.1)",
              marginBottom: "24px"
            }}
          />

          {/* Buttons */}
          <div className="space-y-3">
            {/* Login Button */}
            <button
              onClick={() => navigate(`/shop/${slug}/login`)}
              className="w-full transition hover:shadow-lg hover:scale-105 font-cairo"
              style={{
                backgroundColor: "#D4AF37",
                color: "#000",
                borderRadius: "12px",
                padding: "14px",
                fontSize: "1rem",
                fontFamily: "Cairo, sans-serif",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "all 0.3s ease"
              }}
            >
              {t.login}
            </button>

            {/* Register Button */}
            <button
              onClick={() => navigate(`/shop/${slug}/register`)}
              className="w-full transition hover:shadow-lg hover:scale-105 font-cairo"
              style={{
                backgroundColor: "transparent",
                color: "#D4AF37",
                border: "2px solid #D4AF37",
                borderRadius: "12px",
                padding: "14px",
                fontSize: "1rem",
                fontFamily: "Cairo, sans-serif",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.1)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              {t.register}
            </button>
          </div>

          {/* Language Toggle */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => handleLanguageChange(lang === 'ar' ? 'en' : 'ar')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-white text-xs font-bold transition"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
