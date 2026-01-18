import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { invoiceIdSchema, invoicePaymentCreateSchema } from '@/lib/validation/invoices'
import type { InvoiceWithRelations } from '@/lib/types/invoices'

function isRpcSuccess(v: unknown): v is { success: true } {
  if (typeof v !== 'object' || v === null) return false
  if (!('success' in v)) return false
  return (v as Record<string, unknown>).success === true
}

function getRpcErrorMessage(v: unknown): string | null {
  if (typeof v !== 'object' || v === null) return null
  if (!('error' in v)) return null
  const value = (v as Record<string, unknown>).error
  if (value === null || value === undefined) return null
  return String(value)
}

function mapRpcErrorToStatus(message: string): number {
  const msg = message.toLowerCase()
  if (msg.includes('unauthorized')) return 401
  if (msg.includes('forbidden') || msg.includes('insufficient permissions')) return 403
  if (msg.includes('not found')) return 404
  if (
    msg.includes('invalid') ||
    msg.includes('overpayment') ||
    msg.includes('already paid') ||
    msg.includes('cannot') ||
    msg.includes('remaining balance')
  ) return 400
  return 500
}

/**
 * POST /api/invoices/[id]/payments
 *
 * Record a payment for an invoice.
 *
 * Security:
 * - Requires authentication and tenant membership
 * - Staff-only (owner/admin/instructor)
 * - Uses a SECURITY DEFINER Postgres RPC to ensure atomicity:
 *   inserts invoice_payments + transactions + updates invoice totals/status in one DB transaction.
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

  const { userRole } = tenantContext

  const { id: invoiceId } = await params

  const idValidation = invoiceIdSchema.safeParse(invoiceId)
  if (!idValidation.success) {
    return NextResponse.json({ error: 'Invalid invoice ID format' }, { status: 400 })
  }

  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const validation = invoicePaymentCreateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: validation.error.issues },
      { status: 400 }
    )
  }

  const data = validation.data

  const { data: rpcResult, error: rpcError } = await supabase.rpc('record_invoice_payment_atomic', {
    p_invoice_id: invoiceId,
    p_amount: data.amount,
    p_payment_method: data.payment_method,
    p_payment_reference: data.payment_reference || null,
    p_notes: data.notes || null,
    p_paid_at: data.paid_at || null,
  })

  if (rpcError || !isRpcSuccess(rpcResult)) {
    console.error('Error recording invoice payment:', rpcError, rpcResult)
    const rpcMessage = getRpcErrorMessage(rpcResult)
    const message = rpcMessage || rpcError?.message || 'Failed to record payment'
    return NextResponse.json({ error: message }, { status: mapRpcErrorToStatus(message) })
  }

  // Fetch updated invoice for immediate UI refresh
  const { data: updatedInvoice, error: fetchError } = await supabase
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

  if (fetchError || !updatedInvoice) {
    return NextResponse.json(
      {
        success: true,
        result: rpcResult,
      },
      { status: 201 }
    )
  }

  return NextResponse.json(
    {
      success: true,
      result: rpcResult,
      invoice: updatedInvoice as InvoiceWithRelations,
    },
    { status: 201 }
  )
}
