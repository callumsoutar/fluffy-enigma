-- ============================================================================
-- MIGRATION: Make instructor_categories Global
-- ============================================================================
-- 
-- This migration removes tenant scoping from instructor_categories because
-- in New Zealand all instructor categories (A-Cat, B-Cat, C-Cat, etc.) are
-- standardized and should be available to all tenants.
--
-- CHANGES:
--   1. Drop tenant-specific RLS policies
--   2. Remove tenant_id column and related constraints
--   3. Create new global RLS policies (read-all, admin-only write)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: DROP EXISTING TENANT-SPECIFIC RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "instructor_categories_tenant_select" ON public.instructor_categories;
DROP POLICY IF EXISTS "instructor_categories_tenant_insert" ON public.instructor_categories;
DROP POLICY IF EXISTS "instructor_categories_tenant_update" ON public.instructor_categories;
DROP POLICY IF EXISTS "instructor_categories_tenant_delete" ON public.instructor_categories;

-- ============================================================================
-- PHASE 2: REMOVE TENANT_ID COLUMN AND CONSTRAINTS
-- ============================================================================

-- Drop the index first
DROP INDEX IF EXISTS idx_instructor_categories_tenant_id;

-- Remove the tenant_id column
ALTER TABLE public.instructor_categories DROP COLUMN IF EXISTS tenant_id;

-- ============================================================================
-- PHASE 3: CREATE NEW GLOBAL RLS POLICIES
-- ============================================================================

-- Anyone authenticated can read instructor categories (global data)
CREATE POLICY "instructor_categories_global_select" 
  ON public.instructor_categories
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only users with admin/owner role in ANY tenant can insert
-- This is restrictive - in practice, these should be seeded/managed by system
CREATE POLICY "instructor_categories_global_insert" 
  ON public.instructor_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('owner', 'admin')
    )
  );

-- Only users with admin/owner role in ANY tenant can update
CREATE POLICY "instructor_categories_global_update" 
  ON public.instructor_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('owner', 'admin')
    )
  );

-- Only users with owner role in ANY tenant can delete
-- This is very restrictive since these are reference data
CREATE POLICY "instructor_categories_global_delete" 
  ON public.instructor_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name = 'owner'
    )
  );

-- ============================================================================
-- PHASE 4: ADD COMMENT FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.instructor_categories IS 
  'Global instructor categories (A-Cat, B-Cat, C-Cat) standardized for New Zealand. Not tenant-specific.';

COMMIT;
