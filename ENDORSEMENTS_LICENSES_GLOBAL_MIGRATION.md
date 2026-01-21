# Endorsements and Licenses Global Migration

## Issue

The `endorsements` and `licenses` tables had `tenant_id` columns from the old single-tenant design. These should be global reference data that all tenants can access, similar to `instructor_categories`.

## Solution

Applied migration `027_make_endorsements_licenses_global.sql` which:

1. **Dropped tenant_id columns:**
   - Removed `tenant_id` from `endorsements` table
   - Removed `tenant_id` from `licenses` table
   - Kept `tenant_id` on `users_endorsements` (it's user-specific data)

2. **Dropped related constraints and indexes:**
   - Removed foreign key constraints: `endorsements_tenant_id_fkey`, `licenses_tenant_id_fkey`
   - Removed indexes: `idx_endorsements_tenant_id`, `idx_licenses_tenant_id`
   - Removed default values that referenced `get_user_tenant()`

3. **Updated RLS policies:**
   - **Old:** Tenant-scoped policies that filtered by `tenant_id`
   - **New:** Global policies that check for role at ANY tenant:
     - `endorsements_global_select`: Read access for users with instructor/admin/owner role at any tenant
     - `endorsements_global_manage`: Write access for users with admin/owner role at any tenant
     - `licenses_global_select`: Read access for users with instructor/admin/owner role at any tenant
     - `licenses_global_manage`: Write access for users with admin/owner role at any tenant

## Impact

✅ **Fixed:** Endorsements and licenses are now global reference data accessible to all tenants  
✅ **Maintained:** Role-based authorization still enforced (admin/owner for management, instructor/admin/owner for viewing)  
✅ **Preserved:** `users_endorsements` remains tenant-scoped (user-specific data)  

## Code Changes

No code changes were required! The existing API routes already:
- Don't explicitly filter by `tenant_id` in queries
- Use RLS policies for access control
- Check for proper roles via `getTenantContext`

The TypeScript types in `lib/types/database.ts` were already correct (didn't include `tenant_id`).

## Testing

The API routes should now:
- Return all endorsements/licenses globally (not filtered by tenant)
- Still enforce proper authorization (users must have appropriate role at some tenant)
- Work seamlessly with the new global RLS policies

## Migration Applied

The migration has been applied to your production database (`flight-service-pro`) and saved locally at:
```
/supabase/migrations/027_make_endorsements_licenses_global.sql
```
