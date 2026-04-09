# Dashboard Errors - Root Cause Analysis & Fix

**Status:** Production Deployment Issues  
**Date:** March 25, 2026  
**Affected Admin:** serenity0serenity0@gmail.com  
**Errors:** 404, 403, 400 HTTP responses from Supabase queries

---

## 🔍 Error Analysis

### Error 1: **404 - Subscription Not Found**
```
Failed to load resource: the server responded with a status of 404
Endpoint: subscriptions?id=eq.a844c8e8-b7f2-402b-a2a1-d68cc002e8de
```
**Cause:** Subscription record doesn't exist for the clinic  
**Impact:** Dashboard shows subscription warning  
**Fix:** Create subscription record for clinic

### Error 2: **403 - Forbidden on Transaction Queries**
```
Failed to load resource: the server responded with a status of 403
Endpoint: transactions?clinic_id=eq.a844c8e8-b7f2-402b-a2a1-d68cc002e8de&order=created_at.desc
```
**Cause:** RLS policy not permitting transaction reads (likely policy is missing or too restrictive)  
**Impact:** Dashboard cannot load transactions - main revenue data unavailable  
**Fix:** Update RLS policies to allow admin read access

### Error 3: **400 - Bad Request on Expense Queries**
```
Failed to load resource: the server responded with a status of 400
Endpoint: expenses?clinic_id=eq....&order=date.desc
```
**Cause:** Column name mismatch or invalid query syntax  
**Impact:** Expense tracking unavailable  
**Fix:** Verify column names and update query if needed

---

## ✅ Step-by-Step Fix Instructions

### Step 1: Run Diagnostic SQL (5 minutes)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create new query with file: `fix-dashboard-errors.sql`
3. Run all statements in order
4. Review output to identify which data is missing

### Step 2: Create Missing Clinic Record (if needed)

If diagnostic shows clinic record is missing:

```sql
INSERT INTO clinic (
  id, name, admin_email, admin_name, 
  primary_color, secondary_color, accent_color,
  timezone, currency, language
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'Serenity Beauty Clinic',
  'serenity0serenity0@gmail.com',
  'Admin',
  '#E91E63', '#C2185B', '#F06292',
  'Africa/Cairo', 'EGP', 'ar'
);
```

### Step 3: Create Missing Subscription Record (if needed)

```sql
INSERT INTO subscriptions (clinic_id, plan, status, started_at, expires_at)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'professional',
  'active',
  NOW(),
  NOW() + INTERVAL '365 days'
);
```

### Step 4: Fix RLS Policies

Drop too-restrictive policies and recreate:

```sql
-- Drop existing transaction policies
DROP POLICY IF EXISTS "Admin: select own clinic transactions" ON transactions;
DROP POLICY IF EXISTS "Admin: insert own clinic transactions" ON transactions;
DROP POLICY IF EXISTS "Admin: update own clinic transactions" ON transactions;

-- Create new permissive policies for admin
CREATE POLICY "Admin: select transactions" ON transactions
FOR SELECT USING (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth WHERE clinic_id = transactions.clinic_id
  ) OR clinic_id IS NULL
);

CREATE POLICY "Admin: insert transactions" ON transactions
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth WHERE clinic_id = transactions.clinic_id
  )
);

CREATE POLICY "Admin: update transactions" ON transactions
FOR UPDATE USING (
  auth.uid() IN (
    SELECT auth_user_id FROM admin_auth WHERE clinic_id = transactions.clinic_id
  )
);
```

### Step 5: Add Sample Data (Optional - for testing)

```sql
-- Create sample transaction
INSERT INTO transactions (
  clinic_id, client_name, client_phone, amount, total, payment_method, 
  status, date, created_at, updated_at
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'Test Client', '01001234567', 100, 100, 'cash', 'completed',
  CURRENT_DATE::text, NOW(), NOW()
);

-- Create sample expense
INSERT INTO expenses (
  clinic_id, category, amount, date, created_at, updated_at
)
VALUES (
  'a844c8e8-b7f2-402b-a2a1-d68cc002e8de',
  'supplies', 150, CURRENT_DATE::text, NOW(), NOW()
);
```

### Step 6: Verify Everything Works

Run verification queries:
```sql
-- Should show 0 errors from above steps
SELECT 'Clinic' as name, COUNT(*) 
FROM clinic 
WHERE id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

SELECT 'Subscription' as name, COUNT(*) 
FROM subscriptions 
WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';

SELECT 'Transactions' as name, COUNT(*) 
FROM transactions 
WHERE clinic_id = 'a844c8e8-b7f2-402b-a2a1-d68cc002e8de';
```

### Step 7: Hard Refresh Dashboard

1. Go to deployed app: `https://vwttkglmvtkrrnxeaazz.vercel.app`
2. Log in as admin
3. **Hard refresh** browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
4. Check browser console (`F12` → Console tab) for errors

---

## 🛠️ Architecture Context

**Admin User:**
- Email: serenity0serenity0@gmail.com
- Auth ID: 9bf6605a-db64-4024-9245-f23ef16cae37

**Clinic Record:**
- ID: a844c8e8-b7f2-402b-a2a1-d68cc002e8de
- Name: Serenity Beauty Clinic
- Admin Link: admin_auth table (links auth_user_id to clinic_id)

**Data Flow:**
1. User logs in → Supabase Auth creates session
2. useAuth hook queries admin_auth table → gets clinic_id
3. useTransactions/useExpenses filter by clinic_id via RLS
4. Dashboard displays clinic-specific data

**Why Errors Occur:**
- Clinic record missing → 404 on subscription lookup
- RLS policy denying query → 403 on transaction select
- Column name mismatch → 400 on query syntax error

---

## 📋 Troubleshooting Checklist

- ✅ Clinic record exists with correct ID
- ✅ Admin_auth record links auth_user_id to clinic_id
- ✅ Subscription record created with status='active'
- ✅ RLS policies allow admin read/write to transactions
- ✅ RLS policies allow admin read/write to expenses
- ✅ Sample data exists for dashboard (at least 1 transaction)
- ✅ Browser cache cleared (hard refresh)
- ✅ No TypeScript errors in console

---

## 🚀 Expected Result After Fixes

**Before:**
```
Dashboard render: transLoading= true loading= true  ❌
Error fetching transactions: 403 Forbidden
Error fetching expenses: 400 Bad Request
Error checking subscription: 404 Not Found
```

**After:**
```
Dashboard render: transLoading= false loading= false  ✅
Transactions fetched: 5 records
Expenses fetched: 2 records
Subscription status: active
```

Dashboard displays:
- Today's revenue from transactions
- Monthly revenue statistics
- Recent transactions list
- Expenses tracking
- Client count analytics
- Active subscription banner

---

## 📞 Additional Help

If issues persist:

1. **Check browser console** (`F12` → Console tab) for exact error messages
2. **Verify auth status**: Open DevTools → Application → Cookies → Check supabase session
3. **Check Supabase logs**: Supabase Dashboard → Logs → See actual query errors
4. **Verify RLS policies**: Supabase Dashboard → Authentication → Policies tab
5. **Check table permissions**: Supabase Dashboard → SQL Editor → Run `\d transactions`

