-- Migration: Aviation-correct aircraft TTIS delta tracking during booking check-in + safe corrections
--
-- Core rules implemented:
-- - Bookings are the authoritative flight record.
-- - Aircraft TTIS (total_time_in_service) is persisted state.
-- - Aircraft time is ONLY mutated server-side.
-- - All updates are applied as deltas, never recalculated from history.
-- - Applied delta depends on aircraft.total_time_method (with optional multipliers).
--
-- This migration:
-- 1) Adds persisted TTIS state to aircraft (total_time_in_service).
-- 2) Adds booking audit fields for TTIS application + corrections.
-- 3) Extends the existing atomic check-in approval RPC to:
--    - lock booking FOR UPDATE
--    - lock aircraft FOR UPDATE
--    - compute meter deltas server-side
--    - compute applied_aircraft_delta from total_time_method
--    - update aircraft.total_time_in_service += applied_delta
--    - snapshot total_hours_start/total_hours_end on the booking
-- 4) Adds a correction RPC that applies delta-of-deltas transactionally.

-- 1) Aircraft persisted TTIS state
ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS total_time_in_service numeric;

-- Best-effort backfill: prefer existing column value; else map from legacy total_hours if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'total_hours'
  ) THEN
    EXECUTE 'UPDATE public.aircraft SET total_time_in_service = COALESCE(total_time_in_service, total_hours, 0) WHERE total_time_in_service IS NULL;';
  ELSE
    EXECUTE 'UPDATE public.aircraft SET total_time_in_service = COALESCE(total_time_in_service, 0) WHERE total_time_in_service IS NULL;';
  END IF;
END $$;

ALTER TABLE public.aircraft
  ALTER COLUMN total_time_in_service SET NOT NULL;

ALTER TABLE public.aircraft
  ALTER COLUMN total_time_in_service SET DEFAULT 0;

COMMENT ON COLUMN public.aircraft.total_time_in_service IS
  'Authoritative persisted aircraft total time in service (TTIS). Mutated only by server-side transactional deltas.';

-- 2) Booking audit fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS applied_aircraft_delta numeric,
  ADD COLUMN IF NOT EXISTS applied_total_time_method text,
  ADD COLUMN IF NOT EXISTS correction_delta numeric,
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS corrected_by uuid,
  ADD COLUMN IF NOT EXISTS correction_reason text;

COMMENT ON COLUMN public.bookings.applied_aircraft_delta IS
  'The delta actually applied to aircraft.total_time_in_service for this booking (after total_time_method multiplier).';

COMMENT ON COLUMN public.bookings.applied_total_time_method IS
  'Snapshot of aircraft.total_time_method used when calculating applied_aircraft_delta (for deterministic corrections).';

COMMENT ON COLUMN public.bookings.correction_delta IS
  'Delta applied to aircraft.total_time_in_service when correcting this booking (new_applied_delta - old_applied_delta).';

-- 3) Allow controlled corrections to specific fields after approval
CREATE OR REPLACE FUNCTION public.prevent_approved_checkin_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If not approved, allow updates.
  IF OLD.checkin_approved_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Once approved, allow ONLY controlled corrections to a whitelisted set of fields
  -- when correction metadata is present.
  IF NEW.corrected_at IS NOT NULL THEN
    IF NEW.corrected_by IS NULL OR NEW.correction_reason IS NULL OR length(trim(NEW.correction_reason)) = 0 THEN
      RAISE EXCEPTION 'Correction requires corrected_by and non-empty correction_reason'
        USING ERRCODE = '42501';
    END IF;

    -- Allow only time/audit fields to change under correction.
    IF (
      -- Core booking identity / invoicing / status must remain immutable.
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.checked_out_aircraft_id IS DISTINCT FROM OLD.checked_out_aircraft_id OR
      NEW.checked_out_instructor_id IS DISTINCT FROM OLD.checked_out_instructor_id OR
      NEW.flight_type_id IS DISTINCT FROM OLD.flight_type_id OR
      NEW.billing_basis IS DISTINCT FROM OLD.billing_basis OR
      NEW.billing_hours IS DISTINCT FROM OLD.billing_hours OR
      NEW.flight_time IS DISTINCT FROM OLD.flight_time OR
      NEW.checkin_invoice_id IS DISTINCT FROM OLD.checkin_invoice_id OR
      NEW.checkin_approved_at IS DISTINCT FROM OLD.checkin_approved_at OR
      NEW.checkin_approved_by IS DISTINCT FROM OLD.checkin_approved_by
    ) THEN
      RAISE EXCEPTION 'Approved booking fields are immutable (correction is time-only)'
        USING ERRCODE = '42501';
    END IF;

    -- All other changes are allowed ONLY if within the flight time / TTIS correction scope.
    RETURN NEW;
  END IF;

  -- No correction metadata: block any changes to fields that affect billing/audit.
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
    NEW.checkin_approved_by IS DISTINCT FROM OLD.checkin_approved_by OR
    NEW.solo_end_hobbs IS DISTINCT FROM OLD.solo_end_hobbs OR
    NEW.solo_end_tach IS DISTINCT FROM OLD.solo_end_tach OR
    NEW.dual_time IS DISTINCT FROM OLD.dual_time OR
    NEW.solo_time IS DISTINCT FROM OLD.solo_time OR
    NEW.total_hours_start IS DISTINCT FROM OLD.total_hours_start OR
    NEW.total_hours_end IS DISTINCT FROM OLD.total_hours_end OR
    NEW.applied_aircraft_delta IS DISTINCT FROM OLD.applied_aircraft_delta OR
    NEW.applied_total_time_method IS DISTINCT FROM OLD.applied_total_time_method OR
    NEW.correction_delta IS DISTINCT FROM OLD.correction_delta OR
    NEW.corrected_at IS DISTINCT FROM OLD.corrected_at OR
    NEW.corrected_by IS DISTINCT FROM OLD.corrected_by OR
    NEW.correction_reason IS DISTINCT FROM OLD.correction_reason
  ) THEN
    RAISE EXCEPTION 'Booking check-in is approved and immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Total time method delta calculation (authoritative)
CREATE OR REPLACE FUNCTION public.calculate_applied_aircraft_delta(
  p_method text,
  p_hobbs_delta numeric,
  p_tach_delta numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
BEGIN
  CASE p_method
    WHEN 'hobbs' THEN
      IF p_hobbs_delta IS NULL THEN RAISE EXCEPTION 'hobbs delta is required for total_time_method=hobbs'; END IF;
      RETURN p_hobbs_delta;
    WHEN 'tacho' THEN
      IF p_tach_delta IS NULL THEN RAISE EXCEPTION 'tach delta is required for total_time_method=tacho'; END IF;
      RETURN p_tach_delta;
    WHEN 'airswitch' THEN
      IF p_hobbs_delta IS NULL THEN RAISE EXCEPTION 'hobbs delta is required for total_time_method=airswitch'; END IF;
      RETURN p_hobbs_delta;
    WHEN 'hobbs less 5%' THEN
      IF p_hobbs_delta IS NULL THEN RAISE EXCEPTION 'hobbs delta is required for total_time_method=hobbs less 5%'; END IF;
      RETURN p_hobbs_delta * 0.95;
    WHEN 'hobbs less 10%' THEN
      IF p_hobbs_delta IS NULL THEN RAISE EXCEPTION 'hobbs delta is required for total_time_method=hobbs less 10%'; END IF;
      RETURN p_hobbs_delta * 0.90;
    WHEN 'tacho less 5%' THEN
      IF p_tach_delta IS NULL THEN RAISE EXCEPTION 'tach delta is required for total_time_method=tacho less 5%'; END IF;
      RETURN p_tach_delta * 0.95;
    WHEN 'tacho less 10%' THEN
      IF p_tach_delta IS NULL THEN RAISE EXCEPTION 'tach delta is required for total_time_method=tacho less 10%'; END IF;
      RETURN p_tach_delta * 0.90;
    ELSE
      RAISE EXCEPTION 'Unknown total_time_method: %', COALESCE(p_method, 'NULL');
  END CASE;
END;
$$;

-- 5) Replace the atomic approval function to compute deltas server-side and update TTIS
DROP FUNCTION IF EXISTS public.approve_booking_checkin_atomic(
  uuid, uuid, uuid, uuid,
  timestamptz, timestamptz,
  numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric,
  text, numeric,
  numeric, timestamptz, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.approve_booking_checkin_atomic(
  p_booking_id uuid,
  p_checked_out_aircraft_id uuid,
  p_checked_out_instructor_id uuid,
  p_flight_type_id uuid,

  p_actual_start timestamptz,
  p_actual_end timestamptz,

  p_hobbs_start numeric,
  p_hobbs_end numeric,
  p_tach_start numeric,
  p_tach_end numeric,
  p_airswitch_start numeric,
  p_airswitch_end numeric,

  p_solo_end_hobbs numeric,
  p_solo_end_tach numeric,
  p_dual_time numeric,
  p_solo_time numeric,

  p_billing_basis text,
  p_billing_hours numeric,

  p_tax_rate numeric DEFAULT NULL,
  p_due_date timestamptz DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_booking record;
  v_aircraft record;
  v_invoice_result jsonb;
  v_invoice_id uuid;
  v_invoice_number text;

  v_hobbs_delta numeric;
  v_tach_delta numeric;
  v_airswitch_delta numeric;

  v_method text;
  v_applied_delta numeric;
  v_old_ttis numeric;
  v_new_ttis numeric;
BEGIN
  BEGIN
    -- AuthN: must be called with a real JWT
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized',
        'message', 'Authentication required'
      );
    END IF;

    -- AuthZ: only staff can approve check-ins (financially critical)
    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Forbidden',
        'message', 'Insufficient permissions to approve check-in'
      );
    END IF;

    -- Validate items early (create_invoice_atomic requires at least one)
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Missing invoice items',
        'message', 'Check-in approval must include at least one invoice item'
      );
    END IF;

    -- Validate billing basis/hours (store-only, but guard against obviously bad data)
    IF p_billing_basis IS NULL OR p_billing_basis NOT IN ('hobbs', 'tacho', 'airswitch') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid billing_basis',
        'message', 'billing_basis must be one of hobbs, tacho, airswitch'
      );
    END IF;

    IF p_billing_hours IS NULL OR p_billing_hours <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid billing_hours',
        'message', 'billing_hours must be greater than zero'
      );
    END IF;

    -- Lock the booking row to prevent concurrent approvals
    SELECT
      b.id,
      b.user_id,
      b.booking_type,
      b.status,
      b.checkin_approved_at
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Not found',
        'message', 'Booking not found'
      );
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid booking type',
        'message', 'Check-in approval is only valid for flight bookings'
      );
    END IF;

    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid status',
        'message', 'Cannot approve check-in for cancelled bookings'
      );
    END IF;

    IF v_booking.checkin_approved_at IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Already approved',
        'message', 'Booking check-in has already been approved'
      );
    END IF;

    IF v_booking.user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Missing booking user',
        'message', 'Cannot invoice a booking without a member/user_id'
      );
    END IF;

    -- Prevent double-invoicing
    IF EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.booking_id = p_booking_id
        AND i.deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invoice already exists',
        'message', 'An active invoice already exists for this booking'
      );
    END IF;

    -- Lock aircraft row (authoritative TTIS update)
    SELECT
      a.id,
      a.total_time_method,
      a.total_time_in_service
    INTO v_aircraft
    FROM public.aircraft a
    WHERE a.id = p_checked_out_aircraft_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Not found',
        'message', 'Aircraft not found'
      );
    END IF;

    v_method := v_aircraft.total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid aircraft total_time_method',
        'message', 'Aircraft total_time_method must be set to apply TTIS deltas'
      );
    END IF;

    -- Compute deltas server-side (authoritative)
    v_hobbs_delta := CASE
      WHEN p_hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL
      ELSE p_hobbs_end - p_hobbs_start
    END;
    v_tach_delta := CASE
      WHEN p_tach_start IS NULL OR p_tach_end IS NULL THEN NULL
      ELSE p_tach_end - p_tach_start
    END;
    v_airswitch_delta := CASE
      WHEN p_airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL
      ELSE p_airswitch_end - p_airswitch_start
    END;

    IF v_hobbs_delta IS NOT NULL AND v_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta', 'message', 'hobbs_end must be >= hobbs_start');
    END IF;
    IF v_tach_delta IS NOT NULL AND v_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta', 'message', 'tach_end must be >= tach_start');
    END IF;
    IF v_airswitch_delta IS NOT NULL AND v_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta', 'message', 'airswitch_end must be >= airswitch_start');
    END IF;

    v_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_hobbs_delta, v_tach_delta);
    v_old_ttis := v_aircraft.total_time_in_service;
    v_new_ttis := v_old_ttis + v_applied_delta;

    IF v_applied_delta IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid applied delta', 'message', 'Applied aircraft delta could not be calculated');
    END IF;
    IF v_applied_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid applied delta', 'message', 'Applied aircraft delta must be non-negative');
    END IF;

    -- Create invoice + items atomically using the authoritative invoicing RPC
    v_invoice_result := public.create_invoice_atomic(
      v_booking.user_id,
      p_booking_id,
      'pending',
      NULL,
      p_tax_rate,
      now(),
      p_due_date,
      p_reference,
      p_notes,
      p_items
    );

    IF (v_invoice_result->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'Atomic invoice creation failed: %', COALESCE(v_invoice_result->>'error', 'unknown error');
    END IF;

    v_invoice_id := NULLIF(v_invoice_result->>'invoice_id', '')::uuid;
    v_invoice_number := v_invoice_result->>'invoice_number';

    IF v_invoice_id IS NULL THEN
      RAISE EXCEPTION 'Atomic invoice creation did not return invoice_id';
    END IF;

    -- Apply TTIS update (delta-only)
    UPDATE public.aircraft
    SET total_time_in_service = v_new_ttis
    WHERE id = p_checked_out_aircraft_id;

    -- Persist final check-in state and lock it (single update to satisfy immutability trigger)
    UPDATE public.bookings
    SET
      status = 'complete',
      checked_out_aircraft_id = p_checked_out_aircraft_id,
      checked_out_instructor_id = p_checked_out_instructor_id,
      flight_type_id = p_flight_type_id,

      actual_start = p_actual_start,
      actual_end = p_actual_end,

      hobbs_start = p_hobbs_start,
      hobbs_end = p_hobbs_end,
      tach_start = p_tach_start,
      tach_end = p_tach_end,
      airswitch_start = p_airswitch_start,
      airswitch_end = p_airswitch_end,

      solo_end_hobbs = p_solo_end_hobbs,
      solo_end_tach = p_solo_end_tach,
      dual_time = p_dual_time,
      solo_time = p_solo_time,

      flight_time_hobbs = v_hobbs_delta,
      flight_time_tach = v_tach_delta,
      flight_time_airswitch = v_airswitch_delta,

      billing_basis = p_billing_basis,
      billing_hours = p_billing_hours,
      flight_time = p_billing_hours,

      total_hours_start = v_old_ttis,
      total_hours_end = v_new_ttis,
      applied_aircraft_delta = v_applied_delta,
      applied_total_time_method = v_method,

      checkin_invoice_id = v_invoice_id,
      checkin_approved_at = now(),
      checkin_approved_by = v_actor
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'applied_aircraft_delta', v_applied_delta,
      'total_hours_start', v_old_ttis,
      'total_hours_end', v_new_ttis,
      'message', 'Booking check-in approved and TTIS updated atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'message', 'Atomic check-in approval rolled back due to error'
      );
  END;
END;
$$;

-- 6) Atomic finalize (when invoice already exists/was approved separately) + TTIS update
CREATE OR REPLACE FUNCTION public.finalize_booking_checkin_with_invoice_atomic(
  p_booking_id uuid,
  p_invoice_id uuid,
  p_checked_out_aircraft_id uuid,
  p_checked_out_instructor_id uuid,
  p_flight_type_id uuid,

  p_actual_start timestamptz,
  p_actual_end timestamptz,

  p_hobbs_start numeric,
  p_hobbs_end numeric,
  p_tach_start numeric,
  p_tach_end numeric,
  p_airswitch_start numeric,
  p_airswitch_end numeric,

  p_solo_end_hobbs numeric,
  p_solo_end_tach numeric,
  p_dual_time numeric,
  p_solo_time numeric,

  p_billing_basis text,
  p_billing_hours numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_booking record;
  v_aircraft record;

  v_hobbs_delta numeric;
  v_tach_delta numeric;
  v_airswitch_delta numeric;

  v_method text;
  v_applied_delta numeric;
  v_old_ttis numeric;
  v_new_ttis numeric;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to finalize check-in');
    END IF;

    -- Lock booking
    SELECT
      b.id,
      b.booking_type,
      b.status,
      b.checkin_approved_at
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type', 'message', 'Check-in finalization is only valid for flight bookings');
    END IF;

    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Cannot finalize check-in for cancelled bookings');
    END IF;

    IF v_booking.checkin_approved_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already approved', 'message', 'Booking check-in has already been approved');
    END IF;

    -- Lock aircraft
    SELECT
      a.id,
      a.total_time_method,
      a.total_time_in_service
    INTO v_aircraft
    FROM public.aircraft a
    WHERE a.id = p_checked_out_aircraft_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
    END IF;

    v_method := v_aircraft.total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid aircraft total_time_method', 'message', 'Aircraft total_time_method must be set to apply TTIS deltas');
    END IF;

    v_hobbs_delta := CASE
      WHEN p_hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL
      ELSE p_hobbs_end - p_hobbs_start
    END;
    v_tach_delta := CASE
      WHEN p_tach_start IS NULL OR p_tach_end IS NULL THEN NULL
      ELSE p_tach_end - p_tach_start
    END;
    v_airswitch_delta := CASE
      WHEN p_airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL
      ELSE p_airswitch_end - p_airswitch_start
    END;

    IF v_hobbs_delta IS NOT NULL AND v_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta', 'message', 'hobbs_end must be >= hobbs_start');
    END IF;
    IF v_tach_delta IS NOT NULL AND v_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta', 'message', 'tach_end must be >= tach_start');
    END IF;
    IF v_airswitch_delta IS NOT NULL AND v_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta', 'message', 'airswitch_end must be >= airswitch_start');
    END IF;

    v_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_hobbs_delta, v_tach_delta);
    v_old_ttis := v_aircraft.total_time_in_service;
    v_new_ttis := v_old_ttis + v_applied_delta;

    IF v_applied_delta IS NULL OR v_applied_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid applied delta', 'message', 'Applied aircraft delta must be non-negative');
    END IF;

    UPDATE public.aircraft
    SET total_time_in_service = v_new_ttis
    WHERE id = p_checked_out_aircraft_id;

    UPDATE public.bookings
    SET
      status = 'complete',
      checked_out_aircraft_id = p_checked_out_aircraft_id,
      checked_out_instructor_id = p_checked_out_instructor_id,
      flight_type_id = p_flight_type_id,

      actual_start = p_actual_start,
      actual_end = p_actual_end,

      hobbs_start = p_hobbs_start,
      hobbs_end = p_hobbs_end,
      tach_start = p_tach_start,
      tach_end = p_tach_end,
      airswitch_start = p_airswitch_start,
      airswitch_end = p_airswitch_end,

      solo_end_hobbs = p_solo_end_hobbs,
      solo_end_tach = p_solo_end_tach,
      dual_time = p_dual_time,
      solo_time = p_solo_time,

      flight_time_hobbs = v_hobbs_delta,
      flight_time_tach = v_tach_delta,
      flight_time_airswitch = v_airswitch_delta,

      billing_basis = p_billing_basis,
      billing_hours = p_billing_hours,
      flight_time = p_billing_hours,

      total_hours_start = v_old_ttis,
      total_hours_end = v_new_ttis,
      applied_aircraft_delta = v_applied_delta,
      applied_total_time_method = v_method,

      checkin_invoice_id = p_invoice_id,
      checkin_approved_at = now(),
      checkin_approved_by = v_actor
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'invoice_id', p_invoice_id,
      'applied_aircraft_delta', v_applied_delta,
      'total_hours_start', v_old_ttis,
      'total_hours_end', v_new_ttis,
      'message', 'Booking check-in finalized and TTIS updated atomically'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'message', 'Atomic check-in finalization rolled back due to error'
      );
  END;
END;
$$;

-- 7) Corrections: apply delta-of-deltas transactionally (no recalculation from history)
CREATE OR REPLACE FUNCTION public.correct_booking_checkin_ttis_atomic(
  p_booking_id uuid,
  p_hobbs_end numeric,
  p_tach_end numeric,
  p_airswitch_end numeric,
  p_correction_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_booking record;
  v_aircraft record;

  v_new_hobbs_delta numeric;
  v_new_tach_delta numeric;
  v_new_airswitch_delta numeric;

  v_method text;
  v_old_applied_delta numeric;
  v_new_applied_delta numeric;
  v_correction_delta numeric;

  v_aircraft_old_ttis numeric;
  v_aircraft_new_ttis numeric;
  v_booking_new_total_hours_end numeric;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to correct check-in');
    END IF;

    IF p_correction_reason IS NULL OR length(trim(p_correction_reason)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid correction_reason', 'message', 'correction_reason is required');
    END IF;

    -- Lock booking
    SELECT
      b.id,
      b.booking_type,
      b.status,
      b.checkin_approved_at,
      b.checked_out_aircraft_id,
      b.hobbs_start,
      b.tach_start,
      b.airswitch_start,
      b.applied_aircraft_delta,
      b.applied_total_time_method,
      b.total_hours_end
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;

    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type', 'message', 'Corrections are only valid for flight bookings');
    END IF;

    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status', 'message', 'Cannot correct cancelled bookings');
    END IF;

    IF v_booking.checkin_approved_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not approved', 'message', 'Cannot correct an unapproved check-in');
    END IF;

    IF v_booking.checked_out_aircraft_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing aircraft', 'message', 'Booking has no checked_out_aircraft_id');
    END IF;

    v_old_applied_delta := v_booking.applied_aircraft_delta;
    IF v_old_applied_delta IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing applied delta', 'message', 'Booking is missing applied_aircraft_delta (cannot correct safely)');
    END IF;

    v_method := v_booking.applied_total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing method snapshot', 'message', 'Booking is missing applied_total_time_method (cannot correct deterministically)');
    END IF;

    -- Lock aircraft
    SELECT
      a.id,
      a.total_time_in_service
    INTO v_aircraft
    FROM public.aircraft a
    WHERE a.id = v_booking.checked_out_aircraft_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Aircraft not found');
    END IF;

    -- Compute new base deltas from stored starts + new ends
    v_new_hobbs_delta := CASE
      WHEN v_booking.hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL
      ELSE p_hobbs_end - v_booking.hobbs_start
    END;
    v_new_tach_delta := CASE
      WHEN v_booking.tach_start IS NULL OR p_tach_end IS NULL THEN NULL
      ELSE p_tach_end - v_booking.tach_start
    END;
    v_new_airswitch_delta := CASE
      WHEN v_booking.airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL
      ELSE p_airswitch_end - v_booking.airswitch_start
    END;

    IF v_new_hobbs_delta IS NOT NULL AND v_new_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta', 'message', 'New hobbs_end must be >= hobbs_start');
    END IF;
    IF v_new_tach_delta IS NOT NULL AND v_new_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta', 'message', 'New tach_end must be >= tach_start');
    END IF;
    IF v_new_airswitch_delta IS NOT NULL AND v_new_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta', 'message', 'New airswitch_end must be >= airswitch_start');
    END IF;

    v_new_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_new_hobbs_delta, v_new_tach_delta);
    v_correction_delta := v_new_applied_delta - v_old_applied_delta;

    v_aircraft_old_ttis := v_aircraft.total_time_in_service;
    v_aircraft_new_ttis := v_aircraft_old_ttis + v_correction_delta;

    IF v_aircraft_new_ttis < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid correction', 'message', 'Correction would result in negative aircraft TTIS');
    END IF;

    -- Apply correction to aircraft TTIS (delta-of-deltas)
    UPDATE public.aircraft
    SET total_time_in_service = v_aircraft_new_ttis
    WHERE id = v_booking.checked_out_aircraft_id;

    -- Update booking (time-only correction + metadata)
    v_booking_new_total_hours_end := COALESCE(v_booking.total_hours_end, 0) + v_correction_delta;

    UPDATE public.bookings
    SET
      hobbs_end = p_hobbs_end,
      tach_end = p_tach_end,
      airswitch_end = p_airswitch_end,

      flight_time_hobbs = v_new_hobbs_delta,
      flight_time_tach = v_new_tach_delta,
      flight_time_airswitch = v_new_airswitch_delta,

      applied_aircraft_delta = v_new_applied_delta,
      correction_delta = v_correction_delta,
      corrected_at = now(),
      corrected_by = v_actor,
      correction_reason = p_correction_reason,

      total_hours_end = v_booking_new_total_hours_end
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'old_applied_delta', v_old_applied_delta,
      'new_applied_delta', v_new_applied_delta,
      'correction_delta', v_correction_delta,
      'aircraft_total_time_in_service', v_aircraft_new_ttis,
      'message', 'Booking TTIS correction applied atomically'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'message', 'Atomic TTIS correction rolled back due to error'
      );
  END;
END;
$$;


