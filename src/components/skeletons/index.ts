/**
 * Single entry point for the app's Skullet integration.
 *
 * Pages import `Skeleton` / `SkeletonBox` from here so the library itself
 * stays isolated and can be replaced without touching every page.
 */
export { Skeleton, SkeletonBox } from 'skullet/react'
export { AppSkeletonProvider } from './AppSkeletonProvider'
export * from './primitives'
export * from './composites'
