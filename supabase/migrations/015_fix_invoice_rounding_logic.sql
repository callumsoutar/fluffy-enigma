-- Fix invoice rounding logic to calculate from tax-inclusive rate first
--
-- Problem: When rounding tax-exclusive amount first, then calculating tax, 
-- the final total can differ from the expected tax-inclusive rate by $0.01
--
-- Example with rate 269.5652173913044 at 15% tax:
-- OLD METHOD:
--   amount = round(269.57, 2) = 269.57
--   tax = round(269.57 * 0.15, 2) = 40.44
--   total = 269.57 + 40.44 = 310.01 ❌
--
-- NEW METHOD:
--   rate_inclusive = round(269.5652173913044 * 1.15, 2) = 310.00
--   line_total = round(1.0 * 310.00, 2) = 310.00
--   amount = round(310.00 / 1.15, 2) = 269.57
--   tax = round(310.00 - 269.57, 2) = 40.43
--   total = 269.57 + 40.43 = 310.00 ✅
--
-- This ensures the line_total always matches the tax-inclusive rate that users see.

CREATE OR REPLACE FUNCTION public.create_invoice_atomic(
  p_user_id uuid,
  p_booking_id uuid DEFAULT NULL,
  p_status text DEFAULT 'draft',
  p_invoice_number text DEFAULT NULL,
  p_tax_rate numeric DEFAULT NULL,
  p_issue_date timestamp with time zone DEFAULT now(),
  p_due_date timestamp with time zone DEFAULT NULL,
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
  v_invoice_id uuid;
  v_invoice_number text;
  v_issue_date timestamptz;
  v_due_date timestamptz;
  v_tax_rate numeric;
  v_total_amount numeric;
  v_totals_result jsonb;
  v_status_result jsonb;
  v_transaction_id uuid;
BEGIN
  -- Wrap everything in a subtransaction; any error rolls back all writes
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

    -- AuthZ: only staff roles can create invoices
    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Forbidden',
        'message', 'Insufficient permissions to create invoices'
      );
    END IF;

    -- Validate status: this creation flow supports draft and pending only
    IF p_status NOT IN ('draft', 'pending') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid status',
        'message', 'Only draft or pending status is allowed at creation time'
      );
    END IF;

    -- Validate items: must be a non-empty array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Missing invoice items',
        'message', 'Invoice must include at least one item'
      );
    END IF;

    -- Normalize and validate dates and tax rate
    v_issue_date := COALESCE(p_issue_date, now());
    v_due_date := COALESCE(p_due_date, v_issue_date + interval '30 days');
    v_tax_rate := COALESCE(p_tax_rate, 0.15);

    IF v_tax_rate < 0 OR v_tax_rate > 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid tax_rate',
        'message', 'tax_rate must be between 0 and 1'
      );
    END IF;

    -- Generate invoice number if not provided
    v_invoice_number := COALESCE(p_invoice_number, generate_invoice_number_app());

    -- Insert invoice as DRAFT first (so non-admin instructors can still insert items; item triggers block inserts to approved invoices)
    INSERT INTO public.invoices (
      user_id,
      booking_id,
      status,
      invoice_number,
      issue_date,
      due_date,
      reference,
      notes,
      tax_rate,
      subtotal,
      tax_total,
      total_amount,
      total_paid,
      balance_due
    ) VALUES (
      p_user_id,
      p_booking_id,
      'draft'::invoice_status,
      v_invoice_number,
      v_issue_date,
      v_due_date,
      p_reference,
      p_notes,
      v_tax_rate,
      0,
      0,
      0,
      0,
      0
    )
    RETURNING id INTO v_invoice_id;

    -- Insert items with IMPROVED ROUNDING LOGIC:
    -- Calculate from tax-inclusive rate first to ensure line_total matches user expectations
    INSERT INTO public.invoice_items (
      invoice_id,
      chargeable_id,
      description,
      quantity,
      unit_price,
      amount,
      tax_rate,
      tax_amount,
      rate_inclusive,
      line_total,
      notes
    )
    SELECT
      v_invoice_id,
      r.chargeable_id,
      r.description,
      r.quantity,
      r.unit_price,
      -- Step 3: Back-calculate amount from line_total
      round((round((r.quantity * round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2))::numeric, 2) / (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2) AS amount,
      COALESCE(r.tax_rate, v_tax_rate) AS tax_rate,
      -- Step 4: Calculate tax as difference (line_total - amount)
      round(
        round((r.quantity * round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2))::numeric, 2) -
        round((round((r.quantity * round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2))::numeric, 2) / (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2),
        2
      ) AS tax_amount,
      -- Step 1: Calculate tax-inclusive rate (what users see)
      round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2) AS rate_inclusive,
      -- Step 2: Calculate line_total from rate_inclusive
      round((r.quantity * round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2))::numeric, 2) AS line_total,
      r.notes
    FROM jsonb_to_recordset(p_items) AS r(
      chargeable_id uuid,
      description text,
      quantity numeric,
      unit_price numeric,
      tax_rate numeric,
      notes text
    );

    -- Recalculate invoice totals (SECURITY DEFINER; allowed by invoice immutability trigger)
    v_totals_result := public.update_invoice_totals_atomic(v_invoice_id);
    IF (v_totals_result->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'Totals update failed: %', COALESCE(v_totals_result->>'error', 'unknown error');
    END IF;

    -- Ensure non-zero total (transactions table disallows amount = 0)
    SELECT total_amount INTO v_total_amount
    FROM public.invoices
    WHERE id = v_invoice_id;

    IF v_total_amount IS NULL OR v_total_amount <= 0 THEN
      RAISE EXCEPTION 'Invoice total must be greater than zero';
    END IF;

    -- Create associated transaction(s)
    IF p_status = 'draft' THEN
      -- Audit trail: draft invoice created (non-financial event). Use adjustment type.
      INSERT INTO public.transactions (
        user_id,
        type,
        status,
        amount,
        description,
        metadata,
        completed_at
      ) VALUES (
        p_user_id,
        'adjustment'::transaction_type,
        'completed'::transaction_status,
        v_total_amount,
        'Draft invoice created: ' || v_invoice_number,
        jsonb_build_object(
          'invoice_id', v_invoice_id,
          'invoice_number', v_invoice_number,
          'booking_id', p_booking_id,
          'transaction_type', 'invoice_created',
          'created_by', v_actor
        ),
        now()
      )
      RETURNING id INTO v_transaction_id;

      -- Keep invoice in draft
      RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'status', 'draft',
        'total_amount', v_total_amount,
        'transaction_id', v_transaction_id,
        'transaction_kind', 'invoice_created',
        'message', 'Invoice, items, and audit transaction created atomically'
      );
    END IF;

    -- p_status = 'pending': approve invoice and create the financial debit transaction atomically
    v_status_result := public.update_invoice_status_atomic(v_invoice_id, 'pending');
    IF (v_status_result->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'Status update failed: %', COALESCE(v_status_result->>'error', 'unknown error');
    END IF;

    v_transaction_id := NULLIF(v_status_result->>'transaction_id', '')::uuid;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'status', 'pending',
      'total_amount', v_total_amount,
      'transaction_id', v_transaction_id,
      'transaction_kind', 'invoice_debit',
      'message', 'Invoice, items, totals, and debit transaction created atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- All writes in this block are rolled back automatically (subtransaction rollback).
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'message', 'Atomic invoice creation rolled back due to error'
      );
  END;
END;
$$;

