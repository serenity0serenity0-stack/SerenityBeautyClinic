import React from 'react'
import { SkulletProvider } from 'skullet/react'
import type { SkulletConfig } from 'skullet/react'

/**
 * Skullet configuration for the app.
 *
 * Colours follow the existing purple/gold surface language: a neutral
 * translucent fill that reads as "the same card, still loading" in both
 * themes. `pulse` is intentionally calmer than the default page-wide
 * shimmer, and Skullet stops it under `prefers-reduced-motion`.
 */
const skeletonTheme: SkulletConfig['theme'] = {
  light: {
    base: 'rgb(17 24 39 / 0.08)',
    highlight: 'rgb(255 255 255 / 0.65)',
  },
  dark: {
    base: 'rgb(255 255 255 / 0.10)',
    highlight: 'rgb(255 255 255 / 0.18)',
  },
  radius: '0.5rem',
  animation: 'pulse',
  speed: 'slow',
}

interface AppSkeletonProviderProps {
  mode: 'light' | 'dark'
  children: React.ReactNode
}

/**
 * Keeps Skullet in sync with the app theme. `together` is used for reveals
 * so content fades in as a whole instead of sweeping across RTL layouts.
 */
export const AppSkeletonProvider: React.FC<AppSkeletonProviderProps> = ({ mode, children }) => (
  <SkulletProvider mode={mode} theme={skeletonTheme} reveal="together">
    {children}
  </SkulletProvider>
)
