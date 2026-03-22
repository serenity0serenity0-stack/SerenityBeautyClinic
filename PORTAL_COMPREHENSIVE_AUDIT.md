# COMPREHENSIVE PORTAL AUDIT REPORT
**Date:** March 22, 2026  
**Status:** ⚠️ CRITICAL ISSUES FOUND

---

## 1. ❌ COLUMN NAME MISMATCHES (CRITICAL)

### A. usePortalBookings.ts - WRONG COLUMN NAMES
**File:** [src/hooks/usePortalBookings.ts](src/hooks/usePortalBookings.ts)

| Line | Issue | Current | Should Be | Severity |
|------|-------|---------|-----------|----------|
| 51 | services table query | `.eq('isActive', true)` | `.eq('active', true)` | 🔴 CRITICAL |
| 69 | barbers table query | `.eq('isActive', true)` | `.eq('active', true)` | 🔴 CRITICAL |

**SQL Schema Reality:**
- `services` table has column: `active` (NOT `isActive`)
- `barbers` table has column: `active` (NOT `isActive`)
- Source: `supabase-schema.sql` lines 19-79

**Impact:** Services and barbers won't load in portal → booking creation will fail

---

### B. usePortalProfile.ts - WRONG TABLE NAME
**File:** [src/hooks/usePortalProfile.ts](src/hooks/usePortalProfile.ts)

| Line | Issue | Current Table | Should Be | Severity |
|------|-------|----------------|-----------|----------|
| 24 | profile fetch | `portal_customers` | `customer_users` | 🔴 CRITICAL |
| 39 | profile update | `portal_customers` | `customer_users` | 🔴 CRITICAL |
| 59 | phone verify | `portal_customers` | `customer_users` | 🔴 CRITICAL |
| 72 | email verify | `portal_customers` | `customer_users` | 🔴 CRITICAL |

**SQL Schema Reality:**
- Table is called `customer_users` (defined in `supabase-customer-portal.sql`)
- No `portal_customers` table exists
- Columns exist: `full_name`, `email`, `phone` (no phone_verified/email_verified)

**Impact:** Portal profile page will crash → data fetch errors

---

### C. Column Naming Convention - MIXED PATTERNS USED
**Status:** ✅ PASSING (but inconsistent code style)

#### CORRECT (snake_case):
- ✅ `usePortalAuth.ts`: Uses `birth_date`, `full_name`, `customer_user_id` (correct SQL column names)
- ✅ `usePortalHistory.ts`: Uses `visit_date`, `amount_paid`, `customer_user_id` (correct)
- ✅ `usePortalDashboardStats.ts`: Uses `booking_date`, `booking_time`, `customer_user_id` (correct)
- ✅ `usePortalSettingsWithShop.ts`: Uses `portal_slug`, `is_active` (correct)

#### WRONG (camelCase where not appropriate):
- ❌ `usePortalBookings.ts` line 51, 69: Uses camelCase `isActive` instead of `active`
- ❌ `usePortalProfile.ts`: Uses non-existent table name

---

## 2. ⚠️ DATA ISOLATION ISSUES

### A. Missing Shop Filter - usePortalProfile.ts
**File:** [src/hooks/usePortalProfile.ts](src/hooks/usePortalProfile.ts)  
**Issue:** Should filter by shop_id to prevent cross-shop data access

**Current Code (WRONG):**
```typescript
// Line 24-26
const { data, error: err } = await supabase
  .from('portal_customers')
  .select('id, name, email, phone, phone_verified, email_verified')
  .eq('id', customerId)  // ⚠️ NO SHOP FILTER!
```

**Should Be:**
```typescript
const { data, error: err } = await supabase
  .from('customer_users')
  .select('id, full_name, email, phone, shop_id')
  .eq('id', customerId)
  .eq('shop_id', shopId)  // ADD THIS
```

**Severity:** 🔴 CRITICAL - Customer could access another shop's portal

---

### B. Customer Isolation - All Queries
**Status:** ✅ PASSING (but needs verification)

Queries Properly Include Filters:
- ✅ `usePortalAuth.ts`: Verifies `customer_user_id` and `shop_id` match
- ✅ `usePortalBookings.ts`: Filters by both `customer_user_id` AND `shop_id`
- ✅ `usePortalHistory.ts`: Filters by both `customer_user_id` AND `shop_id`
- ✅ `usePortalDashboardStats.ts`: Filters by both `customer_user_id` AND `shop_id`

---

## 3. 🔐 AUTHENTICATION ISSUES

### A. Sign-Up Email/Phone Uniqueness - PARTIAL IMPLEMENTATION
**File:** [src/hooks/usePortalAuth.ts](src/hooks/usePortalAuth.ts) line 250

**Current:**
```typescript
// Database constraints exist: UNIQUE(shop_id, email) and UNIQUE(shop_id, phone)
// But code doesn't explicitly handle uniqueness errors
```

**Issue:** Application should catch and display friendly messages for:
- ❌ Email already exists in shop
- ❌ Phone already exists in shop

**Recommendation:** Add explicit validation before signup attempt:
```typescript
// Check email uniqueness within shop
const { data: existingEmail } = await supabase
  .from('customer_users')
  .select('id')
  .eq('shop_id', shopId)
  .eq('email', email)
  .maybeSingle()

if (existingEmail) throw new Error('البريد الإلكتروني مسجل بالفعل')
```

**Severity:** 🟡 MEDIUM - Relies on database constraints only

---

### B. Sign-In Shop Verification - ✅ PASSING
**File:** [src/hooks/usePortalAuth.ts](src/hooks/usePortalAuth.ts) line 219

**Status:** ✅ Correctly verifies customer belongs to shop
- Lines 228-234: Checks `customerData.shop_id !== shopId`
- Properly signs out if mismatch

---

### C. Protected Pages Redirect - ✅ PASSING (with condition)
**Files:** Portal pages (PortalDashboard, PortalBookings, etc.)

**Status:** ✅ Correctly redirects to login when not authenticated
```typescript
// Example from PortalDashboard.tsx lines 31-33
useEffect(() => {
  if (!loading && !isAuthenticated) {
    navigate(`/shop/${slug}/login`, { replace: true })
  }
}, [isAuthenticated, loading, slug, navigate])
```

---

## 4. 🚫 MISSING PORTAL_SETTINGS CHECKS - CRITICAL

### A. Portal Active Status NOT CHECKED
**File:** [src/pages/portal/PortalLanding.tsx](src/pages/portal/PortalLanding.tsx)

**Current:** ❌ No check if `is_active = false`
```typescript
// Portal loads regardless of is_active status
const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)
// ⚠️ Never checks settings.is_active
```

**Should Be:**
```typescript
// After loading settings, check if portal is active
if (!loading && settings && !settings.is_active) {
  return <PortalInactiveView /> // Show "Portal closed" message
}
```

**Impact:** 🔴 CRITICAL - Shop can't disable portal; customers can access inactive portals

---

### B. Portal Not Found - BLANK PAGE
**File:** [src/pages/portal/PortalLanding.tsx](src/pages/portal/PortalLanding.tsx)

**Current:** ❌ Shows blank page or loading state
```typescript
// No error handling for invalid slug
if (settingsLoading) return <LoadingSpinner />
if (!settings) return <div /> // ⚠️ BLANK!
```

**Should Be:**
```typescript
if (settingsLoading) return <LoadingSpinner />
if (error) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1>البوربتال غير موجود</h1>
        <p>يرجى التحقق من رابط البوربتال</p>
      </div>
    </div>
  )
}
```

**Severity:** 🟡 MEDIUM - Poor UX but not data leak

---

## 5. ✅ APP.TSX PORTAL ROUTES - PASSING

**File:** [src/App.tsx](src/App.tsx) lines 301-307

### Verification Result:
All 7 portal routes exist and are correctly configured:

| # | Route | Page Component | Status |
|---|-------|---|--------|
| 1 | `/shop/:slug` | PortalLanding | ✅ Exists |
| 2 | `/shop/:slug/login` | PortalLogin | ✅ Exists |
| 3 | `/shop/:slug/register` | PortalRegister | ✅ Exists |
| 4 | `/shop/:slug/dashboard` | PortalDashboard | ✅ Exists |
| 5 | `/shop/:slug/bookings` | PortalBookings | ✅ Exists |
| 6 | `/shop/:slug/history` | PortalHistory | ✅ Exists |
| 7 | `/shop/:slug/profile` | PortalProfile | ✅ Exists |

### Route Protection:
✅ NOT wrapped with ShopRoute or AdminRoute (correct - portal is public-facing)
✅ Slug-based routing allows multi-tenant access

---

## 6. 📋 ADDITIONAL ISSUES FOUND

### A. usePortalBookings - Wrong Query Target
**File:** [src/hooks/usePortalBookings.ts](src/hooks/usePortalBookings.ts) line 114

```typescript
// This queries wrong table - there's no consistent pattern
.from('bookings')  // Is this staff bookings or customer bookings?
```

Should query `customer_bookings` consistently:
```typescript
.from('customer_bookings')
```

**Severity:** 🔴 CRITICAL - May access wrong booking data

---

### B. Table Relationship Confusion
**File:** [src/hooks/usePortalHistory.ts](src/hooks/usePortalHistory.ts)

**Question:** Where does `visit_logs` data come from?
- `visit_logs` table is for tracking completed visits
- But `customer_bookings` is for future bookings
- Need to clarify: Should history show `visit_logs` or completed `customer_bookings`?

**Current Implementation:** Uses `visit_logs` (seems correct for history)

---

## 7. 🧪 RLS POLICIES - VERIFICATION NEEDED

**Status:** ⚠️ Need to verify RLS policies exist

The customer portal tables need RLS policies:
- [ ] `customer_users` - customers can only see themselves
- [ ] `customer_bookings` - customers can only see their own bookings
- [ ] `visit_logs` - customers can only access their own records
- [ ] `portal_settings` - public read but not modify

**Note:** No RLS policy implementation found in portal code

---

## SUMMARY OF CRITICAL ISSUES

| Issue | File | Lines | Fix Difficulty | Data Risk |
|-------|------|-------|-----------------|-----------|
| Wrong column name `isActive` | usePortalBookings.ts | 51, 69 | Easy | High |
| Wrong table `portal_customers` | usePortalProfile.ts | 24, 39, 59, 72 | Easy | High |
| No shop_id filter in profile | usePortalProfile.ts | 24 | Easy | Critical |
| Portal `is_active` not checked | PortalLanding.tsx | - | Medium | Medium |
| Blank page on not found | PortalLanding.tsx | - | Easy | Low |
| Wrong bookings table (bookings vs customer_bookings) | usePortalBookings.ts | 114 | Easy | High |

---

## RECOMMENDED FIX ORDER

### Priority 1 (Do First - Data Integrity)
1. Fix `usePortalProfile.ts` - table name and add shop_id filter
2. Fix `usePortalBookings.ts` - column names (active vs isActive)
3. Fix `usePortalBookings.ts` - use correct bookings table

### Priority 2 (Do Second - Feature Completeness)
4. Add `is_active` check to portal landing
5. Add "portal not found" error handling
6. Add email/phone uniqueness pre-validation

### Priority 3 (Do Third - Security)
7. Verify all RLS policies are configured
8. Test cross-shop data isolation

---

## FILES TO MODIFY

- ✏️ [src/hooks/usePortalProfile.ts](src/hooks/usePortalProfile.ts) - 4 changes needed
- ✏️ [src/hooks/usePortalBookings.ts](src/hooks/usePortalBookings.ts) - 3 changes needed
- ✏️ [src/pages/portal/PortalLanding.tsx](src/pages/portal/PortalLanding.tsx) - 2 changes needed
- 💬 [src/hooks/usePortalAuth.ts](src/hooks/usePortalAuth.ts) - Recommend: Add pre-validation

---

## NEXT STEPS

1. Address Priority 1 issues immediately (data integrity risk)
2. Run integration tests after fixes
3. Test with multiple shops to verify isolation
4. Set up automated column name validation
