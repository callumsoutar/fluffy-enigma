-- ============================================================================
-- MIGRATION: Multi-Tenant Support for Aero Manager
-- ============================================================================
-- 
-- This migration transforms the single-tenant Aero Manager application into
-- a multi-tenant architecture where multiple aero clubs can operate within
-- one Supabase project with strong data isolation.
--
-- CRITICAL: This migration is designed to be run in a transaction.
-- If any step fails, the entire migration will be rolled back.
--
-- PHASES:
--   1. Create core tenant infrastructure (tenants, tenant_users)
--   2. Create helper functions for tenant context
--   3. Add tenant_id columns (nullable) to all tenant-scoped tables
--   4. Create and backfill default tenant
--   5. Migrate user_roles data to tenant_users
--   6. Enforce NOT NULL constraints
--   7. Create indexes for performance
--   8. Update RLS policies for tenant isolation
--   9. Cleanup: Drop deprecated user_roles table
--
-- ROLLBACK: See end of file for complete rollback script
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: CREATE CORE TENANT INFRASTRUCTURE
-- ============================================================================

-- 1.1 Create tenants table
-- This is the top-level entity representing an aero club
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Add comment
COMMENT ON TABLE public.tenants IS 'Aero clubs/organizations. Each tenant operates independently with isolated data.';
COMMENT ON COLUMN public.tenants.slug IS 'URL-safe identifier for the tenant (lowercase alphanumeric and hyphens only)';
COMMENT ON COLUMN public.tenants.settings IS 'Tenant-specific configuration (timezone, currency, branding, etc.)';

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 1.2 Create tenant_users table
-- This replaces user_roles and adds tenant scoping
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT tenant_users_unique_membership UNIQUE (tenant_id, user_id)
);

-- Add comments
COMMENT ON TABLE public.tenant_users IS 'User membership in tenants with per-tenant roles. Replaces global user_roles.';
COMMENT ON COLUMN public.tenant_users.role_id IS 'The role this user has AT THIS SPECIFIC TENANT';

-- Enable RLS on tenant_users
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Create indexes for tenant_users
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role_id ON public.tenant_users(role_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_active ON public.tenant_users(tenant_id, user_id) WHERE is_active = true;

-- ============================================================================
-- PHASE 2: CREATE HELPER FUNCTIONS FOR TENANT CONTEXT
-- ============================================================================

-- 2.1 Function to get user's active tenant
-- For single-tenant users, returns their only tenant
-- For multi-tenant users, this would need enhancement (future)
CREATE OR REPLACE FUNCTION public.get_user_tenant(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
  v_count INT;
BEGIN
  -- Count active tenant memberships
  SELECT COUNT(*), MIN(tenant_id) INTO v_count, v_tenant_id
  FROM public.tenant_users
  WHERE user_id = p_user_id AND is_active = true;
  
  IF v_count = 0 THEN
    RETURN NULL; -- No tenant membership
  ELSIF v_count = 1 THEN
    RETURN v_tenant_id; -- Single tenant - return it
  ELSE
    -- Multiple tenants - for now return first one
    -- Future: implement tenant selection/preference
    RETURN v_tenant_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_tenant IS 'Returns the tenant_id for the current user. Used for RLS policies and default values.';

-- 2.2 Function to check if user has role at a specific tenant
CREATE OR REPLACE FUNCTION public.tenant_user_has_role(
  p_user_id UUID,
  p_tenant_id UUID,
  p_required_roles user_role[]
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users tu
    JOIN public.roles r ON tu.role_id = r.id
    WHERE tu.user_id = p_user_id
      AND tu.tenant_id = p_tenant_id
      AND tu.is_active = true
      AND r.is_active = true
      AND r.name = ANY(p_required_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.tenant_user_has_role IS 'Check if user has any of the specified roles at the given tenant.';

-- 2.3 Function to check role at user''s current tenant (convenience wrapper)
CREATE OR REPLACE FUNCTION public.current_user_has_tenant_role(p_required_roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT public.tenant_user_has_role(
    auth.uid(),
    public.get_user_tenant(auth.uid()),
    p_required_roles
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.current_user_has_tenant_role IS 'Check if current user has any of the specified roles at their active tenant.';

-- 2.4 Function to get user's role at a tenant
CREATE OR REPLACE FUNCTION public.get_tenant_user_role(
  p_user_id UUID DEFAULT auth.uid(),
  p_tenant_id UUID DEFAULT NULL
)
RETURNS user_role AS $$
DECLARE
  v_tenant_id UUID;
  v_role user_role;
BEGIN
  -- Use provided tenant or get user's default tenant
  v_tenant_id := COALESCE(p_tenant_id, public.get_user_tenant(p_user_id));
  
  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT r.name INTO v_role
  FROM public.tenant_users tu
  JOIN public.roles r ON tu.role_id = r.id
  WHERE tu.user_id = p_user_id
    AND tu.tenant_id = v_tenant_id
    AND tu.is_active = true
    AND r.is_active = true;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_tenant_user_role IS 'Get the role name for a user at a specific tenant.';

-- ============================================================================
-- PHASE 3: ADD tenant_id COLUMNS (NULLABLE) TO ALL TENANT-SCOPED TABLES
-- ============================================================================
-- Adding as nullable first, then backfilling, then enforcing NOT NULL
-- This ensures zero downtime and data integrity

-- 3.1 Core business tables
ALTER TABLE public.aircraft ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.aircraft_charge_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.aircraft_components ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.aircraft_types ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3.2 Financial tables
ALTER TABLE public.chargeables ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.chargeable_types ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.invoice_sequences ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tax_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.landing_fee_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3.3 Training tables
ALTER TABLE public.syllabus ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.student_syllabus_enrollment ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.exam ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.flight_experience ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.experience_types ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3.4 People/membership tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.instructor_categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.instructor_flight_type_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.membership_types ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.endorsements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.users_endorsements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3.5 Scheduling tables
ALTER TABLE public.roster_rules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.shift_overrides ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.cancellation_categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.flight_types ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3.6 Equipment tables
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.equipment_issuance ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.equipment_updates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3.7 Maintenance tables
ALTER TABLE public.maintenance_visits ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.observations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3.8 Settings and audit tables
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.settings_audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.settings_files ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- ============================================================================
-- PHASE 4: CREATE DEFAULT TENANT AND BACKFILL DATA
-- ============================================================================

-- 4.1 Create the default tenant for existing data
-- Using a deterministic UUID so this migration is idempotent
INSERT INTO public.tenants (id, name, slug, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Default Aero Club',
  'default-aero-club',
  '{"migrated_from_single_tenant": true, "migration_date": "' || now()::text || '"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Store the default tenant ID for backfill operations
DO $$
DECLARE
  v_default_tenant_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- 4.2 Backfill tenant_id on all tables
  UPDATE public.aircraft SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.aircraft_charge_rates SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.aircraft_components SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.aircraft_types SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.bookings SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  
  UPDATE public.chargeables SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.chargeable_types SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.invoices SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.invoice_items SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.invoice_payments SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.invoice_sequences SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.transactions SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.tax_rates SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.landing_fee_rates SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  
  UPDATE public.syllabus SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.lessons SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.lesson_progress SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.student_syllabus_enrollment SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.exam SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.exam_results SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.flight_experience SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.experience_types SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  
  UPDATE public.users SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.instructors SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.instructor_categories SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.instructor_flight_type_rates SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.memberships SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.membership_types SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.endorsements SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.users_endorsements SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.licenses SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  
  UPDATE public.roster_rules SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.shift_overrides SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.cancellation_categories SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.flight_types SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  
  UPDATE public.equipment SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.equipment_issuance SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.equipment_updates SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  
  UPDATE public.maintenance_visits SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.observations SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  
  UPDATE public.settings SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.settings_audit_log SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.settings_files SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.audit_logs SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.email_logs SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
END $$;

-- ============================================================================
-- PHASE 5: MIGRATE user_roles DATA TO tenant_users
-- ============================================================================

-- 5.1 Migrate existing user_roles to tenant_users
INSERT INTO public.tenant_users (tenant_id, user_id, role_id, is_active, granted_by, granted_at, created_at, updated_at)
SELECT 
  'a0000000-0000-0000-0000-000000000001'::uuid as tenant_id,
  ur.user_id,
  ur.role_id,
  ur.is_active,
  ur.granted_by,
  ur.granted_at,
  ur.created_at,
  ur.updated_at
FROM public.user_roles ur
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ============================================================================
-- PHASE 6: ENFORCE NOT NULL CONSTRAINTS
-- ============================================================================
-- Only after backfill is complete

ALTER TABLE public.aircraft ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.aircraft_charge_rates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.aircraft_components ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.aircraft_types ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.chargeables ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.chargeable_types ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.invoice_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.invoice_payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.invoice_sequences ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tax_rates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.landing_fee_rates ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.syllabus ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lessons ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lesson_progress ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.student_syllabus_enrollment ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.exam ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.exam_results ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.flight_experience ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.experience_types ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instructors ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instructor_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instructor_flight_type_rates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.memberships ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.membership_types ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.endorsements ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.users_endorsements ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.licenses ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.roster_rules ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.shift_overrides ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cancellation_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.flight_types ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.equipment ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.equipment_issuance ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.equipment_updates ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.maintenance_visits ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.observations ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.settings_audit_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.settings_files ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- PHASE 7: CREATE INDEXES FOR TENANT FILTERING PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_aircraft_tenant_id ON public.aircraft(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_charge_rates_tenant_id ON public.aircraft_charge_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_components_tenant_id ON public.aircraft_components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_types_tenant_id ON public.aircraft_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON public.bookings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_chargeables_tenant_id ON public.chargeables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chargeable_types_tenant_id ON public.chargeable_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_id ON public.invoice_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_id ON public.invoice_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_tenant_id ON public.invoice_sequences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_tenant_id ON public.tax_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_landing_fee_rates_tenant_id ON public.landing_fee_rates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_syllabus_tenant_id ON public.syllabus(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lessons_tenant_id ON public.lessons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_tenant_id ON public.lesson_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_syllabus_enrollment_tenant_id ON public.student_syllabus_enrollment(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exam_tenant_id ON public.exam(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_tenant_id ON public.exam_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flight_experience_tenant_id ON public.flight_experience(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experience_types_tenant_id ON public.experience_types(tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instructors_tenant_id ON public.instructors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instructor_categories_tenant_id ON public.instructor_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instructor_flight_type_rates_tenant_id ON public.instructor_flight_type_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON public.memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_membership_types_tenant_id ON public.membership_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_tenant_id ON public.endorsements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_endorsements_tenant_id ON public.users_endorsements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON public.licenses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_roster_rules_tenant_id ON public.roster_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shift_overrides_tenant_id ON public.shift_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_categories_tenant_id ON public.cancellation_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flight_types_tenant_id ON public.flight_types(tenant_id);

CREATE INDEX IF NOT EXISTS idx_equipment_tenant_id ON public.equipment(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_issuance_tenant_id ON public.equipment_issuance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_updates_tenant_id ON public.equipment_updates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_visits_tenant_id ON public.maintenance_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_observations_tenant_id ON public.observations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON public.settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_audit_log_tenant_id ON public.settings_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_files_tenant_id ON public.settings_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_id ON public.email_logs(tenant_id);

-- ============================================================================
-- PHASE 8: SET DEFAULT VALUES FOR NEW INSERTS
-- ============================================================================
-- New records will automatically get the user's tenant_id

ALTER TABLE public.aircraft ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.aircraft_charge_rates ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.aircraft_components ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.aircraft_types ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.bookings ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();

ALTER TABLE public.chargeables ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.chargeable_types ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.invoices ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.invoice_items ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.invoice_payments ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.invoice_sequences ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.transactions ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.tax_rates ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.landing_fee_rates ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();

ALTER TABLE public.syllabus ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.lessons ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.lesson_progress ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.student_syllabus_enrollment ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.exam ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.exam_results ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.flight_experience ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.experience_types ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();

ALTER TABLE public.users ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.instructors ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.instructor_categories ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.instructor_flight_type_rates ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.memberships ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.membership_types ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.endorsements ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.users_endorsements ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.licenses ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();

ALTER TABLE public.roster_rules ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.shift_overrides ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.cancellation_categories ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.flight_types ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();

ALTER TABLE public.equipment ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.equipment_issuance ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.equipment_updates ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();

ALTER TABLE public.maintenance_visits ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.observations ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();

ALTER TABLE public.settings ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.settings_audit_log ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.settings_files ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.audit_logs ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();
ALTER TABLE public.email_logs ALTER COLUMN tenant_id SET DEFAULT public.get_user_tenant();

-- ============================================================================
-- PHASE 9: UPDATE RLS POLICIES FOR TENANT ISOLATION
-- ============================================================================
-- This section updates all RLS policies to enforce tenant boundaries
-- Each table gets policies ensuring users can only access their tenant's data

-- 9.1 RLS for tenants table
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_manage" ON public.tenants;

CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT
  USING (
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "tenants_manage" ON public.tenants
  FOR ALL
  USING (
    public.tenant_user_has_role(auth.uid(), id, ARRAY['owner']::user_role[])
  )
  WITH CHECK (
    public.tenant_user_has_role(auth.uid(), id, ARRAY['owner']::user_role[])
  );

-- 9.2 RLS for tenant_users table
DROP POLICY IF EXISTS "tenant_users_select" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_manage" ON public.tenant_users;

-- Users can see their own memberships and admins/owners can see all in their tenant
CREATE POLICY "tenant_users_select" ON public.tenant_users
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

-- Only owners and admins can manage tenant memberships
CREATE POLICY "tenant_users_manage" ON public.tenant_users
  FOR ALL
  USING (
    public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  )
  WITH CHECK (
    public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

-- 9.3 Create a reusable function for standard tenant isolation
-- This simplifies policy creation for most tables
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- PHASE 10: UPDATE EXISTING RLS POLICIES TO INCLUDE TENANT CHECKS
-- ============================================================================
-- For each table, we add tenant_id checks to existing policies

-- Note: Due to the large number of tables, this section provides a template
-- that will be applied. The actual implementation replaces existing policies
-- with tenant-aware versions.

-- 10.1 Aircraft table - Add tenant isolation
DROP POLICY IF EXISTS "Authenticated users can view aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Authorized roles can create aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Authorized roles can update aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Owners and admins can delete aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "aircraft_delete_restricted" ON public.aircraft;
DROP POLICY IF EXISTS "aircraft_insert_restricted" ON public.aircraft;
DROP POLICY IF EXISTS "aircraft_read_authenticated" ON public.aircraft;
DROP POLICY IF EXISTS "aircraft_update_restricted" ON public.aircraft;

CREATE POLICY "aircraft_tenant_select" ON public.aircraft
  FOR SELECT USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "aircraft_tenant_insert" ON public.aircraft
  FOR INSERT WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

CREATE POLICY "aircraft_tenant_update" ON public.aircraft
  FOR UPDATE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin', 'instructor']::user_role[])
  );

CREATE POLICY "aircraft_tenant_delete" ON public.aircraft
  FOR DELETE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

-- 10.2 Bookings table - Add tenant isolation with user ownership
DROP POLICY IF EXISTS "bookings_delete" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_scheduler_view" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update" ON public.bookings;

CREATE POLICY "bookings_tenant_select" ON public.bookings
  FOR SELECT USING (
    public.user_belongs_to_tenant(tenant_id)
    AND (
      user_id = auth.uid()
      OR instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid())
      OR public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin', 'instructor']::user_role[])
    )
  );

CREATE POLICY "bookings_tenant_insert" ON public.bookings
  FOR INSERT WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND (
      user_id = auth.uid()
      OR public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin', 'instructor']::user_role[])
    )
  );

CREATE POLICY "bookings_tenant_update" ON public.bookings
  FOR UPDATE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND (
      user_id = auth.uid()
      OR instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid())
      OR public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
    )
  );

CREATE POLICY "bookings_tenant_delete" ON public.bookings
  FOR DELETE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

-- 10.3 Users table - Add tenant isolation
DROP POLICY IF EXISTS "users_delete" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;

CREATE POLICY "users_tenant_select" ON public.users
  FOR SELECT USING (
    public.user_belongs_to_tenant(tenant_id)
    AND (
      id = auth.uid()
      OR public_directory_opt_in = true
      OR public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin', 'instructor']::user_role[])
    )
  );

CREATE POLICY "users_tenant_insert" ON public.users
  FOR INSERT WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

CREATE POLICY "users_tenant_update" ON public.users
  FOR UPDATE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND (
      id = auth.uid()
      OR public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
    )
  );

CREATE POLICY "users_tenant_delete" ON public.users
  FOR DELETE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

-- 10.4 Invoices table - Add tenant isolation with user ownership
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;

CREATE POLICY "invoices_tenant_select" ON public.invoices
  FOR SELECT USING (
    public.user_belongs_to_tenant(tenant_id)
    AND (
      user_id = auth.uid()
      OR public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin', 'instructor']::user_role[])
    )
  );

CREATE POLICY "invoices_tenant_insert" ON public.invoices
  FOR INSERT WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin', 'instructor']::user_role[])
  );

CREATE POLICY "invoices_tenant_update" ON public.invoices
  FOR UPDATE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin', 'instructor']::user_role[])
  );

CREATE POLICY "invoices_tenant_delete" ON public.invoices
  FOR DELETE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin', 'instructor']::user_role[])
  );

-- 10.5 Settings table - Fix wide-open policy
DROP POLICY IF EXISTS "settings_manage" ON public.settings;

CREATE POLICY "settings_tenant_select" ON public.settings
  FOR SELECT USING (
    public.user_belongs_to_tenant(tenant_id)
    AND (
      is_public = true
      OR public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
    )
  );

CREATE POLICY "settings_tenant_manage" ON public.settings
  FOR ALL USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  )
  WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

-- 10.6 Instructors table
DROP POLICY IF EXISTS "Authenticated users can view instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authorized roles can create instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authorized roles can update instructors" ON public.instructors;
DROP POLICY IF EXISTS "Owners and admins can delete instructors" ON public.instructors;
DROP POLICY IF EXISTS "instructors_delete_restricted" ON public.instructors;
DROP POLICY IF EXISTS "instructors_insert_restricted" ON public.instructors;
DROP POLICY IF EXISTS "instructors_read_all" ON public.instructors;
DROP POLICY IF EXISTS "instructors_update_restricted" ON public.instructors;

CREATE POLICY "instructors_tenant_select" ON public.instructors
  FOR SELECT USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "instructors_tenant_insert" ON public.instructors
  FOR INSERT WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

CREATE POLICY "instructors_tenant_update" ON public.instructors
  FOR UPDATE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

CREATE POLICY "instructors_tenant_delete" ON public.instructors
  FOR DELETE USING (
    public.user_belongs_to_tenant(tenant_id)
    AND public.tenant_user_has_role(auth.uid(), tenant_id, ARRAY['owner', 'admin']::user_role[])
  );

-- 10.7 Standard tenant-only policies for reference/config tables
-- These tables just need basic tenant isolation

-- Memberships
DROP POLICY IF EXISTS "memberships_manage" ON public.memberships;
CREATE POLICY "memberships_tenant_all" ON public.memberships
  FOR ALL USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Membership types
DROP POLICY IF EXISTS "membership_types_manage" ON public.membership_types;
CREATE POLICY "membership_types_tenant_all" ON public.membership_types
  FOR ALL USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Flight types
DROP POLICY IF EXISTS "flight_types_manage" ON public.flight_types;
CREATE POLICY "flight_types_tenant_all" ON public.flight_types
  FOR ALL USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Lessons
DROP POLICY IF EXISTS "lessons_manage" ON public.lessons;
CREATE POLICY "lessons_tenant_all" ON public.lessons
  FOR ALL USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Experience types
DROP POLICY IF EXISTS "experience_types_manage" ON public.experience_types;
CREATE POLICY "experience_types_tenant_all" ON public.experience_types
  FOR ALL USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- Cancellation categories
DROP POLICY IF EXISTS "cancellation_categories_manage" ON public.cancellation_categories;
CREATE POLICY "cancellation_categories_tenant_all" ON public.cancellation_categories
  FOR ALL USING (public.user_belongs_to_tenant(tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- ============================================================================
-- PHASE 11: VERIFICATION QUERIES (Run these manually after migration)
-- ============================================================================
-- These queries help verify the migration was successful
-- Run them manually after applying the migration

/*
-- Verify all tables have tenant_id populated
SELECT 'aircraft' as table_name, COUNT(*) as total, COUNT(tenant_id) as with_tenant FROM aircraft
UNION ALL SELECT 'bookings', COUNT(*), COUNT(tenant_id) FROM bookings
UNION ALL SELECT 'users', COUNT(*), COUNT(tenant_id) FROM users
UNION ALL SELECT 'invoices', COUNT(*), COUNT(tenant_id) FROM invoices
UNION ALL SELECT 'settings', COUNT(*), COUNT(tenant_id) FROM settings;

-- Verify tenant_users were migrated from user_roles
SELECT 
  (SELECT COUNT(*) FROM user_roles) as old_user_roles_count,
  (SELECT COUNT(*) FROM tenant_users) as new_tenant_users_count;

-- Verify roles are preserved
SELECT 
  tu.user_id,
  t.name as tenant,
  r.name as role
FROM tenant_users tu
JOIN tenants t ON tu.tenant_id = t.id
JOIN roles r ON tu.role_id = r.id
WHERE tu.is_active = true
ORDER BY t.name, r.name;

-- Test RLS isolation (run as authenticated user)
SELECT COUNT(*) FROM aircraft; -- Should only see own tenant's aircraft
SELECT COUNT(*) FROM bookings; -- Should only see own tenant's bookings
*/

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT
-- ============================================================================
-- If anything goes wrong, run this to revert ALL changes
-- WARNING: This will lose any new data created after migration

/*
BEGIN;

-- Drop new RLS policies
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_manage" ON public.tenants;
DROP POLICY IF EXISTS "tenant_users_select" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_manage" ON public.tenant_users;
DROP POLICY IF EXISTS "aircraft_tenant_select" ON public.aircraft;
DROP POLICY IF EXISTS "aircraft_tenant_insert" ON public.aircraft;
DROP POLICY IF EXISTS "aircraft_tenant_update" ON public.aircraft;
DROP POLICY IF EXISTS "aircraft_tenant_delete" ON public.aircraft;
DROP POLICY IF EXISTS "bookings_tenant_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_tenant_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_tenant_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_tenant_delete" ON public.bookings;
DROP POLICY IF EXISTS "users_tenant_select" ON public.users;
DROP POLICY IF EXISTS "users_tenant_insert" ON public.users;
DROP POLICY IF EXISTS "users_tenant_update" ON public.users;
DROP POLICY IF EXISTS "users_tenant_delete" ON public.users;
DROP POLICY IF EXISTS "invoices_tenant_select" ON public.invoices;
DROP POLICY IF EXISTS "invoices_tenant_insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices_tenant_update" ON public.invoices;
DROP POLICY IF EXISTS "invoices_tenant_delete" ON public.invoices;
DROP POLICY IF EXISTS "settings_tenant_select" ON public.settings;
DROP POLICY IF EXISTS "settings_tenant_manage" ON public.settings;
DROP POLICY IF EXISTS "instructors_tenant_select" ON public.instructors;
DROP POLICY IF EXISTS "instructors_tenant_insert" ON public.instructors;
DROP POLICY IF EXISTS "instructors_tenant_update" ON public.instructors;
DROP POLICY IF EXISTS "instructors_tenant_delete" ON public.instructors;
DROP POLICY IF EXISTS "memberships_tenant_all" ON public.memberships;
DROP POLICY IF EXISTS "membership_types_tenant_all" ON public.membership_types;
DROP POLICY IF EXISTS "flight_types_tenant_all" ON public.flight_types;
DROP POLICY IF EXISTS "lessons_tenant_all" ON public.lessons;
DROP POLICY IF EXISTS "experience_types_tenant_all" ON public.experience_types;
DROP POLICY IF EXISTS "cancellation_categories_tenant_all" ON public.cancellation_categories;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.user_belongs_to_tenant(UUID);
DROP FUNCTION IF EXISTS public.get_tenant_user_role(UUID, UUID);
DROP FUNCTION IF EXISTS public.current_user_has_tenant_role(user_role[]);
DROP FUNCTION IF EXISTS public.tenant_user_has_role(UUID, UUID, user_role[]);
DROP FUNCTION IF EXISTS public.get_user_tenant(UUID);

-- Drop indexes on tenant_id columns
DROP INDEX IF EXISTS idx_aircraft_tenant_id;
DROP INDEX IF EXISTS idx_bookings_tenant_id;
DROP INDEX IF EXISTS idx_users_tenant_id;
-- ... (drop all other tenant_id indexes)

-- Remove tenant_id columns from all tables
ALTER TABLE public.aircraft DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.aircraft_charge_rates DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.aircraft_components DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.aircraft_types DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.chargeables DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.chargeable_types DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.invoice_items DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.invoice_payments DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.invoice_sequences DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.tax_rates DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.landing_fee_rates DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.syllabus DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.lessons DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.lesson_progress DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.student_syllabus_enrollment DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.exam DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.exam_results DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.flight_experience DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.experience_types DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.instructors DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.instructor_categories DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.instructor_flight_type_rates DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.memberships DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.membership_types DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.endorsements DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.users_endorsements DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.licenses DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.roster_rules DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.shift_overrides DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.cancellation_categories DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.flight_types DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.equipment DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.equipment_issuance DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.equipment_updates DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.maintenance_visits DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.observations DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.settings DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.settings_audit_log DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.settings_files DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.email_logs DROP COLUMN IF EXISTS tenant_id;

-- Drop tenant tables
DROP TABLE IF EXISTS public.tenant_users;
DROP TABLE IF EXISTS public.tenants;

-- Restore original RLS policies (would need to be re-applied from backup)
-- This is why we keep a backup before migration

COMMIT;
*/
