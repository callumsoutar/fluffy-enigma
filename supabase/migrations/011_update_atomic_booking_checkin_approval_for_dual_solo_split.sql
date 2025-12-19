-- Migration: Extend atomic booking check-in approval for dual/solo split
--
-- Purpose:
-- - Persist dual_time/solo_time deterministically at approval time
-- - Persist solo_end_* meter reading relevant to billing basis
-- - Keep audit integrity: approval is a "save" and must not rely on prior draft saves

-- Update immutability guard to include the new solo_end_tach field and time split fields.
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
    NEW.checkin_approved_by IS DISTINCT FROM OLD.checkin_approved_by OR
    NEW.solo_end_hobbs IS DISTINCT FROM OLD.solo_end_hobbs OR
    NEW.solo_end_tach IS DISTINCT FROM OLD.solo_end_tach OR
    NEW.dual_time IS DISTINCT FROM OLD.dual_time OR
    NEW.solo_time IS DISTINCT FROM OLD.solo_time
  ) THEN
    RAISE EXCEPTION 'Booking check-in is approved and immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the atomic approval function with an extended signature.
DROP FUNCTION IF EXISTS public.approve_booking_checkin_atomic(
  uuid, uuid, uuid, uuid,
  timestamptz, timestamptz,
  numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric,
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

  p_flight_time_hobbs numeric,
  p_flight_time_tach numeric,
  p_flight_time_airswitch numeric,

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
  v_invoice_result jsonb;
  v_invoice_id uuid;
  v_invoice_number text;
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

    -- Persist final check-in state and lock it
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

      flight_time_hobbs = p_flight_time_hobbs,
      flight_time_tach = p_flight_time_tach,
      flight_time_airswitch = p_flight_time_airswitch,

      billing_basis = p_billing_basis,
      billing_hours = p_billing_hours,
      flight_time = p_billing_hours,

      checkin_invoice_id = v_invoice_id,
      checkin_approved_at = now(),
      checkin_approved_by = v_actor
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'message', 'Booking check-in approved and invoice created atomically'
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

