import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export function PortalRegister() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { signUp } = usePortalAuth(slug)
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

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - إنشاء حساب`
    }
  }, [settings?.shop_name])

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
        toast.error('خطأ: محل غير محدد')
        return
      }

      if (!settings) {
        toast.error('البوربتال غير متاح الآن')
        return
      }

      // Validation
      if (!formData.fullName.trim()) {
        toast.error('الرجاء إدخال الاسم الكامل')
        return
      }

      if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        toast.error('البريد الإلكتروني غير صحيح')
        return
      }

      if (!formData.phone.match(/^[0-9]{10,}$/)) {
        toast.error('رقم الهاتف يجب أن يحتوي على 10 أرقام على الأقل')
        return
      }

      if (formData.password.length < 6) {
        toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
        return
      }

      if (formData.password !== formData.confirmPassword) {
        toast.error('كلمات المرور غير متطابقة')
        return
      }

      // Call signUp
      await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        formData.phone,
        formData.birthDate,
        settings.shop_id
      )

      // If successful, auto-login and redirect to dashboard
      toast.success('تم إنشاء الحساب بنجاح! جاري تسجيل الدخول...')
      
      // Give it a moment for auto-login
      setTimeout(() => {
        navigate(`/shop/${slug}/dashboard`, { replace: true })
      }, 1000)
    } catch (err: any) {
      console.error('Registration error:', err)
      let errorMessage = err.message || 'خطأ في التسجيل'
      
      // Map common error messages to Arabic
      if (errorMessage.includes('already registered') || errorMessage.includes('User already exists')) {
        errorMessage = 'هذا البريد الإلكتروني مسجل بالفعل'
      } else if (errorMessage.includes('duplicate key')) {
        if (errorMessage.includes('email')) {
          errorMessage = 'هذا البريد الإلكتروني مسجل بالفعل'
        } else if (errorMessage.includes('phone')) {
          errorMessage = 'رقم الهاتف مسجل بالفعل'
        } else {
          errorMessage = 'هذه البيانات مسجلة بالفعل'
        }
      } else if (errorMessage.includes('unique constraint')) {
        errorMessage = 'هذه البيانات مسجلة بالفعل'
      } else if (!['البريد', 'كلمة', 'حساب', 'خطأ', 'هاتف'].some(word => errorMessage.includes(word))) {
        errorMessage = 'خطأ في الاتصال - يرجى المحاولة لاحقاً'
      }
      
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">البوربتال غير متاح</p>
          <button
            onClick={() => navigate(`/shop/${slug}`)}
            className="mt-4 px-6 py-2 bg-gold-400 text-black rounded hover:bg-gold-500 transition"
          >
            العودة
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
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-8">
          <div className="text-center mb-8">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: settings.primary_color }}
            >
              {settings.shop_name}
            </h1>
            <p className="text-white/70">إنشاء حساب جديد</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                الاسم الكامل *
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition"
                placeholder="أحمد محمد"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                البريد الإلكتروني *
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
                رقم الهاتف *
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
                تاريخ الميلاد (اختياري)
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
                كلمة المرور *
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
                تأكيد كلمة المرور *
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
              className="w-full py-2 rounded font-semibold text-white transition hover:shadow-lg disabled:opacity-50 mt-6"
              style={{ backgroundColor: settings.primary_color }}
            >
              {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
            </button>
          </form>

          <div className="mt-6 text-center pt-4 border-t border-white/10">
            <p className="text-white/70 text-sm">
              هل لديك حساب بالفعل؟{' '}
              <button
                onClick={() => navigate(`/shop/${slug}/login`)}
                className="transition hover:opacity-70 font-semibold"
                style={{ color: settings.primary_color }}
              >
                دخول
              </button>
            </p>
          </div>
        </div>

        <p className="text-white/50 text-xs text-center mt-4">
          * الحقول المطلوبة
        </p>
      </div>
    </div>
  )
}
