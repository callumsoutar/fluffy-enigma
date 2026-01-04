import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { userHasAnyRole } from "@/lib/auth/roles"
import { bookingsQuerySchema } from "@/lib/validation/bookings"
import type { BookingStatus, BookingType, SchedulerBookingsResponse, SchedulerBookingWithRelations } from "@/lib/types/bookings"

/**
 * GET /api/bookings/scheduler
 *
 * Scheduler-friendly bookings feed:
 * - Staff (owner/admin/instructor): can see all bookings (minimal fields).
 * - Member/student: can see all booking *slots* but only:
 *   - student name (if assigned)
 *   - instructor name
 *   - purpose ONLY for own bookings OR unassigned bookings (user_id is null)
 *
 * Notes:
 * - Uses the service_role client to bypass bookings RLS, then applies strict output masking.
 * - This endpoint is intentionally narrow: it returns only what the scheduler needs.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate query params (reuse existing schema for date parsing/validation)
  const searchParams = request.nextUrl.searchParams
  const queryParams: Record<string, string | undefined> = {}
  for (const [key, value] of searchParams.entries()) {
    queryParams[key] = value
  }

  const parsed = bookingsQuerySchema.safeParse(queryParams)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const start_date = parsed.data.start_date
  const end_date = parsed.data.end_date

  if (!start_date || !end_date) {
    return NextResponse.json(
      { error: "start_date and end_date are required" },
      { status: 400 }
    )
  }

  const isStaff = await userHasAnyRole(user.id, ["owner", "admin", "instructor"])

  // Fetch bookings for the scheduler date range using service_role (bypass bookings RLS).
  // We deliberately select only minimal fields required by the scheduler UI.
  const admin = createAdminClient()

  const query = admin
    .from("bookings")
    .select(
      `
      id,
      aircraft_id,
      user_id,
      instructor_id,
      start_time,
      end_time,
      status,
      booking_type,
      purpose,
      cancelled_at,
      aircraft:aircraft_id (
        id,
        registration,
        type,
        model,
        manufacturer
      ),
      student:user_id (
        id,
        first_name,
        last_name,
        email
      ),
      instructor:instructors!instructor_id (
        id,
        first_name,
        last_name,
        user:user_id (
          id,
          email
        )
      )
    `
    )
    .gte("start_time", start_date)
    .lte("end_time", end_date)
    .neq("status", "cancelled")
    .is("cancelled_at", null)
    .order("start_time", { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error("Error fetching scheduler bookings:", error)
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 })
  }

  const bookings = ((data ?? []) as unknown as SchedulerBookingWithRelations[]).map((b) => {
    if (isStaff) return b

    const isOwn = b.user_id === user.id
    const isUnassigned = b.user_id === null
    const isOtherPersonsBooking = !isOwn && !isUnassigned

    return {
      ...b,
      // Members/students: only show purpose for own bookings OR unassigned bookings
      purpose: isOwn || isUnassigned ? (b.purpose ?? null) : null,
      // Members/students: do not expose email addresses for other people's bookings
      student: b.student
        ? {
            ...b.student,
            email: isOtherPersonsBooking ? null : b.student.email,
          }
        : b.student,
      instructor: b.instructor
        ? {
            ...b.instructor,
            user: b.instructor.user
              ? {
                  ...b.instructor.user,
                  email: isOtherPersonsBooking ? null : b.instructor.user.email,
                }
              : b.instructor.user,
          }
        : b.instructor,
      // Make it hard to accidentally expand this endpoint into a full booking detail feed:
      // explicitly strip fields that might exist on the base type in future.
      notes: null,
      remarks: null,
      description: null,
    } as SchedulerBookingWithRelations
  })

  const response: SchedulerBookingsResponse = {
    bookings: bookings.map((b) => ({
      ...b,
      status: b.status as BookingStatus,
      booking_type: b.booking_type as BookingType,
    })),
    total: bookings.length,
  }

  return NextResponse.json(response)
}


