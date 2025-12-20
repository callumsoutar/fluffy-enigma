import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { bookingIdSchema } from '@/lib/validation/bookings'
import { z } from 'zod'

function isRpcSuccess(v: unknown): v is { success: true } {
  if (typeof v !== 'object' || v === null) return false
  if (!('success' in v)) return false
  return (v as Record<string, unknown>).success === true
}

const correctCheckinSchema = z.object({
  hobbs_end: z.coerce.number().min(0).optional().nullable(),
  tach_end: z.coerce.number().min(0).optional().nullable(),
  airswitch_end: z.coerce.number().min(0).optional().nullable(),
  correction_reason: z.string().min(3).max(1000),
}).strict()

/**
 * POST /api/bookings/[id]/checkin/correct
 *
 * Applies a TTIS correction for an already-approved booking check-in by applying the
 * delta-of-deltas (new_applied_delta - old_applied_delta) to aircraft.total_time_in_service,
 * transactionally and server-side.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
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

  const bodyValidation = correctCheckinSchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  const payload = bodyValidation.data

  const { data: rpcResult, error: rpcError } = await supabase.rpc('correct_booking_checkin_ttis_atomic', {
    p_booking_id: bookingId,
    p_hobbs_end: payload.hobbs_end ?? null,
    p_tach_end: payload.tach_end ?? null,
    p_airswitch_end: payload.airswitch_end ?? null,
    p_correction_reason: payload.correction_reason,
  })

  if (rpcError || !isRpcSuccess(rpcResult)) {
    console.error('Error applying TTIS correction atomically:', rpcError, rpcResult)
    const message = typeof (rpcResult as Record<string, unknown> | null)?.error === 'string'
      ? String((rpcResult as Record<string, unknown>).error)
      : (rpcError?.message || 'Failed to apply correction')
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ result: rpcResult }, { status: 200 })
}


