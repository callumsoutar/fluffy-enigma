# API Route Security Review

## Current Security Status

### ✅ Example Protected Route (`/api/example-protected`)
**Status**: ✅ **SECURE**

- ✅ Authentication check: Verifies user is logged in
- ✅ Authorization check: Uses `userHasAnyRole()` to verify permissions
- ✅ Proper error handling: Returns 401 for unauthenticated, 403 for unauthorized
- ✅ Role-based access: GET requires owner/admin/instructor, POST requires owner/admin

**Pattern**: This is the **correct pattern** to follow.

---

### ⚠️ Bookings API Route (`/api/bookings`)
**Status**: ⚠️ **NEEDS IMPROVEMENT**

#### Current Security:
- ✅ Authentication check: Verifies user is logged in
- ❌ **No role-based authorization check** - relies only on RLS
- ⚠️ **Security vulnerability**: Allows `user_id` filter parameter without validation
- ⚠️ **Imports `userHasAnyRole` but doesn't use it**

#### Issues:

1. **Missing Role Check**
   - Currently: Any authenticated user can access
   - Should: All authenticated users can access (bookings are user-owned data)
   - **However**: Should validate that users can only filter by their own `user_id` unless they're admin/instructor

2. **User ID Filter Vulnerability**
   ```typescript
   if (filters.user_id) {
     query = query.eq('user_id', filters.user_id)
   }
   ```
   - **Problem**: A regular user could pass `user_id=someone-else-uuid` to query other users' bookings
   - **Risk**: Even with RLS, this is a security anti-pattern - we should validate at API level
   - **Fix**: Check if user is admin/instructor OR if `user_id` matches current user

3. **Instructor ID Filter**
   - Similar issue: Should validate instructor can only filter by their own `instructor_id` unless admin

---

## Security Recommendations

### 1. Add Role-Based Validation for Filters

**For `/api/bookings`:**

```typescript
// Validate user_id filter
if (filters.user_id) {
  const userRole = await getUserRoleCached(user.id)
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  
  // Only allow filtering by own user_id unless admin/instructor
  if (!isAdminOrInstructor && filters.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot query other users\' bookings' },
      { status: 403 }
    )
  }
}

// Validate instructor_id filter
if (filters.instructor_id) {
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  
  // Only allow filtering by own instructor_id unless admin
  if (!isAdminOrInstructor && filters.instructor_id !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot query other instructors\' bookings' },
      { status: 403 }
    )
  }
}
```

### 2. Add Optional Role Checks for Admin-Only Operations

If certain operations should be admin-only (e.g., viewing all bookings regardless of filters):

```typescript
// Optional: Restrict certain operations to admins
if (someAdminOnlyOperation) {
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    )
  }
}
```

### 3. Defense in Depth

**Current approach:**
- Layer 1: API authentication ✅
- Layer 2: API authorization ⚠️ (missing for bookings)
- Layer 3: RLS policies ✅ (enforced at database)

**Recommended:**
- Layer 1: API authentication ✅
- Layer 2: API authorization ✅ (add role checks)
- Layer 3: RLS policies ✅ (enforced at database)

---

## Security Checklist

### For Each API Route:

- [ ] **Authentication**: Check `user` exists (401 if not)
- [ ] **Authorization**: Check roles if needed (403 if insufficient)
- [ ] **Input Validation**: Validate filter parameters
- [ ] **Ownership Validation**: Ensure users can only access their own data (unless admin)
- [ ] **Error Handling**: Proper HTTP status codes (401/403/500)
- [ ] **RLS**: Database policies enforce at final layer

---

## Current State Summary

| Route | Auth | Role Check | Filter Validation | RLS | Status |
|-------|------|------------|-------------------|-----|--------|
| `/api/example-protected` | ✅ | ✅ | N/A | N/A | ✅ Secure |
| `/api/bookings` | ✅ | ❌ | ❌ | ✅ | ⚠️ Needs Fix |

---

## Next Steps

1. **Fix `/api/bookings` route**:
   - Add filter parameter validation
   - Ensure users can only filter by own `user_id` unless admin/instructor
   - Ensure instructors can only filter by own `instructor_id` unless admin

2. **Document security patterns**:
   - Create reusable helper functions for common security checks
   - Document when to use role checks vs RLS-only

3. **Add tests**:
   - Test that users cannot query other users' data
   - Test that admins can query all data
   - Test that RLS still enforces at database level
