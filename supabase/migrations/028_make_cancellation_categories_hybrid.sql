-- ============================================================================
-- MIGRATION: Make cancellation_categories Hybrid (Global + Tenant-Specific)
-- ============================================================================
-- 
-- This migration enables cancellation_categories to support both global (system-wide)
-- categories and tenant-specific custom categories.
--
-- CHANGES:
--   1. Add is_global column to distinguish global vs tenant-specific categories
--   2. Make tenant_id nullable (global categories have NULL tenant_id)
--   3. Update existing categories to be global
--   4. Update RLS policies to support hybrid access
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: ENSURE RLS IS ENABLED AND DROP EXISTING POLICIES
-- ============================================================================

-- Ensure RLS is enabled on the table
ALTER TABLE public.cancellation_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing tenant-specific RLS policies
DROP POLICY IF EXISTS "cancellation_categories_tenant_all" ON public.cancellation_categories;

-- ============================================================================
-- PHASE 2: ADD is_global COLUMN AND MODIFY CONSTRAINTS
-- ============================================================================

-- Add is_global column (defaults to false)
ALTER TABLE public.cancellation_categories 
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- Make tenant_id nullable (global categories will have NULL tenant_id)
ALTER TABLE public.cancellation_categories 
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Remove the default tenant function for new inserts
ALTER TABLE public.cancellation_categories 
  ALTER COLUMN tenant_id DROP DEFAULT;

-- ============================================================================
-- PHASE 3: ADD CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Global categories must have NULL tenant_id
ALTER TABLE public.cancellation_categories
  ADD CONSTRAINT cancellation_categories_global_no_tenant 
  CHECK (
    (is_global = true AND tenant_id IS NULL) OR 
    (is_global = false AND tenant_id IS NOT NULL)
  );

-- ============================================================================
-- PHASE 4: UPDATE EXISTING CATEGORIES TO BE GLOBAL
-- ============================================================================

-- Treat all existing cancellation categories as global/system categories
UPDATE public.cancellation_categories 
SET is_global = true, tenant_id = NULL;

-- ============================================================================
-- PHASE 5: CREATE NEW HYBRID RLS POLICIES
-- ============================================================================

-- SELECT: Users can see global categories AND categories for their tenant
CREATE POLICY "cancellation_categories_hybrid_select" 
  ON public.cancellation_categories
  FOR SELECT
  USING (
    is_global = true
    OR tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid() 
        AND tu.is_active = true
    )
  );

-- INSERT: Users with admin/owner role can create tenant-specific categories
-- Only system/super-admin can create global categories (handled via is_global check)
CREATE POLICY "cancellation_categories_hybrid_insert" 
  ON public.cancellation_categories
  FOR INSERT
  WITH CHECK (
    -- For tenant-specific categories: user must be admin/owner in that tenant
    (is_global = false AND tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('owner', 'admin')
        AND tu.tenant_id = cancellation_categories.tenant_id
    ))
    -- Note: We don't allow global category creation via standard RLS for safety
  );

-- UPDATE: Users can update tenant-specific categories in their tenant
CREATE POLICY "cancellation_categories_hybrid_update" 
  ON public.cancellation_categories
  FOR UPDATE
  USING (
    -- Tenant-specific categories: admin/owner in that tenant
    (is_global = false AND tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('owner', 'admin')
    ))
  );

-- DELETE: Users can delete tenant-specific categories in their tenant
CREATE POLICY "cancellation_categories_hybrid_delete" 
  ON public.cancellation_categories
  FOR DELETE
  USING (
    -- Tenant-specific categories: admin/owner in that tenant
    (is_global = false AND tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('owner', 'admin')
    ))
  );

-- ============================================================================
-- PHASE 6: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.cancellation_categories IS 
  'Cancellation categories (hybrid): Global categories available to all tenants + tenant-specific custom categories. Global categories have is_global=true and tenant_id=NULL.';

COMMENT ON COLUMN public.cancellation_categories.is_global IS 
  'Indicates if this is a global category (available to all tenants) or tenant-specific custom category.';

COMMENT ON COLUMN public.cancellation_categories.tenant_id IS 
  'NULL for global categories, set for tenant-specific custom categories.';

COMMIT;
