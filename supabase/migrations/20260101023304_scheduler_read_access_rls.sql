-- Migration: Add RLS policies for scheduler read access
-- Allows all authenticated users to view aircraft and roster_rules
-- Write operations remain restricted to instructors and above

-- =============================================================================
-- AIRCRAFT TABLE RLS POLICIES
-- =============================================================================

-- Drop existing policies if any (for clean migration)
DROP POLICY IF EXISTS "Authenticated users can view aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Authorized roles can create aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Authorized roles can update aircraft" ON public.aircraft;
DROP POLICY IF EXISTS "Owners and admins can delete aircraft" ON public.aircraft;

-- Enable RLS on aircraft table
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view aircraft (needed for scheduler/booking)
CREATE POLICY "Authenticated users can view aircraft"
  ON public.aircraft
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only instructors, admins, and owners can create aircraft
CREATE POLICY "Authorized roles can create aircraft"
  ON public.aircraft
  FOR INSERT
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- Policy: Only instructors, admins, and owners can update aircraft
CREATE POLICY "Authorized roles can update aircraft"
  ON public.aircraft
  FOR UPDATE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  )
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- Policy: Only owners and admins can delete aircraft
CREATE POLICY "Owners and admins can delete aircraft"
  ON public.aircraft
  FOR DELETE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin']::user_role[],
      auth.uid()
    )
  );

-- =============================================================================
-- ROSTER_RULES TABLE RLS POLICIES
-- =============================================================================

-- Drop existing policies if any (for clean migration)
DROP POLICY IF EXISTS "Authenticated users can view roster rules" ON public.roster_rules;
DROP POLICY IF EXISTS "Authorized roles can create roster rules" ON public.roster_rules;
DROP POLICY IF EXISTS "Authorized roles can update roster rules" ON public.roster_rules;
DROP POLICY IF EXISTS "Owners and admins can delete roster rules" ON public.roster_rules;

-- Enable RLS on roster_rules table
ALTER TABLE public.roster_rules ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view active roster rules (needed for scheduler)
CREATE POLICY "Authenticated users can view roster rules"
  ON public.roster_rules
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND is_active = true
    AND voided_at IS NULL
  );

-- Policy: Only instructors, admins, and owners can create roster rules
CREATE POLICY "Authorized roles can create roster rules"
  ON public.roster_rules
  FOR INSERT
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- Policy: Only instructors, admins, and owners can update roster rules
CREATE POLICY "Authorized roles can update roster rules"
  ON public.roster_rules
  FOR UPDATE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  )
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- Policy: Only owners and admins can delete roster rules
CREATE POLICY "Owners and admins can delete roster rules"
  ON public.roster_rules
  FOR DELETE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin']::user_role[],
      auth.uid()
    )
  );

-- =============================================================================
-- AIRCRAFT_TYPES TABLE RLS POLICIES (Reference table)
-- =============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view aircraft types" ON public.aircraft_types;
DROP POLICY IF EXISTS "Only admins can manage aircraft types" ON public.aircraft_types;

-- Enable RLS on aircraft_types table
ALTER TABLE public.aircraft_types ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view aircraft types
CREATE POLICY "Authenticated users can view aircraft types"
  ON public.aircraft_types
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can manage aircraft types
CREATE POLICY "Only admins can manage aircraft types"
  ON public.aircraft_types
  FOR ALL
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin']::user_role[],
      auth.uid()
    )
  )
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin']::user_role[],
      auth.uid()
    )
  );

-- =============================================================================
-- INSTRUCTORS TABLE RLS POLICIES
-- =============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authorized roles can create instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authorized roles can update instructors" ON public.instructors;
DROP POLICY IF EXISTS "Owners and admins can delete instructors" ON public.instructors;

-- Enable RLS on instructors table
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view instructors (needed for scheduler/booking)
CREATE POLICY "Authenticated users can view instructors"
  ON public.instructors
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only instructors, admins, and owners can create instructor records
CREATE POLICY "Authorized roles can create instructors"
  ON public.instructors
  FOR INSERT
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- Policy: Only instructors, admins, and owners can update instructor records
CREATE POLICY "Authorized roles can update instructors"
  ON public.instructors
  FOR UPDATE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  )
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- Policy: Only owners and admins can delete instructor records
CREATE POLICY "Owners and admins can delete instructors"
  ON public.instructors
  FOR DELETE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin']::user_role[],
      auth.uid()
    )
  );

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "Authenticated users can view aircraft" ON public.aircraft IS 
  'All authenticated users can view aircraft for scheduler and booking purposes. Write operations restricted to instructors and above.';

COMMENT ON POLICY "Authenticated users can view roster rules" ON public.roster_rules IS 
  'All authenticated users can view active roster rules for scheduler availability. Only shows active, non-voided rules.';

COMMENT ON POLICY "Authenticated users can view instructors" ON public.instructors IS 
  'All authenticated users can view instructor profiles for scheduler and booking purposes. Write operations restricted to instructors and above.';

