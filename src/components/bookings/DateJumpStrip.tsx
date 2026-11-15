import React, { useRef, useEffect } from 'react'

export interface DateJumpStripProps {
  days: { date: string; bookings: any[] }[]
  selectedDate: string | null
  onJump: (date: string) => void
  onClear: () => void
  lang: 'ar' | 'en'
}

export const DateJumpStrip: React.FC<DateJumpStripProps> = ({ days, selectedDate, onJump, onClear, lang }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [selectedDate])

  return (
    <div ref={containerRef} className="flex gap-2 overflow-x-auto pb-2 mb-4">
      <button
        onClick={onClear}
        aria-pressed={selectedDate === null}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs border transition ${
          selectedDate === null
            ? 'bg-purple-600 text-white border-purple-500'
            : 'bg-white/10 text-gray-300 border-white/10 hover:bg-white/20'
        }`}
      >
        {lang === 'ar' ? 'كل الأيام' : 'All days'}
      </button>
      {days.map((d) => {
        const label = (() => {
          try {
            return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }).format(new Date(d.date + 'T12:00:00'))
          } catch {
            return d.date
          }
        })()
        const isSelected = selectedDate === d.date
        return (
          <button
            key={d.date}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => onJump(d.date)}
            aria-pressed={isSelected}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs border transition ${
              isSelected
                ? 'bg-purple-600 text-white border-purple-500'
                : 'bg-white/10 text-gray-300 border-white/10 hover:bg-white/20'
            }`}
          >
            {label} ({d.bookings?.length ?? 0})
          </button>
        )
      })}
    </div>
  )
}