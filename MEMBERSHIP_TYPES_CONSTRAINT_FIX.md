# Membership Types Multi-Tenant Constraint Fix

## Issue

When creating membership objects inside a new tenant, the application threw an error:

```
duplicate key value violates unique constraint "membership_types_name_key"
```

## Root Cause

The `membership_types` table had two unique constraints from the old single-tenant design:
- `membership_types_name_key` - UNIQUE constraint on `name` column only
- `membership_types_code_key` - UNIQUE constraint on `code` column only

These constraints prevented different tenants from creating membership types with the same names or codes, which is essential in a multi-tenant system where each tenant should be able to use standard membership type names like "Full Member", "Student", etc.

## Solution

Applied migration `026_fix_membership_types_unique_constraints.sql` which:

1. **Dropped old constraints:**
   - `membership_types_name_key`
   - `membership_types_code_key`

2. **Created new composite unique constraints:**
   - `membership_types_tenant_name_unique` on `(tenant_id, name)`
   - `membership_types_tenant_code_unique` on `(tenant_id, code)`

3. **Added performance indexes:**
   - `idx_membership_types_tenant_name` on `(tenant_id, name)`
   - `idx_membership_types_tenant_code` on `(tenant_id, code)`

## Impact

✅ **Fixed:** Multiple tenants can now have membership types with the same names and codes  
✅ **Maintained:** Uniqueness is still enforced within each tenant  
✅ **Improved:** Added indexes for better query performance  

## Testing

You can now create membership types in different tenants with the same names without conflicts. For example:

- Tenant A can have "Full Member" membership type
- Tenant B can also have "Full Member" membership type
- Both can coexist without constraint violations

However, within a single tenant, duplicate names and codes are still prevented as expected.

## Migration Applied

The migration has been applied to your production database (`flight-service-pro`) and saved locally at:
```
/supabase/migrations/026_fix_membership_types_unique_constraints.sql
```
