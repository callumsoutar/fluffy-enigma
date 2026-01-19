-- Migration: Fix search_path for security-critical database functions
-- This addresses the Supabase security linter warnings about mutable search_path
-- 
-- SECURITY: By setting search_path = '' and using fully qualified names,
-- we prevent potential search_path injection attacks where an attacker could
-- create malicious objects in other schemas that shadow our intended objects.
--
-- All security-critical functions are recreated with:
-- 1. SECURITY DEFINER - Executes with owner's privileges
-- 2. SET search_path = '' - Prevents search_path manipulation
-- 3. Fully qualified table references (public.table_name)
--
-- APPLIED: 2026-01-20 via Supabase MCP
-- Note: Some functions required DROP before CREATE due to parameter name differences

-- ============================================================================
-- CORE TENANT SECURITY FUNCTIONS
-- These are used in RLS policies and must be bulletproof
-- ============================================================================

-- user_belongs_to_tenant: Checks if current user is a member of a specific tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users 
    WHERE user_id = auth.uid() 
      AND tenant_id = p_tenant_id 
      AND is_active = true
  );
$$;

-- tenant_user_has_role: Checks if a specific user has any of the required roles at a tenant
CREATE OR REPLACE FUNCTION public.tenant_user_has_role(
  p_user_id UUID, 
  p_tenant_id UUID, 
  p_required_roles public.user_role[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users tu 
    JOIN public.roles r ON tu.role_id = r.id 
    WHERE tu.user_id = p_user_id 
      AND tu.tenant_id = p_tenant_id 
      AND tu.is_active = true 
      AND r.name = ANY(p_required_roles)
  );
$$;

-- users_share_tenant: Checks if current user shares a tenant with another user
CREATE OR REPLACE FUNCTION public.users_share_tenant(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users tu1
    JOIN public.tenant_users tu2 ON tu1.tenant_id = tu2.tenant_id
    WHERE tu1.user_id = auth.uid()
      AND tu2.user_id = p_user_id
      AND tu1.is_active = true
      AND tu2.is_active = true
  );
$$;

-- current_user_is_staff: Checks if current user has staff-level privileges
CREATE OR REPLACE FUNCTION public.current_user_is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users tu
    JOIN public.roles r ON tu.role_id = r.id
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND r.name IN ('owner', 'admin', 'instructor')
  );
$$;

-- can_manage_user: Checks if current user can manage another user (admin/owner of same tenant)
CREATE OR REPLACE FUNCTION public.can_manage_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users tu1
    JOIN public.tenant_users tu2 ON tu1.tenant_id = tu2.tenant_id
    JOIN public.roles r ON tu1.role_id = r.id
    WHERE tu1.user_id = auth.uid()
      AND tu2.user_id = p_user_id
      AND tu1.is_active = true
      AND tu2.is_active = true
      AND r.name IN ('owner', 'admin')
  );
$$;

-- ============================================================================
-- ROLE CHECKING FUNCTIONS
-- Used for authorization checks
-- ============================================================================

-- check_user_role: Checks if a user has any of the allowed roles
CREATE OR REPLACE FUNCTION public.check_user_role(
  user_id UUID, 
  allowed_roles public.user_role[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_users tu
        JOIN public.roles r ON tu.role_id = r.id
        WHERE tu.user_id = check_user_role.user_id 
        AND r.name = ANY(allowed_roles)
        AND tu.is_active = true
        AND r.is_active = true
    );
END;
$$;

-- check_user_role_simple: Simpler role check that avoids RLS circular dependencies
CREATE OR REPLACE FUNCTION public.check_user_role_simple(
  user_id UUID, 
  allowed_roles public.user_role[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_users tu
    JOIN public.roles r ON tu.role_id = r.id
    WHERE tu.user_id = check_user_role_simple.user_id 
    AND r.name = ANY(allowed_roles)
    AND tu.is_active = true
    AND r.is_active = true
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, return false for security
    RETURN false;
END;
$$;

-- get_user_role: Gets a user's highest priority role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role_name TEXT;
BEGIN
  SELECT r.name INTO user_role_name
  FROM public.tenant_users tu
  JOIN public.roles r ON tu.role_id = r.id
  WHERE tu.user_id = get_user_role.user_id 
  AND tu.is_active = true
  AND r.is_active = true
  ORDER BY 
    CASE r.name 
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2  
      WHEN 'instructor' THEN 3
      WHEN 'member' THEN 4
      WHEN 'student' THEN 5
      ELSE 6
    END
  LIMIT 1;
  
  RETURN user_role_name;
END;
$$;

-- get_tenant_user_role: Gets a user's role at a specific tenant
CREATE OR REPLACE FUNCTION public.get_tenant_user_role(
  p_user_id UUID,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.name 
  FROM public.tenant_users tu 
  JOIN public.roles r ON tu.role_id = r.id 
  WHERE tu.user_id = p_user_id 
    AND tu.tenant_id = COALESCE(p_tenant_id, public.get_user_tenant(p_user_id)) 
    AND tu.is_active = true 
  LIMIT 1;
$$;

-- get_user_tenant: Gets a user's primary tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id 
  FROM public.tenant_users 
  WHERE user_id = p_user_id 
    AND is_active = true 
  ORDER BY created_at 
  LIMIT 1;
$$;

-- is_auth_user: Checks if a UUID corresponds to an authenticated user
CREATE OR REPLACE FUNCTION public.is_auth_user(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = user_uuid);
$$;

-- get_role_id_by_name: Gets a role's ID by its name
CREATE OR REPLACE FUNCTION public.get_role_id_by_name(p_role_name public.user_role)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.roles WHERE name = p_role_name AND is_active = true LIMIT 1;
$$;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- These run in response to data changes
-- ============================================================================

-- update_updated_at_column: Generic trigger to set updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- trigger_set_updated_at: Alternative name for same functionality
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- update_tenant_settings_updated_at: Specific trigger for tenant_settings
CREATE OR REPLACE FUNCTION public.update_tenant_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- update_settings_updated_at: Trigger for settings table
CREATE OR REPLACE FUNCTION public.update_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- update_instructors_updated_at: Trigger for instructors table
CREATE OR REPLACE FUNCTION public.update_instructors_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- update_defects_updated_at: Trigger for defects table
CREATE OR REPLACE FUNCTION public.update_defects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- update_tasks_updated_at: Trigger for tasks table
CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- handle_new_user: Creates user record when auth.users entry is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- AUDIT LOGGING FUNCTIONS
-- ============================================================================

-- log_booking_audit: Records booking changes for audit trail
CREATE OR REPLACE FUNCTION public.log_booking_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    created_at
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    'bookings',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(),
    CURRENT_TIMESTAMP
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- log_booking_audit_improved: Enhanced booking audit with better details
CREATE OR REPLACE FUNCTION public.log_booking_audit_improved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    created_at
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    'bookings',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(),
    CURRENT_TIMESTAMP
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- log_user_audit_improved: User changes audit
CREATE OR REPLACE FUNCTION public.log_user_audit_improved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get tenant from tenant_users
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = COALESCE(NEW.id, OLD.id)
  AND is_active = true
  LIMIT 1;

  INSERT INTO public.audit_logs (
    tenant_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    created_at
  ) VALUES (
    v_tenant_id,
    'users',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(),
    CURRENT_TIMESTAMP
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- log_table_audit: Generic table audit logging
CREATE OR REPLACE FUNCTION public.log_table_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    created_at
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(),
    CURRENT_TIMESTAMP
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- can_see_contact_info: Checks if user can view contact details
CREATE OR REPLACE FUNCTION public.can_see_contact_info(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    p_user_id = auth.uid() OR 
    public.current_user_is_staff();
$$;

-- flatten_settings: Flattens JSONB settings into rows
CREATE OR REPLACE FUNCTION public.flatten_settings(settings JSONB)
RETURNS TABLE(key TEXT, value JSONB)
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT key, value FROM jsonb_each(settings);
$$;

-- calculate_flight_time: Calculates flight duration in hours
CREATE OR REPLACE FUNCTION public.calculate_flight_time(
  start_tach DECIMAL,
  end_tach DECIMAL
)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE 
    WHEN end_tach > start_tach THEN ROUND(end_tach - start_tach, 1)
    ELSE 0
  END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.user_belongs_to_tenant IS 
  'Security function for RLS: Checks if current user belongs to the specified tenant. 
   SET search_path = '''' prevents search_path injection attacks.';

COMMENT ON FUNCTION public.tenant_user_has_role IS 
  'Security function for RLS: Checks if user has any of the required roles at a tenant.
   SET search_path = '''' prevents search_path injection attacks.';

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- These functions need to be callable by authenticated users
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.user_belongs_to_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_user_has_role(UUID, UUID, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_role(UUID, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_role_simple(UUID, public.user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_user_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_auth_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_role_id_by_name(public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_contact_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flatten_settings(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_flight_time(DECIMAL, DECIMAL) TO authenticated;
