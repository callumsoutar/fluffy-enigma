import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTenantContext } from "@/lib/auth/tenant"
import { bookingOverlapsQuerySchema } from "@/lib/validation/bookings"

type BookingOverlapsResponse = {
  unavailable_aircraft_ids: string[]
  unavailable_instructor_ids: string[]
}

/**
 * GET /api/bookings/overlaps
 *
 * Returns unavailable resource IDs (aircraft / instructors) for a proposed time range.
 *
 * Important:
 * - We authenticate using the user session (so unauthenticated callers are rejected).
 * - We query using the admin client to ensure we detect true resource conflicts even if
 *   the caller cannot view other users' bookings under RLS.
 * - We return only IDs (no booking details) to avoid leaking sensitive booking information.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  try {
    await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const queryParams: Record<string, string | undefined> = {}
  for (const [key, value] of searchParams.entries()) {
    queryParams[key] = value
  }

  const parsed = bookingOverlapsQuerySchema.safeParse(queryParams)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { start_time, end_time, exclude_booking_id } = parsed.data

  const admin = createAdminClient()

  let q = admin
    .from("bookings")
    .select("id, aircraft_id, instructor_id")
    // Ignore cancelled bookings for availability purposes
    .is("cancelled_at", null)
    .neq("status", "cancelled")
    // Overlap logic: existing.start < new.end AND existing.end > new.start
    .lt("start_time", end_time)
    .gt("end_time", start_time)

  if (exclude_booking_id) {
    q = q.neq("id", exclude_booking_id)
  }

  const { data, error } = await q

  if (error) {
    console.error("Error fetching booking overlaps:", error)
    return NextResponse.json({ error: "Failed to fetch overlaps" }, { status: 500 })
  }

  const unavailableAircraftIds = new Set<string>()
  const unavailableInstructorIds = new Set<string>()

  for (const row of data ?? []) {
    if (row.aircraft_id) unavailableAircraftIds.add(row.aircraft_id)
    if (row.instructor_id) unavailableInstructorIds.add(row.instructor_id)
  }

  const payload: BookingOverlapsResponse = {
    unavailable_aircraft_ids: Array.from(unavailableAircraftIds),
    unavailable_instructor_ids: Array.from(unavailableInstructorIds),
  }

  return NextResponse.json(payload)
}


