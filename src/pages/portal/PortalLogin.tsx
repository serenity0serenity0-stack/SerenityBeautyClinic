import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { supabase } from '@/db/supabase'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export function PortalLogin() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { customer, loading: authLoading, signIn } = usePortalAuth(slug || '')
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotPhone, setForgotPhone] = useState('')

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!authLoading && customer) {
      navigate(`/shop/${slug}/dashboard`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

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

      const { error } = await signIn(email, password, settings.shop_id)
      
      if (error) {
        toast.error(error)
        return
      }

      // If successful, navigate to dashboard
      navigate(`/shop/${slug}/dashboard`, { replace: true })
      toast.success('تم تسجيل الدخول بنجاح')
    } catch (err: any) {
      console.error('Login error:', err)
      toast.error(err.message || 'خطأ في تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!forgotEmail || !forgotPhone) {
      toast.error('يرجى إدخال البريد الإلكتروني ورقم الهاتف')
      return
    }

    if (!settings) {
      toast.error('البوربتال غير متاح الآن')
      return
    }

    setLoading(true)
    try {
      // Check if both email and phone match in customer_users for this shop
      const { data, error: checkErr } = await supabase
        .from('customer_users')
        .select('id, email')
        .eq('shop_id', settings.shop_id)
        .eq('email', forgotEmail)
        .eq('phone', forgotPhone)
        .maybeSingle()

      if (checkErr && checkErr.code !== 'PGRST116') throw checkErr

      if (!data) {
        toast.error('البيانات غير متطابقة، تحقق من بريدك الإلكتروني ورقم هاتفك')
        return
      }

      // Both match - send reset email
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/shop/${slug}/reset-password`,
      })

      if (resetErr) throw resetErr
      toast.success('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني ✓')
      setShowForgotPassword(false)
      setForgotEmail('')
      setForgotPhone('')
    } catch (err: any) {
      console.error('Forgot password error:', err)
      toast.error(err.message || 'خطأ في إرسال رابط إعادة التعيين')
    } finally {
      setLoading(false)
    }
  }

  if (settingsLoading || authLoading) {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="space-y-2">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold text-white">البوابة غير متاحة</h1>
          </div>
          
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
            <p className="text-red-300 text-sm">
              لم يتم العثور على بيانات البوابة. قد يكون السبب:
            </p>
            <ul className="text-red-300/80 text-xs space-y-2 text-right">
              <li>• البوابة لم يتم تفعيلها من لوحة التحكم</li>
              <li>• الرابط غير صحيح</li>
              <li>• لم يتم إعداد البوابة بعد</li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              👇 اتصل بمدير المحل لتفعيل البوابة من الإعدادات
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 transition duration-200"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      }}
      dir="rtl"
    >
      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Shop Header */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-lg">
            ✂️
          </h1>
          <h2 className="text-3xl font-bold text-white drop-shadow-lg">
            {settings.shop_name}
          </h2>
          <p className="text-cyan-300 font-medium text-sm">تسجيل الدخول إلى حسابك</p>
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-slate-800/50 via-slate-900/50 to-slate-900/50 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl space-y-6">
          {!showForgotPassword ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-3.5 text-slate-400 hover:text-cyan-400 transition duration-200"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  disabled={loading}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition duration-200 disabled:opacity-50"
                >
                  هل نسيت كلمة المرور؟
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 active:from-cyan-700 active:to-blue-700 transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    جاري الدخول...
                  </span>
                ) : (
                  'دخول'
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleForgotPassword()
              }}
              className="space-y-4"
            >
              <div className="text-center mb-4">
                <p className="text-slate-300 text-sm">أدخل بريدك الإلكتروني ورقم هاتفك</p>
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                  placeholder="your@email.com"
                  disabled={loading}
                  required
                />
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                  placeholder="01012345678"
                  dir="ltr"
                  disabled={loading}
                  required
                />
              </div>

              {/* Reset Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 active:from-cyan-700 active:to-blue-700 transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    جاري الإرسال...
                  </span>
                ) : (
                  'إرسال رابط إعادة التعيين'
                )}
              </button>

              {/* Back Button */}
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/10 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                العودة
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="border-t border-slate-700/50"></div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-slate-400 text-sm">
              ليس لديك حساب؟{' '}
              <button
                onClick={() => navigate(`/shop/${slug}/register`)}
                disabled={loading}
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition duration-200 disabled:opacity-50"
              >
                سجل الآن
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-xs">جميع البيانات محمية بالتشفير</p>
        </div>
      </div>
    </div>
  )
}
