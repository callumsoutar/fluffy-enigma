-- Migration: Aircraft TTIS Validation Safeguards
--
-- Purpose: Add database-level validation to prevent "first flight overwrites baseline" bugs
-- and other TTIS corruption issues.
--
-- Safeguards implemented:
-- 1. Trigger to validate TTIS updates don't decrease unexpectedly
-- 2. Warning system for suspicious TTIS values (too low compared to total_hours)
-- 3. Logging of all TTIS changes for audit purposes
--
-- Context: This prevents the bug where aircraft created after migration 012
-- had total_time_in_service defaulting to 0 instead of copying from total_hours,
-- causing the first flight to overwrite the baseline value.

-- 1) Create a function to validate aircraft TTIS updates
CREATE OR REPLACE FUNCTION public.validate_aircraft_ttis_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow increases and small decreases (corrections up to 5 hours)
  -- Larger corrections should use the correction RPC which has proper audit trail
  IF NEW.total_time_in_service < OLD.total_time_in_service - 5 THEN
    RAISE EXCEPTION 'Aircraft TTIS cannot decrease by more than 5 hours without using correction RPC (old: %, new: %). Use correct_booking_checkin_ttis_atomic for larger adjustments.',
      OLD.total_time_in_service, NEW.total_time_in_service
      USING ERRCODE = '23514'; -- check_violation
  END IF;
  
  -- Prevent TTIS from going negative
  IF NEW.total_time_in_service < 0 THEN
    RAISE EXCEPTION 'Aircraft TTIS cannot be negative (attempted value: %)', NEW.total_time_in_service
      USING ERRCODE = '23514'; -- check_violation
  END IF;
  
  -- Warn if TTIS is suspiciously low compared to total_hours
  -- This catches the "first flight overwrites baseline" bug pattern
  IF NEW.total_hours IS NOT NULL 
     AND NEW.total_hours > 100 
     AND NEW.total_time_in_service < NEW.total_hours * 0.5 THEN
    RAISE WARNING 'Aircraft % (%) TTIS (%) is less than 50%% of total_hours (%). This may indicate initialization error or data corruption.',
      NEW.id, NEW.registration, NEW.total_time_in_service, NEW.total_hours;
  END IF;
  
  -- Log TTIS changes for audit purposes (only if changed)
  IF OLD.total_time_in_service IS DISTINCT FROM NEW.total_time_in_service THEN
    RAISE NOTICE 'Aircraft % (%) TTIS updated: % -> % (delta: %)',
      NEW.id, NEW.registration, OLD.total_time_in_service, NEW.total_time_in_service,
      NEW.total_time_in_service - OLD.total_time_in_service;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_aircraft_ttis_update() IS
  'Validates aircraft TTIS updates to prevent data corruption. Blocks large unexpected decreases and warns about suspicious values.';

-- 2) Create trigger to run validation on aircraft updates
DROP TRIGGER IF EXISTS aircraft_ttis_validation ON public.aircraft;

CREATE TRIGGER aircraft_ttis_validation
  BEFORE UPDATE ON public.aircraft
  FOR EACH ROW
  WHEN (OLD.total_time_in_service IS DISTINCT FROM NEW.total_time_in_service)
  EXECUTE FUNCTION public.validate_aircraft_ttis_update();

COMMENT ON TRIGGER aircraft_ttis_validation ON public.aircraft IS
  'Validates TTIS updates to prevent corruption and log changes for audit.';

-- 3) Add a check constraint to ensure TTIS is never negative
ALTER TABLE public.aircraft
  DROP CONSTRAINT IF EXISTS aircraft_ttis_non_negative;

ALTER TABLE public.aircraft
  ADD CONSTRAINT aircraft_ttis_non_negative 
  CHECK (total_time_in_service >= 0);

COMMENT ON CONSTRAINT aircraft_ttis_non_negative ON public.aircraft IS
  'Ensures aircraft total time in service can never be negative.';

-- 4) Create a helper function to check for aircraft with suspicious TTIS values
CREATE OR REPLACE FUNCTION public.find_aircraft_with_suspicious_ttis()
RETURNS TABLE(
  aircraft_id uuid,
  registration text,
  total_hours numeric,
  total_time_in_service numeric,
  discrepancy numeric,
  first_flight_date timestamptz,
  flights_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as aircraft_id,
    a.registration,
    a.total_hours,
    a.total_time_in_service,
    (a.total_hours - a.total_time_in_service) as discrepancy,
    MIN(b.checkin_approved_at) as first_flight_date,
    COUNT(b.id) as flights_count
  FROM aircraft a
  LEFT JOIN bookings b ON b.checked_out_aircraft_id = a.id 
    AND b.checkin_approved_at IS NOT NULL
  WHERE a.total_hours IS NOT NULL
    AND a.total_time_in_service IS NOT NULL
    AND a.total_hours > 100  -- Only check aircraft with significant hours
    AND a.total_time_in_service < a.total_hours * 0.5  -- TTIS is less than 50% of total_hours
  GROUP BY a.id, a.registration, a.total_hours, a.total_time_in_service
  ORDER BY discrepancy DESC;
END;
$$;

COMMENT ON FUNCTION public.find_aircraft_with_suspicious_ttis() IS
  'Diagnostic function to find aircraft that may have incorrect TTIS values (common symptom of the "first flight overwrites baseline" bug).';
