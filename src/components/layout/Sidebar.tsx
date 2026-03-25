import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../hooks/useLanguage'
import { useAuth } from '../../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  ShoppingCart,
  Users,
  Scissors,
  DollarSign,
  Settings,
  Home,
  X,
  FileText,
  Calendar,
  Clock,
  Building2,
  Package,
  Receipt,
} from 'lucide-react'

interface SidebarLink {
  icon: React.ReactNode
  label: string
  href: string
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  currentPath: string
  onNavigate?: (path: string) => void
  subscriptionStatus?: 'active' | 'inactive' | 'suspended' | 'expired'
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPath, subscriptionStatus }) => {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { role } = useAuth()
  const navigate = useNavigate()

  const isReadOnly = subscriptionStatus === 'inactive' && role === 'admin'

  const shopLinks: SidebarLink[] = [
    { icon: <Home size={20} />, label: t('navigation.dashboard'), href: '/dashboard' },
    { icon: <ShoppingCart size={20} />, label: t('navigation.pos'), href: '/pos' },
    { icon: <Users size={20} />, label: t('navigation.clients'), href: '/clients' },
    { icon: <Scissors size={20} />, label: t('navigation.barbers'), href: '/barbers' },
    { icon: <Calendar size={20} />, label: t('navigation.bookings'), href: '/bookings' },
    { icon: <Clock size={20} />, label: t('navigation.queue'), href: '/queue' },
    { icon: <Scissors size={20} />, label: t('navigation.services'), href: '/services' },
    { icon: <FileText size={20} />, label: t('navigation.dailyLogs'), href: '/logs' },
    { icon: <DollarSign size={20} />, label: t('navigation.expenses'), href: '/expenses' },
    { icon: <BarChart3 size={20} />, label: t('navigation.analytics'), href: '/analytics' },
    { icon: <Receipt size={20} />, label: t('navigation.billing'), href: '/billing' },
    { icon: <Settings size={20} />, label: t('navigation.settings'), href: '/settings' },
  ]

  const adminLinks: SidebarLink[] = [
    { icon: <Home size={20} />, label: t('navigation.admin_dashboard'), href: '/admin' },
    { icon: <Building2 size={20} />, label: t('navigation.admin_shops'), href: '/admin/shops' },
    { icon: <Package size={20} />, label: t('navigation.admin_plans'), href: '/admin/plans' },
    { icon: <Receipt size={20} />, label: t('navigation.admin_billing'), href: '/admin/billing' },
  ]

  const links = role === 'admin' ? adminLinks : shopLinks

  const handleNavigate = (path: string) => {
    navigate(path)
    onClose()
  }

  const isActive = (path: string) => currentPath === path
  
  const isLinkDisabled = (path: string) => {
    return isReadOnly && path !== '/billing'
  }

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <motion.aside
        className={`glass-dark fixed ${language === 'ar' ? 'right-0' : 'left-0'} top-16 bottom-0 w-72 z-50 overflow-y-auto
          transition-transform duration-300 ${
            isOpen
              ? (language === 'ar' ? 'translate-x-0' : 'translate-x-0')
              : (language === 'ar' ? 'translate-x-full' : '-translate-x-full')
          }`}
        initial={false}
      >
        <div className="p-6 space-y-3">
          {/* Close button for mobile */}
          <div className={`flex ${language === 'ar' ? 'justify-start' : 'justify-end'} mb-4`}>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="Close"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Read-only Mode Indicator */}
          {isReadOnly && (
            <div className="bg-yellow-500/15 border border-yellow-500/30 rounded-lg px-4 py-2 mb-4">
              <p className="text-yellow-400 text-sm font-medium">
                {language === 'ar' ? 'وضع القراءة فقط' : 'Read-only mode'}
              </p>
            </div>
          )}

          {/* Navigation Links */}
          {links.map((link, index) => {
            const disabled = isLinkDisabled(link.href)
            
            return (
              <motion.button
                key={link.href}
                onClick={() => !disabled && handleNavigate(link.href)}
                title={disabled ? (language === 'ar' ? 'تحديث الاشتراك مطلوب' : 'Subscription update required') : ''}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 font-medium group relative ${
                  disabled
                    ? 'text-gray-500 opacity-50 cursor-not-allowed'
                    : isActive(link.href)
                    ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
                whileHover={!disabled ? { x: language === 'ar' ? -4 : 4 } : {}}
                initial={{ opacity: 0, x: language === 'ar' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                disabled={disabled}
              >
                {link.icon}
                <span>{link.label}</span>
                
                {/* Lock indicator for disabled links */}
                {disabled && (
                  <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center">
                    <span className="text-xs text-gray-300 text-center px-2">
                      {language === 'ar' ? 'اتصل بالمسؤول' : 'Contact admin'}
                    </span>
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>
      </motion.aside>
    </>
  )
}
