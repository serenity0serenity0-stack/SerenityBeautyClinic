import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import { useTheme } from '../hooks/useTheme'
import { GlassCard } from '../components/ui/GlassCard'
import { motion } from 'framer-motion'

export const Settings: React.FC = () => {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-3xl font-bold text-white">{t('settings.title')}</h1>
      </motion.div>

      {/* Display Preferences */}
      <GlassCard>
        <h2 className="text-xl font-bold text-white mb-4">{t('settings.display_preferences')}</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">{t('settings.language')}</span>
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              {language === 'ar' ? '🇪🇬 العربية' : '🇬🇧 English'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">{t('settings.theme')}</span>
            <button
              onClick={toggleTheme}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* About */}
      <GlassCard>
        <div className="text-center space-y-2">
          <p className="text-gray-400">© Serenity Beauty Clinic 2026</p>
          <p className="text-xs text-gray-500">نظام تطوير Serenity • 01000139417</p>
        </div>
      </GlassCard>
    </div>
  )
}

