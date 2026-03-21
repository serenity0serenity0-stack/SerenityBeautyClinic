import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { motion } from 'framer-motion'
import { Mail, Lock, LogIn, Scissors } from 'lucide-react'

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
  const { t, i18n } = useTranslation()
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
      className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0A0F1E] to-slate-950 flex items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gold glow orbs */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute -top-32 -right-32 w-96 h-96 bg-gold-400/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity }}
          className="absolute -bottom-32 -left-32 w-96 h-96 bg-gold-400/5 rounded-full blur-3xl"
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(90deg, #D4AF37 1px, transparent 1px), linear-gradient(0deg, #D4AF37 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/15 via-white/5 to-white/10 border border-white/20 rounded-3xl p-12 shadow-2xl">
          {/* Header with Scissor Icon */}
          <div className="text-center mb-10">
            {/* Scissor Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gold-400/30 to-gold-500/20 rounded-full mb-6 border border-gold-400/50"
            >
              <Scissors className="w-8 h-8 text-gold-400" />
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-3xl font-bold bg-gradient-to-r from-white via-white to-gold-300 bg-clip-text text-transparent mb-3"
            >
              {t('common.appName') || 'نظام إدارة محل حلاقة'}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-gold-300/60 text-sm font-light tracking-wide"
            >
              {t('common.login') || 'Sign in to your account'}
            </motion.p>
          </div>

          {/* Error Message */}
          {authError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-400/50 rounded-xl backdrop-blur-sm"
            >
              <p className="text-red-200 text-sm font-medium">{authError}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <label className="block text-white/80 text-sm font-semibold mb-3 tracking-wide">
                {t('common.email') || 'Email'}
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60 group-focus-within:text-gold-400 transition duration-300" />
                <input
                  type="email"
                  placeholder={isRTL ? 'بريدك@example.com' : 'your@email.com'}
                  {...register('email')}
                  disabled={isSubmitting || authLoading}
                  className={`w-full bg-white/10 border border-white/20 hover:border-white/30 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-400 text-base focus:outline-none focus:border-gold-400/60 focus:bg-white/15 focus:ring-2 focus:ring-gold-400/20 transition duration-300 backdrop-blur-sm ${
                    errors.email ? 'border-red-500/50 focus:border-red-500/60' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-xs mt-2 font-medium"
                >
                  {errors.email.message}
                </motion.p>
              )}
            </motion.div>

            {/* Password Field */}
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <label className="block text-white/80 text-sm font-semibold mb-3 tracking-wide">
                {t('common.password') || 'Password'}
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-400/60 group-focus-within:text-gold-400 transition duration-300" />
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  disabled={isSubmitting || authLoading}
                  className={`w-full bg-white/10 border border-white/20 hover:border-white/30 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-400 text-base focus:outline-none focus:border-gold-400/60 focus:bg-white/15 focus:ring-2 focus:ring-gold-400/20 transition duration-300 backdrop-blur-sm ${
                    errors.password ? 'border-red-500/50 focus:border-red-500/60' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-xs mt-2 font-medium"
                >
                  {errors.password.message}
                </motion.p>
              )}
            </motion.div>

            {/* Login Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(212, 175, 55, 0.3)' }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting || authLoading}
              className="w-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 hover:from-gold-500 hover:via-gold-600 hover:to-gold-700 text-black font-bold py-4 rounded-xl transition duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gold-500/30 rel border border-gold-300/50"
            >
              {isSubmitting || authLoading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <LogIn className="w-5 h-5" />
                  </motion.div>
                  <span>{t('common.loading') || 'Loading...'}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>{t('common.login') || 'Sign In'}</span>
                </>
              )}
            </motion.button>
          </form>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-center text-white/30 text-xs mt-10 font-light"
        >
          © 2026 Barber Shop Management System. {t('common.allRightsReserved') || 'All rights reserved.'}
        </motion.p>
      </motion.div>
    </div>
  )
}
