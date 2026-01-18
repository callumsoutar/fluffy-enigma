-- ============================================================================
-- MIGRATION: Add Multi-Tenant Signup Support
-- ============================================================================
-- 
-- This migration adds:
-- 1. The roles table (if it doesn't exist) - referenced by tenant_users
-- 2. A stored procedure for atomic tenant signup
-- 3. Trigger to handle new user setup
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: CREATE ROLES TABLE (if not exists)
-- ============================================================================
-- The tenant_users table references roles(id), so we need this table

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name user_role NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default roles if they don't exist
INSERT INTO public.roles (name, description) VALUES
  ('owner', 'Organization owner with full access'),
  ('admin', 'Administrator with management access'),
  ('instructor', 'Flight instructor'),
  ('member', 'Regular club member'),
  ('student', 'Student pilot')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on roles table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Everyone can read roles (needed for role assignment)
DROP POLICY IF EXISTS "roles_select" ON public.roles;
CREATE POLICY "roles_select" ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- PHASE 2: CREATE HELPER FUNCTION TO GET ROLE ID
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_role_id(p_role_name user_role)
RETURNS UUID AS $$
  SELECT id FROM public.roles WHERE name = p_role_name AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_role_id IS 'Returns the UUID for a given role name';

-- ============================================================================
-- PHASE 3: CREATE STORED PROCEDURE FOR TENANT SIGNUP
-- ============================================================================
-- This procedure creates a tenant and sets up the owner in one atomic operation

CREATE OR REPLACE FUNCTION public.setup_tenant_owner(
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS void AS $$
DECLARE
  v_owner_role_id UUID;
BEGIN
  -- Get the owner role ID
  SELECT id INTO v_owner_role_id
  FROM public.roles
  WHERE name = 'owner' AND is_active = true;
  
  IF v_owner_role_id IS NULL THEN
    RAISE EXCEPTION 'Owner role not found in roles table';
  END IF;
  
  -- Create the tenant_users record
  INSERT INTO public.tenant_users (
    tenant_id,
    user_id,
    role_id,
    is_active,
    granted_at
  ) VALUES (
    p_tenant_id,
    p_user_id,
    v_owner_role_id,
    true,
    now()
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role_id = v_owner_role_id,
    is_active = true,
    updated_at = now();
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.setup_tenant_owner IS 'Sets up a user as the owner of a tenant';

-- ============================================================================
-- PHASE 4: CREATE TRIGGER FOR NEW USER TENANT SETUP
-- ============================================================================
-- When a new user is created via auth, check if they have tenant_id in metadata
-- and automatically set up their tenant membership

CREATE OR REPLACE FUNCTION public.handle_new_user_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_is_owner BOOLEAN;
  v_owner_role_id UUID;
  v_member_role_id UUID;
BEGIN
  -- Check if user has tenant_id in metadata
  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  v_is_owner := COALESCE((NEW.raw_user_meta_data->>'is_tenant_owner')::BOOLEAN, false);
  
  IF v_tenant_id IS NOT NULL THEN
    -- Get the appropriate role ID
    IF v_is_owner THEN
      SELECT id INTO v_owner_role_id FROM public.roles WHERE name = 'owner' AND is_active = true;
      
      -- Create tenant_users record with owner role
      INSERT INTO public.tenant_users (tenant_id, user_id, role_id, is_active, granted_at)
      VALUES (v_tenant_id, NEW.id, v_owner_role_id, true, now())
      ON CONFLICT (tenant_id, user_id) DO NOTHING;
    ELSE
      SELECT id INTO v_member_role_id FROM public.roles WHERE name = 'member' AND is_active = true;
      
      -- Create tenant_users record with member role
      INSERT INTO public.tenant_users (tenant_id, user_id, role_id, is_active, granted_at)
      VALUES (v_tenant_id, NEW.id, v_member_role_id, true, now())
      ON CONFLICT (tenant_id, user_id) DO NOTHING;
    END IF;
    
    -- Also create user record in users table if it doesn't exist
    -- Note: tenant_id is NOT on users table - relationship is via tenant_users
    INSERT INTO public.users (
      id,
      email,
      first_name,
      last_name,
      is_active
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.users.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.users.last_name),
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger on auth.users needs to be created via Supabase Dashboard
-- or through a privileged migration. Here's the command for reference:
-- 
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user_tenant();

-- ============================================================================
-- PHASE 5: UPDATE TENANT RLS FOR SELF-INSERTION
-- ============================================================================
-- Allow authenticated users to create their own tenant during signup

DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
CREATE POLICY "tenants_insert_self" ON public.tenants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Will be handled by API route validation

-- Also need to allow the initial tenant_users insert
DROP POLICY IF EXISTS "tenant_users_insert_self" ON public.tenant_users;
CREATE POLICY "tenant_users_insert_self" ON public.tenant_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PHASE 6: CREATE INDEX FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON public.roles(name) WHERE is_active = true;

COMMIT;

-- ============================================================================
-- MANUAL STEP REQUIRED
-- ============================================================================
-- 
-- After running this migration, you need to create a trigger on auth.users
-- through the Supabase Dashboard or via a privileged SQL editor:
--
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Run the following:
--
--    CREATE TRIGGER on_auth_user_created
--      AFTER INSERT ON auth.users
--      FOR EACH ROW
--      EXECUTE FUNCTION public.handle_new_user_tenant();
--
-- This trigger will automatically set up tenant membership when new users
-- are created with tenant_id in their metadata.
-- ============================================================================
