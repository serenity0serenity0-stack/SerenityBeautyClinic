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
  service_type?: 'regular' | 'package'
  unit_label?: string | null
  package_quantity?: number | null
  bonus_quantity?: number | null
  expiry_value?: number | null
  expiry_unit?: 'days' | 'weeks' | 'months' | null
  description?: string | null
  created_at?: string
  updated_at?: string
}

export interface InvoiceItem {
  id: string
  clinic_id: string
  transaction_id: string
  service_id?: string | null
  service_name: string
  service_type: string
  unit_label?: string | null
  unit_price: number
  quantity: number
  bonus_quantity: number
  line_total: number
  created_at?: string
}

export interface ServicePurchase {
  id: string
  clinic_id: string
  client_id: string
  transaction_id?: string | null
  invoice_item_id?: string | null
  service_id?: string | null
  service_name: string
  unit_label?: string | null
  paid_quantity: number
  bonus_quantity: number
  total_quantity: number
  remaining_quantity: number
  unit_price: number
  amount: number
  expiry_date?: string | null
  status: 'active' | 'fully_used' | 'expired' | 'voided' | 'adjustment'
  created_at?: string
  updated_at?: string
}

export interface ServiceConsumption {
  id: string
  clinic_id: string
  client_id: string
  purchase_id: string
  service_id?: string | null
  service_name: string
  unit_label?: string | null
  quantity: number
  note?: string | null
  created_at?: string
  created_by?: string | null
}

export interface BalanceAdjustment {
  id: string
  clinic_id: string
  client_id: string
  service_id?: string | null
  service_name: string
  unit_label?: string | null
  delta: number
  reason?: string | null
  created_at?: string
  created_by?: string | null
}

export interface ClientBalanceSummary {
  clinic_id: string
  client_id: string
  service_id: string
  service_name: string
  unit_label: string
  purchased: number
  bonus: number
  remaining: number
  active_purchases: number
  earliest_expiry?: string | null
}

export interface Transaction {
  id?: string
  client_id?: string
  booking_id?: string
  client_name?: string
  client_phone?: string
  barber_id?: string
  barber_name?: string
  amount?: number
  discount?: number
  discount_type?: 'percentage' | 'fixed'
  total: number
  payment_method?: 'cash' | 'card' | 'wallet'
  status?: 'completed' | 'pending'
  description?: string
  invoice_no?: number
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
  email?: string
  specialization?: string
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

export interface CustomerNote {
  id?: string
  customer_id: string
  clinic_id?: string
  note: string
  created_by?: string
  created_by_name?: string | null
  created_at?: string
  updated_at?: string
}
