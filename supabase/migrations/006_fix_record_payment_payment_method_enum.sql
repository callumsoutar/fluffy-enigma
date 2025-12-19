-- Fix record_invoice_payment_atomic: write enum payment_method to invoices.payment_method
--
-- invoices.payment_method is a USER-DEFINED enum (payment_method). The original function
-- incorrectly cast p_payment_method to text when updating invoices.

CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method payment_method,
  p_payment_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_invoice_user_id uuid;
  v_invoice_number text;
  v_invoice_status invoice_status;
  v_total_amount numeric;
  v_total_paid numeric;
  v_balance_due numeric;
  v_new_total_paid numeric;
  v_new_balance_due numeric;
  v_transaction_id uuid;
  v_payment_id uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized',
        'message', 'Authentication required'
      );
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Forbidden',
        'message', 'Insufficient permissions to record payments'
      );
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid amount',
        'message', 'Payment amount must be greater than zero'
      );
    END IF;

    SELECT
      i.user_id,
      i.invoice_number,
      i.status,
      COALESCE(i.total_amount, 0),
      COALESCE(i.total_paid, 0),
      COALESCE(i.balance_due, GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.total_paid, 0)))
    INTO
      v_invoice_user_id,
      v_invoice_number,
      v_invoice_status,
      v_total_amount,
      v_total_paid,
      v_balance_due
    FROM public.invoices i
    WHERE i.id = p_invoice_id
      AND i.deleted_at IS NULL
    FOR UPDATE;

    IF v_invoice_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Not found',
        'message', 'Invoice not found'
      );
    END IF;

    IF v_invoice_status IN ('cancelled', 'refunded') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid invoice status',
        'message', 'Cannot record payments for cancelled or refunded invoices'
      );
    END IF;

    IF v_balance_due <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Already paid',
        'message', 'Invoice has no remaining balance'
      );
    END IF;

    IF p_amount > v_balance_due THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Overpayment',
        'message', 'Payment amount cannot exceed the remaining balance',
        'balance_due', v_balance_due
      );
    END IF;

    v_new_total_paid := round(v_total_paid + p_amount, 2);
    v_new_balance_due := round(GREATEST(0, v_total_amount - v_new_total_paid), 2);

    INSERT INTO public.transactions (
      user_id,
      type,
      status,
      amount,
      description,
      metadata,
      completed_at
    ) VALUES (
      v_invoice_user_id,
      'adjustment'::transaction_type,
      'completed'::transaction_status,
      round(p_amount, 2),
      'Invoice payment received: ' || COALESCE(v_invoice_number, p_invoice_id::text),
      jsonb_build_object(
        'invoice_id', p_invoice_id,
        'invoice_number', v_invoice_number,
        'transaction_type', 'invoice_payment',
        'payment_method', p_payment_method::text,
        'payment_reference', p_payment_reference,
        'created_by', v_actor
      ),
      COALESCE(p_paid_at, now())
    )
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.invoice_payments (
      invoice_id,
      user_id,
      amount,
      payment_method,
      payment_reference,
      notes,
      paid_at,
      transaction_id,
      created_by
    ) VALUES (
      p_invoice_id,
      v_invoice_user_id,
      round(p_amount, 2),
      p_payment_method,
      p_payment_reference,
      p_notes,
      COALESCE(p_paid_at, now()),
      v_transaction_id,
      v_actor
    )
    RETURNING id INTO v_payment_id;

    UPDATE public.invoices
    SET
      total_paid = v_new_total_paid,
      balance_due = v_new_balance_due,
      payment_method = p_payment_method,
      payment_reference = p_payment_reference,
      paid_date = CASE WHEN v_new_balance_due <= 0 THEN COALESCE(p_paid_at, now()) ELSE paid_date END,
      status = CASE WHEN v_new_balance_due <= 0 THEN 'paid'::invoice_status ELSE status END,
      updated_at = now()
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'payment_id', v_payment_id,
      'transaction_id', v_transaction_id,
      'new_total_paid', v_new_total_paid,
      'new_balance_due', v_new_balance_due,
      'new_status', CASE WHEN v_new_balance_due <= 0 THEN 'paid' ELSE v_invoice_status::text END,
      'message', 'Payment recorded atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'message', 'Atomic payment recording rolled back due to error'
      );
  END;
END;
$$;
