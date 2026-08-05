export const PAGE_KEYS = [
  'dashboard',
  'pos',
  'clients',
  'bookings',
  'services',
  'staff',
  'logs',
  'expenses',
  'queue',
  'analytics',
  'settings',
] as const

export type PageKey = (typeof PAGE_KEYS)[number]

export type UserRole = 'admin' | 'cashier' | null

// Locale key for each page's display label (logs -> dailyLogs)
export const PAGE_LABEL_KEYS: Record<PageKey, string> = {
  dashboard: 'navigation.dashboard',
  pos: 'navigation.pos',
  clients: 'navigation.clients',
  bookings: 'navigation.bookings',
  services: 'navigation.services',
  staff: 'navigation.staff',
  logs: 'navigation.dailyLogs',
  expenses: 'navigation.expenses',
  queue: 'navigation.queue',
  analytics: 'navigation.analytics',
  settings: 'navigation.settings',
}

export const ROUTE_TO_PAGE: Record<string, PageKey> = {
  '/dashboard': 'dashboard',
  '/pos': 'pos',
  '/clients': 'clients',
  '/bookings': 'bookings',
  '/services': 'services',
  '/staff': 'staff',
  '/logs': 'logs',
  '/expenses': 'expenses',
  '/queue': 'queue',
  '/analytics': 'analytics',
  '/settings': 'settings',
}

export const DEFAULT_CASHIER_PAGES: PageKey[] = ['dashboard', 'pos', 'clients', 'bookings', 'services', 'queue']

export function canAccess(role: UserRole, permissions: string[] | undefined | null, page: string): boolean {
  if (role === 'admin') return true
  if (role !== 'cashier') return false
  return (permissions || []).includes(page)
}

export function firstAllowedPage(role: UserRole, permissions: string[] | undefined | null): string {
  if (role === 'admin') return '/dashboard'
  for (const key of PAGE_KEYS) {
    if ((permissions || []).includes(key)) return `/${key}`
  }
  return '/login'
}

export function normalizePermissions(role: UserRole | null | undefined, permissions: unknown): string[] {
  if (role === 'admin') return ['all']
  if (Array.isArray(permissions)) return permissions.filter((p): p is string => typeof p === 'string')
  return []
}
