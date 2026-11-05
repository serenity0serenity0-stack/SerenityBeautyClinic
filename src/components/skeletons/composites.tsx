import React from 'react'
import { SkeletonBar } from './primitives'

/**
 * Page-specific skeleton shapes. Each one mirrors the real card/row it
 * replaces (same padding, radii and number of text lines) so the content
 * does not jump when it arrives.
 */

const cardShell = 'glass rounded-2xl border border-white/10 p-6 sm:p-8'

export const ClientCardSkeleton: React.FC = () => (
  <div className={cardShell} aria-hidden="true">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <SkeletonBar height="1.5rem" width="46%" />
        <SkeletonBar height="1rem" width="30%" radius="0.375rem" />
        <div className="mt-2 flex flex-wrap gap-2">
          <SkeletonBar height="2.125rem" width="3.5rem" radius="999px" />
          <SkeletonBar height="2.125rem" width="4.75rem" radius="999px" />
          <SkeletonBar height="2.125rem" width="5.5rem" radius="999px" />
        </div>
      </div>
      <div className="flex gap-2">
        <SkeletonBar height="2.25rem" width="2.25rem" radius="0.5rem" />
        <SkeletonBar height="2.25rem" width="2.25rem" radius="0.5rem" />
      </div>
    </div>
  </div>
)

export const ServiceCardSkeleton: React.FC = () => (
  <div className={cardShell} aria-hidden="true">
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonBar height="1.125rem" width="55%" />
          <div className="flex flex-wrap gap-2">
            <SkeletonBar height="1.25rem" width="4rem" radius="999px" />
            <SkeletonBar height="1.25rem" width="3.5rem" radius="999px" />
            <SkeletonBar height="1.25rem" width="5rem" radius="999px" />
          </div>
        </div>
        <SkeletonBar height="1.5rem" width="5rem" radius="0.5rem" />
      </div>
    </div>
  </div>
)

export const DoctorCardSkeleton: React.FC = () => (
  <div className={cardShell} aria-hidden="true">
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBar height="1.125rem" width="50%" />
          <SkeletonBar height="0.75rem" width="35%" radius="0.375rem" />
          <SkeletonBar height="0.625rem" width="42%" radius="0.375rem" />
        </div>
        <SkeletonBar height="1.5rem" width="3.75rem" radius="0.375rem" />
      </div>
      <div className="space-y-3 border-t border-white/10 pt-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center justify-between gap-3">
            <SkeletonBar height="0.75rem" width="35%" radius="0.375rem" />
            <SkeletonBar height="0.75rem" width="25%" radius="0.375rem" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-white/10 pt-3">
        <SkeletonBar height="2rem" width="5rem" radius="0.5rem" />
        <SkeletonBar height="2rem" width="5rem" radius="0.5rem" />
      </div>
    </div>
  </div>
)

export const ExpenseRowSkeleton: React.FC = () => (
  <div className={cardShell} aria-hidden="true">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBar height="1rem" width="40%" />
        <SkeletonBar height="0.625rem" width="24%" radius="0.375rem" />
      </div>
      <div className="flex items-center gap-3">
        <SkeletonBar height="1.25rem" width="5rem" radius="0.375rem" />
        <SkeletonBar height="2rem" width="2rem" radius="0.375rem" />
      </div>
    </div>
  </div>
)

export const ActivityRowSkeleton: React.FC = () => (
  <div
    className="glass rounded-2xl border border-white/10 px-4 py-3.5 sm:px-6"
    aria-hidden="true"
  >
    <div className="flex items-center gap-3">
      <SkeletonBar height="2.75rem" width="2.75rem" radius="0.75rem" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <SkeletonBar height="1rem" width="3rem" radius="999px" />
          <SkeletonBar height="0.875rem" width="35%" radius="0.375rem" />
        </div>
        <SkeletonBar height="0.625rem" width="22%" radius="0.375rem" />
      </div>
      <SkeletonBar height="1.25rem" width="4.5rem" radius="0.375rem" />
    </div>
  </div>
)

export const BookingCardSkeleton: React.FC = () => (
  <div className="glass-dark rounded-lg border-2 border-white/10 p-6" aria-hidden="true">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <SkeletonBar height="1.75rem" width="3.25rem" radius="0.5rem" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBar height="0.875rem" width="40%" />
          <SkeletonBar height="0.75rem" width="28%" radius="0.375rem" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SkeletonBar height="2.25rem" width="2.25rem" radius="0.375rem" />
        <SkeletonBar height="2.25rem" width="7rem" radius="0.375rem" />
      </div>
    </div>
    <div className="flex flex-wrap gap-3">
      <SkeletonBar height="0.75rem" width="30%" radius="0.375rem" />
      <SkeletonBar height="0.75rem" width="22%" radius="0.375rem" />
      <SkeletonBar height="0.75rem" width="26%" radius="0.375rem" />
    </div>
  </div>
)

export const UserRowSkeleton: React.FC = () => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4" aria-hidden="true">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SkeletonBar height="2.5rem" width="2.5rem" radius="999px" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBar height="0.875rem" width="35%" />
          <SkeletonBar height="0.625rem" width="45%" radius="0.375rem" />
          <div className="flex gap-2 pt-1">
            <SkeletonBar height="1rem" width="3.75rem" radius="999px" />
            <SkeletonBar height="1rem" width="3.25rem" radius="999px" />
          </div>
        </div>
      </div>
      <SkeletonBar height="2rem" width="6rem" radius="0.5rem" />
    </div>
  </div>
)

export const PosServiceRowSkeleton: React.FC = () => (
  <div className="w-full rounded-lg border border-white/20 bg-gradient-to-r from-white/10 to-white/5 p-3" aria-hidden="true">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBar height="0.875rem" width="45%" />
        <div className="flex gap-2">
          <SkeletonBar height="1rem" width="3.75rem" radius="999px" />
          <SkeletonBar height="1rem" width="4.5rem" radius="999px" />
        </div>
      </div>
      <SkeletonBar height="1.75rem" width="4.5rem" radius="0.5rem" />
    </div>
  </div>
)

/** History entries inside the client detail modal. */
export const DetailHistorySkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-3" aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <SkeletonBar height="1rem" width="35%" />
          <SkeletonBar height="0.75rem" width="20%" radius="0.375rem" />
        </div>
        <div className="space-y-2">
          <SkeletonBar height="0.75rem" width="60%" radius="0.375rem" />
          <SkeletonBar height="0.75rem" width="40%" radius="0.375rem" />
        </div>
      </div>
    ))}
  </div>
)
