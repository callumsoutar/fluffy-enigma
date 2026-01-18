import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { invoiceIdSchema, invoiceUpdateSchema } from '@/lib/validation/invoices'
import type { InvoiceWithRelations } from '@/lib/types/invoices'
import { calculateInvoiceTotals, roundToTwoDecimals } from '@/lib/invoice-calculations'

function isRpcSuccess(v: unknown): v is { success: true } {
  if (typeof v !== 'object' || v === null) return false
  if (!('success' in v)) return false
  return (v as Record<string, unknown>).success === true
}

/**
 * GET /api/invoices/[id]
 * 
 * Fetch a single invoice by ID
 * Requires authentication and tenant membership
 */
export async function GET(
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

  const { id: invoiceId } = await params

  // Validate invoice ID format
  const idValidation = invoiceIdSchema.safeParse(invoiceId)
  if (!idValidation.success) {
    return NextResponse.json(
      { error: 'Invalid invoice ID format' },
      { status: 400 }
    )
  }

  // Fetch invoice with relations
  const { data: invoice, error } = await supabase
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
    .is('deleted_at', null)
    .single()

  if (error) {
    // PGRST116 from `.single()` typically means 0 rows (or multiple rows).
    // Since `id` is unique, treat this as "not found" (often due to RLS).
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }

  // Security: Check if user can access this invoice
  const isAdminOrInstructor = ['owner', 'admin', 'instructor'].includes(userRole)
  const invoiceData = invoice as InvoiceWithRelations

  // Users can only access their own invoices unless admin/instructor
  const canAccess = isAdminOrInstructor || invoiceData.user_id === currentUserId

  if (!invoice || !canAccess) {
    // Return generic "not found" to prevent information leakage
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ invoice: invoiceData })
}

/**
 * PATCH /api/invoices/[id]
 * 
 * Update an invoice
 * Requires authentication, tenant membership, and appropriate permissions
 * Only draft invoices can be updated
 */
export async function PATCH(
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

  const { id: invoiceId } = await params

  // Validate invoice ID format
  const idValidation = invoiceIdSchema.safeParse(invoiceId)
  if (!idValidation.success) {
    return NextResponse.json(
      { error: 'Invalid invoice ID format' },
      { status: 400 }
    )
  }

  // Validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }

  const bodyValidation = invoiceUpdateSchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  // Use validated data
  body = bodyValidation.data

  // First, check if invoice exists and user has access
  const { data: existingInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select('user_id, status, total_paid')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existingInvoice) {
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )
  }

  // Check permissions
  const isAdminOrInstructor = ['owner', 'admin', 'instructor'].includes(userRole)
  const canEdit = isAdminOrInstructor || existingInvoice.user_id === currentUserId

  if (!canEdit) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot edit this invoice' },
      { status: 403 }
    )
  }

  // Only allow updates to draft invoices
  if (existingInvoice.status !== 'draft') {
    return NextResponse.json(
      { error: 'Cannot edit invoice: Only draft invoices can be modified' },
      { status: 400 }
    )
  }

  // If status is being changed, validate the transition
  if (body.status !== undefined && body.status !== 'draft') {
    // Only allow changing from draft to pending (approve)
    if (body.status !== 'pending') {
      return NextResponse.json(
        { error: 'Invalid status transition: Can only approve (draft -> pending) or keep as draft' },
        { status: 400 }
      )
    }
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {}
  const isApproving = body.status === 'pending'
  
  if (body.user_id !== undefined) {
    // Only admins/instructors can change user_id
    if (!isAdminOrInstructor) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot change user_id' },
        { status: 403 }
      )
    }
    updateData.user_id = body.user_id
  }
  // IMPORTANT: approval (draft -> pending) must go through `update_invoice_status_atomic`
  // so that the associated debit transaction is created atomically.
  if (body.status !== undefined && !isApproving) updateData.status = body.status
  if (body.invoice_number !== undefined) updateData.invoice_number = body.invoice_number
  if (body.issue_date !== undefined) updateData.issue_date = body.issue_date
  if (body.due_date !== undefined) updateData.due_date = body.due_date
  if (body.paid_date !== undefined) updateData.paid_date = body.paid_date
  if (body.reference !== undefined) updateData.reference = body.reference
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.booking_id !== undefined) updateData.booking_id = body.booking_id
  if (body.tax_rate !== undefined) updateData.tax_rate = body.tax_rate
  if (body.payment_method !== undefined) updateData.payment_method = body.payment_method
  if (body.payment_reference !== undefined) updateData.payment_reference = body.payment_reference
  // Never trust client-provided financial totals; for approval we recalc server-side via RPC.
  if (!isApproving) {
    if (body.subtotal !== undefined) updateData.subtotal = body.subtotal
    if (body.tax_total !== undefined) updateData.tax_total = body.tax_total
    if (body.total_amount !== undefined) updateData.total_amount = body.total_amount
  }
  if (body.total_paid !== undefined) updateData.total_paid = body.total_paid
  if (body.balance_due !== undefined) updateData.balance_due = body.balance_due

  const hasNonStatusUpdates = Object.keys(updateData).length > 0

  // If financial fields are being updated, recalculate totals from items
  if (!isApproving && (body.subtotal !== undefined || body.tax_total !== undefined || body.total_amount !== undefined)) {
    // Fetch current items to recalculate
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)

    if (items && items.length > 0) {
      const totals = calculateInvoiceTotals(items)
      updateData.subtotal = totals.subtotal
      updateData.tax_total = totals.tax_total
      updateData.total_amount = totals.total_amount
      updateData.balance_due = roundToTwoDecimals(totals.total_amount - (existingInvoice.total_paid || 0))
    }
  }

  // IMPORTANT:
  // - For approval, status changes must go through `update_invoice_status_atomic`.
  // - If the request only contains { status: 'pending' }, then updateData is empty.
  //   Calling .update({}) returns 0 rows, and `.single()` raises PGRST116.
  //   So we skip the normal update in that case and proceed directly to RPC.
  let updatedInvoice: unknown | null = null
  if (!isApproving) {
    if (!hasNonStatusUpdates) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400 }
      )
    }
  }

  if (hasNonStatusUpdates) {
    const { data: updated, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .is('deleted_at', null)
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
      .single()

    if (updateError) {
      // Treat "0 rows" as not found (can happen if deleted concurrently or blocked by RLS)
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        )
      }
      console.error('Error updating invoice:', updateError)
      return NextResponse.json(
        { error: 'Failed to update invoice' },
        { status: 500 }
      )
    }

    updatedInvoice = updated
  }

  // If approving, recalculate totals and then approve via atomic status RPC (creates debit transaction)
  if (isApproving) {
    const { data: totalsResult, error: totalsError } = await supabase.rpc('update_invoice_totals_atomic', {
      p_invoice_id: invoiceId,
    })

    if (totalsError || !isRpcSuccess(totalsResult)) {
      console.error('Error recalculating invoice totals:', totalsError, totalsResult)
      return NextResponse.json(
        { error: 'Failed to recalculate invoice totals before approval' },
        { status: 500 }
      )
    }

    const { data: statusResult, error: statusError } = await supabase.rpc('update_invoice_status_atomic', {
      p_invoice_id: invoiceId,
      p_new_status: 'pending',
    })

    if (statusError || !isRpcSuccess(statusResult)) {
      console.error('Error approving invoice:', statusError, statusResult)
      return NextResponse.json(
        { error: 'Failed to approve invoice' },
        { status: 500 }
      )
    }

    // Fetch and return the updated invoice post-approval
    const { data: approvedInvoice, error: approvedFetchError } = await supabase
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
      .is('deleted_at', null)
      .single()

    if (approvedFetchError || !approvedInvoice) {
      return NextResponse.json(
        { error: 'Invoice approved but failed to fetch updated invoice' },
        { status: 500 }
      )
    }

    return NextResponse.json({ invoice: approvedInvoice as InvoiceWithRelations })
  }

  return NextResponse.json({ invoice: updatedInvoice as InvoiceWithRelations })
}

/**
 * DELETE /api/invoices/[id]
 * 
 * Soft delete an invoice
 * Requires authentication and owner/admin role
 * Only draft invoices can be deleted
 */
export async function DELETE(
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

  const { id: invoiceId } = await params

  // Validate invoice ID format
  const idValidation = invoiceIdSchema.safeParse(invoiceId)
  if (!idValidation.success) {
    return NextResponse.json(
      { error: 'Invalid invoice ID format' },
      { status: 400 }
    )
  }

  // Check authorization - only owners and admins can delete invoices
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole)
  if (!isOwnerOrAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get request body for deletion reason (optional)
  let deletionReason: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    deletionReason = body.deletion_reason || null
  } catch {
    // No body provided, that's fine
  }

  // Check if invoice exists and get its status
  const { data: existingInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existingInvoice) {
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )
  }

  // Only allow deletion of draft invoices
  if (existingInvoice.status !== 'draft') {
    return NextResponse.json(
      { error: 'Cannot delete invoice: Only draft invoices can be deleted' },
      { status: 400 }
    )
  }

  // Soft delete invoice
  const { error: deleteError } = await supabase
    .from('invoices')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: currentUserId,
      deletion_reason: deletionReason,
    })
    .eq('id', invoiceId)

  if (deleteError) {
    console.error('Error deleting invoice:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
