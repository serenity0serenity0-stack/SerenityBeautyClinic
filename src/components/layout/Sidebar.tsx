import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../hooks/useLanguage'
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
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPath, onNavigate }) => {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const navigate = useNavigate()

  const links: SidebarLink[] = [
    { icon: <Home size={20} />, label: t('navigation.dashboard'), href: '/dashboard' },
    { icon: <ShoppingCart size={20} />, label: t('navigation.pos'), href: '/pos' },
    { icon: <Users size={20} />, label: t('navigation.clients'), href: '/clients' },
    { icon: <Scissors size={20} />, label: 'الحلاقين', href: '/barbers' },
    { icon: <Calendar size={20} />, label: 'الحجوزات', href: '/bookings' },
    { icon: <Clock size={20} />, label: 'حالة الطابور', href: '/queue' },
    { icon: <Scissors size={20} />, label: t('navigation.services'), href: '/services' },
    { icon: <FileText size={20} />, label: 'السجلات اليومية', href: '/logs' },
    { icon: <DollarSign size={20} />, label: t('navigation.expenses'), href: '/expenses' },
    { icon: <BarChart3 size={20} />, label: t('navigation.analytics'), href: '/analytics' },
    { icon: <Settings size={20} />, label: t('navigation.settings'), href: '/settings' },
  ]

  const handleNavigate = (path: string) => {
    navigate(path)
    onClose()
  }

  const isActive = (path: string) => currentPath === path

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

          {/* Navigation Links */}
          {links.map((link, index) => (
            <motion.button
              key={link.href}
              onClick={() => handleNavigate(link.href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 font-medium ${
                isActive(link.href)
                  ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              whileHover={{ x: language === 'ar' ? -4 : 4 }}
              initial={{ opacity: 0, x: language === 'ar' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {link.icon}
              <span>{link.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.aside>
    </>
  )
}
