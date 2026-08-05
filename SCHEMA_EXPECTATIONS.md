# DATABASE SCHEMA EXPECTATIONS

## Code-Expected Tables (from TypeScript)

### 1. clients
```typescript
interface Client {
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
```

### 2. services
```typescript
interface Service {
  id?: string
  nameAr?: string
  nameEn?: string
  price: number
  duration: number
  category: string
  active: boolean
  created_at?: string
  updated_at?: string
  clinic_id?: string
}
```

### 3. transactions
```typescript
interface Transaction {
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
```

### 4. expenses
```typescript
interface Expense {
  id?: string
  category: string
  amount: number
  date: string
  note?: string
  created_at: string
  updated_at: string
  clinic_id?: string
}
```

### 5. barbers
```typescript
interface Barber {
  id?: string
  name: string
  phone?: string
  active: boolean
  created_at?: string
  updated_at?: string
  clinic_id?: string
}
```

### 6. bookings
```typescript
interface Booking {
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
  status: 'pending' | 'ongoing' | 'completed' | 'cancelled'
  notes?: string
  created_at: string
  updated_at?: string
  clinic_id?: string
}
```

### 7. admin_auth (queried for authentication)
```
- id: UUID
- email: VARCHAR
- auth_user_id: UUID
- clinic_id: UUID
- role: VARCHAR
- active: BOOLEAN
```

### 8. portal_settings
```
- id: UUID
- clinic_id: UUID
- portal_enabled: BOOLEAN
- portal_title: VARCHAR
- portal_description: TEXT
- allow_booking: BOOLEAN
- allow_profile_edit: BOOLEAN
- auto_logout_minutes: INT
- branding_logo_url: VARCHAR
- branding_primary_color: VARCHAR
- branding_secondary_color: VARCHAR
- updated_at: TIMESTAMP
```

### 9. settings
```
- key: VARCHAR
- value: JSONB
- updated_at: TIMESTAMP
- clinic_id: UUID
```

### 10. clinic (used for clinic info)
```
- id: UUID
- name: VARCHAR
- email: VARCHAR
- phone: VARCHAR
- admin_email: VARCHAR
- admin_name: VARCHAR
- primary_color: VARCHAR
- secondary_color: VARCHAR
- accent_color: VARCHAR
```

### 11. subscriptions
```
- id: UUID
- clinic_id: UUID
- plan: VARCHAR
- status: VARCHAR
- started_at: TIMESTAMP
- expires_at: TIMESTAMP
```

## OLD TABLES TO DROP
- ~~shops~~ (should be replaced by clinic)
- ~~shop_settings~~
- ~~usage_logs~~
