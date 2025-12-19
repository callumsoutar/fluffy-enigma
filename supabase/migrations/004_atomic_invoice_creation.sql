-- Atomic invoice creation (invoice + items + transaction) in a single DB transaction
--
-- Goals:
-- - Prevent partial writes: invoice, invoice_items, and associated transaction(s) must succeed/fail as one unit
-- - Server-side integrity: compute derived monetary fields in Postgres, not client trust
-- - Auditability: create a ledger/audit transaction for draft creation; create invoice debit on approval
--
-- Notes:
-- - This migration is written to be idempotent (CREATE OR REPLACE, IF NOT EXISTS where possible)

-- Enforce one active invoice per booking (application also checks, but DB must enforce to prevent races)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_unique_active_booking_id
  ON public.invoices (booking_id)
  WHERE booking_id IS NOT NULL AND deleted_at IS NULL;

-- Atomic create: invoice record + invoice items + (audit or debit) transaction, all-or-nothing.
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

    -- Insert items and compute derived monetary fields in Postgres (never trust client totals)
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
      round((r.quantity * r.unit_price)::numeric, 2) AS amount,
      COALESCE(r.tax_rate, v_tax_rate) AS tax_rate,
      round(round((r.quantity * r.unit_price)::numeric, 2) * COALESCE(r.tax_rate, v_tax_rate), 2) AS tax_amount,
      round((r.unit_price * (1 + COALESCE(r.tax_rate, v_tax_rate)))::numeric, 2) AS rate_inclusive,
      round(
        round((r.quantity * r.unit_price)::numeric, 2)
        + round(round((r.quantity * r.unit_price)::numeric, 2) * COALESCE(r.tax_rate, v_tax_rate), 2),
        2
      ) AS line_total,
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

-- SECURITY: transactions table must not be writable by anon users.
-- Replace the overly permissive policy with role-aware policies.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_manage ON public.transactions;

-- Allow staff to manage (insert/update/delete) transactions.
CREATE POLICY transactions_manage
  ON public.transactions
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (
    check_user_role_simple((SELECT auth.uid() AS uid), ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role])
  )
  WITH CHECK (
    check_user_role_simple((SELECT auth.uid() AS uid), ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role])
  );

-- Allow users to SELECT their own transactions (audit visibility), plus staff visibility.
DROP POLICY IF EXISTS transactions_select ON public.transactions;
CREATE POLICY transactions_select
  ON public.transactions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    (user_id = (SELECT auth.uid() AS uid))
    OR check_user_role_simple((SELECT auth.uid() AS uid), ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role])
  );

