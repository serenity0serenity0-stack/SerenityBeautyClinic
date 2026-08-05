import React from 'react'
import { motion } from 'framer-motion'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  variant?: 'glass' | 'glass-dark' | 'glass-light'
  animated?: boolean
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  onClick,
  variant = 'glass',
  animated = true,
}) => {
  const baseClasses = `${variant} rounded-2xl p-6 sm:p-8 cursor-pointer transition-all duration-300 border border-white/10 hover:border-gold-400/30`

  const Component = animated ? motion.div : 'div'

  return (
    <Component
      onClick={onClick}
      className={`${baseClasses} ${className}`}
      whileHover={animated ? { y: -4, boxShadow: '0 20px 25px rgba(139, 92, 176, 0.18)' } : {}}
      transition={animated ? { duration: 0.2 } : {}}
    >
      {children}
    </Component>
  )
}
