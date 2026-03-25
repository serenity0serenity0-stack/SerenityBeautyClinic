import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

type Language = 'ar' | 'en'

const translations = {
  ar: {
    register: 'إنشاء حساب',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    birthDate: 'تاريخ الميلاد',
    birthDateOptional: 'تاريخ الميلاد (اختياري)',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    createAccount: 'إنشاء الحساب',
    creatingAccount: 'جاري الإنشاء...',
    alreadyHaveAccount: 'لديك حساب بالفعل؟',
    login: 'سجل دخول',
    loading: 'جاري التحميل...',
    portalUnavailable: 'البوربتال غير متاح',
    back: 'العودة',
    newCreateAccount: 'إنشاء حساب جديد',
    errorShopNotSpecified: 'خطأ: عيادة غير محددة',
    errorPortalNotAvailable: 'البوربتال غير متاح الآن',
    errorEnterFullName: 'الرجاء إدخال الاسم الكامل',
    errorInvalidEmail: 'البريد الإلكتروني غير صحيح',
    errorInvalidPhone: 'رقم الهاتف يجب أن يحتوي على 10 أرقام على الأقل',
    errorPasswordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    errorPasswordMismatch: 'كلمات المرور غير متطابقة',
    successAccountCreated: 'تم إنشاء الحساب بنجاح!',
    errorRegistration: 'خطأ في التسجيل',
    required: '(مطلوب)',
    optional: '(اختياري)'
  },
  en: {
    register: 'Register',
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone Number',
    birthDate: 'Birth Date',
    birthDateOptional: 'Birth Date (Optional)',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    createAccount: 'Create Account',
    creatingAccount: 'Creating...',
    alreadyHaveAccount: 'Already have an account?',
    login: 'Sign in',
    loading: 'Loading...',
    portalUnavailable: 'Portal Unavailable',
    back: 'Back',
    newCreateAccount: 'Create New Account',
    errorShopNotSpecified: 'Error: Shop not specified',
    errorPortalNotAvailable: 'Portal not available now',
    errorEnterFullName: 'Please enter full name',
    errorInvalidEmail: 'Invalid email address',
    errorInvalidPhone: 'Phone number must be at least 10 digits',
    errorPasswordTooShort: 'Password must be at least 6 characters',
    errorPasswordMismatch: 'Passwords do not match',
    successAccountCreated: 'Account created successfully!',
    errorRegistration: 'Registration error',
    required: '(Required)',
    optional: '(Optional)'
  }
}

export function PortalRegister() {
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

  const { customer, loading: authLoading, signUp } = usePortalAuth(slug || '')
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    birthDate: '',
  })

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!authLoading && customer) {
      navigate(`/shop/${slug}/dashboard`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

  // Update browser title
  useEffect(() => {
    if (settings?.clinic_name) {
      document.title = `${settings.clinic_name} - ${t.register}`
    }
  }, [settings?.clinic_name, lang, t])

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem(`portal_lang_${slug}`, newLang)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!slug) {
        toast.error(t.errorShopNotSpecified)
        return
      }

      if (!settings) {
        toast.error(t.errorPortalNotAvailable)
        return
      }

      // Validation
      if (!formData.fullName.trim()) {
        toast.error(t.errorEnterFullName)
        return
      }

      if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        toast.error(t.errorInvalidEmail)
        return
      }

      if (!formData.phone.match(/^[0-9]{10,}$/)) {
        toast.error(t.errorInvalidPhone)
        return
      }

      if (formData.password.length < 6) {
        toast.error(t.errorPasswordTooShort)
        return
      }

      if (formData.password !== formData.confirmPassword) {
        toast.error(t.errorPasswordMismatch)
        return
      }

      // Call signUp
      const { error } = await signUp(
        formData.fullName,
        formData.email,
        formData.phone,
        formData.password,
        formData.birthDate,
        settings.clinic_id
      )

      if (error) {
        toast.error(error)
        return
      }

      // If successful, auto-login and redirect to dashboard
      toast.success(t.successAccountCreated)
      
      // Give it a moment for the state to update
      setTimeout(() => {
        navigate(`/shop/${slug}/dashboard`, { replace: true })
      }, 500)
    } catch (err: any) {
      console.error('Registration error:', err)
      toast.error(err.message || t.errorRegistration)
    } finally {
      setLoading(false)
    }
  }

  if (settingsLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">{t.loading}</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center" dir={dir}>
        <div className="text-center">
          <p className="text-red-400">{t.portalUnavailable}</p>
          <button
            onClick={() => navigate(`/shop/${slug}`)}
            className="mt-4 px-6 py-2 bg-gold-400 text-black rounded hover:bg-gold-500 transition"
          >
            {t.back}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-8"
      style={{
        background: `linear-gradient(135deg, ${settings.primary_color}20 0%, ${settings.secondary_color}20 100%)`,
      }}
      dir={dir}
    >
      <div className="w-full max-w-md">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-8">
          <div className="text-center mb-8">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: settings.primary_color }}
            >
              {settings.clinic_name}
            </h1>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <p className="text-white/70">{t.newCreateAccount}</p>
              <button
                onClick={() => handleLanguageChange(lang === 'ar' ? 'en' : 'ar')}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white text-xs font-bold transition"
              >
                {lang === 'ar' ? 'EN' : 'ع'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                {t.fullName} {t.required}
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition"
                placeholder={lang === 'ar' ? 'أحمد محمد' : 'John Doe'}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                {t.email} {t.required}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition"
                placeholder="your@email.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                {t.phone} {t.required}
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition"
                placeholder="20101234567"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                {t.birthDateOptional}
              </label>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                {t.password} {t.required}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition pr-10"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-white/50 hover:text-white/70 transition"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                {t.confirmPassword} {t.required}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition pr-10"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-3 text-white/50 hover:text-white/70 transition"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded font-semibold text-white transition hover:shadow-lg disabled:opacity-50"
              style={{ backgroundColor: settings.primary_color }}
            >
              {loading ? t.creatingAccount : t.createAccount}
            </button>
          </form>

          <div className="mt-6 text-center pt-4 border-t border-white/10">
            <p className="text-white/70 text-sm">
              {t.alreadyHaveAccount}{' '}
              <button
                onClick={() => navigate(`/shop/${slug}/login`)}
                className="transition hover:opacity-70 font-semibold"
                style={{ color: settings.primary_color }}
              >
                {t.login}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
