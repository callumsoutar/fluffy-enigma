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

  // Fetch booking with all relations
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
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
      ),
      flight_type:flight_type_id (
        id,
        name
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
      ),
      flight_type:flight_type_id (
        id,
        name
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
