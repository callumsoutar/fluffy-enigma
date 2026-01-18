import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { memberIdSchema } from '@/lib/validation/members'
import type { MemberFlightHistoryEntry } from '@/lib/types/flight-history'

/**
 * GET /api/members/[id]/flight-history
 *
 * Returns completed bookings for a member that have a non-null flight_time.
 *
 * Security:
 * - Requires authentication
 * - Requires owner/admin/instructor role (same access pattern as member detail)
 * - RLS still enforces final data access
 */
export async function GET(
  _request: NextRequest,
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
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
  }

  const { id: memberId } = await params
  const idValidation = memberIdSchema.safeParse(memberId)
  if (!idValidation.success) {
    return NextResponse.json({ error: 'Invalid member ID format' }, { status: 400 })
  }

  // Pull booking rows directly (flight_logs are legacy and no longer used).
  // Use checked_out_aircraft_id and checked_out_instructor_id for actual flight data.
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      start_time,
      end_time,
      status,
      purpose,
      flight_time,
      aircraft:aircraft!checked_out_aircraft_id (
        id,
        registration
      ),
      instructor:instructors!checked_out_instructor_id (
        id,
        user_id,
        first_name,
        last_name
      ),
      flight_type:flight_types (
        id,
        name
      ),
      lesson:lessons (
        id,
        name
      )
    `)
    .eq('user_id', memberId)
    .eq('status', 'complete')
    .not('flight_time', 'is', null)
    .order('end_time', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('Error fetching member flight history:', error)
    return NextResponse.json({ error: 'Failed to fetch flight history' }, { status: 500 })
  }

  // Supabase relationship selects sometimes type as arrays; normalize to the expected single-object shape.
  type BookingRow = {
    id: string
    user_id: string | null
    start_time: string
    end_time: string
    status: string
    purpose: string
    flight_time: number | null
    aircraft?: Array<{ id: string; registration: string | null }> | { id: string; registration: string | null } | null
    instructor?: Array<{ id: string; first_name: string | null; last_name: string | null }> | { id: string; first_name: string | null; last_name: string | null } | null
    flight_type?: Array<{ id: string; name: string }> | { id: string; name: string } | null
    lesson?: Array<{ id: string; name: string }> | { id: string; name: string } | null
  }
  
  const flights: MemberFlightHistoryEntry[] = (data || []).map((row: BookingRow) => ({
    ...row,
    aircraft: Array.isArray(row?.aircraft) ? (row.aircraft[0] ?? null) : (row.aircraft ?? null),
    instructor: Array.isArray(row?.instructor) ? (row.instructor[0] ?? null) : (row.instructor ?? null),
    flight_type: Array.isArray(row?.flight_type) ? (row.flight_type[0] ?? null) : (row.flight_type ?? null),
    lesson: Array.isArray(row?.lesson) ? (row.lesson[0] ?? null) : (row.lesson ?? null),
  }))

  return NextResponse.json({
    flights,
    total: flights.length,
  })
}


