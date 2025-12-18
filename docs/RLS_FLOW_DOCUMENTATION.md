# RLS Flow Documentation: How Authorization Works End-to-End

## Overview

This document explains the complete flow of how authorization works in the Aero Safety application, from user request to data return. Understanding this flow is critical for maintaining security and debugging authorization issues.

## The Complete Request Flow

### Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Makes Request                                       │
│    - Browser: User clicks link or submits form              │
│    - API Client: JavaScript/TypeScript makes fetch call      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Next.js Middleware (middleware.ts)                       │
│    - updateSession(): Validates JWT, refreshes if needed    │
│    - Checks authentication: Is user logged in?              │
│    - If not authenticated → Redirect to /login (401)        │
│    - If authenticated → Continue                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Middleware Role Check                                    │
│    - Gets user role from JWT claims (fast)                 │
│    - OR queries database via RPC function (fallback)         │
│    - Checks route permissions (route-permissions.ts)         │
│    - If unauthorized → Redirect to /dashboard?error=...     │
│    - If authorized → Continue                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Next.js Route Handler                                    │
│    - Page Route: Server Component renders                   │
│    - API Route: Handler function executes                    │
│    - Both can check roles again (for UX/logging)            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Application Code Queries Database                        │
│    - supabase.from('bookings').select('*')                   │
│    - Supabase client sends query to PostgreSQL               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. PostgreSQL Receives Query                                │
│    - Checks if RLS is enabled on table (YES)                │
│    - Extracts auth.uid() from JWT token                     │
│    - Begins RLS policy evaluation                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. RLS Policy Evaluation                                    │
│    - Evaluates USING clause for each row                     │
│    - Example: USING (                                        │
│        user_id = auth.uid()                                  │
│        OR user_has_any_role(auth.uid(), [...])              │
│      )                                                       │
│    - Calls user_has_any_role() function                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Role Checking Function Executes                          │
│    - Function: user_has_any_role()                           │
│    - SECURITY DEFINER: Executes with function creator's     │
│      privileges (bypasses RLS on user_roles table)          │
│    - Queries user_roles + roles tables directly              │
│    - Returns boolean (true/false)                            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. RLS Policy Decision                                       │
│    - If function returns true → Row is INCLUDED             │
│    - If function returns false → Row is FILTERED OUT        │
│    - This happens for EVERY row in the table                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. Filtered Results Returned                               │
│     - Only rows that passed RLS are returned                │
│     - Supabase client receives filtered data                │
│     - Application code receives filtered data                │
│     - User sees only data they're authorized to see         │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Step-by-Step Explanation

### Step 1: User Request

**What happens:**
- User interacts with the application (clicks button, navigates to page, etc.)
- Browser or API client makes HTTP request to Next.js server

**Security check:** None yet - this is just the request initiation

---

### Step 2: Middleware Authentication Check

**File:** `middleware.ts` → calls `updateSession()` from `lib/supabase/middleware.ts`

**What happens:**
```typescript
// 1. Create Supabase client with cookies
const supabase = createServerClient(...)

// 2. Get user from JWT token
const { data: { user } } = await supabase.auth.getUser()

// 3. If no user, redirect to login
if (!user) {
  return NextResponse.redirect('/login')
}
```

**Security check:** Authentication (is user logged in?)
- ✅ **Pass**: User has valid JWT token → Continue
- ❌ **Fail**: No user or invalid token → Redirect to `/login` (401 Unauthorized)

**Why this matters:** Prevents unauthenticated users from accessing protected routes

---

### Step 3: Middleware Role Check

**File:** `middleware.ts` lines 34-85

**What happens:**
```typescript
// 1. Get user role (from JWT claims or database)
const role = await getUserRoleCached(user.id)

// 2. Check if role is allowed for this route
const isAllowed = isRoleAllowedForRoute(role, pathname)

// 3. If not allowed, redirect
if (!isAllowed) {
  return NextResponse.redirect('/dashboard?error=unauthorized')
}
```

**Security check:** Authorization (does user have required role?)
- ✅ **Pass**: User has required role → Continue
- ❌ **Fail**: User doesn't have required role → Redirect (403 Forbidden)

**Why this matters:** 
- Provides fast failure (doesn't hit database)
- Better UX (redirects unauthorized users)
- **BUT**: This is NOT the final security check - RLS still enforces

---

### Step 4: Route Handler

**Files:** 
- Page routes: `app/**/page.tsx` (Server Components)
- API routes: `app/api/**/route.ts`

**What happens:**
- Server Component renders OR API handler executes
- May check roles again using `RoleGuard` or `userHasAnyRole()`

**Security check:** Optional additional authorization check
- Used for conditional rendering or logging
- **NOT** the final security gate

---

### Step 5: Database Query

**What happens:**
```typescript
// Application code
const { data } = await supabase
  .from('bookings')
  .select('*')
```

**What actually happens:**
- Supabase client sends SQL query to PostgreSQL
- Query includes JWT token in `Authorization` header
- PostgreSQL extracts `auth.uid()` from JWT

**Security check:** None yet - query is sent to database

---

### Step 6: PostgreSQL RLS Evaluation

**What happens:**
1. PostgreSQL receives query
2. Checks if RLS is enabled on `bookings` table: **YES**
3. Extracts `auth.uid()` from JWT token
4. Begins evaluating RLS policies

**Example RLS Policy:**
```sql
CREATE POLICY "Users can view own or authorized bookings"
  ON bookings FOR SELECT
  USING (
    user_id = auth.uid()  -- Own data
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )  -- Authorized roles
  );
```

**Security check:** RLS policy evaluation begins

---

### Step 7: Role Checking Function Call

**What happens:**
1. RLS policy calls `user_has_any_role(auth.uid(), ARRAY[...])`
2. Function executes with `SECURITY DEFINER`
3. Function queries `user_roles` table **directly** (bypasses RLS on `user_roles`)
4. Function returns boolean

**Why SECURITY DEFINER is needed:**
- Without it: RLS policy checks role → queries `user_roles` → triggers RLS on `user_roles` → tries to check role → **infinite loop**
- With it: Function bypasses RLS on `user_roles` table, breaks the circular dependency

**Function implementation:**
```sql
CREATE OR REPLACE FUNCTION public.user_has_any_role(
  required_roles TEXT[],
  user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- Bypasses RLS on user_roles table
STABLE            -- Deterministic, can be cached
SET search_path = public  -- Security: prevent search path attacks
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    INNER JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_has_any_role.user_id
    AND r.name::TEXT = ANY(required_roles)
    AND ur.is_active = true
    AND r.is_active = true
  );
$$;
```

**Security check:** Function returns boolean (true/false)
- ✅ **True**: User has one of the required roles
- ❌ **False**: User doesn't have any of the required roles

---

### Step 8: RLS Policy Decision

**What happens:**
For each row in the `bookings` table:

1. Evaluate USING clause:
   ```sql
   user_id = auth.uid()  -- Is this the user's own booking?
   OR user_has_any_role(...)  -- OR does user have authorized role?
   ```

2. If USING clause evaluates to **true**:
   - ✅ Row is **INCLUDED** in result set

3. If USING clause evaluates to **false**:
   - ❌ Row is **FILTERED OUT** (not returned)

**Example:**
- User has role: `student`
- Query: `SELECT * FROM bookings`
- RLS policy: `user_id = auth.uid() OR user_has_any_role(auth.uid(), ['owner', 'admin', 'instructor'])`
- Result: Only bookings where `user_id = auth.uid()` are returned (student doesn't have admin/instructor role)

**Security check:** **THIS IS THE FINAL GATE**
- Every row is checked
- Only authorized rows are returned
- **No way to bypass** without service role key

---

### Step 9: Filtered Results Returned

**What happens:**
1. PostgreSQL returns only rows that passed RLS
2. Supabase client receives filtered data
3. Application code receives filtered data
4. User sees only data they're authorized to see

**Security check:** Complete - user only sees authorized data

---

## Why RLS Is the Last Line of Defense

### Even If Other Layers Fail

**Scenario 1: Middleware is bypassed**
- Attacker manipulates client to skip middleware
- **RLS still enforces** - database query is still filtered

**Scenario 2: API route check is bypassed**
- Attacker calls API directly with manipulated request
- **RLS still enforces** - database query is still filtered

**Scenario 3: Client code is manipulated**
- Attacker modifies JavaScript to query different data
- **RLS still enforces** - database query is still filtered

**Scenario 4: All application layers are compromised**
- Attacker has access to application code
- **RLS still enforces** - database query is still filtered
- Only way to bypass: Service role key (which is server-only, never exposed to client)

---

## Security Model: Defense in Depth

```
Layer 1: UI (components/app-sidebar.tsx)
  └─ Hides unauthorized menu items
  └─ Purpose: UX only, NOT security
  └─ Can be bypassed: YES (client-side)

Layer 2: Middleware (middleware.ts)
  └─ Blocks unauthorized routes
  └─ Purpose: Fast failure, better UX
  └─ Can be bypassed: YES (if client manipulates requests)

Layer 3: API Routes (app/api/**/route.ts)
  └─ Checks permissions before processing
  └─ Purpose: Better error messages, logging
  └─ Can be bypassed: YES (if API is called directly)

Layer 4: RLS Policies (Database)
  └─ Filters data at database level
  └─ Purpose: FINAL SECURITY GATE
  └─ Can be bypassed: NO (without service role key)
```

**Key Point:** Each layer can fail, but RLS (Layer 4) is always enforced.

---

## How SECURITY DEFINER Functions Work

### The Circular Dependency Problem

**Without SECURITY DEFINER:**
```
RLS policy on bookings table
  → Calls user_has_any_role()
    → Queries user_roles table
      → Triggers RLS on user_roles table
        → Tries to check role
          → Calls user_has_any_role()
            → INFINITE LOOP ❌
```

**With SECURITY DEFINER:**
```
RLS policy on bookings table
  → Calls user_has_any_role()
    → Function executes with DEFINER privileges
      → Queries user_roles table (bypasses RLS)
        → Returns boolean
          → RLS policy uses result
            → SUCCESS ✅
```

### Why This Is Safe

1. **Function is read-only**: Only SELECT, never modifies data
2. **Function is scoped**: Only checks roles, doesn't grant access
3. **RLS still enforces**: The RLS policy on the target table (e.g., `bookings`) is still evaluated
4. **Function returns boolean**: RLS policy decides, not the function
5. **No privilege escalation**: Function doesn't grant additional permissions

---

## Example: Complete Flow for Booking Query

### Scenario: Student user queries bookings

**Step 1:** User clicks "My Bookings" link
- Browser: `GET /bookings`

**Step 2:** Middleware checks authentication
- ✅ User is authenticated (has valid JWT)
- Continue

**Step 3:** Middleware checks role
- Role: `student`
- Route `/bookings` allows: `['owner', 'admin', 'instructor', 'member', 'student']`
- ✅ Student is allowed
- Continue

**Step 4:** Page component renders
- Server Component: `app/bookings/page.tsx`
- Calls: `supabase.from('bookings').select('*')`

**Step 5:** Query sent to database
- SQL: `SELECT * FROM bookings`
- JWT token included in request

**Step 6:** PostgreSQL evaluates RLS
- RLS enabled: ✅
- Policy: `user_id = auth.uid() OR user_has_any_role(auth.uid(), ['owner', 'admin', 'instructor'])`
- For each row:
  - Check: `user_id = auth.uid()` (student's own bookings)
  - OR check: `user_has_any_role(...)` (student is not admin/instructor)

**Step 7:** Function call
- `user_has_any_role('student-uuid', ['owner', 'admin', 'instructor'])`
- Function queries `user_roles` table (bypasses RLS)
- Finds: user has role `student`
- Returns: `false` (student is not in ['owner', 'admin', 'instructor'])

**Step 8:** RLS decision
- For each booking row:
  - If `user_id = auth.uid()` → ✅ Include
  - If `user_has_any_role()` returns false → ❌ Exclude
- Result: Only bookings where `user_id = 'student-uuid'` are included

**Step 9:** Filtered results returned
- Database returns: Only student's own bookings
- Application receives: Only student's own bookings
- User sees: Only their own bookings ✅

---

## Testing the Flow

### Test 1: Verify RLS is Working

```typescript
// As a regular user
const { data } = await supabase
  .from('bookings')
  .select('*');

// Should only return user's own bookings
console.log(data); // Only bookings where user_id = current user
```

### Test 2: Try to Bypass (Should Fail)

```typescript
// Even if client tries to manipulate
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('user_id', 'someone-else-uuid');  // Try to get someone else's bookings

// RLS still filters - only returns user's own bookings
console.log(data); // Still only user's own bookings
```

### Test 3: Direct Database Query

```sql
-- Set user context
SET request.jwt.claim.sub = 'user-uuid-here';

-- Query bookings
SELECT * FROM bookings;

-- Should only return bookings where user_id = 'user-uuid-here'
-- OR where user has admin/instructor role
```

---

## Common Questions

### Q: Why do we need middleware/API checks if RLS works?

**A:** Multiple reasons:
1. **Performance**: Fail fast before database query
2. **UX**: Redirect unauthorized users to appropriate page
3. **Error messages**: Better 401/403 responses
4. **Logging**: Track authorization attempts
5. **Defense in depth**: Multiple layers of security

### Q: Can SECURITY DEFINER functions be exploited?

**A:** No, when properly implemented:
- Functions are read-only (SELECT only)
- Functions only return booleans (don't grant access)
- RLS policy still decides (function doesn't grant permissions)
- Functions have `SET search_path = public` (prevents search path attacks)

### Q: What if a user's role changes?

**A:** 
- Database is updated immediately
- JWT claims may be stale until token refresh
- RLS always checks database (authoritative source)
- User will get new permissions on next request (after token refresh or database lookup)

### Q: How do we test RLS policies?

**A:** See `RLS_TESTING_GUIDE.md` for detailed testing procedures.

---

## Key Takeaways

1. **RLS is the final security gate** - always enforced, cannot be bypassed
2. **SECURITY DEFINER functions** are safe when read-only and scoped
3. **Defense in depth** - multiple layers, but RLS is the ultimate authority
4. **Every database query** goes through RLS evaluation
5. **Functions only return booleans** - RLS policy decides access

---

## Related Documentation

- [RLS Policy Patterns Guide](./RLS_POLICY_PATTERNS.md)
- [RLS Testing Guide](./RLS_TESTING_GUIDE.md)
- [RBAC Architecture](./RBAC_ARCHITECTURE.md)
