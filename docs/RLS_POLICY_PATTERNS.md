# RLS Policy Patterns Guide

## Overview

This guide documents standard RLS policy patterns for the Aero Safety application. Use these patterns consistently across all tables to ensure security and maintainability.

## Core Principles

1. **RLS is always enabled** on user-accessible tables
2. **Ownership is enforced** using `user_id = auth.uid()`
3. **Role checks use** `user_has_any_role()` function consistently
4. **Policies are explicit** - no overly permissive policies (`USING (true)`)
5. **Test all policies** before deploying to production

---

## Standard Policy Patterns

### Pattern A: Own Data Only

**When to use:** User can only access their own records

**Example tables:** Personal settings, user preferences, own invoices

**Policy structure:**
```sql
-- SELECT: Users can view own data
CREATE POLICY "Users can view own [table_name]"
  ON [table_name] FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can create own data
CREATE POLICY "Users can create own [table_name]"
  ON [table_name] FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update own data
CREATE POLICY "Users can update own [table_name]"
  ON [table_name] FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete own data
CREATE POLICY "Users can delete own [table_name]"
  ON [table_name] FOR DELETE
  USING (user_id = auth.uid());
```

**Complete example:**
```sql
-- Example: User preferences table
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  USING (user_id = auth.uid());
```

---

### Pattern B: Own Data OR Authorized Role

**When to use:** Users can access their own data, AND authorized roles (admin/instructor) can access all data

**Example tables:** Bookings, invoices, flight logs

**Policy structure:**
```sql
-- SELECT: Own data OR authorized role
CREATE POLICY "Users can view own or authorized [table_name]"
  ON [table_name] FOR SELECT
  USING (
    user_id = auth.uid()  -- Own data
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )  -- Authorized roles
  );

-- INSERT: Users can create own, authorized roles can create any
CREATE POLICY "Users can create own or authorized [table_name]"
  ON [table_name] FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  );

-- UPDATE: Own data OR authorized role
CREATE POLICY "Users can update own or authorized [table_name]"
  ON [table_name] FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  );

-- DELETE: Only authorized roles (users can't delete, even own)
CREATE POLICY "Only authorized roles can delete [table_name]"
  ON [table_name] FOR DELETE
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );
```

**Complete example: Bookings table**
```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Users can view own bookings, instructors/admins can view all
CREATE POLICY "Users can view own or authorized bookings"
  ON bookings FOR SELECT
  USING (
    user_id = auth.uid()  -- Own bookings
    OR instructor_id = auth.uid()  -- Bookings where user is instructor
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )  -- Authorized roles can see all
  );

-- Users can create own bookings, instructors can create for students
CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()  -- Creating own booking
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )  -- Instructors can create for students
  );

-- Users can update own bookings, instructors can update assigned bookings
CREATE POLICY "Users can update own or assigned bookings"
  ON bookings FOR UPDATE
  USING (
    user_id = auth.uid()  -- Own bookings
    OR instructor_id = auth.uid()  -- Assigned as instructor
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )  -- Authorized roles
  )
  WITH CHECK (
    user_id = auth.uid()
    OR instructor_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  );

-- Only admins/owners can delete bookings
CREATE POLICY "Only admins can delete bookings"
  ON bookings FOR DELETE
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );
```

---

### Pattern C: Authorized Role Only

**When to use:** Only specific roles can access (no ownership concept)

**Example tables:** System settings, audit logs, global configurations

**Policy structure:**
```sql
-- SELECT: Only authorized roles
CREATE POLICY "Only authorized roles can view [table_name]"
  ON [table_name] FOR SELECT
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );

-- INSERT: Only authorized roles
CREATE POLICY "Only authorized roles can create [table_name]"
  ON [table_name] FOR INSERT
  WITH CHECK (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );

-- UPDATE: Only authorized roles
CREATE POLICY "Only authorized roles can update [table_name]"
  ON [table_name] FOR UPDATE
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  )
  WITH CHECK (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );

-- DELETE: Only authorized roles
CREATE POLICY "Only authorized roles can delete [table_name]"
  ON [table_name] FOR DELETE
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );
```

**Complete example: Audit logs table**
```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can view audit logs
CREATE POLICY "Only admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );

-- System can insert audit logs (via service role or trigger)
-- No INSERT policy needed if using service role for inserts
```

---

### Pattern D: Multiple Ownership Columns

**When to use:** Data can be owned by multiple users (e.g., booking owned by student AND instructor)

**Example tables:** Bookings (user_id + instructor_id), shared documents

**Policy structure:**
```sql
-- SELECT: Own data (any ownership column) OR authorized role
CREATE POLICY "Users can view related or authorized [table_name]"
  ON [table_name] FOR SELECT
  USING (
    user_id = auth.uid()  -- Primary owner
    OR instructor_id = auth.uid()  -- Secondary owner
    OR created_by = auth.uid()  -- Creator
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )  -- Authorized roles
  );
```

**Complete example: Bookings with multiple owners**
```sql
CREATE POLICY "Users can view related bookings"
  ON bookings FOR SELECT
  USING (
    user_id = auth.uid()  -- Student's own bookings
    OR instructor_id = auth.uid()  -- Instructor's assigned bookings
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )  -- Admins/instructors can see all
  );
```

---

## Role Hierarchy in Policies

### Standard Role Arrays

**Owner + Admin only:**
```sql
ARRAY['owner', 'admin']
```
Use for: System settings, user management, audit logs

**Owner + Admin + Instructor:**
```sql
ARRAY['owner', 'admin', 'instructor']
```
Use for: Bookings, flight logs, training records

**All authenticated users:**
```sql
-- No role check needed, just authentication
auth.role() = 'authenticated'
```
Use for: Public data that all users can see (rare)

---

## Policy Naming Conventions

### Standard Naming Pattern

```
[Action] [Scope] [Table Name]

Examples:
- "Users can view own bookings"
- "Only admins can delete audit logs"
- "Users can update own or authorized invoices"
```

### Action Words
- `view` / `select` - For SELECT policies
- `create` / `insert` - For INSERT policies
- `update` - For UPDATE policies
- `delete` - For DELETE policies

### Scope Words
- `own` - User's own data
- `authorized` - Authorized roles can access
- `Only [role]` - Specific role only

---

## Common Patterns by Table Type

### User-Owned Data Tables

**Pattern:** Pattern A (Own Data Only) or Pattern B (Own + Authorized)

**Examples:**
- `invoices` - Users see own invoices, instructors see student invoices
- `bookings` - Users see own bookings, instructors see assigned bookings
- `flight_logs` - Users see own logs, instructors see student logs

**Template:**
```sql
-- Enable RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- SELECT: Own data OR authorized role
CREATE POLICY "Users can view own or authorized [table_name]"
  ON [table_name] FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  );

-- INSERT: Users can create own
CREATE POLICY "Users can create own [table_name]"
  ON [table_name] FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Own data OR authorized role
CREATE POLICY "Users can update own or authorized [table_name]"
  ON [table_name] FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
  );

-- DELETE: Only admins (users typically can't delete)
CREATE POLICY "Only admins can delete [table_name]"
  ON [table_name] FOR DELETE
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );
```

### System/Configuration Tables

**Pattern:** Pattern C (Authorized Role Only)

**Examples:**
- `settings` - Only admins
- `audit_logs` - Only admins
- `roles` - Only admins

**Template:**
```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage [table_name]"
  ON [table_name] FOR ALL
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  )
  WITH CHECK (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );
```

### Reference/Lookup Tables

**Pattern:** Read-only for authenticated users, write for admins

**Examples:**
- `aircraft_types` - All can read, only admins can write
- `flight_types` - All can read, only admins can write

**Template:**
```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can view [table_name]"
  ON [table_name] FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can write
CREATE POLICY "Only admins can manage [table_name]"
  ON [table_name] FOR ALL
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  )
  WITH CHECK (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );
```

---

## Policy Best Practices

### ✅ DO

1. **Always enable RLS** on user-accessible tables
2. **Use explicit ownership checks** (`user_id = auth.uid()`)
3. **Use `user_has_any_role()` function** for role checks
4. **Include both USING and WITH CHECK** for UPDATE policies
5. **Test policies** with different user roles
6. **Name policies clearly** following naming convention
7. **Document complex policies** with comments

### ❌ DON'T

1. **Don't use `USING (true)`** - overly permissive
2. **Don't skip ownership checks** when data is user-owned
3. **Don't use different role checking patterns** - standardize on `user_has_any_role()`
4. **Don't forget WITH CHECK** for UPDATE/INSERT policies
5. **Don't disable RLS** on sensitive tables
6. **Don't use service role key** in client code

---

## Policy Examples by Operation

### SELECT Policies

**Own data only:**
```sql
USING (user_id = auth.uid())
```

**Own data OR authorized role:**
```sql
USING (
  user_id = auth.uid()
  OR public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin', 'instructor']
  )
)
```

**Authorized role only:**
```sql
USING (
  public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin']
  )
)
```

### INSERT Policies

**Users can create own:**
```sql
WITH CHECK (user_id = auth.uid())
```

**Users can create own OR authorized roles can create any:**
```sql
WITH CHECK (
  user_id = auth.uid()
  OR public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin', 'instructor']
  )
)
```

### UPDATE Policies

**Always include both USING and WITH CHECK:**
```sql
USING (
  user_id = auth.uid()
  OR public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin', 'instructor']
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin', 'instructor']
  )
)
```

**Why both?**
- `USING`: Controls which rows can be updated
- `WITH CHECK`: Controls what values can be set

### DELETE Policies

**Only authorized roles:**
```sql
USING (
  public.user_has_any_role(
    auth.uid(),
    ARRAY['owner', 'admin']
  )
)
```

---

## Complex Scenarios

### Scenario 1: Soft Deletes

**When table has `deleted_at` or `voided_at` column:**

```sql
-- SELECT: Exclude soft-deleted rows
CREATE POLICY "Users can view active [table_name]"
  ON [table_name] FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR public.user_has_any_role(
        auth.uid(),
        ARRAY['owner', 'admin', 'instructor']
      )
    )
  );
```

### Scenario 2: Draft vs Published

**When table has `status` column:**

```sql
-- SELECT: Own drafts OR published items OR authorized roles
CREATE POLICY "Users can view [table_name]"
  ON [table_name] FOR SELECT
  USING (
    (user_id = auth.uid() AND status = 'draft')  -- Own drafts
    OR status = 'published'  -- Published items
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )  -- Authorized roles see all
  );
```

### Scenario 3: Time-Based Access

**When access depends on time:**

```sql
-- SELECT: Own data OR authorized role OR within time window
CREATE POLICY "Users can view [table_name]"
  ON [table_name] FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['owner', 'admin', 'instructor']
    )
    OR (created_at > NOW() - INTERVAL '30 days')  -- Recent items visible
  );
```

---

## Policy Testing Checklist

Before deploying a new RLS policy, test:

- [ ] Regular user can access own data
- [ ] Regular user cannot access other users' data
- [ ] Admin can access all data
- [ ] Instructor can access assigned data
- [ ] Unauthenticated user cannot access data
- [ ] Policy works with INSERT operations
- [ ] Policy works with UPDATE operations
- [ ] Policy works with DELETE operations
- [ ] Policy handles edge cases (NULL values, soft deletes, etc.)

---

## Migration Strategy

### Adding RLS to Existing Table

1. **Enable RLS:**
   ```sql
   ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
   ```

2. **Create policies incrementally:**
   - Start with SELECT (read-only)
   - Test thoroughly
   - Add INSERT
   - Test thoroughly
   - Add UPDATE
   - Test thoroughly
   - Add DELETE
   - Test thoroughly

3. **Verify no data is hidden incorrectly:**
   ```sql
   -- As admin, verify all data is accessible
   SET request.jwt.claim.sub = 'admin-uuid';
   SELECT COUNT(*) FROM [table_name];
   ```

---

## Related Documentation

- [RLS Flow Documentation](./RLS_FLOW_DOCUMENTATION.md)
- [RLS Testing Guide](./RLS_TESTING_GUIDE.md)
- [RBAC Architecture](./RBAC_ARCHITECTURE.md)
