import React from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'

export interface BookingsToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  staffFilter: string
  onStaffFilterChange: (v: string) => void
  serviceFilter: string
  onServiceFilterChange: (v: string) => void
  statusOptions: string[]
  staffOptions: string[]
  serviceOptions: string[]
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (v: 'asc' | 'desc') => void
  onExpandAll: () => void
  onCollapseAll: () => void
  lang: 'ar' | 'en'
  totalCount: number
  dayCount: number
  statusCounts: Record<string, number>
}

export const BookingsToolbar: React.FC<BookingsToolbarProps> = (props) => {
  const { t } = useTranslation()
  const { search, onSearchChange, statusFilter, onStatusFilterChange,
    staffFilter, onStaffFilterChange, serviceFilter, onServiceFilterChange,
    statusOptions, staffOptions, serviceOptions, sortOrder, onSortOrderChange,
    onExpandAll, onCollapseAll, lang, totalCount, dayCount, statusCounts } = props
  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
            className="w-full bg-white/10 text-white ps-9 pe-3 py-2 rounded-lg border border-white/20 text-sm"
          />
        </div>
        <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm">
          <option value="all">{lang === 'ar' ? 'جميع الحالات' : 'All statuses'}</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{t(`bookings.status.${s}`, { defaultValue: s })}</option>
          ))}
        </select>
        <select value={staffFilter} onChange={(e) => onStaffFilterChange(e.target.value)} className="bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm">
          <option value="all">{lang === 'ar' ? 'جميع الأطباء' : 'All staff'}</option>
          {staffOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={serviceFilter} onChange={(e) => onServiceFilterChange(e.target.value)} className="bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm">
          <option value="all">{lang === 'ar' ? 'جميع الخدمات' : 'All services'}</option>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={sortOrder} onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')} className="bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 text-sm">
          <option value="asc">{lang === 'ar' ? 'الأقدم أولاً' : 'Oldest first'}</option>
          <option value="desc">{lang === 'ar' ? 'الأحدث أولاً' : 'Newest first'}</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
        <span>{lang === 'ar' ? 'الإجمالي' : 'Total'}: {totalCount} | {lang === 'ar' ? 'أيام' : 'Days'}: {dayCount}</span>
        {Object.entries(statusCounts).map(([s, c]) => (
          <span key={s} className="bg-white/5 px-2 py-0.5 rounded">{t(`bookings.status.${s}`, { defaultValue: s })}: {c}</span>
        ))}
        <div className="ms-auto flex gap-2">
          <button onClick={onExpandAll} className="px-2 py-1 bg-white/10 rounded hover:bg-white/20 flex items-center gap-1">
            <ChevronDown size={12} /> {lang === 'ar' ? 'توسيع الكل' : 'Expand all'}
          </button>
          <button onClick={onCollapseAll} className="px-2 py-1 bg-white/10 rounded hover:bg-white/20 flex items-center gap-1">
            <ChevronUp size={12} /> {lang === 'ar' ? 'طي الكل' : 'Collapse all'}
          </button>
        </div>
      </div>
    </div>
  )
}