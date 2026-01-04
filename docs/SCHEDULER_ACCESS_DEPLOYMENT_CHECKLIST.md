# Scheduler Access Deployment Checklist

**Date:** January 1, 2026  
**Feature:** Scheduler access for all authenticated users (students and members)

## Pre-Deployment Checklist

### 1. Code Review
- [ ] Review all modified files for correctness
- [ ] Verify no sensitive data is exposed
- [ ] Check that write operations remain restricted
- [ ] Ensure error handling is in place
- [ ] Verify no linter errors

**Files to review:**
- `lib/auth/route-permissions.ts`
- `app/api/aircraft/route.ts`
- `app/api/roster-rules/route.ts`
- `supabase/migrations/017_scheduler_read_access_rls.sql`

### 2. Security Review
- [ ] Verify RLS policies are correct
- [ ] Check that all write operations require authorization
- [ ] Ensure no bypass mechanisms exist
- [ ] Verify defense-in-depth approach is maintained
- [ ] Review role hierarchy is correct

### 3. Documentation Review
- [ ] Read `SCHEDULER_ACCESS_CONFIGURATION.md`
- [ ] Review `SCHEDULER_ACCESS_IMPLEMENTATION_SUMMARY.md`
- [ ] Check `SCHEDULER_ACCESS_FLOW_DIAGRAM.md` for accuracy
- [ ] Verify test queries in `SCHEDULER_ACCESS_TEST_QUERIES.sql`

### 4. Local Testing
- [ ] Run linter: `npm run lint`
- [ ] Run type checker: `npm run type-check` (if available)
- [ ] Build project: `npm run build`
- [ ] Test locally with different user roles

## Deployment Steps

### Step 1: Database Migration

```bash
# Connect to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
supabase db push

# Or manually via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy contents of supabase/migrations/017_scheduler_read_access_rls.sql
# 3. Execute the SQL
```

**Verification:**
- [ ] Migration applied successfully
- [ ] No errors in migration logs
- [ ] RLS policies visible in Supabase Dashboard

### Step 2: Verify RLS Policies

Run the following query in Supabase SQL Editor:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('aircraft', 'roster_rules', 'instructors', 'aircraft_types');

-- Check policies exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('aircraft', 'roster_rules', 'instructors', 'aircraft_types')
ORDER BY tablename, cmd;
```

**Expected results:**
- [ ] All tables have `rowsecurity = true`
- [ ] Each table has SELECT, INSERT, UPDATE, DELETE policies
- [ ] Policy names match documentation

### Step 3: Deploy Code Changes

```bash
# Commit changes
git add .
git commit -m "feat: enable scheduler access for all authenticated users

- Update route permissions to allow students
- Modify aircraft API to allow read access for all users
- Modify roster-rules API to allow read access for all users
- Add comprehensive RLS policies for scheduler tables
- Add documentation for security model and testing"

# Push to main branch (or create PR)
git push origin main

# Or create a pull request
git checkout -b feature/scheduler-access-all-users
git push origin feature/scheduler-access-all-users
```

**Verification:**
- [ ] Code pushed successfully
- [ ] CI/CD pipeline passes (if applicable)
- [ ] Deployment completes without errors

### Step 4: Smoke Testing (Production)

#### Test as Student User
- [ ] Log in as a student user
- [ ] Navigate to `/scheduler`
- [ ] Verify page loads without errors
- [ ] Verify aircraft are visible
- [ ] Verify instructor schedules are visible
- [ ] Verify you can click empty slots to create bookings
- [ ] Try to navigate to `/aircraft` - should be blocked
- [ ] Try to navigate to `/staff` - should be blocked

#### Test as Member User
- [ ] Log in as a member user
- [ ] Navigate to `/scheduler`
- [ ] Verify page loads without errors
- [ ] Verify all data is visible
- [ ] Create a test booking via scheduler
- [ ] Verify you cannot access admin pages

#### Test as Instructor User
- [ ] Log in as an instructor user
- [ ] Navigate to `/scheduler`
- [ ] Verify page loads without errors
- [ ] Navigate to `/aircraft` - should work
- [ ] Verify you can create/edit aircraft
- [ ] Verify you can create/edit roster rules

### Step 5: API Testing

Test API endpoints directly:

```bash
# Get student JWT token from browser DevTools (Application > Local Storage)
STUDENT_TOKEN="your-student-jwt-token"
INSTRUCTOR_TOKEN="your-instructor-jwt-token"
API_URL="https://your-app.com"

# Test 1: Student can view aircraft (should succeed)
curl -H "Authorization: Bearer $STUDENT_TOKEN" \
  "$API_URL/api/aircraft"

# Test 2: Student cannot create aircraft (should fail with 403)
curl -X POST \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"registration":"TEST","type":"C172","model":"Skyhawk"}' \
  "$API_URL/api/aircraft"

# Test 3: Student can view roster rules (should succeed)
curl -H "Authorization: Bearer $STUDENT_TOKEN" \
  "$API_URL/api/roster-rules?date=2026-01-15"

# Test 4: Instructor can create aircraft (should succeed)
curl -X POST \
  -H "Authorization: Bearer $INSTRUCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"registration":"TEST","type":"C172","model":"Skyhawk"}' \
  "$API_URL/api/aircraft"
```

**Expected results:**
- [ ] Test 1: Returns 200 with aircraft list
- [ ] Test 2: Returns 403 Forbidden
- [ ] Test 3: Returns 200 with roster rules
- [ ] Test 4: Returns 201 with created aircraft

### Step 6: Database-Level Testing

Run test queries from `SCHEDULER_ACCESS_TEST_QUERIES.sql`:

```sql
-- Test 1: Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('aircraft', 'roster_rules', 'instructors');

-- Test 2: Check for overly permissive policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual::text LIKE '%true%'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

-- Test 3: Verify policy count
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('aircraft', 'roster_rules', 'instructors')
GROUP BY tablename;
```

**Expected results:**
- [ ] All tables have RLS enabled
- [ ] No overly permissive write policies
- [ ] Each table has 4+ policies (SELECT, INSERT, UPDATE, DELETE)

## Post-Deployment Monitoring

### First 24 Hours

Monitor these metrics:

#### Application Metrics
- [ ] Error rate (should remain stable)
- [ ] Response times for `/api/aircraft` (should be <200ms)
- [ ] Response times for `/api/roster-rules` (should be <200ms)
- [ ] Number of 403 errors (should be minimal)

#### Database Metrics
- [ ] Query performance for `aircraft` table
- [ ] Query performance for `roster_rules` table
- [ ] RLS overhead (should be negligible)
- [ ] Connection pool usage

#### User Activity
- [ ] Number of scheduler page views (should increase)
- [ ] Number of bookings created (track trend)
- [ ] User feedback (check support channels)

### Monitoring Queries

```sql
-- Check query performance
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%aircraft%' OR query LIKE '%roster_rules%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check for failed RLS policy checks (if logging enabled)
-- This depends on your logging setup
```

## Rollback Procedure

If critical issues are found:

### Emergency Rollback (Immediate)

```bash
# 1. Revert code deployment
git revert HEAD
git push origin main

# 2. Revert route permissions manually
# Edit lib/auth/route-permissions.ts
# Change: allowedRoles: ['owner', 'admin', 'instructor', 'member', 'student']
# To:     allowedRoles: ['owner', 'admin', 'instructor', 'member']

# 3. Deploy hotfix
git add lib/auth/route-permissions.ts
git commit -m "hotfix: revert scheduler access for students"
git push origin main
```

### Full Rollback (If Database Issues)

```sql
-- Drop new RLS policies
DROP POLICY IF EXISTS "Authenticated users can view aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Authenticated users can view roster rules" ON public.roster_rules;
DROP POLICY IF EXISTS "Authenticated users can view instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authenticated users can view aircraft types" ON public.aircraft_types;

-- Restore previous policies (if they existed)
-- Add previous policy definitions here
```

## Success Criteria

Deployment is considered successful if:

- [ ] No increase in error rates
- [ ] Response times remain acceptable (<200ms for API calls)
- [ ] Students/members can access scheduler
- [ ] Students/members cannot modify aircraft/roster data
- [ ] No security vulnerabilities introduced
- [ ] User feedback is positive

## Communication Plan

### Internal Team
- [ ] Notify development team of deployment
- [ ] Share monitoring dashboard links
- [ ] Set up alerts for error rate spikes

### Users
- [ ] Send email to students/members about new scheduler access
- [ ] Update help documentation
- [ ] Prepare support team for potential questions

### Stakeholders
- [ ] Report deployment completion
- [ ] Share success metrics after 24 hours
- [ ] Schedule review meeting if needed

## Sign-Off

- [ ] **Developer**: Implementation complete and tested
- [ ] **Code Reviewer**: Code reviewed and approved
- [ ] **Security Reviewer**: Security review passed
- [ ] **QA**: Testing complete and passed
- [ ] **Product Owner**: Feature approved for deployment
- [ ] **DevOps**: Deployment successful

---

## Deployment Log

**Deployed by:** _________________  
**Deployment date:** _________________  
**Deployment time:** _________________  
**Environment:** Production  
**Rollback performed:** Yes / No  
**Issues encountered:** _________________  
**Resolution:** _________________  

---

## Post-Deployment Review

**Review date:** _________________ (Schedule 48 hours after deployment)

**Metrics Review:**
- Error rate: _________________
- Performance: _________________
- User adoption: _________________

**Issues Found:**
- _________________
- _________________

**Action Items:**
- _________________
- _________________

**Lessons Learned:**
- _________________
- _________________

---

**Status:** ⏳ Pending Deployment

**Next Steps:**
1. Complete pre-deployment checklist
2. Schedule deployment window
3. Execute deployment steps
4. Monitor for 24-48 hours
5. Conduct post-deployment review

