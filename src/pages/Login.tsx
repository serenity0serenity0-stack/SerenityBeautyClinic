import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { motion } from 'framer-motion'
import { Mail, Lock, LogIn } from 'lucide-react'

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormInputs = z.infer<typeof loginSchema>

/**
 * Login Page
 * 
 * - Unified login for both admins and shop owners
 * - Auto-detects role after login (via useAuth hook)
 * - Redirects to /admin or /dashboard based on role
 * - Supports Arabic/English with RTL support
 * - Matches existing design system (dark theme, glassmorphism, gold accent)
 */
export default function Login() {
  const navigate = useNavigate()
  const { signIn, loading: authLoading, error: authError, role } = useAuth()
  const { t, i18n } = useLanguage()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  })

  const isRTL = i18n.language === 'ar'

  // Redirect if already logged in
  if (!authLoading && role) {
    const redirectPath = role === 'admin' ? '/admin' : `/dashboard`
    navigate(redirectPath, { replace: true })
    return null
  }

  const onSubmit = async (data: LoginFormInputs) => {
    setIsSubmitting(true)
    const { error } = await signIn(data.email, data.password)
    setIsSubmitting(false)

    if (!error) {
      // Redirect will happen via role change detection
      // The useAuth hook will update role, and the effect above will redirect
    }
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4"
    >
      {/* Background blur effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-400/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-400/5 rounded-full blur-3xl"></div>
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              {t('common.appName') || 'Barber Shop'}
            </h1>
            <p className="text-gray-300 text-sm">
              {t('common.login') || 'Login to your account'}
            </p>
          </div>

          {/* Error Message */}
          {authError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg"
            >
              <p className="text-red-200 text-sm">{authError}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                {t('common.email') || 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/50" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  {...register('email')}
                  disabled={isSubmitting || authLoading}
                  className={`w-full bg-white/5 border border-white/10 rounded-lg pl-12 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-400/50 focus:bg-white/10 transition ${
                    errors.email ? 'border-red-500/50' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-2">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                {t('common.password') || 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/50" />
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  disabled={isSubmitting || authLoading}
                  className={`w-full bg-white/5 border border-white/10 rounded-lg pl-12 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-400/50 focus:bg-white/10 transition ${
                    errors.password ? 'border-red-500/50' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-2">{errors.password.message}</p>
              )}
            </div>

            {/* Login Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting || authLoading}
              className="w-full bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-500 hover:to-gold-600 text-black font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-5 h-5" />
              <span>
                {isSubmitting || authLoading
                  ? t('common.loading') || 'Loading...'
                  : t('common.login') || 'Login'}
              </span>
            </motion.button>
          </form>

          {/* Demo Credentials Info */}
          <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-white/60 text-xs mb-3">
              {t('common.demoCredentials') || 'Demo Credentials:'}
            </p>
            <div className="space-y-2 text-white/50 text-xs font-mono">
              <p>
                <span className="text-gold-400">Admin:</span> yaa2003ya@gmail.com
              </p>
              <p>
                <span className="text-gold-400">Shop:</span> shop1@gmail.com
              </p>
              <p>
                <span className="text-gold-400">Password:</span> (ask administrator)
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-8">
          © 2026 Barber Shop Management System. {t('common.allRightsReserved') || 'All rights reserved.'}
        </p>
      </motion.div>
    </div>
  )
}
