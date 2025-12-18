# RBAC System Update Summary

## Overview

The RBAC system has been updated to work with your existing database structure, which uses a normalized `roles` table with foreign key relationships instead of an enum-based approach.

## Database Structure

Your existing database uses:
- **`roles` table**: Contains role definitions (id, name, description, is_active)
- **`user_roles` table**: Links users to roles via `role_id` foreign key
- **Active roles**: Both tables have `is_active` flags for soft deletes

## Changes Made

### 1. Database Functions Created

The following helper functions were added to work with your existing structure:

- `get_user_role(user_id)` - Returns role name as TEXT
- `user_has_role(required_role_name, user_id)` - Checks if user has specific role
- `user_has_any_role(required_role_names[], user_id)` - Checks if user has any of provided roles
- `user_has_minimum_role(minimum_role_name, user_id)` - Checks role hierarchy
- `get_role_id_by_name(role_name)` - Helper to get role ID by name

### 2. TypeScript Files Updated

All TypeScript files have been updated to work with the existing database structure:

#### `lib/auth/roles.ts`
- Updated `getUserRole()` to join `user_roles` with `roles` table
- Updated `getUserRoleCached()` to use RPC function `get_user_role`
- Updated `userHasRole()` and `userHasAnyRole()` to use database RPC functions for better performance
- All functions now handle the `is_active` flag

#### `contexts/auth-context.tsx`
- Updated `fetchUserRole()` to:
  1. Check JWT claims first (fast)
  2. Fall back to RPC function `get_user_role`
  3. Final fallback to direct query with join
- Properly handles Supabase's array return for joined relations

#### `middleware.ts`
- Updated role checking to use RPC function `get_user_role`
- Falls back to direct query if RPC fails
- Handles array returns from Supabase joins

#### `components/auth/role-guard.tsx`
- Updated to use RPC function for role lookup
- Falls back to direct query with proper type handling

## How It Works

### Role Lookup Flow

1. **JWT Claims (Fastest)**: Check `user.user_metadata.role` first
2. **RPC Function (Fast)**: Call `get_user_role()` database function
3. **Direct Query (Fallback)**: Join `user_roles` with `roles` table

### Performance Optimization

- Database RPC functions are used for role checks (more efficient than client-side joins)
- JWT claims provide instant role access without database queries
- Direct queries only used as fallback

## Usage Examples

### Server-Side Role Check

```typescript
import { getUserRoleCached, userHasAnyRole } from '@/lib/auth/roles'

// Get user's role
const role = await getUserRoleCached(userId)

// Check if user has any of the roles
const canAccess = await userHasAnyRole(userId, ['owner', 'admin', 'instructor'])
```

### Client-Side Role Check

```typescript
import { useAuth } from '@/contexts/auth-context'

function MyComponent() {
  const { role, hasRole, hasAnyRole } = useAuth()
  
  if (hasAnyRole(['owner', 'admin'])) {
    // Show admin content
  }
}
```

### Route Protection

```typescript
import { RoleGuard } from '@/components/auth/role-guard'

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={['owner', 'admin']}>
      <div>Admin Content</div>
    </RoleGuard>
  )
}
```

## Database Function Signatures

All functions use `user_id` as the parameter name (UUID type):

```sql
get_user_role(user_id UUID DEFAULT auth.uid()) RETURNS TEXT
user_has_role(required_role_name TEXT, user_id UUID DEFAULT auth.uid()) RETURNS BOOLEAN
user_has_any_role(required_role_names TEXT[], user_id UUID DEFAULT auth.uid()) RETURNS BOOLEAN
user_has_minimum_role(minimum_role_name TEXT, user_id UUID DEFAULT auth.uid()) RETURNS BOOLEAN
```

## Important Notes

1. **Active Roles Only**: All queries filter by `is_active = true` on both `user_roles` and `roles` tables
2. **Role Names**: Functions return role names as TEXT (e.g., 'owner', 'admin', 'instructor', 'member', 'student')
3. **Type Safety**: TypeScript types ensure only valid role names are used
4. **Fallback Strategy**: Multiple fallback layers ensure role lookup always works

## Testing

To test the implementation:

1. **Check Role Retrieval**:
   ```typescript
   const role = await getUserRoleCached(userId)
   console.log('User role:', role)
   ```

2. **Test RPC Functions**:
   ```sql
   SELECT public.get_user_role('user-uuid-here');
   SELECT public.user_has_role('admin', 'user-uuid-here');
   ```

3. **Verify in Browser**:
   - Log in and check browser console
   - Auth context should log the user's role
   - Sidebar should filter based on role

## Next Steps

1. ✅ Database functions created
2. ✅ TypeScript files updated
3. ⏳ Test role retrieval
4. ⏳ Update sidebar navigation filtering
5. ⏳ Add RLS policies to application tables
6. ⏳ Create admin UI for role management

## Troubleshooting

### Role Not Appearing

1. Check `user_roles` table has a record for the user
2. Verify `is_active = true` on both `user_roles` and `roles`
3. Check that `role_id` references a valid role in `roles` table
4. Try calling the RPC function directly in SQL Editor

### RPC Function Errors

If RPC functions fail:
- Check function exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'get_user_role'`
- Verify parameter names match (should be `user_id`, not `user_uuid`)
- Check function permissions

### Type Errors

If you see TypeScript errors about role types:
- Ensure `isValidRole()` is used to validate role strings
- Check that role names match exactly: 'owner', 'admin', 'instructor', 'member', 'student'

---

**Last Updated**: 2025-01-27  
**Status**: ✅ Complete - Ready for Testing
