import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export function PortalLogin() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { signIn } = usePortalAuth(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - تسجيل الدخول`
    }
  }, [settings?.shop_name])

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

      // Get shop_id from settings
      const shopId = settings.shop_id

      // Call signIn
      await signIn(email, password, shopId)

      // If successful, navigate to dashboard
      navigate(`/shop/${slug}/dashboard`, { replace: true })
      toast.success('تم تسجيل الدخول بنجاح')
    } catch (err: any) {
      console.error('Login error:', err)
      let errorMessage = err.message || 'خطأ في تسجيل الدخول'
      
      // Map common error messages to Arabic
      if (
        errorMessage.includes('Invalid login credentials') ||
        errorMessage.includes('invalid credentials') ||
        errorMessage.includes('Unable to validate') ||
        errorMessage.includes('Invalid credentials')
      ) {
        errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'يرجى تأكيد بريدك الإلكتروني'
      } else if (errorMessage.includes('User not found')) {
        errorMessage = 'لا توجد حسابات بهذا البريد الإلكتروني'
      } else if (!['البريد', 'كلمة', 'حساب', 'خطأ', 'جلسة'].some(word => errorMessage.includes(word))) {
        errorMessage = 'خطأ في الاتصال - يرجى المحاولة لاحقاً'
      }
      
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('الرجاء إدخال بريدك الإلكتروني')
      return
    }

    setLoading(true)
    try {
      const { error } = await (
        await import('@/db/supabase')
      ).supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/shop/${slug}/reset-password`,
      })

      if (error) throw error
      toast.success('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك')
    } catch (err: any) {
      toast.error(err.message || 'خطأ في إرسال رابط إعادة التعيين')
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
      className="min-h-screen flex items-center justify-center p-4"
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
            <p className="text-white/70">تسجيل الدخول إلى حسابك</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:border-white/30 focus:outline-none transition"
                placeholder="your@email.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded font-semibold text-white transition hover:shadow-lg disabled:opacity-50"
              style={{ backgroundColor: settings.primary_color }}
            >
              {loading ? 'جاري التحميل...' : 'دخول'}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full text-sm transition hover:opacity-70 disabled:opacity-50"
              style={{ color: settings.primary_color }}
            >
              هل نسيت كلمة المرور؟
            </button>

            <div className="text-center pt-3 border-t border-white/10">
              <p className="text-white/70 text-sm">
                ليس لديك حساب؟{' '}
                <button
                  onClick={() => navigate(`/shop/${slug}/register`)}
                  className="transition hover:opacity-70 font-semibold"
                  style={{ color: settings.primary_color }}
                >
                  سجل الآن
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
