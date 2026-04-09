# ⚡ Serenity Beauty Clinic - Quick Reference

**Fast lookup for common tasks**

---

## 📱 Routes

```
/login          → Admin login
/dashboard      → Dashboard (KPIs, overview)
/pos            → Point of Sale (checkout)
/bookings       → Appointment management
/queue          → Queue display (waiting room)
/services       → Beauty services management
/therapists     → Therapist/staff management
/clients        → Client database
/analytics      → Reports & analytics
/logs           → Daily visit logs
/expenses       → Expense tracking
/settings       → Clinic configuration
```

---

## 🗄️ Database Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `admin_auth` | Admin user linking | auth_user_id, clinic_id, email |
| `therapists` | Beauty therapists | name, phone, specialization |
| `clients` | Client database | name, phone, skin_type, allergies |
| `services` | Beauty services | name_ar, name_en, price, duration, category |
| `bookings` | Appointments | client_id, therapist_id, booking_time, status |
| `transactions` | POS sales | client_id, items, total, payment_method |
| `expenses` | Business expenses | category, amount, date |
| `visit_logs` | Client visit notes | client_id, therapist_id, visit_date, notes |
| `settings` | Clinic config | key (enum), value (JSON) |

---

## 🎨 Colors

**Primary Colors:**
```css
--hot-pink: #E91E63          /* Main buttons, accents */
--deep-pink: #C2185B         /* Secondary, hover */
--light-pink: #F06292        /* Lighter accents */
--soft-pink: #F48FB1         /* Very light, backgrounds */
```

**Usage:**
- Primary actions → `hot-pink`
- Hover states → `deep-pink`
- Backgrounds → `blush` (#FBE9E7) or `lavender` (#F3E5F5)
- Text → `white` or `white/80` on dark backgrounds

**Tailwind Classes:**
```html
<!-- Button -->
<button className="bg-hot-pink hover:bg-deep-pink text-white">
  Click me
</button>

<!-- Accent -->
<div className="border border-hot-pink/50">
  Content
</div>

<!-- Loading -->
<div className="border-4 border-hot-pink/20 border-t-hot-pink animate-spin" />
```

---

## 🔐 Authentication

**Login Flow:**
1. User enters email/password
2. Supabase Auth validates
3. `checkIfAdmin()` checks `admin_auth` table
4. If found → redirect to `/dashboard`
5. If not found → `signOut()` and show error

**Key Hook:**
```typescript
import { useAuth } from '@/hooks/useAuth'

const { user, role, clinicId, loading, error, signIn, signOut } = useAuth()
```

**Protected Route:**
```typescript
function ProtectedRoute({ children }) {
  const { loading, role } = useAuth()
  if (loading) return <Loading />
  if (!role) return <Navigate to="/login" />
  return children
}
```

---

## 📊 Common Queries

### Get all services
```typescript
const { data: services } = await supabase
  .from('services')
  .select('*')
  .eq('active', true)
  .order('category')
```

### Create booking
```typescript
const { data, error } = await supabase
  .from('bookings')
  .insert({
    client_id: clientId,
    therapist_id: therapistId,
    booking_time: new Date().toISOString(),
    status: 'pending'
  })
```

### Get client history
```typescript
const { data: visits } = await supabase
  .from('visit_logs')
  .select('*')
  .eq('client_id', clientId)
  .order('visit_date', { ascending: false })
```

### Create transaction (POS)
```typescript
const { data } = await supabase
  .from('transactions')
  .insert({
    client_id: clientId,
    items: [{ service_id, quantity, price }],
    total: 500,
    payment_method: 'cash',
    date: today
  })
```

---

## 🧪 Testing Checklist

```
Before deploying:
- [ ] Login works
- [ ] Dashboard loads data
- [ ] Can create client
- [ ] Can create booking
- [ ] Can create transaction
- [ ] Can edit therapist
- [ ] Queue display shows bookings
- [ ] Reports generate
- [ ] Dark theme works
- [ ] Light theme works
- [ ] Arabic RTL works
- [ ] English LTR works
- [ ] Mobile responsive
- [ ] Print dialog works
```

---

## 🐛 Debug Mode

**Check what user is logged in:**
```typescript
const { user, role, clinicId } = useAuth()
console.log('User:', user?.email)
console.log('Role:', role)
console.log('Clinic:', clinicId)
```

**Check Supabase session:**
```typescript
import { supabase } from '@/db/supabase'

const { data } = await supabase.auth.getSession()
console.log(data.session)
```

**Check database connection:**
```typescript
const { data, error } = await supabase.from('services').select('count(*)')
if (error) console.error('DB Error:', error)
else console.log('Connected! Count:', data)
```

---

## 📝 Common Tasks

### Add a new service
```typescript
// In Services page component:
await supabase.from('services').insert({
  name_ar: 'تقشير البشرة',
  name_en: 'Facial Peeling',
  price: 200,
  duration: 45,
  category: 'skincare',
  active: true
})
```

### Update therapist
```typescript
await supabase
  .from('therapists')
  .update({ name: 'New Name' })
  .eq('id', therapistId)
```

### Delete client
```typescript
await supabase
  .from('clients')
  .delete()
  .eq('id', clientId)
```

### Add service to visit log
```typescript
await supabase.from('visit_logs').insert({
  client_id: clientId,
  therapist_id: therapistId,
  visit_date: today,
  notes: 'Great service!',
  products_used: [{ name: 'Moisturizer', brand: 'Luxury' }]
})
```

---

## 🌍 Translations

**Arabic translations at:** `src/locales/ar.json`  
**English translations at:** `src/locales/en.json`

**Usage:**
```typescript
import { useTranslation } from 'react-i18next'

export function MyComponent() {
  const { t, i18n } = useTranslation()
  
  return (
    <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <h1>{t('dashboard.title')}</h1>
    </div>
  )
}
```

**Add new translation:**
```json
// In ar.json and en.json:
{
  "myFeature": {
    "title": "..."
  }
}
```

---

## 🚀 Build & Deploy

**Local Development:**
```bash
npm run dev      # Start dev server (http://localhost:5174)
npm run build    # Test production build
npm run preview  # Preview production build
```

**Deploy to Vercel:**
```bash
git add .
git commit -m "Your message"
git push origin main
# Vercel auto-deploys from GitHub
```

---

## 📦 Project Dependencies

**Frontend:**
- `react@18.2` - UI library
- `typescript@5.3` - Type safety
- `vite@5.0` - Build tool
- `tailwindcss@3.4` - Styling
- `framer-motion@11.0` - Animations

**Forms & Validation:**
- `react-hook-form@7.71` - Form management
- `zod@4.3` - Schema validation
- `@hookform/resolvers` - Form validation

**Database:**
- `@supabase/supabase-js@2.99` - Supabase client
- `supabase@1.120` - Supabase library

**UI & Utils:**
- `lucide-react@0.400` - Icons
- `react-router-dom@7.13` - Routing
- `react-hot-toast@2.4` - Notifications
- `react-to-print@2.14` - Receipt printing
- `recharts@2.12` - Charts/analytics
- `i18next@23.7` - Internationalization
- `date-fns@3.0` - Date utilities

---

## 🎯 Key Hooks

```typescript
// Authentication
import { useAuth } from '@/hooks/useAuth'
const { user, role, clinicId, loading, error, signIn, signOut } = useAuth()

// Theme
import { useTheme } from '@/hooks/useTheme'
const { theme, toggleTheme } = useTheme()

// Language
import { useLanguage } from '@/hooks/useLanguage'
const { language, changeLanguage } = useLanguage()

// Forms
import { useForm } from 'react-hook-form'
const { register, handleSubmit, formState: { errors } } = useForm()

// Translations
import { useTranslation } from 'react-i18next'
const { t, i18n } = useTranslation()
```

---

## 💡 Tips & Tricks

**Performance:**
- Use `React.memo` for frequently rendered components
- Lazy load routes: `import { lazy } from 'react'`
- Memoize callbacks: `useCallback`
- Cache computed values: `useMemo`

**Styling:**
- Use Tailwind `@apply` for reusable styles
- Define colors in tailwind.config.js
- Use CSS variables for theme colors

**Debugging:**
- use browser DevTools (F12)
- Check Network tab for API calls
- Use React DevTools Extension
- Check Supabase Console logs

**Deployment:**
- Always test with `npm run build` first
- Check error logs on Vercel dashboard
- Use `vercel env` to manage secrets
- Keep `.env.local` synced with Vercel env vars

---

## 📞 Quick Links

- **Supabase Dashboard:** https://app.supabase.com
- **Vercel Dashboard:** https://vercel.com
- **React Documentation:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **Supabase Docs:** https://supabase.com/docs

---

**Keep this doc handy!** 📌

