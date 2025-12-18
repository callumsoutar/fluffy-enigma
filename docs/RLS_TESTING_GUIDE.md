# RLS Testing Guide

## Overview

This guide explains how to test Row Level Security (RLS) policies to ensure they work correctly and enforce proper data access controls.

## Why Test RLS Policies?

RLS is the **last line of defense** for data security. Testing ensures:
- Users can only access their own data
- Authorized roles can access appropriate data
- Unauthorized access is blocked
- Policies work correctly for all operations (SELECT, INSERT, UPDATE, DELETE)

---

## Testing Methods

### Method 1: Supabase SQL Editor

**Best for:** Quick manual testing, debugging specific policies

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Set user context using `SET request.jwt.claim.sub`
3. Run test queries
4. Verify results match expectations

**Example:**
```sql
-- Test as a specific user
SET request.jwt.claim.sub = 'user-uuid-here';

-- Run query
SELECT * FROM bookings;

-- Verify: Should only return user's own bookings
```

**Limitations:**
- Manual process
- Requires knowing user UUIDs
- Can't easily test multiple scenarios

---

### Method 2: Application-Level Testing

**Best for:** Testing real-world scenarios, integration testing

**Steps:**
1. Log in as different user roles
2. Make requests through the application
3. Verify data returned matches expectations
4. Check browser console/network tab for errors

**Example:**
```typescript
// Test as student user
const { data } = await supabase
  .from('bookings')
  .select('*');

// Verify: data should only contain student's own bookings
console.assert(
  data.every(booking => booking.user_id === currentUser.id),
  'Student should only see own bookings'
);
```

---

### Method 3: Automated Test Scripts

**Best for:** Regression testing, CI/CD pipelines

**Steps:**
1. Create test users with different roles
2. Create test data
3. Run automated tests
4. Verify results
5. Clean up test data

**Example:** See `RLS_TEST_QUERIES.sql` for complete test suite

---

## Setting User Context for Testing

### In Supabase SQL Editor

**Option 1: SET request.jwt.claim.sub**
```sql
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM bookings;
```

**Option 2: SET LOCAL (for transaction)**
```sql
BEGIN;
SET LOCAL request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM bookings;
COMMIT;
```

**Option 3: Using set_config (in functions)**
```sql
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'user-uuid-here', true);
  -- Your test queries here
END $$;
```

### In Application Code

**Using Supabase client:**
```typescript
// Client automatically uses JWT from session
const { data } = await supabase
  .from('bookings')
  .select('*');
```

**Using service role (bypasses RLS - use carefully!):**
```typescript
// Only use in server-side code, never in client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Bypasses RLS
);
```

---

## Test Scenarios

### Scenario 1: Ownership Enforcement

**Test:** User can only access their own data

**Steps:**
1. Set context to regular user (student/member)
2. Query table with user-owned data
3. Verify only own records are returned

**Example:**
```sql
-- As student
SET request.jwt.claim.sub = 'student-uuid';

SELECT 
  id,
  user_id,
  created_at
FROM bookings;

-- Expected: Only bookings where user_id = 'student-uuid'
-- Verify: Check that all returned rows have user_id = 'student-uuid'
```

**Pass criteria:**
- ✅ Only own records returned
- ✅ No other users' records visible
- ✅ Count matches expected number of own records

---

### Scenario 2: Role-Based Access

**Test:** Authorized roles can access all data

**Steps:**
1. Set context to authorized role (admin/instructor)
2. Query table
3. Verify all records are returned

**Example:**
```sql
-- As instructor
SET request.jwt.claim.sub = 'instructor-uuid';

SELECT COUNT(*) as total_bookings FROM bookings;

-- Expected: Count of ALL bookings in table
-- Compare with: SELECT COUNT(*) FROM bookings; (as service role)
```

**Pass criteria:**
- ✅ All records visible
- ✅ Count matches total records
- ✅ Can access records from all users

---

### Scenario 3: Unauthorized Access Blocked

**Test:** Unauthorized users cannot access restricted data

**Steps:**
1. Set context to unauthorized user
2. Query restricted table
3. Verify no data returned (or error)

**Example:**
```sql
-- As student (should not see audit logs)
SET request.jwt.claim.sub = 'student-uuid';

SELECT * FROM audit_logs;

-- Expected: Empty result set (0 rows)
```

**Pass criteria:**
- ✅ No data returned
- ✅ No error (silent filtering is OK)
- ✅ Cannot access restricted data

---

### Scenario 4: INSERT Operations

**Test:** Users can only create records they own

**Steps:**
1. Set context to regular user
2. Try to INSERT with own user_id → Should succeed
3. Try to INSERT with different user_id → Should fail

**Example:**
```sql
-- As student
SET request.jwt.claim.sub = 'student-uuid';

-- This should succeed
INSERT INTO bookings (user_id, start_time, end_time)
VALUES (
  auth.uid(),  -- Own booking
  '2025-01-28 10:00:00',
  '2025-01-28 11:00:00'
);

-- This should fail (RLS WITH CHECK blocks it)
INSERT INTO bookings (user_id, start_time, end_time)
VALUES (
  'different-user-uuid',  -- Not own booking
  '2025-01-28 10:00:00',
  '2025-01-28 11:00:00'
);
-- Expected: Error or no row inserted
```

**Pass criteria:**
- ✅ Own records can be created
- ✅ Other users' records cannot be created
- ✅ Error message is clear (if error thrown)

---

### Scenario 5: UPDATE Operations

**Test:** Users can only update records they own (or authorized)

**Steps:**
1. Set context to regular user
2. Try to UPDATE own record → Should succeed
3. Try to UPDATE other user's record → Should fail

**Example:**
```sql
-- As student
SET request.jwt.claim.sub = 'student-uuid';

-- This should succeed
UPDATE bookings
SET notes = 'Updated'
WHERE id = 'own-booking-uuid'
AND user_id = auth.uid();

-- This should fail (RLS USING blocks it)
UPDATE bookings
SET notes = 'Hacked'
WHERE id = 'someone-else-booking-uuid';
-- Expected: 0 rows updated (filtered by RLS)
```

**Pass criteria:**
- ✅ Own records can be updated
- ✅ Other users' records cannot be updated
- ✅ UPDATE returns 0 rows for unauthorized records

---

### Scenario 6: DELETE Operations

**Test:** Only authorized roles can delete

**Steps:**
1. Set context to regular user
2. Try to DELETE → Should fail
3. Set context to admin
4. Try to DELETE → Should succeed

**Example:**
```sql
-- As student (should not be able to delete)
SET request.jwt.claim.sub = 'student-uuid';

DELETE FROM bookings WHERE id = 'own-booking-uuid';
-- Expected: 0 rows deleted (RLS blocks it)

-- As admin (should be able to delete)
SET request.jwt.claim.sub = 'admin-uuid';

DELETE FROM bookings WHERE id = 'booking-to-delete-uuid';
-- Expected: 1 row deleted
```

**Pass criteria:**
- ✅ Regular users cannot delete
- ✅ Authorized roles can delete
- ✅ DELETE returns correct row count

---

## Testing Checklist

### For Each Table with RLS

- [ ] **SELECT Policy**
  - [ ] Regular user sees only own data
  - [ ] Authorized role sees all data
  - [ ] Unauthorized user sees no data
  - [ ] Count matches expectations

- [ ] **INSERT Policy**
  - [ ] User can create own records
  - [ ] User cannot create records for others
  - [ ] Authorized role can create any records
  - [ ] WITH CHECK clause works correctly

- [ ] **UPDATE Policy**
  - [ ] User can update own records
  - [ ] User cannot update others' records
  - [ ] Authorized role can update any records
  - [ ] Both USING and WITH CHECK work correctly

- [ ] **DELETE Policy**
  - [ ] Regular user cannot delete
  - [ ] Authorized role can delete
  - [ ] DELETE returns correct row count

- [ ] **Edge Cases**
  - [ ] NULL user_id handled correctly
  - [ ] Soft-deleted records filtered correctly
  - [ ] Multiple ownership columns work correctly
  - [ ] Joins with other tables work correctly

---

## Common Testing Patterns

### Pattern 1: Count Comparison

**Compare counts to verify filtering:**
```sql
-- As service role (bypasses RLS)
SELECT COUNT(*) as total_count FROM bookings;

-- As regular user
SET request.jwt.claim.sub = 'student-uuid';
SELECT COUNT(*) as user_count FROM bookings;

-- Verify: user_count <= total_count
-- If user_count = total_count, RLS might not be working!
```

### Pattern 2: Explicit Filter Test

**Test that explicit filters don't bypass RLS:**
```sql
-- As student
SET request.jwt.claim.sub = 'student-uuid';

-- Try to explicitly filter for other user's data
SELECT * FROM bookings
WHERE user_id = 'different-user-uuid';

-- Expected: Empty result (RLS still filters)
```

### Pattern 3: Role Function Test

**Test role checking functions directly:**
```sql
SET request.jwt.claim.sub = 'admin-uuid';

SELECT 
  public.get_user_role(auth.uid()) as role,
  public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin']
  ) as has_admin_role;

-- Expected: role = 'admin', has_admin_role = true
```

### Pattern 4: Cross-Table Join Test

**Test RLS with joins:**
```sql
SET request.jwt.claim.sub = 'student-uuid';

SELECT 
  b.id,
  b.user_id,
  a.tail_number,
  u.email
FROM bookings b
JOIN aircraft a ON b.aircraft_id = a.id
JOIN users u ON b.user_id = u.id;

-- Expected: Only own bookings, but can see related aircraft/users
-- (assuming aircraft and users have appropriate RLS policies)
```

---

## Debugging Failed Tests

### Issue: User sees all data (should only see own)

**Possible causes:**
1. RLS not enabled on table
2. Policy is too permissive (`USING (true)`)
3. Policy missing ownership check
4. Function returning wrong value

**Debug steps:**
```sql
-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'bookings';

-- 2. Check policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'bookings';

-- 3. Test function directly
SET request.jwt.claim.sub = 'user-uuid';
SELECT public.user_has_any_role(auth.uid(), ARRAY['admin']);
-- Should return false for non-admin

-- 4. Test policy expression
SET request.jwt.claim.sub = 'user-uuid';
SELECT 
  user_id = auth.uid() as is_own,
  public.user_has_any_role(auth.uid(), ARRAY['admin']) as is_admin
FROM bookings
LIMIT 1;
```

### Issue: User sees no data (should see own)

**Possible causes:**
1. Policy too restrictive
2. user_id doesn't match auth.uid()
3. Function returning false incorrectly
4. Data doesn't have user_id set

**Debug steps:**
```sql
-- 1. Check if user_id matches
SET request.jwt.claim.sub = 'user-uuid';
SELECT 
  auth.uid() as current_user_id,
  user_id,
  COUNT(*) as count
FROM bookings
GROUP BY user_id;

-- 2. Check function result
SELECT public.get_user_role(auth.uid()) as role;

-- 3. Check policy expression manually
SELECT 
  user_id = auth.uid() as ownership_check,
  public.user_has_any_role(auth.uid(), ARRAY['admin']) as role_check
FROM bookings
LIMIT 1;
```

### Issue: INSERT/UPDATE/DELETE not working

**Possible causes:**
1. Missing WITH CHECK clause
2. USING clause too restrictive
3. Policy doesn't exist for operation

**Debug steps:**
```sql
-- 1. Check policies for operation
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'bookings'
AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

-- 2. Test WITH CHECK expression
SET request.jwt.claim.sub = 'user-uuid';
-- Manually evaluate the WITH CHECK expression
```

---

## Automated Testing Script

### Example: Test Bookings Table

```sql
-- Test script for bookings table RLS
DO $$
DECLARE
  student_id UUID;
  admin_id UUID;
  booking_count INT;
  total_count INT;
BEGIN
  -- Get test user IDs (replace with actual emails)
  SELECT id INTO student_id 
  FROM auth.users 
  WHERE email = 'student@example.com';
  
  SELECT id INTO admin_id 
  FROM auth.users 
  WHERE email = 'admin@example.com';
  
  -- Get total count (as service role - bypasses RLS)
  SELECT COUNT(*) INTO total_count FROM bookings;
  
  -- Test as student
  PERFORM set_config('request.jwt.claim.sub', student_id::text, true);
  SELECT COUNT(*) INTO booking_count FROM bookings;
  
  ASSERT booking_count <= total_count, 
    'Student should see same or fewer bookings than total';
  
  -- Test as admin
  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  SELECT COUNT(*) INTO booking_count FROM bookings;
  
  ASSERT booking_count = total_count, 
    'Admin should see all bookings';
  
  RAISE NOTICE 'All RLS tests passed for bookings table';
END $$;
```

---

## Testing in Different Environments

### Local Development

**Using Supabase CLI:**
```bash
# Start local Supabase
supabase start

# Run test queries
psql postgresql://postgres:postgres@localhost:54322/postgres -f docs/RLS_TEST_QUERIES.sql
```

### Staging Environment

**Using Supabase Dashboard:**
1. Connect to staging project
2. Use SQL Editor to run test queries
3. Verify results match expectations

### Production Environment

**⚠️ CAUTION: Be careful testing in production!**

**Best practices:**
- Use read-only queries (SELECT only)
- Test with service accounts, not real users
- Don't modify production data
- Test during low-traffic periods
- Have rollback plan ready

---

## Continuous Testing

### Integration with CI/CD

**Example GitHub Actions workflow:**
```yaml
name: Test RLS Policies

on: [push, pull_request]

jobs:
  test-rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run RLS tests
        run: |
          # Connect to test database
          # Run test queries
          # Verify results
```

### Regular Audits

**Schedule periodic RLS audits:**
1. Review all tables for RLS enablement
2. Test policies with different user roles
3. Verify no overly permissive policies
4. Check for missing ownership checks
5. Document findings

---

## Test Data Management

### Creating Test Users

```sql
-- Create test users with different roles
INSERT INTO auth.users (email, encrypted_password)
VALUES 
  ('test-student@example.com', crypt('password', gen_salt('bf'))),
  ('test-instructor@example.com', crypt('password', gen_salt('bf'))),
  ('test-admin@example.com', crypt('password', gen_salt('bf')));

-- Assign roles
INSERT INTO user_roles (user_id, role_id)
SELECT 
  u.id,
  r.id
FROM auth.users u
CROSS JOIN roles r
WHERE u.email LIKE 'test-%@example.com'
AND r.name IN ('student', 'instructor', 'admin');
```

### Creating Test Data

```sql
-- Create test bookings for different users
INSERT INTO bookings (user_id, start_time, end_time, aircraft_id)
SELECT 
  u.id,
  NOW() + (random() * interval '30 days'),
  NOW() + (random() * interval '30 days') + interval '1 hour',
  (SELECT id FROM aircraft LIMIT 1)
FROM auth.users u
WHERE u.email LIKE 'test-%@example.com';
```

### Cleaning Up Test Data

```sql
-- Remove test data
DELETE FROM bookings
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-%@example.com'
);

DELETE FROM user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-%@example.com'
);

DELETE FROM auth.users
WHERE email LIKE 'test-%@example.com';
```

---

## Related Documentation

- [RLS Flow Documentation](./RLS_FLOW_DOCUMENTATION.md)
- [RLS Policy Patterns](./RLS_POLICY_PATTERNS.md)
- [RLS Test Queries](./RLS_TEST_QUERIES.sql)
- [RBAC Architecture](./RBAC_ARCHITECTURE.md)

---

## Quick Reference

### Test as Different Users
```sql
-- Student
SET request.jwt.claim.sub = 'student-uuid';

-- Instructor  
SET request.jwt.claim.sub = 'instructor-uuid';

-- Admin
SET request.jwt.claim.sub = 'admin-uuid';
```

### Check Current User Context
```sql
SELECT auth.uid() as current_user_id;
```

### Verify RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### List All Policies
```sql
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```
