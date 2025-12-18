# RBAC Documentation

This directory contains comprehensive documentation and implementation files for the Role-Based Access Control (RBAC) system in Aero Safety.

## 📚 Documentation Files

### 1. [RBAC_ARCHITECTURE.md](./RBAC_ARCHITECTURE.md)
**Complete architecture design and rationale**

- High-level architecture overview
- Database schema design with SQL examples
- RLS policy examples
- Implementation plan
- Code examples for all layers
- Security considerations
- Performance optimizations
- Role permissions matrix

**Read this first** to understand the complete system design.

### 2. [RBAC_IMPLEMENTATION_GUIDE.md](./RBAC_IMPLEMENTATION_GUIDE.md)
**Step-by-step implementation instructions**

- Database migration steps
- Edge Function setup
- Testing procedures
- Troubleshooting guide
- Security checklist

**Use this** when implementing the system.

### 3. [RBAC_QUICK_REFERENCE.md](./RBAC_QUICK_REFERENCE.md)
**Quick reference for common operations**

- Code snippets for role checking
- RLS policy patterns
- Common use cases
- Troubleshooting tips

**Reference this** during development.

## 🏗️ Architecture Overview

### Design Principles

1. **Defense in Depth**: Authorization enforced at multiple layers
   - Database (RLS) - Ultimate authority
   - API/Server - Request validation
   - Frontend - UX only (never trusted)

2. **Hybrid Role Storage**:
   - **Primary**: `user_roles` table (authoritative, queryable)
   - **Cache**: JWT custom claims (performance optimization)

3. **Role Hierarchy**:
   - `owner` (highest) → `admin` → `instructor` → `member` → `student` (lowest)

### Key Components

```
┌─────────────────────────────────────────┐
│         Frontend Layer                   │
│  - Auth Context (role state)            │
│  - Role Guard Components                │
│  - Sidebar Filtering                    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Middleware/API Layer                │
│  - Route Protection                      │
│  - Role Checking Utilities               │
│  - Request Validation                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Database Layer (RLS)                │
│  - Row Level Security Policies          │
│  - Role Helper Functions                │
│  - user_roles Table                     │
└─────────────────────────────────────────┘
```

## 📁 Implementation Files

### Core Files

- `lib/types/roles.ts` - TypeScript types and role definitions
- `lib/auth/roles.ts` - Server-side role checking utilities
- `lib/auth/route-permissions.ts` - Route permission configuration
- `contexts/auth-context.tsx` - Enhanced auth context with role support
- `components/auth/role-guard.tsx` - Server component for route protection
- `middleware.ts` - Enhanced middleware with role-based routing

### Database

- `supabase/migrations/001_create_user_roles.sql` - Database migration

### Examples

- `app/api/example-protected/route.ts` - Example protected API route

## 🚀 Quick Start

1. **Read the Architecture**: Start with [RBAC_ARCHITECTURE.md](./RBAC_ARCHITECTURE.md)

2. **Run Migration**: Execute `supabase/migrations/001_create_user_roles.sql`

3. **Set Up Edge Function**: Deploy the Edge Function (see implementation guide)

4. **Create Owner Role**: Assign owner role to your first user

5. **Test**: Follow the testing steps in the implementation guide

## 🔐 Security Layers

### Layer 1: Database (RLS)
- **Purpose**: Ultimate authority - no data access without permission
- **Implementation**: RLS policies using helper functions
- **Trust Level**: Highest (cannot be bypassed)

### Layer 2: API/Server
- **Purpose**: Validate requests before processing
- **Implementation**: Role checking in API routes and server components
- **Trust Level**: High (validates before database queries)

### Layer 3: Frontend
- **Purpose**: User experience (hide/show UI)
- **Implementation**: Conditional rendering based on role
- **Trust Level**: None (for UX only, never trusted for security)

## 📊 Role Permissions

| Feature | Owner | Admin | Instructor | Member | Student |
|---------|-------|-------|------------|--------|---------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Aircraft | ✅ | ✅ | ✅ | ❌ | ❌ |
| View All Reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Settings | ✅ | ✅ | ❌ | ❌ | ❌ |

See [RBAC_ARCHITECTURE.md](./RBAC_ARCHITECTURE.md) for complete matrix.

## 🔄 Role Change Flow

1. Admin updates role in `user_roles` table
2. Database trigger calls Edge Function
3. Edge Function updates JWT custom claims
4. Token refresh includes new role
5. Frontend auth context updates
6. UI reflects new permissions

## 🛠️ Common Tasks

### Check User Role (Server)

```typescript
import { getCurrentUserRole } from '@/lib/auth/roles'
const role = await getCurrentUserRole()
```

### Check User Role (Client)

```typescript
import { useAuth } from '@/contexts/auth-context'
const { role, hasRole, hasAnyRole } = useAuth()
```

### Protect Route (Server Component)

```typescript
import { RoleGuard } from '@/components/auth/role-guard'
<RoleGuard allowedRoles={['owner', 'admin']}>...</RoleGuard>
```

### Protect API Route

```typescript
import { userHasAnyRole } from '@/lib/auth/roles'
const hasAccess = await userHasAnyRole(userId, ['owner', 'admin'])
```

### RLS Policy

```sql
CREATE POLICY "policy_name"
  ON table_name
  FOR SELECT
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin']::user_role[],
      auth.uid()
    )
  );
```

## 📝 Next Steps

1. **Add RLS Policies**: Apply RLS to all application tables
2. **Update Sidebar**: Filter navigation items by role
3. **Create Admin UI**: Build role management interface
4. **Add Audit Logging**: Track role changes
5. **Test Thoroughly**: Test all authorization layers

## 🐛 Troubleshooting

### Role Not Appearing
- Check `user_roles` table has record
- Verify user_id matches auth.users.id
- Try `refreshUser()` in auth context

### RLS Not Working
- Ensure RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- Check policies are created correctly
- Test with SQL Editor

### Middleware Issues
- Verify route permissions config
- Check role retrieval logic
- Review middleware logs

See [RBAC_IMPLEMENTATION_GUIDE.md](./RBAC_IMPLEMENTATION_GUIDE.md) for detailed troubleshooting.

## 📖 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)

## ✅ Implementation Checklist

- [ ] Read architecture document
- [ ] Run database migration
- [ ] Set up Edge Function
- [ ] Create owner role for first user
- [ ] Test role retrieval
- [ ] Test route protection
- [ ] Test sidebar filtering
- [ ] Add RLS policies to all tables
- [ ] Create admin UI for role management
- [ ] Add audit logging
- [ ] Complete security checklist

## 🎯 Design Decisions

### Why Database Table + JWT Claims?

- **Database Table**: Authoritative source, queryable, auditable
- **JWT Claims**: Performance optimization, eliminates repeated lookups
- **Combined**: Best of both worlds - security + performance

### Why RLS is Required?

- **Defense in Depth**: Even if application code has bugs, RLS protects data
- **Direct Database Access**: Protects against SQL injection and direct DB access
- **Supabase Best Practice**: Recommended approach for multi-tenant applications

### Why Not Just JWT Claims?

- **Not Queryable**: Can't easily query "all admins"
- **Not Auditable**: Hard to track role changes
- **Cache Invalidation**: Requires token refresh for updates
- **Database is Source of Truth**: More reliable and maintainable

## 📞 Support

For questions or issues:
1. Review the relevant documentation file
2. Check the troubleshooting sections
3. Review code examples in architecture document
4. Consult Supabase and Next.js documentation

---

**Last Updated**: 2025-01-27  
**Version**: 1.0.0
