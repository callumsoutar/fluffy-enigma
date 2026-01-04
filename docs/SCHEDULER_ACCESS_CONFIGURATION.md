# Scheduler Access Configuration

**Date:** January 1, 2026
**Status:** Implemented

## Overview

This document describes the configuration changes made to enable safe, read-only access to the scheduler for all authenticated users (including students and members), while maintaining proper security controls.

## Problem Statement

Previously, the scheduler page was only accessible to instructors, admins, and owners. However, students and members need to access the scheduler to:

1. View aircraft availability
2. See instructor roster schedules
3. Make bookings
4. Check availability before creating bookings

The original configuration blocked these users at multiple levels:
- Route-level permissions (middleware)
- API endpoint authorization checks
- Missing RLS policies

## Solution Architecture

### Three-Layer Security Approach

1. **Route-Level Access** (Middleware)
   - Allows all authenticated users to access `/scheduler`
   - Students and members can now navigate to the scheduler page

2. **API-Level Access** (API Routes)
   - **Read Operations (GET)**: All authenticated users
   - **Write Operations (POST, PATCH, DELETE)**: Instructors and above only

3. **Database-Level Security** (RLS Policies)
   - **SELECT**: All authenticated users can read
   - **INSERT/UPDATE/DELETE**: Instructors and above only

This layered approach follows the principle of defense-in-depth.

## Changes Made

### 1. Route Permissions (`lib/auth/route-permissions.ts`)

**Before:**
```typescript
{ path: '/scheduler', allowedRoles: ['owner', 'admin', 'instructor', 'member'] }
```

**After:**
```typescript
{ path: '/scheduler', allowedRoles: ['owner', 'admin', 'instructor', 'member', 'student'] }
```

### 2. Aircraft API (`app/api/aircraft/route.ts`)

**Before:**
- GET endpoint required `['owner', 'admin', 'instructor']` roles
- Blocked members and students from viewing aircraft list

**After:**
- GET endpoint requires authentication only (all authenticated users)
- POST endpoint still requires `['owner', 'admin', 'instructor']` roles
- PATCH/DELETE endpoints unchanged (instructors and above)

### 3. Roster Rules API (`app/api/roster-rules/route.ts`)

**Before:**
- Used `requireOperationsAccess()` which defaulted to `['owner', 'admin', 'instructor']`
- Blocked members and students from viewing roster rules

**After:**
- GET endpoint requires authentication only (all authenticated users)
- POST endpoint still uses `requireOperationsAccess()` (instructors and above)
- PATCH/DELETE endpoints unchanged (instructors and above)

### 4. RLS Policies (Migration `017_scheduler_read_access_rls.sql`)

Created comprehensive RLS policies for:

#### Aircraft Table
- **SELECT**: All authenticated users
- **INSERT**: Instructors, admins, owners only
- **UPDATE**: Instructors, admins, owners only
- **DELETE**: Admins and owners only

#### Roster Rules Table
- **SELECT**: All authenticated users (only active, non-voided rules)
- **INSERT**: Instructors, admins, owners only
- **UPDATE**: Instructors, admins, owners only
- **DELETE**: Admins and owners only

#### Aircraft Types Table (Reference Table)
- **SELECT**: All authenticated users
- **INSERT/UPDATE/DELETE**: Admins and owners only

#### Instructors Table
- **SELECT**: All authenticated users
- **INSERT**: Instructors, admins, owners only
- **UPDATE**: Instructors, admins, owners only
- **DELETE**: Admins and owners only

## Security Considerations

### What Users Can Now Do

**Students and Members:**
- ✅ View the scheduler page
- ✅ See all aircraft and their availability
- ✅ See instructor roster schedules
- ✅ See when instructors are available
- ✅ Make informed booking decisions
- ✅ Create bookings via the scheduler UI

### What Users Still Cannot Do

**Students and Members:**
- ❌ Create, edit, or delete aircraft
- ❌ Create, edit, or delete roster rules
- ❌ Create, edit, or delete instructor profiles
- ❌ Modify aircraft types or other configuration
- ❌ Access admin-only features

### Defense in Depth

Even if a malicious user bypasses the frontend:

1. **API Layer**: Write operations return 403 Forbidden
2. **Database Layer**: RLS policies block unauthorized writes
3. **Audit Trail**: All database operations are logged

### RLS Policy Safety

The RLS policies use:
- `auth.role() = 'authenticated'` for read access (Supabase built-in check)
- `public.user_has_any_role()` for write access (custom function with explicit role checks)
- Both `USING` and `WITH CHECK` clauses for UPDATE policies (prevents privilege escalation)

## Data Exposure Analysis

### What Information Is Now Visible to All Users

1. **Aircraft Data**:
   - Registration numbers
   - Aircraft types and models
   - Status (available/maintenance)
   - ✅ Safe: This is public-facing information needed for booking

2. **Roster Rules**:
   - Instructor availability windows (day/time)
   - Instructor IDs (UUIDs, not personal info)
   - ✅ Safe: Schedule information, no sensitive data

3. **Instructor Profiles**:
   - Names (already visible in bookings)
   - IDs (UUIDs, not sensitive)
   - ✅ Safe: Public-facing instructor information

### What Information Remains Protected

- Financial data (invoices, payments)
- Personal contact details (phone, address)
- Training records beyond user's own
- System configuration
- Audit logs

## Testing Checklist

### As a Student User:

- [ ] Navigate to `/scheduler` without being redirected
- [ ] See list of aircraft in the scheduler
- [ ] See roster rules (instructor availability) in the scheduler
- [ ] Click empty time slots to create a booking
- [ ] View existing bookings on the scheduler
- [ ] Verify you CANNOT access `/aircraft` management page
- [ ] Verify you CANNOT access `/staff` or admin pages

### As a Member User:

- [ ] Navigate to `/scheduler` successfully
- [ ] See all aircraft and roster information
- [ ] Create bookings via scheduler
- [ ] Verify read-only access (no edit/delete options for aircraft)

### As an Instructor User:

- [ ] Navigate to `/scheduler` successfully
- [ ] See all aircraft and roster information
- [ ] Create/edit bookings
- [ ] Access `/aircraft` management page
- [ ] Create/edit roster rules

### Database-Level Testing:

Run these queries as different users to verify RLS:

```sql
-- As student/member (should succeed)
SELECT * FROM aircraft;
SELECT * FROM roster_rules WHERE is_active = true;
SELECT * FROM instructors;

-- As student/member (should fail)
INSERT INTO aircraft (...) VALUES (...);
UPDATE roster_rules SET ... WHERE id = '...';
DELETE FROM instructors WHERE id = '...';

-- As instructor (should succeed)
INSERT INTO aircraft (...) VALUES (...);
UPDATE roster_rules SET ... WHERE id = '...';
SELECT * FROM aircraft;
```

## Migration Instructions

### 1. Apply the Migration

```bash
# If using Supabase CLI
supabase db push

# Or apply manually via Supabase Dashboard
# Copy contents of 017_scheduler_read_access_rls.sql
```

### 2. Verify RLS Policies

```sql
-- Check policies are applied
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('aircraft', 'roster_rules', 'instructors', 'aircraft_types')
ORDER BY tablename, policyname;
```

### 3. Test Access

1. Log in as a student user
2. Navigate to `/scheduler`
3. Verify you can see aircraft and roster rules
4. Verify you cannot access admin pages

## Rollback Plan

If issues arise, rollback in this order:

1. **Revert API changes** (restore authorization checks)
2. **Revert route permissions** (remove students from scheduler)
3. **Drop RLS policies** (if needed)

```sql
-- Emergency rollback of RLS policies
DROP POLICY IF EXISTS "Authenticated users can view aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Authenticated users can view roster rules" ON public.roster_rules;
-- Restore previous policies
```

## Performance Considerations

### Potential Impact

- **Increased database queries**: More users accessing scheduler data
- **RLS overhead**: Minimal (policies are simple, use indexed columns)
- **API load**: Slight increase in `/api/aircraft` and `/api/roster-rules` calls

### Monitoring

Monitor these metrics after deployment:
- Query performance for `aircraft` and `roster_rules` tables
- API response times for GET endpoints
- Error rates (especially 403 Forbidden)

### Optimization

If performance degrades:
1. Add database indexes on `is_active`, `voided_at` for roster_rules
2. Implement API response caching (60s TTL)
3. Add pagination to aircraft list

## Future Enhancements

1. **Field-Level RLS**: Hide sensitive aircraft data (e.g., maintenance notes) from students
2. **Caching Layer**: Add Redis cache for frequently accessed scheduler data
3. **Real-Time Updates**: Use Supabase Realtime for live scheduler updates
4. **Audit Logging**: Log scheduler access for compliance

## Related Documentation

- [RBAC Architecture](./RBAC_ARCHITECTURE.md)
- [RLS Policy Patterns](./RLS_POLICY_PATTERNS.md)
- [RLS Testing Guide](./RLS_TESTING_GUIDE.md)
- [API Security Review](./API_SECURITY_REVIEW.md)

## Approval and Sign-Off

- **Implemented by**: AI Assistant
- **Date**: January 1, 2026
- **Reviewed by**: Pending
- **Approved by**: Pending

---

**Status**: ✅ Implementation Complete
**Migration File**: `017_scheduler_read_access_rls.sql`
**Risk Level**: Low (read-only access, defense-in-depth security)

