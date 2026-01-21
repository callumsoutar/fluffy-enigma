-- ============================================================================
-- MIGRATION: Make endorsements and licenses tables global
-- ============================================================================
--
-- ISSUE: endorsements and licenses tables have tenant_id columns from the
-- old single-tenant design. These should be global reference data that all
-- tenants can access, similar to instructor_categories.
--
-- SOLUTION: 
-- 1. Drop tenant_id columns from endorsements and licenses tables
-- 2. Drop related foreign keys, indexes, and default values
-- 3. Update RLS policies to allow global access with role-based authorization
-- 4. Keep users_endorsements tenant-scoped (it's user-specific data)
--
-- NOTE: This migration will make endorsements and licenses accessible to
-- all tenants, but still requires proper role-based authorization (admin/owner
-- for management, instructor/admin/owner for viewing).
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP RLS POLICIES
-- ============================================================================

-- Drop existing tenant-scoped policies
DROP POLICY IF EXISTS endorsements_tenant_select ON public.endorsements;
DROP POLICY IF EXISTS endorsements_tenant_manage ON public.endorsements;
DROP POLICY IF EXISTS licenses_tenant_select ON public.licenses;
DROP POLICY IF EXISTS licenses_tenant_manage ON public.licenses;

-- ============================================================================
-- STEP 2: DROP INDEXES ON tenant_id
-- ============================================================================

DROP INDEX IF EXISTS idx_endorsements_tenant_id;
DROP INDEX IF EXISTS idx_licenses_tenant_id;

-- ============================================================================
-- STEP 3: DROP FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE public.endorsements DROP CONSTRAINT IF EXISTS endorsements_tenant_id_fkey;
ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_tenant_id_fkey;

-- ============================================================================
-- STEP 4: DROP tenant_id COLUMNS
-- ============================================================================

ALTER TABLE public.endorsements DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.licenses DROP COLUMN IF EXISTS tenant_id;

-- ============================================================================
-- STEP 5: CREATE NEW GLOBAL RLS POLICIES
-- ============================================================================

-- Endorsements: Global read access for instructors/admins/owners
-- Global write access for admins/owners only
CREATE POLICY "endorsements_global_select" ON public.endorsements
  FOR SELECT
  USING (
    -- Check if user has instructor/admin/owner role at any tenant
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('instructor', 'admin', 'owner')
    )
  );

CREATE POLICY "endorsements_global_manage" ON public.endorsements
  FOR ALL
  USING (
    -- Check if user has admin/owner role at any tenant
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    -- Check if user has admin/owner role at any tenant
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('admin', 'owner')
    )
  );

-- Licenses: Global read access for instructors/admins/owners
-- Global write access for admins/owners only
CREATE POLICY "licenses_global_select" ON public.licenses
  FOR SELECT
  USING (
    -- Check if user has instructor/admin/owner role at any tenant
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('instructor', 'admin', 'owner')
    )
  );

CREATE POLICY "licenses_global_manage" ON public.licenses
  FOR ALL
  USING (
    -- Check if user has admin/owner role at any tenant
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    -- Check if user has admin/owner role at any tenant
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('admin', 'owner')
    )
  );

COMMENT ON POLICY endorsements_global_select ON public.endorsements IS 
  'Allows global read access to endorsements for users with instructor/admin/owner role at any tenant';

COMMENT ON POLICY endorsements_global_manage ON public.endorsements IS 
  'Allows global write access to endorsements for users with admin/owner role at any tenant';

COMMENT ON POLICY licenses_global_select ON public.licenses IS 
  'Allows global read access to licenses for users with instructor/admin/owner role at any tenant';

COMMENT ON POLICY licenses_global_manage ON public.licenses IS 
  'Allows global write access to licenses for users with admin/owner role at any tenant';

COMMIT;
