import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

type AuthMode = 'login' | 'register' | 'forgot-password'

export function PortalLoginSecure() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  
  const { 
    customer, 
    loading: authLoading, 
    error: authError,
    loginPortalUser,
    registerPortalUser,
    resetPasswordViaPhone
  } = usePortalAuthSecure(slug)
  
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  // Form states
  const [mode, setMode] = useState<AuthMode>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotPhone, setForgotPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!authLoading && customer && slug) {
      console.log('✅ Customer logged in, redirecting:', {
        customerId: customer.id,
        slug,
        destination: `/shop/${slug}/dashboard`
      })
      navigate(`/shop/${slug}/dashboard`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

  // Show auth error
  useEffect(() => {
    if (authError) {
      toast.error(authError)
    }
  }, [authError])

  // Update browser title
  useEffect(() => {
    if (settings?.clinic_name) {
      document.title = `${settings.clinic_name} - تسجيل الدخول`
    }
  }, [settings?.clinic_name])

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!phone || !password) {
        toast.error('يرجى ملء جميع الحقول')
        return
      }

      console.log('📱 Attempting login with phone:', phone)
      
      const result = await loginPortalUser(phone, password)
      
      if (result) {
        console.log('✅ Login successful, redirecting to dashboard')
        toast.success('تم تسجيل الدخول بنجاح ✓')
        // Use window.location.href to force full page reload with new session
        setTimeout(() => {
          window.location.href = `/shop/${slug}/dashboard`
        }, 500)
      } else {
        console.error('❌ Login returned null/falsy')
        toast.error('فشل تسجيل الدخول')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      
      // Enhanced error messages
      let errorMsg = 'خطأ في تسجيل الدخول'
      
      if (err.message?.includes('not found') || err.message?.includes('نتيجة للبحث')) {
        errorMsg = '❌ رقم الهاتف غير مسجل. يرجى التسجيل أولاً'
      } else if (err.message?.includes('Invalid password') || err.message?.includes('password')) {
        errorMsg = '❌ كلمة المرور غير صحيحة'
      } else if (err.message) {
        errorMsg = `❌ ${err.message}`
      }
      
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // Handle registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!phone || !password || !passwordConfirm) {
        toast.error('يرجى ملء جميع الحقول المطلوبة')
        return
      }

      if (password !== passwordConfirm) {
        toast.error('كلمات المرور غير متطابقة')
        return
      }

      if (password.length < 6) {
        toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
        return
      }

      if (!slug) {
        toast.error('خطأ: معرف المحل غير موجود')
        return
      }

      const result = await registerPortalUser(
        phone,
        password,
        name || undefined,
        email || undefined,
        settings?.clinic_id || slug?.split('-')[0]
      )

      if (result) {
        toast.success('تم التسجيل بنجاح ✓')
        setMode('login')
        setPhone('')
        setPassword('')
        setPasswordConfirm('')
        setName('')
        setEmail('')
      }
    } catch (err: any) {
      console.error('Registration error:', err)
      
      // Enhanced error messages
      let errorMsg = 'خطأ في التسجيل'
      
      if (err.message?.includes('User already registered') || err.message?.includes('already exists')) {
        errorMsg = '❌ رقم الهاتف مسجل بالفعل. حاول تسجيل الدخول أو استخدم رقم آخر'
      } else if (err.message?.includes('invalid email')) {
        errorMsg = '❌ البريد الإلكتروني غير صحيح'
      } else if (err.message?.includes('password')) {
        errorMsg = '❌ كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل'
      } else if (err.message) {
        errorMsg = `❌ ${err.message}`
      }
      
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!forgotEmail || !forgotPhone || !newPassword) {
        toast.error('يرجى ملء جميع الحقول')
        return
      }

      if (newPassword.length < 6) {
        toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
        return
      }

      // Verify email and phone match, then update password
      const result = await resetPasswordViaPhone(forgotPhone, forgotEmail, newPassword)
      
      if (result) {
        toast.success('تم تحديث كلمة المرور بنجاح ✓')
        setMode('login')
        setForgotEmail('')
        setForgotPhone('')
        setNewPassword('')
      } else {
        // Error message is already set by resetPasswordViaPhone
        toast.error(authError || 'فشل التحقق من البيانات')
      }
    } catch (err: any) {
      console.error('Reset error:', err)
      
      // Enhanced error messages
      let errorMsg = 'خطأ في إعادة تعيين كلمة المرور'
      
      if (err.message?.includes('not found') || err.message?.includes('doesn\'t exist')) {
        errorMsg = '❌ رقم الهاتف غير مسجل في النظام'
      } else if (err.message?.includes('does not match')) {
        errorMsg = '❌ البريد الإلكتروني لا يتطابق مع البيانات المسجلة'
      } else if (err.message?.includes('password')) {
        errorMsg = '❌ كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل'
      } else if (err.message) {
        errorMsg = `❌ ${err.message}`
      }
      
      toast.error(errorMsg)
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
              {!settings ? 'لم يتم العثور على بيانات البوابة' : 'البوابة معطلة حالياً'}
            </p>
            <ul className="text-red-300/80 text-xs space-y-2 text-right">
              <li>• تأكد من صحة الرابط</li>
              <li>• قد تحتاج البوابة إلى تفعيل</li>
              <li>• اتصل بمدير المحل</li>
            </ul>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 transition duration-200"
          >
            إعادة المحاولة
          </button>
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
            {settings.clinic_name}
          </h2>
          <p className="text-cyan-300 font-medium text-sm">
            {mode === 'login' && 'تسجيل الدخول إلى حسابك'}
            {mode === 'register' && 'إنشاء حساب جديد'}
            {mode === 'forgot-password' && 'إعادة تعيين كلمة المرور'}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-slate-800/50 via-slate-900/50 to-slate-900/50 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl space-y-6">
          
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Phone Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                  placeholder="01012345678"
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
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Links */}
              <div className="flex justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  disabled={loading}
                  className="text-cyan-400 hover:text-cyan-300 transition duration-200 disabled:opacity-50"
                >
                  هل نسيت كلمة المرور؟
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  disabled={loading}
                  className="text-cyan-400 hover:text-cyan-300 transition duration-200 disabled:opacity-50"
                >
                  تسجيل جديد
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
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  الاسم (اختياري)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                  placeholder="اسمك"
                  disabled={loading}
                />
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                  placeholder="you@email.com"
                  disabled={loading}
                />
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                  placeholder="01012345678"
                  dir="ltr"
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
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">الحد الأدنى 6 أحرف</p>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  تأكيد كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 hover:border-cyan-500/30 focus:border-cyan-500/60 rounded-lg text-white placeholder-slate-500 focus:outline-none transition duration-200 focus:ring-1 focus:ring-cyan-500/20"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute left-4 top-3.5 text-slate-400 hover:text-cyan-400 transition duration-200"
                    disabled={loading}
                  >
                    {showPasswordConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Register Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 active:from-cyan-700 active:to-blue-700 transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    جاري التسجيل...
                  </span>
                ) : (
                  'تسجيل'
                )}
              </button>

              {/* Back to Login */}
              <button
                type="button"
                onClick={() => setMode('login')}
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/10 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                العودة للدخول
              </button>
            </form>
          )}

          {mode === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-slate-300 text-sm text-center mb-4">
                أدخل بريدك الإلكتروني ورقم هاتفك وكلمة مرور جديدة
              </p>

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
                  placeholder="you@email.com"
                  required
                  disabled={loading}
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
                  required
                  disabled={loading}
                />
              </div>

              {/* New Password Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">الحد الأدنى 6 أحرف</p>
              </div>

              {/* Verification Info */}
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-300 text-xs">
                  🔐 سيتم التحقق من تطابق البريد الإلكتروني ورقم الهاتف قبل حفظ كلمة المرور الجديدة
                </p>
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
                    جاري التحقق...
                  </span>
                ) : (
                  'تحديث كلمة المرور'
                )}
              </button>

              {/* Back to Login */}
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setForgotEmail('')
                  setForgotPhone('')
                  setNewPassword('')
                }}
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/10 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                العودة
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="border-t border-slate-700/50"></div>

          {/* Security Note */}
          <p className="text-xs text-slate-400 text-center">
            🔒 بيانات آمنة ومشفرة مع Supabase
          </p>
        </div>
      </div>
    </div>
  )
}
