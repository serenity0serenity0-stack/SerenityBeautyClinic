import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { Moon, Sun, Globe, LogOut, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface HeaderProps {
  onMenuClick?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    await signOut()
    setShowUserMenu(false)
    navigate('/login', { replace: true })
  }

  return (
    <header className="glass-dark fixed top-0 left-0 right-0 h-16 z-40 border-b border-white/5 backdrop-blur-xl">
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="text-gold-400 hover:bg-white/10 p-2 rounded-lg transition"
            title="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💈</span>
            <h1 className="text-lg sm:text-xl font-bold text-white hidden sm:block">{t('common.appName')}</h1>
          </div>
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Egypt Stamp */}
          <motion.div
            className="text-xl sm:text-2xl"
            whileHover={{ rotate: 15 }}
          >
            🇪🇬
          </motion.div>

          {/* Theme Toggle */}
          <motion.button
            onClick={toggleTheme}
            className="p-2 hover:bg-white/10 rounded-lg transition"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              <Sun size={18} className="text-gold-400" />
            ) : (
              <Moon size={18} className="text-gold-400" />
            )}
          </motion.button>

          {/* Language Toggle */}
          <motion.button
            onClick={toggleLanguage}
            className="p-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Globe size={18} className="text-gold-400" />
            <span className="text-xs sm:text-sm font-semibold text-gold-400 hidden xs:inline">
              {language === 'ar' ? 'AR' : 'EN'}
            </span>
          </motion.button>

          {/* User Menu */}
          <div className="relative">
            <motion.button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-2 hover:bg-white/10 rounded-lg transition flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <User size={18} className="text-gold-400" />
              <span className="text-xs sm:text-sm text-white/70 hidden sm:inline truncate max-w-[100px]">
                {user?.email}
              </span>
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-lg shadow-lg overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-white text-sm font-medium">{user?.email}</p>
                    <p className="text-gold-400 text-xs mt-1">
                      {role === 'admin' ? 'Administrator' : 'Shop Owner'}
                    </p>
                  </div>

                  <motion.button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-white/5 transition"
                    whileHover={{ paddingLeft: 20 }}
                  >
                    <LogOut size={16} />
                    <span>{t('common.logout') || 'Logout'}</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
