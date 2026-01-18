import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { bookingIdSchema, bookingCheckinApproveSchema } from '@/lib/validation/bookings'
import type { InvoiceWithRelations } from '@/lib/types/invoices'
import { calculateInvoiceTotals, calculateItemAmounts } from '@/lib/invoice-calculations'

function isRpcSuccess(v: unknown): v is { success: true } {
  if (typeof v !== 'object' || v === null) return false
  if (!('success' in v)) return false
  return (v as Record<string, unknown>).success === true
}

/**
 * POST /api/bookings/[id]/checkin/approve
 *
 * Approves a booking check-in and atomically:
 * - Creates an invoice (pending)
 * - Creates all invoice items
 * - Persists booking check-in fields + locks them (immutability)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: 'Forbidden: No tenant membership' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 })
  }

  const { userId: currentUserId, userRole } = tenantContext
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const { id: bookingId } = await params
  const idValidation = bookingIdSchema.safeParse(bookingId)
  if (!idValidation.success) {
    return NextResponse.json({ error: 'Invalid booking ID format' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const bodyValidation = bookingCheckinApproveSchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  const payload = bodyValidation.data

  // If a draft invoice already exists for this booking (created during "Save Draft Check-In"),
  // we approve using that invoice (draft -> pending) instead of creating a new one.
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, booking_type, status, checkin_invoice_id, checkin_approved_at, lesson_id, instructor_id')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.booking_type !== 'flight') {
    return NextResponse.json({ error: 'Check-in approval is only valid for flight bookings' }, { status: 400 })
  }

  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot approve check-in for cancelled bookings' }, { status: 400 })
  }

  if (booking.checkin_approved_at) {
    return NextResponse.json({ error: 'Booking check-in has already been approved' }, { status: 400 })
  }

  // No draft invoice exists yet → fall back to the fully atomic path (creates invoice + items).
  if (!booking.checkin_invoice_id) {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('approve_booking_checkin_atomic', {
      p_booking_id: bookingId,
      p_checked_out_aircraft_id: payload.checked_out_aircraft_id,
      p_checked_out_instructor_id: payload.checked_out_instructor_id ?? null,
      p_flight_type_id: payload.flight_type_id,

      p_hobbs_start: payload.hobbs_start,
      p_hobbs_end: payload.hobbs_end,
      p_tach_start: payload.tach_start,
      p_tach_end: payload.tach_end,
      p_airswitch_start: payload.airswitch_start,
      p_airswitch_end: payload.airswitch_end,

      p_solo_end_hobbs: payload.solo_end_hobbs ?? null,
      p_solo_end_tach: payload.solo_end_tach ?? null,
      p_dual_time: payload.dual_time ?? null,
      p_solo_time: payload.solo_time ?? null,

      p_billing_basis: payload.billing_basis,
      p_billing_hours: payload.billing_hours,

      p_tax_rate: payload.tax_rate ?? null,
      p_due_date: payload.due_date ?? null,
      p_reference: payload.reference ?? null,
      p_notes: payload.notes ?? null,
      p_items: payload.items,
    })

    if (rpcError || !isRpcSuccess(rpcResult)) {
      console.error('Error approving booking check-in atomically:', rpcError, rpcResult)
      const message = typeof (rpcResult as Record<string, unknown> | null)?.error === 'string'
        ? String((rpcResult as Record<string, unknown>).error)
        : (rpcError?.message || 'Failed to approve check-in')
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const result = rpcResult as unknown as { invoice_id?: string }
    if (!result?.invoice_id) {
      return NextResponse.json({ error: 'Check-in approved but missing invoice_id' }, { status: 500 })
    }

    // Upsert lesson progress if any debrief data is provided
    const hasDebriefData = payload.instructor_comments ||
                          payload.lesson_highlights || 
                          payload.areas_for_improvement || 
                          payload.airmanship || 
                          payload.focus_next_lesson || 
                          payload.safety_concerns || 
                          payload.weather_conditions || 
                          payload.lesson_status;

    if (hasDebriefData) {
      const { data: existingProgress } = await supabase
        .from('lesson_progress')
        .select('id')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const progressData = {
        booking_id: bookingId,
        user_id: booking.user_id,
        lesson_id: booking.lesson_id,
        instructor_id: payload.checked_out_instructor_id || booking.instructor_id,
        instructor_comments: payload.instructor_comments,
        lesson_highlights: payload.lesson_highlights,
        areas_for_improvement: payload.areas_for_improvement,
        airmanship: payload.airmanship,
        focus_next_lesson: payload.focus_next_lesson,
        safety_concerns: payload.safety_concerns,
        weather_conditions: payload.weather_conditions,
        status: payload.lesson_status,
        date: new Date().toISOString(),
      };

      if (existingProgress) {
        await supabase
          .from('lesson_progress')
          .update(progressData)
          .eq('id', existingProgress.id);
      } else {
        await supabase
          .from('lesson_progress')
          .insert(progressData);
      }
    }

    // Fetch the created invoice with relations (reuse invoice route selection shape)
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        user:user_id (
          id,
          first_name,
          last_name,
          email
        ),
        booking:booking_id (
          id,
          start_time,
          end_time,
          status
        )
      `)
      .eq('id', result.invoice_id)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json(
        { error: 'Check-in approved but failed to fetch created invoice' },
        { status: 500 }
      )
    }

    return NextResponse.json({ invoice: invoice as InvoiceWithRelations }, { status: 201 })
  }

  // Draft invoice exists → replace the auto-generated time items with payload.items and approve invoice.
  const invoiceId = booking.checkin_invoice_id as string

  const nowIso = new Date().toISOString()

  const { data: invoiceRow, error: invoiceRowError } = await supabase
    .from('invoices')
    .select('id, status, tax_rate, total_paid')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single()

  if (invoiceRowError || !invoiceRow) {
    return NextResponse.json({ error: 'Linked invoice not found' }, { status: 404 })
  }

  // Idempotency safety: if the invoice is already pending but the booking isn't locked yet,
  // complete the booking lock step without trying to mutate invoice items/status again.
  if (invoiceRow.status === 'pending') {
    const { data: finalizeResult, error: finalizeError } = await supabase.rpc('finalize_booking_checkin_with_invoice_atomic', {
      p_booking_id: bookingId,
      p_invoice_id: invoiceId,
      p_checked_out_aircraft_id: payload.checked_out_aircraft_id,
      p_checked_out_instructor_id: payload.checked_out_instructor_id ?? null,
      p_flight_type_id: payload.flight_type_id,

      p_hobbs_start: payload.hobbs_start,
      p_hobbs_end: payload.hobbs_end,
      p_tach_start: payload.tach_start,
      p_tach_end: payload.tach_end,
      p_airswitch_start: payload.airswitch_start,
      p_airswitch_end: payload.airswitch_end,

      p_solo_end_hobbs: payload.solo_end_hobbs ?? null,
      p_solo_end_tach: payload.solo_end_tach ?? null,
      p_dual_time: payload.dual_time ?? null,
      p_solo_time: payload.solo_time ?? null,

      p_billing_basis: payload.billing_basis,
      p_billing_hours: payload.billing_hours,
    })

    if (finalizeError || !isRpcSuccess(finalizeResult)) {
      console.error('Invoice already pending but failed to finalize booking check-in (atomic):', finalizeError, finalizeResult)
      return NextResponse.json({ error: 'Invoice already approved but failed to lock booking check-in' }, { status: 500 })
    }

    const { data: approvedInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        user:user_id (
          id,
          first_name,
          last_name,
          email
        ),
        booking:booking_id (
          id,
          start_time,
          end_time,
          status
        )
      `)
      .eq('id', invoiceId)
      .single()

    if (fetchError || !approvedInvoice) {
      return NextResponse.json(
        { error: 'Check-in approved but failed to fetch approved invoice' },
        { status: 500 }
      )
    }

    return NextResponse.json({ invoice: approvedInvoice as InvoiceWithRelations }, { status: 201 })
  }

  if (invoiceRow.status !== 'draft') {
    return NextResponse.json({ error: 'Cannot approve: linked invoice is not a draft' }, { status: 400 })
  }

  // Replace only the auto-generated time items (keep any manual items intact)
  const { error: softDeleteError } = await supabase
    .from('invoice_items')
    .update({ deleted_at: nowIso, deleted_by: currentUserId })
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
    .or('description.ilike.Aircraft Hire (%,description.ilike.Instructor Rate -%')

  if (softDeleteError) {
    console.error('Failed to soft-delete existing auto-generated time items:', softDeleteError)
    return NextResponse.json({ error: 'Failed to update invoice items before approval' }, { status: 500 })
  }

  const defaultTaxRate = payload.tax_rate ?? invoiceRow.tax_rate ?? 0.15
  const itemsToInsert = payload.items.map((i) => {
    const taxRate = i.tax_rate ?? defaultTaxRate
    const calculated = calculateItemAmounts({
      quantity: i.quantity,
      unit_price: i.unit_price,
      tax_rate: taxRate,
    })
    return {
      invoice_id: invoiceId,
      chargeable_id: i.chargeable_id ?? null,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      amount: calculated.amount,
      tax_rate: taxRate,
      tax_amount: calculated.tax_amount,
      rate_inclusive: calculated.rate_inclusive,
      line_total: calculated.line_total,
      notes: i.notes ?? null,
    }
  })

  const { error: insertError } = await supabase
    .from('invoice_items')
    .insert(itemsToInsert)

  if (insertError) {
    console.error('Failed to insert updated time items before approval:', insertError)
    return NextResponse.json({ error: 'Failed to update invoice items before approval' }, { status: 500 })
  }

  const { data: allItems, error: allItemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)

  if (allItemsError) {
    console.error('Failed to fetch invoice items for totals:', allItemsError)
    return NextResponse.json({ error: 'Failed to recalculate invoice totals before approval' }, { status: 500 })
  }

  const totals = calculateInvoiceTotals(allItems || [])
  const { error: updateInvoiceError } = await supabase
    .from('invoices')
    .update({
      tax_rate: defaultTaxRate,
      due_date: payload.due_date ?? undefined,
      reference: payload.reference ?? undefined,
      notes: payload.notes ?? undefined,
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      total_amount: totals.total_amount,
      balance_due: totals.total_amount - (invoiceRow.total_paid || 0),
    })
    .eq('id', invoiceId)

  if (updateInvoiceError) {
    console.error('Failed to update invoice totals before approval:', updateInvoiceError)
    return NextResponse.json({ error: 'Failed to recalculate invoice totals before approval' }, { status: 500 })
  }

  const { data: totalsRpcResult, error: totalsRpcError } = await supabase.rpc('update_invoice_totals_atomic', {
    p_invoice_id: invoiceId,
  })

  if (totalsRpcError || !isRpcSuccess(totalsRpcResult)) {
    console.error('Error recalculating invoice totals (RPC) before approval:', totalsRpcError, totalsRpcResult)
    return NextResponse.json({ error: 'Failed to recalculate invoice totals before approval' }, { status: 500 })
  }

  const { data: statusResult, error: statusError } = await supabase.rpc('update_invoice_status_atomic', {
    p_invoice_id: invoiceId,
    p_new_status: 'pending',
  })

  if (statusError || !isRpcSuccess(statusResult)) {
    console.error('Error approving invoice via atomic status RPC:', statusError, statusResult)
    return NextResponse.json({ error: 'Failed to approve invoice' }, { status: 500 })
  }

  // Persist final check-in state and lock it + apply TTIS (atomic)
  const { data: finalizeResult, error: finalizeError } = await supabase.rpc('finalize_booking_checkin_with_invoice_atomic', {
    p_booking_id: bookingId,
    p_invoice_id: invoiceId,
    p_checked_out_aircraft_id: payload.checked_out_aircraft_id,
    p_checked_out_instructor_id: payload.checked_out_instructor_id ?? null,
    p_flight_type_id: payload.flight_type_id,

    p_hobbs_start: payload.hobbs_start,
    p_hobbs_end: payload.hobbs_end,
    p_tach_start: payload.tach_start,
    p_tach_end: payload.tach_end,
    p_airswitch_start: payload.airswitch_start,
    p_airswitch_end: payload.airswitch_end,

    p_solo_end_hobbs: payload.solo_end_hobbs ?? null,
    p_solo_end_tach: payload.solo_end_tach ?? null,
    p_dual_time: payload.dual_time ?? null,
    p_solo_time: payload.solo_time ?? null,

    p_billing_basis: payload.billing_basis,
    p_billing_hours: payload.billing_hours,
  })

  if (finalizeError || !isRpcSuccess(finalizeResult)) {
    console.error('Invoice approved but failed to finalize booking check-in (atomic):', finalizeError, finalizeResult)
    return NextResponse.json({ error: 'Invoice approved but failed to lock booking check-in' }, { status: 500 })
  }

  // Upsert lesson progress if any debrief data is provided
  const hasDebriefData = payload.instructor_comments ||
                        payload.lesson_highlights || 
                        payload.areas_for_improvement || 
                        payload.airmanship || 
                        payload.focus_next_lesson || 
                        payload.safety_concerns || 
                        payload.weather_conditions || 
                        payload.lesson_status;

  if (hasDebriefData) {
    const { data: existingProgress } = await supabase
      .from('lesson_progress')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();

    const progressData = {
      booking_id: bookingId,
      user_id: booking.user_id,
      lesson_id: booking.lesson_id,
      instructor_id: payload.checked_out_instructor_id || booking.instructor_id,
      instructor_comments: payload.instructor_comments,
      lesson_highlights: payload.lesson_highlights,
      areas_for_improvement: payload.areas_for_improvement,
      airmanship: payload.airmanship,
      focus_next_lesson: payload.focus_next_lesson,
      safety_concerns: payload.safety_concerns,
      weather_conditions: payload.weather_conditions,
      status: payload.lesson_status,
      date: new Date().toISOString(),
    };

    if (existingProgress) {
      await supabase
        .from('lesson_progress')
        .update(progressData)
        .eq('id', existingProgress.id);
    } else {
      await supabase
        .from('lesson_progress')
        .insert(progressData);
    }
  }

  // Fetch the approved invoice with relations
  const { data: approvedInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select(`
      *,
      user:user_id (
        id,
        first_name,
        last_name,
        email
      ),
      booking:booking_id (
        id,
        start_time,
        end_time,
        status
      )
    `)
    .eq('id', invoiceId)
    .single()

  if (fetchError || !approvedInvoice) {
    return NextResponse.json(
      { error: 'Check-in approved but failed to fetch approved invoice' },
      { status: 500 }
    )
  }

  return NextResponse.json({ invoice: approvedInvoice as InvoiceWithRelations }, { status: 201 })

}
