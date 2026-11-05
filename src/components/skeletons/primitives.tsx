import React from 'react'
import { SkeletonBox } from 'skullet/react'

type Length = string | number

interface SkeletonBarProps {
  height?: Length
  width?: Length
  radius?: Length
  className?: string
}

/** A single Skullet bone sized with the same proportions as the content it replaces. */
export const SkeletonBar: React.FC<SkeletonBarProps> = ({
  height = '0.75rem',
  width = '100%',
  radius = '0.5rem',
  className,
}) => (
  <SkeletonBox height={height} width={width} radius={radius} className={className} />
)

/** Matches the `text-2xl md:text-3xl` KPI value line in Dashboard/Analytics. */
export const KpiValueSkeleton: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <span className={compact ? 'flex h-8 items-center' : 'flex h-8 items-center md:h-9'}>
    <SkeletonBar height="1.5rem" width="6.5rem" radius="0.5rem" />
  </span>
)

/** Matches the 300px `ResponsiveContainer` used by the revenue chart. */
export const ChartSkeleton: React.FC<{ height?: number | string }> = ({ height = 300 }) => (
  <div className="w-full" style={{ height }} aria-hidden="true">
    <SkeletonBar height="100%" width="100%" radius="0.75rem" />
  </div>
)

interface ListSkeletonProps {
  rows?: number
  className?: string
}

/**
 * Two-line row with a trailing pill — the shape shared by transaction,
 * expense and activity lists.
 */
export const ListSkeleton: React.FC<ListSkeletonProps> = ({ rows = 4, className = 'space-y-2 md:space-y-3' }) => (
  <div className={className} aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 p-2 md:p-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBar height="0.875rem" width={index % 3 === 0 ? '62%' : index % 3 === 1 ? '48%' : '55%'} />
          <SkeletonBar height="0.625rem" width="38%" radius="0.375rem" />
        </div>
        <SkeletonBar height="1.5rem" width="4.5rem" radius="999px" />
      </div>
    ))}
  </div>
)

interface CardGridSkeletonProps {
  cards?: number
  className?: string
  children: React.ReactNode
}

/** Repeats a card-shaped skeleton inside a grid whose columns match the real one. */
export const CardGridSkeleton: React.FC<CardGridSkeletonProps> = ({
  cards = 4,
  className = 'grid grid-cols-1 gap-4 lg:grid-cols-2',
  children,
}) => (
  <div className={className} aria-hidden="true">
    {Array.from({ length: cards }).map((_, index) => (
      <React.Fragment key={index}>{children}</React.Fragment>
    ))}
  </div>
)
