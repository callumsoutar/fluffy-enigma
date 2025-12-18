# RBAC Quick Reference Guide

Quick reference for common RBAC operations and patterns.

## Role Types

```typescript
type UserRole = 'owner' | 'admin' | 'instructor' | 'member' | 'student'
```

## Server-Side Role Checking

### Get Current User's Role

```typescript
import { getCurrentUserRole } from '@/lib/auth/roles'

const role = await getCurrentUserRole()
```

### Check if User Has Role

```typescript
import { userHasRole } from '@/lib/auth/roles'

const isAdmin = await userHasRole(userId, 'admin')
```

### Check if User Has Any Role

```typescript
import { userHasAnyRole } from '@/lib/auth/roles'

const canManage = await userHasAnyRole(userId, ['owner', 'admin', 'instructor'])
```

### Check Current User

```typescript
import { currentUserHasAnyRole } from '@/lib/auth/roles'

const canAccess = await currentUserHasAnyRole(['owner', 'admin'])
```

## Client-Side Role Checking

### Using Auth Context

```typescript
import { useAuth } from '@/contexts/auth-context'

function MyComponent() {
  const { role, hasRole, hasAnyRole } = useAuth()
  
  if (hasRole('admin')) {
    // Show admin content
  }
  
  if (hasAnyRole(['owner', 'admin', 'instructor'])) {
    // Show instructor content
  }
}
```

## Route Protection

### Server Component

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

### API Route

```typescript
import { userHasAnyRole } from '@/lib/auth/roles'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Your logic here
}
```

## RLS Policies

### Basic Policy Pattern

```sql
-- Allow users with specific roles
CREATE POLICY "policy_name"
  ON table_name
  FOR SELECT
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );
```

### Users Can View Their Own Records

```sql
CREATE POLICY "Users can view own records"
  ON table_name
  FOR SELECT
  USING (auth.uid() = user_id);
```

### Combined: Own Records OR Authorized Role

```sql
CREATE POLICY "Users can view own or authorized records"
  ON table_name
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );
```

## Sidebar Navigation Filtering

```typescript
const navigationItems = [
  {
    title: "Admin",
    url: "/admin",
    roles: ['owner', 'admin'] as UserRole[],
  },
  // ...
]

const { role } = useAuth()
const filteredItems = navigationItems.filter(item => 
  item.roles.includes(role!)
)
```

## Role Permissions Matrix

| Action | Owner | Admin | Instructor | Member | Student |
|--------|-------|-------|------------|--------|---------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Aircraft | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Reports | ✅ | ✅ | ✅ | ✅ | ✅ |

## Common Patterns

### Pattern 1: Role-Based Conditional Rendering

```typescript
const { hasAnyRole } = useAuth()

{hasAnyRole(['owner', 'admin']) && (
  <AdminPanel />
)}
```

### Pattern 2: Role-Based Redirect

```typescript
const { role } = useAuth()

useEffect(() => {
  if (role && !['owner', 'admin'].includes(role)) {
    router.push('/dashboard?error=unauthorized')
  }
}, [role, router])
```

### Pattern 3: Database Query with RLS

```typescript
// RLS automatically filters based on user role
const { data } = await supabase
  .from('reports')
  .select('*')
// Only returns records user can access based on RLS policies
```

## Updating User Roles

### Server-Side (Admin Only)

```typescript
import { currentUserHasAnyRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export async function updateUserRole(userId: string, newRole: UserRole) {
  // Check if current user can update roles
  const canUpdate = await currentUserHasAnyRole(['owner', 'admin'])
  if (!canUpdate) {
    throw new Error('Unauthorized')
  }
  
  const supabase = await createClient()
  
  // Update role in database
  const { error } = await supabase
    .from('user_roles')
    .update({ role: newRole })
    .eq('user_id', userId)
  
  if (error) throw error
  
  // Optionally: Call Edge Function to update JWT claims
  // This ensures immediate role update without waiting for token refresh
}
```

## Troubleshooting

### Role Not Updating

1. Check database: `SELECT * FROM user_roles WHERE user_id = '...'`
2. Refresh session: `await supabase.auth.refreshSession()`
3. Check JWT claims: `user.user_metadata?.role`

### RLS Blocking Access

1. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
2. Check policies: `SELECT * FROM pg_policies WHERE tablename = '...'`
3. Test with SQL: `SET request.jwt.claim.sub = 'user_id'; SELECT * FROM table_name;`

### Middleware Not Working

1. Check route permissions config
2. Verify role is being retrieved
3. Check middleware logs
4. Ensure middleware matcher includes your routes

## Database Functions Reference

```sql
-- Get user role
SELECT public.get_user_role(auth.uid());

-- Check if user has role
SELECT public.user_has_role('admin', auth.uid());

-- Check if user has any role
SELECT public.user_has_any_role(
  ARRAY['owner', 'admin']::user_role[],
  auth.uid()
);

-- Check minimum role
SELECT public.user_has_minimum_role('instructor', auth.uid());
```
