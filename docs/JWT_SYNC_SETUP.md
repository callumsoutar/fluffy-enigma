# JWT Role Sync Setup Guide

## Overview

The JWT role sync system automatically updates the `user_metadata.role` field in JWT tokens when a user's role changes in the database. This enables fast role lookups without database queries.

## Components

### 1. Edge Function: `sync-role-to-jwt`
- **Location**: `supabase/functions/sync-role-to-jwt/index.ts`
- **Status**: ✅ Deployed
- **Purpose**: Updates `user_metadata.role` in Supabase Auth when called

### 2. Database Trigger: `on_user_role_updated`
- **Location**: Database trigger on `user_roles` table
- **Status**: ✅ Created
- **Purpose**: Automatically calls Edge Function when role changes

### 3. Database Function: `sync_role_to_jwt()`
- **Location**: PostgreSQL function
- **Status**: ✅ Created
- **Purpose**: Makes HTTP request to Edge Function

## How It Works

```
1. User role changes in database (INSERT/UPDATE on user_roles table)
   ↓
2. Trigger fires: on_user_role_updated
   ↓
3. Function executes: sync_role_to_jwt()
   - Gets role name from roles table
   - Calls Edge Function via HTTP
   ↓
4. Edge Function: sync-role-to-jwt
   - Updates user_metadata.role in auth.users
   ↓
5. Next JWT token refresh includes updated role
   ↓
6. Application reads role from JWT (fast, no database query)
```

## Configuration Required

### Step 1: Set Service Role Key in Database

The trigger function needs the service role key to authenticate with the Edge Function.

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to Supabase Dashboard → Your Project → Settings → Database
2. Find "Custom Config" or "Database Settings"
3. Add custom setting:
   - Key: `app.settings.service_role_key`
   - Value: Your service role key (from Settings → API → service_role key)

**Option B: Using SQL (Alternative)**

```sql
-- Set the service role key (replace with your actual key)
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';
```

**Option C: Using Environment Variable**

If using Supabase CLI or local development, set:
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Step 2: Set Supabase URL (Optional)

If your Supabase URL is different from the default, set it:

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
```

## Testing

### Test 1: Manual Role Update

```sql
-- Update a user's role
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'admin')
WHERE user_id = 'user-uuid-here';

-- Check if Edge Function was called
-- Look in Supabase Dashboard → Edge Functions → sync-role-to-jwt → Logs
```

### Test 2: Verify JWT Contains Role

```typescript
// In your application
const { data: { user } } = await supabase.auth.getUser()
console.log(user?.user_metadata?.role) // Should show the role
```

### Test 3: Check Trigger Works

```sql
-- Insert a new user role
INSERT INTO user_roles (user_id, role_id, is_active)
VALUES (
  'user-uuid-here',
  (SELECT id FROM roles WHERE name = 'instructor'),
  true
);

-- Check Edge Function logs for the call
```

## Troubleshooting

### Issue: JWT not updating with role

**Possible causes:**
1. Service role key not configured
2. Edge Function not deployed
3. Trigger not firing
4. User needs to refresh token

**Solutions:**
1. Check service role key is set: `SHOW app.settings.service_role_key;`
2. Verify Edge Function is deployed: Check Supabase Dashboard
3. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_user_role_updated';`
4. Force token refresh: `await supabase.auth.refreshSession()`

### Issue: Edge Function returns 401

**Cause:** Service role key is incorrect or missing

**Solution:** 
1. Verify service role key in database settings
2. Check Edge Function logs for authentication errors
3. Ensure key is set correctly (no extra spaces, correct format)

### Issue: Trigger not firing

**Possible causes:**
1. Trigger not created
2. `is_active` condition not met
3. Transaction rolled back

**Solutions:**
1. Check trigger exists: `\d user_roles` (in psql)
2. Ensure `is_active = true` when updating role
3. Check for errors in PostgreSQL logs

### Issue: pg_net extension not available

**Solution:** The migration should create it automatically. If not:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

If pg_net is not available, you may need to:
1. Use Supabase's webhook feature instead
2. Or use a different HTTP extension
3. Or call Edge Function from application code instead of trigger

## Manual Sync (Fallback)

If the automatic trigger doesn't work, you can manually sync roles:

```typescript
// In your application code
async function syncUserRoleToJWT(userId: string) {
  // Get role from database
  const { data: role } = await supabase
    .rpc('get_user_role', { user_id: userId });
  
  // Call Edge Function
  const { error } = await supabase.functions.invoke('sync-role-to-jwt', {
    body: { userId, role }
  });
  
  if (error) {
    console.error('Failed to sync role to JWT:', error);
  }
}
```

## Security Considerations

1. **Service Role Key**: Never expose this in client code. Only use in:
   - Database functions (SECURITY DEFINER)
   - Server-side code
   - Edge Functions

2. **Edge Function**: Protected by Supabase's built-in authentication. Only callable with:
   - Service role key
   - Authenticated requests (if you add auth checks)

3. **Trigger Function**: Uses SECURITY DEFINER to bypass RLS when making HTTP calls. This is safe because:
   - Function only makes HTTP calls
   - Doesn't modify data
   - Only called by trigger (not directly by users)

## Next Steps

1. ✅ Edge Function deployed
2. ✅ Database trigger created
3. ⚠️ **Configure service role key** (required)
4. Test role changes
5. Verify JWT contains role
6. Monitor Edge Function logs

## Related Documentation

- [RLS Flow Documentation](./RLS_FLOW_DOCUMENTATION.md)
- [RBAC Architecture](./RBAC_ARCHITECTURE.md)
- [Current State & Next Steps](./CURRENT_STATE_AND_NEXT_STEPS.md)
