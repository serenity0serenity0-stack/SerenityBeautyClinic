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
  total_visits: number
  total_spent: number
  is_vip: boolean
  last_visit?: string
  clinic_id?: string
  created_at?: string
  updated_at?: string
}

export interface Service {
  id?: string
  nameAr?: string
  nameEn?: string
  price: number
  duration: number
  category: string
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface Transaction {
  id?: string
  client_id?: string
  booking_id?: string
  client_name?: string
  client_phone?: string
  barber_id?: string
  amount?: number
  discount?: number
  discount_type?: 'percentage' | 'fixed'
  total: number
  payment_method?: 'cash' | 'card' | 'wallet'
  status?: 'completed' | 'pending'
  description?: string
  date: string
  time?: string
  items?: Array<{ id: string; name: string; price: number }>
  subtotal?: number
  visit_number?: number
  created_at?: string
  updated_at?: string
  clinic_id?: string
}

export interface Expense {
  id?: string
  category: string
  amount: number
  date: string
  note?: string
  created_at: string
  updated_at: string
}

export interface Settings {
  key: string
  value: any
  updated_at: string
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'ongoing'
  | 'completed'
  | 'cancelled'

export interface Barber {
  id?: string
  name: string
  phone?: string
  active: boolean
  working_hours_start?: string | null
  working_hours_end?: string | null
  days_off?: number[] | null
  vacation_start?: string | null
  vacation_end?: string | null
  created_at?: string
  updated_at?: string
  clinic_id?: string
}

export interface Booking {
  id?: string
  client_id: string
  client_name: string
  client_phone: string
  barber_id?: string
  barber_name?: string
  service_type?: string
  booking_date?: string
  booking_time: string
  duration?: number
  queue_number: number
  status: BookingStatus
  notes?: string
  created_at: string
  updated_at?: string
  clinic_id?: string
}

export interface WaitingList {
  id?: string
  clinic_id?: string
  client_id?: string
  client_name: string
  client_phone: string
  barber_id?: string
  barber_name?: string
  service_type?: string
  duration?: number
  status: 'waiting' | 'notified' | 'booked' | 'removed'
  notes?: string
  created_at?: string
  updated_at?: string
}
