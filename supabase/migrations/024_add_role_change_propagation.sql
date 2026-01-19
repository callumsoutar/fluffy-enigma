-- Migration: Add role change propagation mechanism
--
-- SECURITY: When a user's role changes in tenant_users, we need to ensure
-- their JWT claims are updated. This migration adds a mechanism to track
-- role changes that the application can use to force session refresh.
--
-- Strategy:
-- 1. Add a role_changed_at column to track when roles were last modified
-- 2. Create a function to check if a user's role has changed since token was issued
-- 3. The application can use this to force re-authentication when needed
--
-- APPLIED: 2026-01-20 via Supabase MCP

-- ============================================================================
-- ROLE CHANGE TRACKING
-- ============================================================================

-- Add role_changed_at column to tenant_users if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_users' 
    AND column_name = 'role_changed_at'
  ) THEN
    ALTER TABLE public.tenant_users 
    ADD COLUMN role_changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    
    COMMENT ON COLUMN public.tenant_users.role_changed_at IS 
      'Timestamp of last role change. Used for session invalidation on role changes.';
  END IF;
END;
$$;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tenant_users_role_changed_at 
ON public.tenant_users(user_id, role_changed_at);

-- ============================================================================
-- TRIGGER TO UPDATE role_changed_at ON ROLE CHANGES
-- ============================================================================

-- Function to update role_changed_at when role_id or is_active changes
CREATE OR REPLACE FUNCTION public.track_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only update if role_id or is_active actually changed
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.role_id IS DISTINCT FROM NEW.role_id) OR 
       (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
      NEW.role_changed_at = CURRENT_TIMESTAMP;
    END IF;
  ELSIF (TG_OP = 'INSERT') THEN
    NEW.role_changed_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger (drop first if exists to ensure clean state)
DROP TRIGGER IF EXISTS trigger_track_role_changes ON public.tenant_users;
CREATE TRIGGER trigger_track_role_changes
  BEFORE INSERT OR UPDATE ON public.tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION public.track_role_changes();

-- ============================================================================
-- FUNCTION TO CHECK IF SESSION NEEDS REFRESH
-- ============================================================================

-- Check if user's role has changed since a given timestamp
-- This can be called by the application to determine if session should be refreshed
CREATE OR REPLACE FUNCTION public.needs_session_refresh(
  p_user_id UUID,
  p_token_issued_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users
    WHERE user_id = p_user_id
      AND is_active = true
      AND role_changed_at > p_token_issued_at
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.needs_session_refresh(UUID, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- FUNCTION TO GET USER'S CURRENT ROLE STATE
-- ============================================================================

-- Returns current role info that can be compared with JWT claims
CREATE OR REPLACE FUNCTION public.get_current_role_state(p_user_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  role_name public.user_role,
  role_changed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    tu.tenant_id,
    r.name::public.user_role,
    tu.role_changed_at
  FROM public.tenant_users tu
  JOIN public.roles r ON tu.role_id = r.id
  WHERE tu.user_id = p_user_id
    AND tu.is_active = true
  ORDER BY tu.created_at
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_role_state(UUID) TO authenticated;

-- ============================================================================
-- OPTIONAL: REALTIME NOTIFICATION ON ROLE CHANGES
-- ============================================================================

-- Create a channel that the app can subscribe to for role change notifications
-- This allows real-time UI updates when an admin changes someone's role

-- Function to notify on role changes (for Supabase Realtime)
CREATE OR REPLACE FUNCTION public.notify_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only notify if role or active status actually changed
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.role_id IS DISTINCT FROM NEW.role_id) OR 
       (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
      -- Broadcast to a channel the user can subscribe to
      PERFORM pg_notify(
        'role_changes',
        json_build_object(
          'user_id', NEW.user_id,
          'tenant_id', NEW.tenant_id,
          'is_active', NEW.is_active,
          'changed_at', CURRENT_TIMESTAMP
        )::text
      );
    END IF;
  ELSIF (TG_OP = 'INSERT') THEN
    PERFORM pg_notify(
      'role_changes',
      json_build_object(
        'user_id', NEW.user_id,
        'tenant_id', NEW.tenant_id,
        'is_active', NEW.is_active,
        'changed_at', CURRENT_TIMESTAMP
      )::text
    );
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM pg_notify(
      'role_changes',
      json_build_object(
        'user_id', OLD.user_id,
        'tenant_id', OLD.tenant_id,
        'is_active', false,
        'changed_at', CURRENT_TIMESTAMP
      )::text
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the notification trigger
DROP TRIGGER IF EXISTS trigger_notify_role_change ON public.tenant_users;
CREATE TRIGGER trigger_notify_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_role_change();

-- Add comment explaining usage
COMMENT ON FUNCTION public.needs_session_refresh IS 
  'Checks if a user''s role has changed since their JWT was issued.
   Application should call this periodically and force re-authentication if true.
   
   Example usage in application:
   SELECT needs_session_refresh(auth.uid(), ''2024-01-20T10:00:00Z''::timestamptz);';

COMMENT ON FUNCTION public.get_current_role_state IS
  'Returns the user''s current role state from the database.
   Can be compared with JWT claims to detect role drift.';
