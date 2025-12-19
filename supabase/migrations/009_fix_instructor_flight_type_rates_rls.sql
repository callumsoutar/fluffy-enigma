-- Migration: Allow staff to read instructor flight-type rates
--
-- Bugfix:
-- - The app (check-in) needs instructors to read instructor_flight_type_rates.
-- - Existing policy only allowed admin/owner, causing "no rows" and 404s.

ALTER TABLE public.instructor_flight_type_rates ENABLE ROW LEVEL SECURITY;

-- Allow staff (instructor/admin/owner) to SELECT rates.
DROP POLICY IF EXISTS instructor_flight_type_rates_select_staff ON public.instructor_flight_type_rates;
CREATE POLICY instructor_flight_type_rates_select_staff
  ON public.instructor_flight_type_rates
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    check_user_role_simple((SELECT auth.uid() AS uid), ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role])
  );
