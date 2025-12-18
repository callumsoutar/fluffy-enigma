-- RLS Policy Test Queries
-- Use these queries to verify RLS policies work correctly

-- ============================================================================
-- SETUP: Get User UUIDs for Testing
-- ============================================================================

-- Get a list of users with their roles for testing
SELECT 
  u.id as user_id,
  u.email,
  r.name as role_name
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
WHERE ur.is_active = true
ORDER BY r.name, u.email;

-- ============================================================================
-- TESTING METHOD: Simulate User Context
-- ============================================================================

-- To test as a specific user, use:
-- SET request.jwt.claim.sub = 'user-uuid-here';
-- Then run your query

-- Note: In Supabase SQL Editor, you may need to use:
-- SET LOCAL request.jwt.claim.sub = 'user-uuid-here';

-- ============================================================================
-- TEST 1: Bookings Table - Ownership Enforcement
-- ============================================================================

-- Test as regular user (student/member)
-- Should only see own bookings
SET request.jwt.claim.sub = 'student-user-uuid-here';
SELECT 
  id,
  user_id,
  instructor_id,
  start_time,
  end_time
FROM bookings
ORDER BY start_time;

-- Expected: Only bookings where user_id = 'student-user-uuid-here'

-- Test as instructor
-- Should see own bookings + assigned bookings + all bookings (if policy allows)
SET request.jwt.claim.sub = 'instructor-user-uuid-here';
SELECT 
  id,
  user_id,
  instructor_id,
  start_time,
  end_time
FROM bookings
ORDER BY start_time;

-- Expected: All bookings (instructor role can see all)

-- Test as admin
-- Should see all bookings
SET request.jwt.claim.sub = 'admin-user-uuid-here';
SELECT COUNT(*) as total_bookings FROM bookings;

-- Expected: Count of all bookings

-- ============================================================================
-- TEST 2: Flight Logs Table - Ownership Enforcement
-- ============================================================================

-- Test as regular user
-- Should only see own flight logs
SET request.jwt.claim.sub = 'student-user-uuid-here';
SELECT 
  id,
  user_id,
  flight_date,
  flight_time
FROM flight_logs
ORDER BY flight_date DESC;

-- Expected: Only flight logs where user_id = 'student-user-uuid-here'

-- Test as instructor
-- Should see all flight logs
SET request.jwt.claim.sub = 'instructor-user-uuid-here';
SELECT COUNT(*) as total_flight_logs FROM flight_logs;

-- Expected: Count of all flight logs

-- ============================================================================
-- TEST 3: Audit Logs Table - Role-Only Access
-- ============================================================================

-- Test as regular user
-- Should see nothing (audit logs restricted to admins)
SET request.jwt.claim.sub = 'student-user-uuid-here';
SELECT COUNT(*) as audit_log_count FROM audit_logs;

-- Expected: 0 (or error if policy denies access)

-- Test as admin
-- Should see all audit logs
SET request.jwt.claim.sub = 'admin-user-uuid-here';
SELECT 
  id,
  table_name,
  action,
  user_id,
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- Expected: Audit log entries

-- ============================================================================
-- TEST 4: Invoices Table - Own Data OR Authorized Role
-- ============================================================================

-- Test as regular user
-- Should only see own invoices
SET request.jwt.claim.sub = 'student-user-uuid-here';
SELECT 
  id,
  user_id,
  invoice_number,
  total_amount,
  status
FROM invoices
ORDER BY created_at DESC;

-- Expected: Only invoices where user_id = 'student-user-uuid-here'

-- Test as instructor
-- Should see all invoices
SET request.jwt.claim.sub = 'instructor-user-uuid-here';
SELECT COUNT(*) as total_invoices FROM invoices;

-- Expected: Count of all invoices

-- ============================================================================
-- TEST 5: Users Table - Complex Visibility Rules
-- ============================================================================

-- Test as regular user
-- Should see own profile + public directory users
SET request.jwt.claim.sub = 'student-user-uuid-here';
SELECT 
  id,
  email,
  public_directory_opt_in
FROM users
WHERE public_directory_opt_in = true
ORDER BY email;

-- Expected: Own user + users with public_directory_opt_in = true

-- Test as instructor
-- Should see more users (based on bookings relationship)
SET request.jwt.claim.sub = 'instructor-user-uuid-here';
SELECT COUNT(*) as visible_users FROM users;

-- Expected: More users visible (instructors can see students they've worked with)

-- ============================================================================
-- TEST 6: Role Checking Functions
-- ============================================================================

-- Test user_has_any_role function
SET request.jwt.claim.sub = 'admin-user-uuid-here';
SELECT 
  public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin']
  ) as has_admin_role;

-- Expected: true

-- Test as student
SET request.jwt.claim.sub = 'student-user-uuid-here';
SELECT 
  public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin']
  ) as has_admin_role;

-- Expected: false

-- Test get_user_role function
SET request.jwt.claim.sub = 'instructor-user-uuid-here';
SELECT public.get_user_role(auth.uid()) as user_role;

-- Expected: 'instructor'

-- ============================================================================
-- TEST 7: INSERT Operations
-- ============================================================================

-- Test: Regular user creating own booking
SET request.jwt.claim.sub = 'student-user-uuid-here';

-- This should succeed (user creating own booking)
INSERT INTO bookings (user_id, start_time, end_time, aircraft_id)
VALUES (
  auth.uid(),  -- Own booking
  '2025-01-28 10:00:00',
  '2025-01-28 11:00:00',
  'aircraft-uuid-here'
);

-- This should fail (user trying to create booking for someone else)
INSERT INTO bookings (user_id, start_time, end_time, aircraft_id)
VALUES (
  'different-user-uuid',  -- Not own booking
  '2025-01-28 10:00:00',
  '2025-01-28 11:00:00',
  'aircraft-uuid-here'
);

-- Expected: First succeeds, second fails (RLS WITH CHECK blocks it)

-- ============================================================================
-- TEST 8: UPDATE Operations
-- ============================================================================

-- Test: Regular user updating own booking
SET request.jwt.claim.sub = 'student-user-uuid-here';

-- This should succeed (updating own booking)
UPDATE bookings
SET notes = 'Updated notes'
WHERE id = 'own-booking-uuid'
AND user_id = auth.uid();

-- This should fail (trying to update someone else's booking)
UPDATE bookings
SET notes = 'Hacked notes'
WHERE id = 'someone-else-booking-uuid';

-- Expected: First succeeds, second fails (RLS USING blocks it)

-- ============================================================================
-- TEST 9: DELETE Operations
-- ============================================================================

-- Test: Regular user trying to delete
SET request.jwt.claim.sub = 'student-user-uuid-here';

-- This should fail (students can't delete bookings)
DELETE FROM bookings
WHERE id = 'own-booking-uuid';

-- Expected: Fails (RLS policy blocks DELETE for non-admins)

-- Test: Admin deleting
SET request.jwt.claim.sub = 'admin-user-uuid-here';

-- This should succeed (admin can delete)
DELETE FROM bookings
WHERE id = 'booking-to-delete-uuid';

-- Expected: Succeeds (admin role allows DELETE)

-- ============================================================================
-- TEST 10: Verify No Data Leakage
-- ============================================================================

-- Test: Try to access other user's data directly
SET request.jwt.claim.sub = 'student-user-uuid-here';

-- Try to query with explicit user_id filter (should still be filtered by RLS)
SELECT * FROM bookings
WHERE user_id = 'different-user-uuid';

-- Expected: Empty result (RLS filters out rows even with explicit filter)

-- Try to use service role key (should bypass RLS)
-- NOTE: Only use service role key in server-side code, never in client
-- This test is to verify RLS is working, not to bypass it

-- ============================================================================
-- TEST 11: Multiple Policies on Same Table
-- ============================================================================

-- Some tables have multiple SELECT policies
-- PostgreSQL uses OR logic: if ANY policy allows, row is included

-- Test bookings table with multiple policies
SET request.jwt.claim.sub = 'student-user-uuid-here';

-- Check which policies apply
SELECT 
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'bookings'
AND cmd = 'SELECT';

-- Then test query
SELECT COUNT(*) FROM bookings;

-- Expected: Only own bookings (even if multiple policies exist)

-- ============================================================================
-- TEST 12: Performance Testing
-- ============================================================================

-- Test: Verify role checking function is performant
SET request.jwt.claim.sub = 'admin-user-uuid-here';

-- Enable timing
\timing on

-- Query that uses role checking
SELECT * FROM bookings
WHERE public.user_has_any_role(
  auth.uid(),
  ARRAY['owner', 'admin', 'instructor']
);

-- Expected: Query completes quickly (function is STABLE, can be cached)

\timing off

-- ============================================================================
-- TEST 13: Edge Cases
-- ============================================================================

-- Test: User with no role assigned
SET request.jwt.claim.sub = 'user-with-no-role-uuid';

SELECT public.get_user_role(auth.uid()) as role;

-- Expected: NULL or default role

-- Test: User with inactive role
-- (Role exists but is_active = false)
SET request.jwt.claim.sub = 'user-with-inactive-role-uuid';

SELECT 
  public.user_has_any_role(
    auth.uid(),
    ARRAY['admin']
  ) as has_admin_role;

-- Expected: false (inactive roles are excluded)

-- Test: NULL user_id in data
SET request.jwt.claim.sub = 'student-user-uuid-here';

SELECT * FROM bookings
WHERE user_id IS NULL;

-- Expected: Empty (unless policy specifically allows NULL)

-- ============================================================================
-- TEST 14: Verify Function Security
-- ============================================================================

-- Test: Verify function has proper security settings
SELECT 
  routine_name,
  security_type,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'user_has_any_role',
  'user_has_role',
  'get_user_role',
  'check_user_role_simple'
)
ORDER BY routine_name;

-- Expected:
-- - security_type = 'DEFINER' (SECURITY DEFINER)
-- - All functions should have SET search_path = public

-- ============================================================================
-- TEST 15: Cross-Table Relationships
-- ============================================================================

-- Test: Query with joins (RLS applies to each table)
SET request.jwt.claim.sub = 'student-user-uuid-here';

SELECT 
  b.id as booking_id,
  b.start_time,
  a.tail_number,
  u.email as student_email
FROM bookings b
JOIN aircraft a ON b.aircraft_id = a.id
JOIN users u ON b.user_id = u.id
WHERE b.user_id = auth.uid();

-- Expected: Only own bookings, but can see related aircraft and user data
-- (assuming aircraft and users tables have appropriate RLS policies)

-- ============================================================================
-- CLEANUP: Reset Context
-- ============================================================================

-- Reset user context (if needed)
RESET request.jwt.claim.sub;

-- ============================================================================
-- NOTES FOR TESTING
-- ============================================================================

-- 1. Replace 'user-uuid-here' with actual UUIDs from your database
-- 2. Run tests in Supabase SQL Editor or via psql
-- 3. Test with different user roles (student, member, instructor, admin, owner)
-- 4. Verify expected results match actual results
-- 5. Document any unexpected behavior
-- 6. Test both positive cases (should work) and negative cases (should fail)

-- ============================================================================
-- AUTOMATED TESTING SCRIPT
-- ============================================================================

-- You can create a test script that:
-- 1. Sets up test users with different roles
-- 2. Creates test data
-- 3. Tests each policy
-- 4. Verifies results
-- 5. Cleans up test data

-- Example structure:
/*
DO $$
DECLARE
  test_user_id UUID;
  test_admin_id UUID;
  booking_count INT;
BEGIN
  -- Get test user IDs
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'test-student@example.com';
  SELECT id INTO test_admin_id FROM auth.users WHERE email = 'test-admin@example.com';
  
  -- Test as student
  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);
  SELECT COUNT(*) INTO booking_count FROM bookings;
  ASSERT booking_count > 0, 'Student should see own bookings';
  
  -- Test as admin
  PERFORM set_config('request.jwt.claim.sub', test_admin_id::text, true);
  SELECT COUNT(*) INTO booking_count FROM bookings;
  ASSERT booking_count > 0, 'Admin should see all bookings';
  
  RAISE NOTICE 'All tests passed';
END $$;
*/
