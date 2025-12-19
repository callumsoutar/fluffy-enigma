-- Migration: Booking Check-In billing fields + immutability guard
--
-- Purpose:
-- - Support airswitch meter capture (start/end/delta)
-- - Store billing basis + billing hours chosen by rate flags (calculated in browser)
-- - Final approval marks the check-in as immutable (financially critical)
--
-- NOTE: All business calculations remain client-side; DB stores state + enforces immutability.

-- 1) Add airswitch meter fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS airswitch_start NUMERIC,
  ADD COLUMN IF NOT EXISTS airswitch_end NUMERIC,
  ADD COLUMN IF NOT EXISTS flight_time_airswitch NUMERIC;

-- 2) Add check-in approval / billing audit fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS billing_basis TEXT,
  ADD COLUMN IF NOT EXISTS billing_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS checkin_invoice_id UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS checkin_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_approved_by UUID REFERENCES auth.users(id);

-- 3) Constrain billing_basis to known values (idempotent via exception guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_billing_basis_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_billing_basis_check
      CHECK (billing_basis IS NULL OR billing_basis IN ('hobbs', 'tacho', 'airswitch'));
  END IF;
END $$;

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_bookings_checkin_approved_at
  ON public.bookings(checkin_approved_at);

CREATE INDEX IF NOT EXISTS idx_bookings_checkin_invoice_id
  ON public.bookings(checkin_invoice_id);

-- 5) Immutability guard: once approved, prevent modifications to check-in/billing fields
CREATE OR REPLACE FUNCTION public.prevent_approved_checkin_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If not approved, allow updates.
  IF OLD.checkin_approved_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Once approved, block changes to fields that affect billing/audit.
  IF (
    NEW.actual_start IS DISTINCT FROM OLD.actual_start OR
    NEW.actual_end IS DISTINCT FROM OLD.actual_end OR
    NEW.hobbs_start IS DISTINCT FROM OLD.hobbs_start OR
    NEW.hobbs_end IS DISTINCT FROM OLD.hobbs_end OR
    NEW.tach_start IS DISTINCT FROM OLD.tach_start OR
    NEW.tach_end IS DISTINCT FROM OLD.tach_end OR
    NEW.airswitch_start IS DISTINCT FROM OLD.airswitch_start OR
    NEW.airswitch_end IS DISTINCT FROM OLD.airswitch_end OR
    NEW.flight_time_hobbs IS DISTINCT FROM OLD.flight_time_hobbs OR
    NEW.flight_time_tach IS DISTINCT FROM OLD.flight_time_tach OR
    NEW.flight_time_airswitch IS DISTINCT FROM OLD.flight_time_airswitch OR
    NEW.flight_time IS DISTINCT FROM OLD.flight_time OR
    NEW.billing_basis IS DISTINCT FROM OLD.billing_basis OR
    NEW.billing_hours IS DISTINCT FROM OLD.billing_hours OR
    NEW.flight_type_id IS DISTINCT FROM OLD.flight_type_id OR
    NEW.checked_out_aircraft_id IS DISTINCT FROM OLD.checked_out_aircraft_id OR
    NEW.checked_out_instructor_id IS DISTINCT FROM OLD.checked_out_instructor_id OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.checkin_invoice_id IS DISTINCT FROM OLD.checkin_invoice_id OR
    NEW.checkin_approved_at IS DISTINCT FROM OLD.checkin_approved_at OR
    NEW.checkin_approved_by IS DISTINCT FROM OLD.checkin_approved_by
  ) THEN
    RAISE EXCEPTION 'Booking check-in is approved and immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_prevent_approved_checkin_mutations ON public.bookings;
CREATE TRIGGER bookings_prevent_approved_checkin_mutations
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_approved_checkin_mutations();
