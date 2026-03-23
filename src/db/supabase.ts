import { createClient } from '@supabase/supabase-js'

// Get your Supabase URL and anon key from:
// https://app.supabase.com/project/_/settings/api
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials not found. Please check your .env.local file.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Database type definitions
export interface Client {
  id?: string
  name: string
  phone: string
  email?: string | null
  birthday?: string
  notes?: string
  totalVisits: number
  totalSpent: number
  isVIP: boolean
  lastVisit?: string
  shop_id?: string
  createdAt: string
  updatedAt: string
}

export interface Service {
  id?: string
  nameAr: string
  nameEn: string
  price: number
  duration: number
  category: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id?: string
  clientId?: string
  clientName: string
  clientPhone?: string
  visitNumber: number
  date: string
  time: string
  items: Array<{ id: string; name: string; price: number }>
  subtotal: number
  discount: number
  discountType: 'percentage' | 'fixed'
  total: number
  paymentMethod: 'cash' | 'card' | 'wallet'
  barberId?: string
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id?: string
  category: string
  amount: number
  date: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface Settings {
  key: string
  value: any
  updatedAt: string
}

export interface Barber {
  id?: string
  name: string
  phone?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Booking {
  id?: string
  clientId: string
  clientName: string
  clientPhone: string
  barberId?: string
  barberName?: string
  serviceType?: string
  bookingTime: string // ISO date string
  duration?: number // in minutes
  queueNumber: number
  status: 'pending' | 'ongoing' | 'completed' | 'cancelled'
  notes?: string
  createdAt: string
  updatedAt: string
}
