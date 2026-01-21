-- ============================================================================
-- MIGRATION: Fix membership_types unique constraints for multi-tenancy
-- ============================================================================
--
-- ISSUE: membership_types has unique constraints on `name` and `code` columns
-- without considering `tenant_id`, which prevents different tenants from
-- having membership types with the same names or codes.
--
-- SOLUTION: Drop the old single-column unique constraints and create new
-- composite unique constraints on (tenant_id, name) and (tenant_id, code).
--
-- This allows multiple tenants to have membership types with the same name
-- or code while still preventing duplicates within a single tenant.
-- ============================================================================

BEGIN;

-- Drop the old unique constraints that don't consider tenant_id
ALTER TABLE public.membership_types DROP CONSTRAINT IF EXISTS membership_types_name_key;
ALTER TABLE public.membership_types DROP CONSTRAINT IF EXISTS membership_types_code_key;

-- Create new composite unique constraints that include tenant_id
ALTER TABLE public.membership_types 
  ADD CONSTRAINT membership_types_tenant_name_unique UNIQUE (tenant_id, name);

ALTER TABLE public.membership_types 
  ADD CONSTRAINT membership_types_tenant_code_unique UNIQUE (tenant_id, code);

-- Create indexes to optimize lookups by these composite keys
CREATE INDEX IF NOT EXISTS idx_membership_types_tenant_name 
  ON public.membership_types(tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_membership_types_tenant_code 
  ON public.membership_types(tenant_id, code);

COMMENT ON CONSTRAINT membership_types_tenant_name_unique ON public.membership_types IS 
  'Ensures membership type names are unique within each tenant (allows same name across different tenants)';

COMMENT ON CONSTRAINT membership_types_tenant_code_unique ON public.membership_types IS 
  'Ensures membership type codes are unique within each tenant (allows same code across different tenants)';

COMMIT;
