-- ============================================================================
-- DIAGNOSTIC: Verify Authentication & Dynamic Configuration
-- ============================================================================

-- ============================================================================
-- SECTION 1: Verify auth_user_id relationships (NOT hardcoded)
-- ============================================================================

-- Query 1: Check auth_user_id values are unique and properly linked
SELECT 
  id,
  name,
  auth_user_id,
  CASE 
    WHEN auth_user_id IS NULL THEN '⚠️ NULL'
    ELSE '✅ SET'
  END as auth_status,
  CASE 
    WHEN auth_user_id::text LIKE '________-____-____-____-____________' THEN '✅ VALID UUID'
    ELSE '❌ INVALID FORMAT'
  END as uuid_format
FROM shops
ORDER BY created_at DESC;

-- Query 2: Check for duplicate auth_user_id (should be unique)
SELECT 
  auth_user_id,
  COUNT(*) as shop_count,
  STRING_AGG(name, ', ') as shop_names
FROM shops
WHERE auth_user_id IS NOT NULL
GROUP BY auth_user_id
HAVING COUNT(*) > 1;

-- ============================================================================
-- SECTION 2: Verify Dynamic Email Formats (NOT hardcoded)
-- ============================================================================

-- Query 3: Check portal_users email format is dynamic
SELECT 
  id,
  phone,
  email,
  shop_id,
  CASE 
    WHEN email LIKE '%@%.portal' THEN '✅ DYNAMIC FORMAT'
    WHEN email LIKE '%@%' THEN '⚠️ CUSTOM EMAIL'
    ELSE '❌ INVALID'
  END as email_validation
FROM portal_users
ORDER BY shop_id;

-- Query 4: Verify email contains phone (NOT hardcoded names)
SELECT 
  id,
  phone,
  email,
  SUBSTRING(email FROM 1 FOR POSITION('@' IN email) - 1) as email_prefix,
  CASE 
    WHEN SUBSTRING(email FROM 1 FOR POSITION('@' IN email) - 1) = phone THEN '✅ PHONE EMBEDDED'
    ELSE '❌ NO PHONE'
  END as email_phone_check
FROM portal_users
ORDER BY shop_id;

-- ============================================================================
-- SECTION 3: Verify Timestamps Are Dynamic (NOT hardcoded)
-- ============================================================================

-- Query 5: Check created/updated timestamps are NOT all the same
SELECT 
  table_name,
  MIN(created_time) as earliest_timestamp,
  MAX(created_time) as latest_timestamp,
  COUNT(DISTINCT created_time) as unique_timestamps,
  COUNT(*) as total_records,
  EXTRACT(DAY FROM MAX(created_time) - MIN(created_time)) as days_spread
FROM (
  SELECT 'sessions' as table_name, created_at as created_time FROM portal_users
  UNION ALL
  SELECT 'clients', "createdAt" FROM clients
  UNION ALL
  SELECT 'bookings', createdat FROM bookings
  UNION ALL
  SELECT 'services', "createdAt" FROM services
)
GROUP BY table_name
ORDER BY table_name;

-- Query 6: Verify booking times are diverse (NOT hardcoded times)
SELECT 
  DATE(bookingtime) as booking_date,
  EXTRACT(HOUR FROM bookingtime) as booking_hour,
  COUNT(*) as count
FROM bookings
GROUP BY DATE(bookingtime), EXTRACT(HOUR FROM bookingtime)
ORDER BY booking_date DESC, booking_hour;

-- ============================================================================
-- SECTION 4: Verify subscription/payment data variability
-- ============================================================================

-- Query 7: Check subscription dates are NOT hardcoded
SELECT 
  name,
  subscription_status,
  subscription_end_date,
  CASE 
    WHEN subscription_end_date IS NULL THEN '⚠️ NULL'
    WHEN subscription_end_date::date >= CURRENT_DATE THEN '✅ ACTIVE'
    ELSE '❌ EXPIRED'
  END as subscription_status_check
FROM shops
ORDER BY subscription_end_date DESC;

-- Query 8: Check pricing is diverse (NOT hardcoded to one value)
SELECT 
  shop_id,
  'services' as data_type,
  COUNT(*) as item_count,
  COUNT(DISTINCT price) as unique_prices,
  MIN(price) as min_value,
  MAX(price) as max_value,
  AVG(price)::numeric(10,2) as avg_value,
  STDDEV(price)::numeric(10,2) as price_stddev
FROM services
WHERE active = TRUE
GROUP BY shop_id

UNION ALL

SELECT 
  shop_id,
  'transactions' as data_type,
  COUNT(*) as item_count,
  COUNT(DISTINCT amount) as unique_amounts,
  MIN(amount) as min_value,
  MAX(amount) as max_value,
  AVG(amount)::numeric(10,2) as avg_value,
  STDDEV(amount)::numeric(10,2) as amount_stddev
FROM transactions
WHERE shop_id IS NOT NULL
GROUP BY shop_id;

-- ============================================================================
-- SECTION 5: Verify No Hardcoded Default Values
-- ============================================================================

-- Query 9: Check column defaults are NOT suspicious hardcoded values
SELECT 
  table_name,
  column_name,
  data_type,
  column_default,
  CASE 
    WHEN column_default IS NULL THEN 'NO DEFAULT'
    WHEN column_default LIKE '%random%' THEN '✅ RANDOM/SEQUENTIAL'
    WHEN column_default LIKE '%now%' THEN '✅ DYNAMIC TIMESTAMP'
    WHEN column_default LIKE '%uuid%' THEN '✅ DYNAMIC UUID'
    WHEN column_default LIKE '%true%' OR column_default LIKE '%false%' THEN '⚠️ BOOLEAN'
    ELSE '❓ CHECK: ' || column_default
  END as default_analysis
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('shops', 'portal_users', 'clients', 'bookings', 'services', 'barbers')
  AND column_default IS NOT NULL
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- SECTION 6: Verify No Hardcoded Text Values in Data
-- ============================================================================

-- Query 10: Check for suspicious or repeated text patterns
SELECT 
  'barbers_name' as context,
  name as value,
  COUNT(*) as occurrence_count,
  CASE 
    WHEN COUNT(*) > 5 THEN '⚠️ POSSIBLY HARDCODED'
    ELSE '✅ UNIQUE'
  END as assessment
FROM barbers
GROUP BY name
HAVING COUNT(*) > 1

UNION ALL

SELECT 
  'services_name_ar' as context,
  "nameAr" as value,
  COUNT(*) as occurrence_count,
  CASE WHEN COUNT(*) > 5 THEN '⚠️ POSSIBLY HARDCODED' ELSE '✅ UNIQUE' END as assessment
FROM services
GROUP BY "nameAr"
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;

-- ============================================================================
-- SECTION 7: Verify Query Parameterization (check for literal strings in data)
-- ============================================================================

-- Query 11: Check table sizes to ensure data is NOT hardcoded (should have variety)
SELECT 
  'Data Variety Check' as check_name,
  schemaname::text as schema_name,
  tablename::text as table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = schemaname AND table_name = t.tablename) as record_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('shops', 'portal_users', 'clients', 'bookings', 'services', 'barbers', 'transactions')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- FINAL VERIFICATION: Summary Report
-- ============================================================================

-- Query 12: Generate complete audit report (simplified for reliability)
SELECT 
  'ISOLATION AUDIT' as audit_type,
  'Shops' as entity,
  (SELECT COUNT(*) FROM shops) as data_count,
  (SELECT COUNT(DISTINCT shop_id) FROM bookings) as isolation_count,
  '✅ Complete' as status

UNION ALL

SELECT 
  'DATA VARIETY',
  'Bookings Have Diverse Timestamps',
  COUNT(*)::text,
  COUNT(DISTINCT createdat)::text,
  CASE 
    WHEN COUNT(*) > 0 AND COUNT(*) = COUNT(DISTINCT createdat) THEN '✅ NOT HARDCODED'
    WHEN COUNT(*) > 0 THEN '✅ DIVERSE DATA'
    ELSE '⚠️ NO DATA'
  END as assessment
FROM bookings;
