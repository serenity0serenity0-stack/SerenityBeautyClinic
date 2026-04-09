-- ============================================================================
-- DATABASE AUDIT - COMPARE CODE EXPECTATIONS VS ACTUAL SCHEMA
-- ============================================================================
-- This shows exactly what tables/columns the code needs vs what exists

-- ============================================================================
-- STEP 1: LIST ALL TABLES THE CODE QUERIES
-- ============================================================================
-- From grep search of codebase, code queries these tables:
-- - clients
-- - expenses
-- - transactions
-- - services
-- - bookings
-- - barbers
-- - admin_auth
-- - portal_settings
-- - settings
-- - subscriptions (for subscription checker)
-- - clinic (for clinic info)

-- ============================================================================
-- STEP 2: SHOW WHAT ACTUALLY EXISTS IN DATABASE
-- ============================================================================
SELECT 
  tablename,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.tablename) as column_count,
  rowsecurity
FROM pg_tables t
WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- ============================================================================
-- STEP 3: SHOW COLUMNS IN EACH TABLE
-- ============================================================================
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- STEP 4: CHECK FOR OLD TABLES THAT SHOULD BE DROPPED
-- ============================================================================
-- Old multi-tenant tables that should NOT exist:
-- - shops
-- - shop_settings
-- - usage_logs

SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('shops', 'shop_settings', 'usage_logs');
