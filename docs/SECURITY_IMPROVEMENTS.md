# Security Improvements Documentation

This document outlines the security improvements implemented and the manual actions required to complete the security hardening of the Aero Safety application.

## Completed Improvements (Applied via Migrations)

### 1. Security Function Search Path Fixes

**Migration:** `022_fix_security_function_search_paths.sql` (applied)

Fixed `search_path` vulnerability for all security-critical database functions used in RLS policies:

| Function | Purpose |
|----------|---------|
| `user_belongs_to_tenant()` | Checks if current user is a member of a tenant |
| `tenant_user_has_role()` | Checks if user has specific roles at a tenant |
| `users_share_tenant()` | Checks if two users share a tenant |
| `current_user_is_staff()` | Checks if current user has staff privileges |
| `can_manage_user()` | Checks if current user can manage another user |
| `check_user_role()` | General role checking function |
| `check_user_role_simple()` | Simplified role check avoiding RLS loops |
| `get_user_role()` | Gets user's highest priority role |
| `get_tenant_user_role()` | Gets user's role at specific tenant |
| `get_user_tenant()` | Gets user's primary tenant |
| `is_auth_user()` | Validates user exists in auth.users |
| `can_see_contact_info()` | Checks contact info visibility |

All functions now use:
- `SECURITY DEFINER` - Executes with owner's privileges
- `SET search_path = ''` - Prevents search_path manipulation attacks

### 2. Role Change Propagation System

**Migration:** `024_add_role_change_propagation.sql` (applied)

Added infrastructure to detect and handle role changes:

#### New Database Objects:
- **Column:** `tenant_users.role_changed_at` - Tracks when role was last modified
- **Function:** `needs_session_refresh(user_id, token_issued_at)` - Checks if session needs refresh
- **Function:** `get_current_role_state(user_id)` - Gets current role from database
- **Trigger:** `trigger_track_role_changes` - Automatically updates `role_changed_at`
- **Trigger:** `trigger_notify_role_change` - Sends pg_notify for real-time updates

#### Application Changes:
- **AuthContext** (`contexts/auth-context.tsx`):
  - Added `roleChangedSinceLogin` state
  - Periodic role change detection (every 60 seconds)
  - Automatic role refresh when change detected

- **Roles Library** (`lib/auth/roles.ts`):
  - Removed deprecated legacy functions
  - Added `needsSessionRefresh()` - Server-side session validation
  - Added `getCurrentRoleState()` - Get current database role state
  - All functions now use tenant-aware patterns

### 3. Deprecated Functions Removed

The following deprecated functions have been removed from `lib/auth/roles.ts`:
- `getUserRole()` → Use `getTenantContext()`
- `userHasRole()` → Use `hasTenantRole()`
- `userHasAnyRole()` → Use `hasTenantRole()`
- `getUserRoleCached()` → Use `getCurrentUserRole()`

---

## Manual Actions Required (Supabase Dashboard)

The following actions must be performed manually in the Supabase Dashboard:

### 1. Enable Leaked Password Protection

**Priority:** High  
**Estimated Time:** 2 minutes

This prevents users from registering with passwords known to be compromised (checked against HaveIBeenPwned).

**Steps:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `fergmobsjyucucxeumvb`
3. Navigate to **Authentication** → **Policies** (or **Auth Settings**)
4. Find **Password Requirements** or **Security** section
5. Enable **"Leaked Password Protection"** or **"HaveIBeenPwned check"**
6. Save changes

**Reference:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. Upgrade Postgres Version

**Priority:** High  
**Estimated Time:** 5-15 minutes (requires brief downtime)

Current version has outstanding security patches available.

**Steps:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `fergmobsjyucucxeumvb`
3. Navigate to **Settings** → **Infrastructure**
4. Find the **Database** section
5. Click **Upgrade** or **Restart with latest version**
6. Confirm the upgrade
7. Wait for the upgrade to complete (may cause brief downtime)

**Reference:** https://supabase.com/docs/guides/platform/upgrading

**Note:** Before upgrading:
- Ensure you have a recent backup
- Schedule during low-traffic period if possible
- Test in a development branch first if available

---

## Known Limitations

### pg_net Extension Cannot Be Moved

The `pg_net` extension is installed in the `public` schema and triggers a security warning. Unfortunately, this extension does not support `SET SCHEMA` and cannot be moved.

**Status:** Cannot be fixed  
**Risk:** Low - This is an informational warning; the extension itself is secure.

---

## Remaining Security Warnings

The following functions still have the `search_path` warning but are **not security-critical** (not used in RLS policies). These can be addressed in a future migration if desired:

### Business Logic Functions (Lower Priority)
- `soft_delete_invoice`
- `prevent_approved_invoice_modification`
- `generate_credit_note_number`
- `get_maintenance_frequency_report`
- `get_instructor_week_schedule`
- `check_schedule_conflict`
- `cancel_booking`
- `uncancel_booking`
- `process_payment`
- `process_refund`
- ... and ~40 more

**Recommendation:** Create a follow-up migration to fix these in a future sprint. They don't affect RLS security but fixing them follows best practices.

---

## Security Checklist

### Completed
- [x] Fix search_path for RLS security functions
- [x] Implement role change detection
- [x] Update AuthContext with role change propagation
- [x] Remove deprecated role functions
- [x] Add `needs_session_refresh()` RPC function
- [x] Add `get_current_role_state()` RPC function
- [x] Add role change tracking triggers

### Manual Actions Pending
- [ ] Enable leaked password protection (Dashboard)
- [ ] Upgrade Postgres version (Dashboard)

### Future Improvements (Optional)
- [ ] Fix remaining ~50 business logic function search_paths
- [ ] Consider implementing rate limiting for auth endpoints
- [ ] Add security audit logging for admin actions

---

## Testing the Changes

### Test Role Change Detection

1. Log in as a user
2. In another session (or SQL Editor), change the user's role:
   ```sql
   UPDATE tenant_users 
   SET role_id = (SELECT id FROM roles WHERE name = 'admin')
   WHERE user_id = 'your-user-id';
   ```
3. Wait up to 60 seconds
4. Check browser console for: `[AUTH] Role has changed since login`
5. The user should see their new role without logging out

### Test Session Refresh Function

```sql
-- Check if session needs refresh
SELECT needs_session_refresh(
  'user-uuid-here',
  '2024-01-20T10:00:00Z'::timestamptz
);

-- Get current role state
SELECT * FROM get_current_role_state('user-uuid-here');
```

---

## Rollback Instructions

If issues arise, the migrations can be rolled back:

```sql
-- Rollback role change propagation
DROP TRIGGER IF EXISTS trigger_notify_role_change ON public.tenant_users;
DROP TRIGGER IF EXISTS trigger_track_role_changes ON public.tenant_users;
DROP FUNCTION IF EXISTS public.notify_role_change();
DROP FUNCTION IF EXISTS public.track_role_changes();
DROP FUNCTION IF EXISTS public.needs_session_refresh(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_current_role_state(UUID);
ALTER TABLE public.tenant_users DROP COLUMN IF EXISTS role_changed_at;
```

Note: Rolling back the search_path fixes is not recommended as it would reduce security.

---

## References

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Supabase Auth Security](https://supabase.com/docs/guides/auth/password-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [PostgreSQL search_path Security](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-SEARCH-PATH)
