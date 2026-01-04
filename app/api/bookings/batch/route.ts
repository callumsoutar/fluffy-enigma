import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { bookingCreateSchema } from '@/lib/validation/bookings'
import type { BookingWithRelations } from '@/lib/types/bookings'
import { z } from 'zod'

const batchBookingCreateSchema = z.object({
  bookings: z.array(bookingCreateSchema).min(1).max(50), // Limit to 50 for safety
})

/**
 * POST /api/bookings/batch
 *
 * Create multiple bookings in a single action.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isStaff = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = batchBookingCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request data', details: parsed.error.issues }, { status: 400 })
  }

  const { bookings } = parsed.data

  // Perform basic validations and prepare payloads
  const payloads = []
  for (const data of bookings) {
    // Privilege checks
    if (!isStaff && data.user_id && data.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Cannot create booking for another user' }, { status: 403 })
    }
    if (!isStaff && data.status && data.status !== 'unconfirmed') {
      return NextResponse.json({ error: 'Forbidden: Only staff can set booking status' }, { status: 403 })
    }

    const userIdForBooking = isStaff ? (data.user_id ?? user.id) : user.id
    const statusForBooking = isStaff ? (data.status ?? 'unconfirmed') : 'unconfirmed'

    // If an instructor is provided, ensure they're rostered on for this proposed time range.
    // (UI filters this, but enforce server-side for integrity.)
    if (data.instructor_id) {
      const start = new Date(data.start_time)
      const end = new Date(data.end_time)
      const yyyy = start.getFullYear()
      const mm = String(start.getMonth() + 1).padStart(2, '0')
      const dd = String(start.getDate()).padStart(2, '0')
      const bookingDate = `${yyyy}-${mm}-${dd}`
      const dow = start.getDay()
      const startHHmm = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
      const endHHmm = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`

      const { data: rosterRule, error: rosterErr } = await supabase
        .from('roster_rules')
        .select('id')
        .eq('instructor_id', data.instructor_id)
        .eq('day_of_week', dow)
        .eq('is_active', true)
        .is('voided_at', null)
        .lte('effective_from', bookingDate)
        .or(`effective_until.gte.${bookingDate},effective_until.is.null`)
        .lte('start_time', startHHmm)
        .gte('end_time', endHHmm)
        .limit(1)
        .maybeSingle()

      if (rosterErr) {
        console.error('Error checking instructor roster rules (batch):', rosterErr)
        return NextResponse.json({ error: 'Failed to verify instructor roster rules' }, { status: 500 })
      }
      if (!rosterRule) {
        return NextResponse.json({ error: 'One or more bookings use an instructor who is not rostered on for that time range' }, { status: 400 })
      }
    }

    payloads.push({
      aircraft_id: data.aircraft_id,
      user_id: userIdForBooking,
      instructor_id: data.instructor_id ?? null,
      flight_type_id: data.flight_type_id ?? null,
      lesson_id: data.lesson_id ?? null,
      booking_type: data.booking_type,
      status: statusForBooking,
      start_time: data.start_time,
      end_time: data.end_time,
      purpose: data.purpose,
      remarks: data.remarks ?? null,
      notes: data.notes ?? null,
    })
  }

  // Use a transaction or multi-insert
  // Note: Supabase JS client's .insert() with an array is a single multi-row INSERT statement.
  // Postgres will fail the whole statement if any constraint (like RLS or exclusion) is violated.
  const { data: inserted, error } = await supabase
    .from('bookings')
    .insert(payloads)
    .select(`
      *,
      aircraft:aircraft_id (id, registration, type, model, manufacturer),
      student:user_id (id, first_name, last_name, email),
      instructor:instructors!instructor_id (
        id, first_name, last_name,
        user:user_id (id, email)
      ),
      flight_type:flight_type_id (id, name),
      lesson:lesson_id (id, name, description)
    `)

  if (error) {
    console.error('Error creating batch bookings:', error)
    // If it's a conflict error, return a friendly message
    if (error.code === '23P01') {
      return NextResponse.json({ error: 'One or more bookings conflict with existing schedules.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Failed to create bookings' }, { status: 500 })
  }

  return NextResponse.json({ bookings: inserted as BookingWithRelations[] }, { status: 201 })
}

