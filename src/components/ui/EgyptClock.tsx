import React from 'react'
import { useEgyptTime } from '../../hooks/useEgyptTime'
import { Clock } from 'lucide-react'

interface EgyptClockProps {
  className?: string
  locale?: 'ar' | 'en'
}

export const EgyptClock: React.FC<EgyptClockProps> = ({ 
  className = '',
  locale = 'en'
}) => {
  const { formattedDateTime, formattedDateTimeAr } = useEgyptTime()
  const displayText = locale === 'ar' ? formattedDateTimeAr : formattedDateTime

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Clock size={16} className="text-gold-400" />
      <span className="text-sm text-gray-300">
        {displayText}
      </span>
    </div>
  )
}

/**
 * Digital clock display - just time in Egypt timezone
 */
export const EgyptDigitalClock: React.FC<{className?: string}> = ({ className = '' }) => {
  const { timeString } = useEgyptTime()

  return (
    <div className={`text-2xl font-bold text-gold-400 font-mono ${className}`}>
      {timeString}
    </div>
  )
}

/**
 * Compact clock - for headers and compact spaces
 */
export const EgyptClockCompact: React.FC<{className?: string}> = ({ 
  className = ''
}) => {
  const { timeString } = useEgyptTime()

  return (
    <span className={`text-xs text-gray-400 ${className}`}>
      🕐 {timeString}
    </span>
  )
}
