# RBAC Implementation Guide

This guide provides step-by-step instructions for implementing the RBAC system in your Aero Safety application.

## Prerequisites

- Supabase project set up and configured
- Next.js application with Supabase authentication already working
- Access to Supabase Dashboard

## Step 1: Run Database Migration

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/001_create_user_roles.sql`
4. Paste and execute the SQL

### Option B: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

### Verify Migration

After running the migration, verify the following:

1. Check that `user_roles` table exists:
   ```sql
   SELECT * FROM public.user_roles;
   ```

2. Check that functions exist:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name LIKE '%role%';
   ```

## Step 2: Set Up Edge Function for JWT Claim Updates

### Create Edge Function

1. In Supabase Dashboard, go to **Edge Functions**
2. Click **Create a new function**
3. Name it `update-user-role`
4. Use the following code:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Validate role
    const validRoles = ['owner', 'admin', 'instructor', 'member', 'student']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
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

5. Deploy the function

### Set Up Database Webhook (Alternative to Trigger)

Since we can't create triggers directly on `auth.users`, we'll use a database webhook:

1. Go to **Database** → **Webhooks** in Supabase Dashboard
2. Create a new webhook that triggers on `user_roles` table updates
3. Configure it to call the Edge Function

**OR** use a simpler approach: Update the role in the application code and manually call the Edge Function.

## Step 3: Create Your First Owner User

After running the migration, you need to create an owner role for your first user:

```sql
-- Replace 'YOUR_USER_ID' with the actual UUID from auth.users
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'owner')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
```

To find your user ID:
1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Copy the UUID of your user
3. Use it in the SQL above

## Step 4: Test the Implementation

### Test Role Retrieval

1. Log in to your application
2. Check the browser console - the auth context should log the user's role
3. Verify the role appears in the auth context

### Test Route Protection

1. Try accessing `/admin` as a non-admin user
2. You should be redirected to `/dashboard?error=unauthorized`
3. As an owner/admin, you should be able to access `/admin`

### Test Sidebar Filtering

1. Log in as different roles
2. Verify that sidebar items are filtered based on role
3. Check that unauthorized items don't appear

## Step 5: Set Up Automatic Role Assignment

### Option A: Database Trigger (Recommended)

Create a database function that automatically assigns 'student' role to new users:

```sql
-- This function will be called via Edge Function or webhook
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then set up a webhook in Supabase Dashboard that:
- Triggers on `auth.users` INSERT
- Calls an Edge Function that inserts into `user_roles`

### Option B: Application-Level (Simpler)

Update your signup flow to automatically create a role:

```typescript
// In your signup handler
const { data: { user } } = await supabase.auth.signUp({...})

if (user) {
  // Create default role
  await supabase
    .from('user_roles')
    .insert({ user_id: user.id, role: 'student' })
}
```

## Step 6: Add RLS Policies to Your Tables

For each table in your application, add RLS policies using the helper functions:

### Example: Aircraft Table

```sql
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view aircraft
CREATE POLICY "Authenticated users can view aircraft"
  ON public.aircraft
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only owners, admins, and instructors can create aircraft
CREATE POLICY "Authorized roles can create aircraft"
  ON public.aircraft
  FOR INSERT
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );
```

Repeat this pattern for all your application tables.

## Step 7: Update Sidebar Navigation

The sidebar component (`components/app-sidebar.tsx`) needs to be updated to filter items by role. See the architecture document for the complete implementation.

## Step 8: Create Admin UI for Role Management

Create an admin page where owners/admins can manage user roles:

```typescript
// app/admin/roles/page.tsx
import { RoleGuard } from '@/components/auth/role-guard'
import { USER_ROLES } from '@/lib/types/roles'

export default function RolesPage() {
  return (
    <RoleGuard allowedRoles={[USER_ROLES.OWNER, USER_ROLES.ADMIN]}>
      {/* Role management UI */}
    </RoleGuard>
  )
}
```

## Troubleshooting

### Role Not Appearing in Auth Context

1. Check that `user_roles` table has a record for your user
2. Verify the user_id matches the auth.users.id
3. Check browser console for errors
4. Try calling `refreshUser()` manually

### Middleware Redirecting Incorrectly

1. Check that route permissions are configured correctly
2. Verify the role is being retrieved correctly
3. Check middleware logs for errors

### RLS Policies Not Working

1. Ensure RLS is enabled on the table: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Verify policies are created correctly
3. Test policies using Supabase SQL Editor with `SET request.jwt.claim.sub = 'user_id';`

### JWT Claims Not Updating

1. Verify Edge Function is deployed and accessible
2. Check that service role key is set correctly
3. Manually refresh the session: `await supabase.auth.refreshSession()`
4. Check Edge Function logs for errors

## Next Steps

1. **Add Audit Logging**: Create a table to log all role changes
2. **Add Role Permissions Matrix**: Create a UI to visualize role permissions
3. **Add Bulk Role Management**: Allow admins to update multiple users at once
4. **Add Role History**: Track role changes over time
5. **Add Role-Based Feature Flags**: Use roles to enable/disable features

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] RLS policies tested for each role
- [ ] Middleware role checks working
- [ ] API routes protected with role checks
- [ ] Frontend role checks are for UX only (not security)
- [ ] Service role key never exposed to client
- [ ] Edge Function properly secured
- [ ] Role changes are logged/audited

## Support

For issues or questions:
1. Check the architecture document: `docs/RBAC_ARCHITECTURE.md`
2. Review Supabase RLS documentation
3. Check Next.js middleware documentation
4. Review the code examples in the architecture document
