import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { bookingIdSchema, bookingUpdateSchema } from '@/lib/validation/bookings'
import type { BookingWithRelations } from '@/lib/types/bookings'

/**
 * GET /api/bookings/[id]
 * 
 * Fetch a single booking by ID
 * Requires authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id: bookingId } = await params

  // Validate booking ID format
  const idValidation = bookingIdSchema.safeParse(bookingId)
  if (!idValidation.success) {
    return NextResponse.json(
      { error: 'Invalid booking ID format' },
      { status: 400 }
    )
  }

  // Fetch booking with all relations (including flight log fields)
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
      aircraft:aircraft_id (
        id,
        registration,
        type,
        model,
        manufacturer,
        record_hobbs,
        record_tacho,
        record_airswitch
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
      ),
      flight_type:flight_type_id (
        id,
        name,
        instruction_type
      ),
      lesson:lesson_id (
        id,
        name,
        description
      ),
      checked_out_aircraft:checked_out_aircraft_id (
        id,
        registration,
        type,
        model,
        manufacturer,
        record_hobbs,
        record_tacho,
        record_airswitch
      ),
      checked_out_instructor:instructors!bookings_checked_out_instructor_id_fkey (
        id,
        first_name,
        last_name,
        user_id,
        user:users!instructors_user_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      )
    `)
    .eq('id', bookingId)
    .single()

  if (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    )
  }

  // Security: Check if user can access this booking
  // Check permissions before revealing if booking exists (prevent information leakage)
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  const bookingData = booking as BookingWithRelations

  // Users can only access their own bookings unless admin/instructor
  // Also check if user is the assigned instructor
  const canAccess = isAdminOrInstructor || 
                    bookingData.user_id === user.id ||
                    bookingData.instructor_id === user.id

  if (!booking || !canAccess) {
    // Return generic "not found" to prevent information leakage
    return NextResponse.json(
      { error: 'Booking not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ booking: bookingData })
}

/**
 * PATCH /api/bookings/[id]
 * 
 * Update a booking
 * Requires authentication and appropriate permissions
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id: bookingId } = await params

  // Validate booking ID format
  const idValidation = bookingIdSchema.safeParse(bookingId)
  if (!idValidation.success) {
    return NextResponse.json(
      { error: 'Invalid booking ID format' },
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

  const bodyValidation = bookingUpdateSchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  // Use validated data
  body = bodyValidation.data

  // First, check if booking exists and user has access
  const { data: existingBooking, error: fetchError } = await supabase
    .from('bookings')
    .select('user_id, instructor_id, status')
    .eq('id', bookingId)
    .single()

  if (fetchError || !existingBooking) {
    return NextResponse.json(
      { error: 'Booking not found' },
      { status: 404 }
    )
  }

  // Check permissions
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  const canEdit = isAdminOrInstructor || 
                  existingBooking.user_id === user.id ||
                  existingBooking.instructor_id === user.id

  if (!canEdit) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot edit this booking' },
      { status: 403 }
    )
  }

  // Financially critical: flight log + billing fields must only be editable by staff.
  // Prevent members/students from tampering with meter readings, flight times, or billing basis.
  const hasCheckinOrBillingFields =
    body.checked_out_aircraft_id !== undefined ||
    body.checked_out_instructor_id !== undefined ||
    body.actual_start !== undefined ||
    body.actual_end !== undefined ||
    body.eta !== undefined ||
    body.hobbs_start !== undefined ||
    body.hobbs_end !== undefined ||
    body.tach_start !== undefined ||
    body.tach_end !== undefined ||
    body.airswitch_start !== undefined ||
    body.airswitch_end !== undefined ||
    body.flight_time_hobbs !== undefined ||
    body.flight_time_tach !== undefined ||
    body.flight_time_airswitch !== undefined ||
    body.flight_time !== undefined ||
    body.billing_basis !== undefined ||
    body.billing_hours !== undefined ||
    body.fuel_on_board !== undefined ||
    body.passengers !== undefined ||
    body.route !== undefined ||
    body.equipment !== undefined ||
    body.briefing_completed !== undefined ||
    body.authorization_completed !== undefined ||
    body.flight_remarks !== undefined ||
    body.solo_end_hobbs !== undefined ||
    body.solo_end_tach !== undefined ||
    body.dual_time !== undefined ||
    body.solo_time !== undefined ||
    body.total_hours_start !== undefined ||
    body.total_hours_end !== undefined

  if (hasCheckinOrBillingFields && !isAdminOrInstructor) {
    return NextResponse.json(
      { error: 'Forbidden: Only staff can update check-in/flight log fields' },
      { status: 403 }
    )
  }

  // Prepare update data (only allow specific fields to be updated)
  const updateData: Record<string, unknown> = {}
  
  if (body.start_time !== undefined) updateData.start_time = body.start_time
  if (body.end_time !== undefined) updateData.end_time = body.end_time
  if (body.aircraft_id !== undefined) updateData.aircraft_id = body.aircraft_id
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
  if (body.instructor_id !== undefined) {
    // Only admins/instructors can change instructor_id
    if (!isAdminOrInstructor) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot change instructor_id' },
        { status: 403 }
      )
    }
    updateData.instructor_id = body.instructor_id
  }
  if (body.flight_type_id !== undefined) updateData.flight_type_id = body.flight_type_id
  if (body.lesson_id !== undefined) updateData.lesson_id = body.lesson_id
  if (body.status !== undefined) {
    // Only admins/instructors can change status
    if (!isAdminOrInstructor) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot change status' },
        { status: 403 }
      )
    }
    updateData.status = body.status
  }
  if (body.booking_type !== undefined) updateData.booking_type = body.booking_type
  if (body.purpose !== undefined) updateData.purpose = body.purpose
  if (body.remarks !== undefined) updateData.remarks = body.remarks
  if (body.notes !== undefined) updateData.notes = body.notes
  
  // Flight log fields (consolidated from flight_logs table)
  if (body.checked_out_aircraft_id !== undefined) updateData.checked_out_aircraft_id = body.checked_out_aircraft_id
  if (body.checked_out_instructor_id !== undefined) updateData.checked_out_instructor_id = body.checked_out_instructor_id
  if (body.actual_start !== undefined) updateData.actual_start = body.actual_start
  if (body.actual_end !== undefined) updateData.actual_end = body.actual_end
  if (body.eta !== undefined) updateData.eta = body.eta
  if (body.hobbs_start !== undefined) updateData.hobbs_start = body.hobbs_start
  if (body.hobbs_end !== undefined) updateData.hobbs_end = body.hobbs_end
  if (body.tach_start !== undefined) updateData.tach_start = body.tach_start
  if (body.tach_end !== undefined) updateData.tach_end = body.tach_end
  if (body.airswitch_start !== undefined) updateData.airswitch_start = body.airswitch_start
  if (body.airswitch_end !== undefined) updateData.airswitch_end = body.airswitch_end
  if (body.flight_time_hobbs !== undefined) updateData.flight_time_hobbs = body.flight_time_hobbs
  if (body.flight_time_tach !== undefined) updateData.flight_time_tach = body.flight_time_tach
  if (body.flight_time_airswitch !== undefined) updateData.flight_time_airswitch = body.flight_time_airswitch
  if (body.flight_time !== undefined) updateData.flight_time = body.flight_time
  if (body.billing_basis !== undefined) updateData.billing_basis = body.billing_basis
  if (body.billing_hours !== undefined) updateData.billing_hours = body.billing_hours
  if (body.fuel_on_board !== undefined) updateData.fuel_on_board = body.fuel_on_board
  if (body.passengers !== undefined) updateData.passengers = body.passengers
  if (body.route !== undefined) updateData.route = body.route
  if (body.equipment !== undefined) updateData.equipment = body.equipment
  if (body.briefing_completed !== undefined) updateData.briefing_completed = body.briefing_completed
  if (body.authorization_completed !== undefined) updateData.authorization_completed = body.authorization_completed
  if (body.flight_remarks !== undefined) updateData.flight_remarks = body.flight_remarks
  if (body.solo_end_hobbs !== undefined) updateData.solo_end_hobbs = body.solo_end_hobbs
  if (body.solo_end_tach !== undefined) updateData.solo_end_tach = body.solo_end_tach
  if (body.dual_time !== undefined) updateData.dual_time = body.dual_time
  if (body.solo_time !== undefined) updateData.solo_time = body.solo_time
  if (body.total_hours_start !== undefined) updateData.total_hours_start = body.total_hours_start
  if (body.total_hours_end !== undefined) updateData.total_hours_end = body.total_hours_end

  // Update booking
  const { data: updatedBooking, error: updateError } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', bookingId)
    .select(`
      *,
      aircraft:aircraft_id (
        id,
        registration,
        type,
        model,
        manufacturer,
        record_hobbs,
        record_tacho,
        record_airswitch
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
      ),
      flight_type:flight_type_id (
        id,
        name,
        instruction_type
      ),
      lesson:lesson_id (
        id,
        name,
        description
      ),
      checked_out_aircraft:checked_out_aircraft_id (
        id,
        registration,
        type,
        model,
        manufacturer,
        record_hobbs,
        record_tacho,
        record_airswitch
      ),
      checked_out_instructor:instructors!bookings_checked_out_instructor_id_fkey (
        id,
        first_name,
        last_name,
        user_id,
        user:users!instructors_user_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      )
    `)
    .single()

  if (updateError) {
    console.error('Error updating booking:', updateError)
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    )
  }

  return NextResponse.json({ booking: updatedBooking as BookingWithRelations })
}
