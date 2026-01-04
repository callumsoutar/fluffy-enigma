-- Scheduler Access Configuration - RLS Test Queries
-- Run these queries to verify RLS policies are working correctly
-- Test with different user roles to ensure proper access control

-- =============================================================================
-- SETUP: Get test user IDs for different roles
-- =============================================================================

-- Find a student user
SELECT u.id as student_user_id, u.email, ur.role
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'student'
LIMIT 1;

-- Find a member user
SELECT u.id as member_user_id, u.email, ur.role
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'member'
LIMIT 1;

-- Find an instructor user
SELECT u.id as instructor_user_id, u.email, ur.role
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'instructor'
LIMIT 1;

-- Find an admin user
SELECT u.id as admin_user_id, u.email, ur.role
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'admin'
LIMIT 1;

-- =============================================================================
-- TEST 1: Verify RLS is enabled on all tables
-- =============================================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('aircraft', 'roster_rules', 'instructors', 'aircraft_types')
ORDER BY tablename;

-- Expected: All tables should have rls_enabled = true

-- =============================================================================
-- TEST 2: List all policies for scheduler-related tables
-- =============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('aircraft', 'roster_rules', 'instructors', 'aircraft_types')
ORDER BY tablename, cmd, policyname;

-- Expected: Should see policies for SELECT, INSERT, UPDATE, DELETE operations

-- =============================================================================
-- TEST 3: Test aircraft SELECT access (should work for all authenticated users)
-- =============================================================================

-- This simulates what happens when a student/member accesses the scheduler
-- In production, this is enforced by Supabase RLS automatically

-- Check if policy allows SELECT for authenticated users
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'aircraft'
  AND cmd = 'SELECT'
  AND schemaname = 'public';

-- Expected: Should see "Authenticated users can view aircraft" policy

-- =============================================================================
-- TEST 4: Test roster_rules SELECT access
-- =============================================================================

SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'roster_rules'
  AND cmd = 'SELECT'
  AND schemaname = 'public';

-- Expected: Should see "Authenticated users can view roster rules" policy
-- Should include is_active = true and voided_at IS NULL checks

-- =============================================================================
-- TEST 5: Verify write operations are restricted
-- =============================================================================

-- Check INSERT policies (should require specific roles)
SELECT 
  tablename,
  policyname,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('aircraft', 'roster_rules', 'instructors')
  AND cmd = 'INSERT'
ORDER BY tablename;

-- Expected: All should use user_has_any_role with ['owner', 'admin', 'instructor']

-- =============================================================================
-- TEST 6: Test role checking functions
-- =============================================================================

-- Test user_has_any_role function (replace USER_ID with actual test user ID)
-- SELECT public.user_has_any_role(
--   ARRAY['owner', 'admin', 'instructor']::user_role[],
--   'USER_ID_HERE'::uuid
-- );

-- Test with student user (should return false)
-- Test with instructor user (should return true)

-- =============================================================================
-- TEST 7: Verify data visibility (sample queries)
-- =============================================================================

-- Count aircraft visible to all users
SELECT COUNT(*) as total_aircraft
FROM public.aircraft;

-- Count active roster rules visible to all users
SELECT COUNT(*) as total_active_roster_rules
FROM public.roster_rules
WHERE is_active = true
  AND voided_at IS NULL;

-- Count instructors visible to all users
SELECT COUNT(*) as total_instructors
FROM public.instructors;

-- =============================================================================
-- TEST 8: Verify sensitive data is still protected
-- =============================================================================

-- These tables should NOT be readable by students/members
-- (Should fail or return empty if RLS is working)

-- Test settings table (should be admin-only)
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'settings'
ORDER BY cmd;

-- Expected: Should see policies restricting access to admins only

-- =============================================================================
-- TEST 9: Check for any overly permissive policies
-- =============================================================================

-- Find policies that might be too permissive (USING (true) is dangerous)
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%true%'
    OR qual IS NULL
  )
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY tablename;

-- Expected: Should return no results (no overly permissive write policies)

-- =============================================================================
-- TEST 10: Verify policy naming consistency
-- =============================================================================

SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('aircraft', 'roster_rules', 'instructors', 'aircraft_types')
ORDER BY tablename, cmd;

-- Expected: Policy names should follow pattern:
-- - "Authenticated users can view [table]" for SELECT
-- - "Authorized roles can create/update [table]" for INSERT/UPDATE
-- - "Owners and admins can delete [table]" for DELETE

-- =============================================================================
-- TEST 11: Performance check - ensure policies use indexes
-- =============================================================================

-- Check if frequently queried columns are indexed
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('aircraft', 'roster_rules', 'instructors')
ORDER BY tablename, indexname;

-- Expected: Should see indexes on:
-- - roster_rules: is_active, voided_at, instructor_id, day_of_week
-- - aircraft: status, on_line
-- - instructors: user_id (if exists)

-- =============================================================================
-- TEST 12: Verify no bypass mechanisms exist
-- =============================================================================

-- Check for any SECURITY DEFINER functions that might bypass RLS
SELECT 
  routine_schema,
  routine_name,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND security_type = 'DEFINER'
  AND routine_name NOT IN (
    'get_user_role',
    'user_has_role',
    'user_has_any_role',
    'user_has_minimum_role',
    'assign_default_role',
    'handle_user_role_change',
    'update_updated_at_column'
  )
ORDER BY routine_name;

-- Expected: Should only see known, safe SECURITY DEFINER functions

-- =============================================================================
-- SUMMARY REPORT
-- =============================================================================

-- Generate a summary report of RLS configuration
SELECT 
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(DISTINCT CASE WHEN p.cmd = 'SELECT' THEN p.policyname END) as select_policies,
  COUNT(DISTINCT CASE WHEN p.cmd = 'INSERT' THEN p.policyname END) as insert_policies,
  COUNT(DISTINCT CASE WHEN p.cmd = 'UPDATE' THEN p.policyname END) as update_policies,
  COUNT(DISTINCT CASE WHEN p.cmd = 'DELETE' THEN p.policyname END) as delete_policies,
  COUNT(DISTINCT CASE WHEN p.cmd = 'ALL' THEN p.policyname END) as all_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN ('aircraft', 'roster_rules', 'instructors', 'aircraft_types')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- Expected results:
-- - aircraft: RLS enabled, 1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE
-- - roster_rules: RLS enabled, 1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE
-- - instructors: RLS enabled, 1 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE
-- - aircraft_types: RLS enabled, 1 SELECT, 1 ALL (or separate INSERT/UPDATE/DELETE)

-- =============================================================================
-- CLEANUP
-- =============================================================================

-- No cleanup needed - these are read-only test queries

