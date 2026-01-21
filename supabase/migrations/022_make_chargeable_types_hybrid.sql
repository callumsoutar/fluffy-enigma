-- ============================================================================
-- MIGRATION: Make chargeable_types Hybrid (Global + Tenant-Specific)
-- ============================================================================
-- 
-- This migration enables chargeable_types to support both global (system-wide)
-- types and tenant-specific custom types. This allows all tenants to use
-- standard types (landing_fee, instruction, etc.) while also creating their
-- own custom chargeable types.
--
-- CHANGES:
--   1. Add is_global column to distinguish global vs tenant-specific types
--   2. Make tenant_id nullable (global types have NULL tenant_id)
--   3. Add uniqueness constraint for tenant-specific type codes
--   4. Update RLS policies to support hybrid access
--   5. Seed global default chargeable types
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: ENSURE RLS IS ENABLED AND DROP EXISTING POLICIES
-- ============================================================================

-- Ensure RLS is enabled on the table
ALTER TABLE public.chargeable_types ENABLE ROW LEVEL SECURITY;

-- Drop existing tenant-specific RLS policies (if they exist)
DROP POLICY IF EXISTS "chargeable_types_tenant_select" ON public.chargeable_types;
DROP POLICY IF EXISTS "chargeable_types_tenant_insert" ON public.chargeable_types;
DROP POLICY IF EXISTS "chargeable_types_tenant_update" ON public.chargeable_types;
DROP POLICY IF EXISTS "chargeable_types_tenant_delete" ON public.chargeable_types;

-- ============================================================================
-- PHASE 2: ADD is_global COLUMN AND MODIFY CONSTRAINTS
-- ============================================================================

-- Add is_global column (defaults to false for existing tenant-specific data)
ALTER TABLE public.chargeable_types 
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- Make tenant_id nullable (global types will have NULL tenant_id)
ALTER TABLE public.chargeable_types 
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Remove the default tenant function for new inserts
ALTER TABLE public.chargeable_types 
  ALTER COLUMN tenant_id DROP DEFAULT;

-- ============================================================================
-- PHASE 3: ADD CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Global types must have NULL tenant_id
ALTER TABLE public.chargeable_types
  ADD CONSTRAINT chargeable_types_global_no_tenant 
  CHECK (
    (is_global = true AND tenant_id IS NULL) OR 
    (is_global = false AND tenant_id IS NOT NULL)
  );

-- Code must be unique within tenant (for tenant-specific types) or globally (for global types)
-- We'll handle this with a unique partial index
DROP INDEX IF EXISTS idx_chargeable_types_tenant_id;
CREATE UNIQUE INDEX idx_chargeable_types_code_per_tenant 
  ON public.chargeable_types(tenant_id, code) 
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX idx_chargeable_types_code_global 
  ON public.chargeable_types(code) 
  WHERE is_global = true;

-- ============================================================================
-- PHASE 4: CREATE NEW HYBRID RLS POLICIES
-- ============================================================================

-- SELECT: Users can see global types AND types for their tenant
CREATE POLICY "chargeable_types_hybrid_select" 
  ON public.chargeable_types
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

-- INSERT: Users with admin/owner role can create tenant-specific types
-- Only system/super-admin can create global types (handled via is_global check)
CREATE POLICY "chargeable_types_hybrid_insert" 
  ON public.chargeable_types
  FOR INSERT
  WITH CHECK (
    -- For tenant-specific types: user must be admin/owner in that tenant
    (is_global = false AND tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('owner', 'admin')
        AND tu.tenant_id = chargeable_types.tenant_id
    ))
    OR
    -- For global types: user must be owner in ANY tenant (system admin)
    -- This is restrictive - global types should be seeded/managed carefully
    (is_global = true AND tenant_id IS NULL AND EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name = 'owner'
    ))
  );

-- UPDATE: Users can update tenant-specific types in their tenant, 
-- Only owners can update global types
CREATE POLICY "chargeable_types_hybrid_update" 
  ON public.chargeable_types
  FOR UPDATE
  USING (
    -- Tenant-specific types: admin/owner in that tenant
    (is_global = false AND tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name IN ('owner', 'admin')
    ))
    OR
    -- Global types: owner in any tenant (system admin)
    (is_global = true AND EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name = 'owner'
    ))
  );

-- DELETE: Only owners can delete (very restrictive)
CREATE POLICY "chargeable_types_hybrid_delete" 
  ON public.chargeable_types
  FOR DELETE
  USING (
    -- Tenant-specific types: owner in that tenant
    (is_global = false AND tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name = 'owner'
    ))
    OR
    -- Global types: owner in any tenant (system admin)
    (is_global = true AND EXISTS (
      SELECT 1 
      FROM public.tenant_users tu
      JOIN public.roles r ON tu.role_id = r.id
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
        AND r.is_active = true
        AND r.name = 'owner'
    ))
  );

-- ============================================================================
-- PHASE 5: SEED GLOBAL DEFAULT CHARGEABLE TYPES
-- ============================================================================

-- First, mark any existing types that should be global
-- We'll convert common types to global if they exist
UPDATE public.chargeable_types 
SET is_global = true, tenant_id = NULL
WHERE code IN ('landing_fee', 'instruction', 'aircraft_hire', 'membership_fee', 'fuel_surcharge', 'cancellation_fee', 'admin_fee', 'exam_fee')
  AND tenant_id IS NOT NULL;

-- Insert global chargeable types (only if they don't already exist)
-- We use DO block to check for existence first since we have a partial unique index
DO $$
DECLARE
  v_type_code TEXT;
  v_type_name TEXT;
  v_type_desc TEXT;
  v_type RECORD;
BEGIN
  -- Array of global types to seed
  FOR v_type IN 
    SELECT * FROM (VALUES
      ('landing_fee', 'Landing Fee', 'Fee charged for landing at the aerodrome'),
      ('instruction', 'Flight Instruction', 'Fee for flight instruction/training'),
      ('aircraft_hire', 'Aircraft Hire', 'Fee for aircraft rental/hire'),
      ('membership_fee', 'Membership Fee', 'Club membership fee'),
      ('fuel_surcharge', 'Fuel Surcharge', 'Additional fuel cost surcharge'),
      ('cancellation_fee', 'Cancellation Fee', 'Fee for late booking cancellation'),
      ('admin_fee', 'Administration Fee', 'General administrative fee'),
      ('exam_fee', 'Examination Fee', 'Fee for examinations and tests')
    ) AS t(code, name, description)
  LOOP
    -- Insert only if no global type with this code exists
    INSERT INTO public.chargeable_types (code, name, description, is_global, is_active, created_at, updated_at)
    SELECT v_type.code, v_type.name, v_type.description, true, true, now(), now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.chargeable_types 
      WHERE code = v_type.code AND is_global = true
    );
  END LOOP;
END $$;

-- ============================================================================
-- PHASE 6: ADD COMMENT FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.chargeable_types IS 
  'Chargeable types (hybrid): Global types available to all tenants + tenant-specific custom types. Global types have is_global=true and tenant_id=NULL.';

COMMENT ON COLUMN public.chargeable_types.is_global IS 
  'Indicates if this is a global type (available to all tenants) or tenant-specific custom type.';

COMMENT ON COLUMN public.chargeable_types.tenant_id IS 
  'NULL for global types, set for tenant-specific custom types.';

COMMIT;
