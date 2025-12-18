# Current State & Next Steps

## Current Authentication & JWT Status

### ✅ What's Working

1. **Login Flow**: Uses Supabase Auth (`signInWithPassword`) which creates JWT tokens
2. **JWT Tokens**: Created automatically on login, contain user identity
3. **Role Lookup**: 3-tier fallback system works:
   - First: Check `user.user_metadata?.role` in JWT (fast)
   - Second: RPC function `get_user_role()` (medium speed)
   - Third: Direct database query with join (slower)

### ❌ What's Missing

**JWT Metadata is NOT being populated with roles**

**Current State:**
- Login creates JWT token ✅
- JWT contains user identity ✅
- JWT does NOT contain role in `user_metadata` ❌
- Code tries to read role from JWT → not found → falls back to database ✅

**Why this matters:**
- Every request falls back to database lookup (slower)
- Role changes in database don't reflect in JWT until token refresh
- No automatic sync when roles change

---

## What Needs to Be Done Next

### Priority 1: Critical Security Fixes (Must Fix Before Production)

#### 1. Fix Audit Logs RLS 🔴 CRITICAL
- **Issue**: `audit_logs` table has RLS disabled
- **Risk**: Anyone can read sensitive audit data
- **Fix**: Enable RLS, restrict to admins/owners only

#### 2. Fix Flight Logs Ownership 🔴 CRITICAL
- **Issue**: `flight_logs` policies only check authentication, not ownership
- **Risk**: Any user can see ALL flight logs
- **Fix**: Add `user_id = auth.uid()` checks

#### 3. Fix Bookings Scheduler Policy 🔴 CRITICAL
- **Issue**: `bookings_scheduler_view` uses `USING (true)` - everyone sees all bookings
- **Risk**: Privacy violation
- **Fix**: Restrict to own bookings OR authorized roles

#### 4. Fix Middleware Error Handling 🔴 CRITICAL
- **Issue**: Redirects API routes instead of returning 403
- **Risk**: API clients get HTML redirects
- **Fix**: Return proper 403 for `/api/*` routes

### Priority 2: JWT Role Sync (High Priority)

#### 5. Implement JWT Role Sync 🟡 HIGH
- **What**: Create Edge Function to sync role to JWT `user_metadata` when role changes
- **Why**: Faster role lookups, immediate role updates
- **How**: 
  1. Create Edge Function to update `user_metadata.role`
  2. Create database trigger/webhook to call Edge Function on role changes
  3. Sync role on user signup

**Current Behavior:**
- Roles are only in database
- Code checks JWT first → not found → queries database
- Works, but slower than having role in JWT

**After Implementation:**
- Roles synced to JWT `user_metadata.role`
- Fast lookups from JWT (no database query needed)
- Automatic sync when roles change

### Priority 3: Standardization & Consistency

#### 6. Standardize RLS Patterns
- Use `user_has_any_role()` consistently across all policies
- Remove old `check_user_role_simple()` usage where possible

#### 7. Document Data Ownership Model
- Document single-tenant architecture
- Ensure all user-owned tables have `user_id` columns
- Update RLS policies to enforce ownership

---

## Detailed Next Steps

### Step 1: Fix Critical Security Issues

These should be done immediately:

```sql
-- 1. Fix audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );

-- 2. Fix flight_logs
DROP POLICY IF EXISTS "Users can read flight logs" ON flight_logs;
CREATE POLICY "Users can read own flight logs"
  ON flight_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  );

-- 3. Fix bookings_scheduler_view
DROP POLICY IF EXISTS "bookings_scheduler_view" ON bookings;
CREATE POLICY "bookings_scheduler_view"
  ON bookings FOR SELECT
  USING (
    user_id = auth.uid()
    OR instructor_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  );
```

### Step 2: Implement JWT Role Sync

#### 2a. Create Edge Function

Create `supabase/functions/sync-role-to-jwt/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { userId, role } = await req.json()

    if (!userId || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update user metadata (this will be reflected in JWT on next token refresh)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: { role }
      }
    )

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

#### 2b. Create Database Function to Call Edge Function

```sql
-- Function to sync role to JWT via Edge Function
CREATE OR REPLACE FUNCTION public.sync_role_to_jwt()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'https://fergmobsjyucucxeumvb.supabase.co/functions/v1/sync-role-to-jwt';
  service_role_key TEXT;
  role_name TEXT;
BEGIN
  -- Get role name from roles table
  SELECT r.name INTO role_name
  FROM public.roles r
  WHERE r.id = NEW.role_id;
  
  -- Get service role key from environment (set via Supabase dashboard)
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Call Edge Function to update JWT claims
  PERFORM
    net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'role', role_name
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_user_role_updated ON public.user_roles;
CREATE TRIGGER on_user_role_updated
  AFTER INSERT OR UPDATE OF role_id ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.sync_role_to_jwt();
```

#### 2c. Sync Role on User Signup

Update signup flow to sync role to JWT after creating user role.

### Step 3: Fix Middleware Error Handling

Update `middleware.ts` to return 403 for API routes:

```typescript
if (!isAllowed) {
  // API routes should return 403, page routes should redirect
  if (pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  // Page routes redirect
  const url = request.nextUrl.clone()
  url.pathname = '/dashboard'
  url.searchParams.set('error', 'unauthorized')
  return NextResponse.redirect(url)
}
```

---

## Testing Checklist

After implementing fixes:

- [ ] Test audit_logs: Regular user cannot access, admin can
- [ ] Test flight_logs: User only sees own logs, instructor sees all
- [ ] Test bookings: User only sees own bookings, instructor sees all
- [ ] Test middleware: API routes return 403, page routes redirect
- [ ] Test JWT sync: Role in JWT matches database role
- [ ] Test role change: Changing role updates JWT metadata

---

## Summary

**Current State:**
- ✅ Login works with Supabase Auth (JWT tokens created)
- ✅ Role lookup works (3-tier fallback)
- ❌ Roles NOT in JWT metadata (only in database)
- ❌ Critical security vulnerabilities in RLS policies

**Immediate Actions:**
1. Fix 4 critical security issues (RLS policies)
2. Implement JWT role sync (Edge Function + trigger)
3. Fix middleware error handling

**After These Fixes:**
- Secure RLS policies
- Fast role lookups from JWT
- Automatic role sync
- Production-ready security
