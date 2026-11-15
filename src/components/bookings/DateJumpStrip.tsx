import React from 'react'

export interface DateJumpStripProps {
  days: { date: string }[]
  onJump: (date: string) => void
  lang: 'ar' | 'en'
}

export const DateJumpStrip: React.FC<DateJumpStripProps> = ({ days, onJump, lang }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
      {days.map((d) => {
        const label = (() => {
          try {
            return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }).format(new Date(d.date + 'T12:00:00'))
          } catch {
            return d.date
          }
        })()
        return (
          <button
            key={d.date}
            onClick={() => onJump(d.date)}
            className="shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 border border-white/10"
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}