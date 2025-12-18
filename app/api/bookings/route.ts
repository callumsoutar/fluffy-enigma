import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { bookingsQuerySchema } from '@/lib/validation/bookings'
import type { BookingStatus, BookingType, BookingsFilter, BookingWithRelations } from '@/lib/types/bookings'

/**
 * GET /api/bookings
 * 
 * Fetch bookings with optional filters
 * Requires authentication
 * 
 * Security:
 * - All authenticated users can access (bookings are user-owned)
 * - Users can only filter by their own user_id unless admin/instructor
 * - Instructors can only filter by their own instructor_id unless admin
 * - RLS policies enforce final data access
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Get and validate query parameters
  const searchParams = request.nextUrl.searchParams
  
  // Build query object from URL params
  const queryParams: Record<string, string | undefined> = {}
  for (const [key, value] of searchParams.entries()) {
    queryParams[key] = value
  }

  // Validate query parameters
  const validationResult = bookingsQuerySchema.safeParse(queryParams)
  
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validationResult.error.issues },
      { status: 400 }
    )
  }

  const filters: BookingsFilter = {
    status: validationResult.data.status as BookingStatus[] | undefined,
    booking_type: validationResult.data.booking_type as BookingType[] | undefined,
    aircraft_id: validationResult.data.aircraft_id,
    instructor_id: validationResult.data.instructor_id,
    user_id: validationResult.data.user_id,
    search: validationResult.data.search,
    start_date: validationResult.data.start_date,
    end_date: validationResult.data.end_date,
  }

  // Security: Validate filter parameters to prevent unauthorized data access
  // Check if user is admin/instructor (can query any user's bookings)
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])

  // Validate user_id filter - users can only filter by their own user_id unless admin/instructor
  // Instructors and admins can see all bookings (no user_id filter restriction)
  if (filters.user_id) {
    if (!isAdminOrInstructor && filters.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot query other users\' bookings' },
        { status: 403 }
      )
    }
  } else {
    // If no user_id filter specified:
    // - Regular users (students/members) default to own bookings only
    // - Instructors/admins can see all bookings (no filter applied)
    if (!isAdminOrInstructor) {
      filters.user_id = user.id
    }
    // Instructors and admins: filters.user_id remains undefined, allowing all bookings
  }

  // Validate instructor_id filter - instructors can only filter by their own instructor_id unless admin
  if (filters.instructor_id) {
    const isAdmin = await userHasAnyRole(user.id, ['owner', 'admin'])
    if (!isAdmin) {
      // Check if the current user has an instructor record and if it matches the filter
      const { data: instructor } = await supabase
        .from('instructors')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_actively_instructing', true)
        .single()
      
      // If user is not an instructor, or their instructor_id doesn't match, deny access
      if (!instructor || instructor.id !== filters.instructor_id) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot query other instructors\' bookings' },
          { status: 403 }
        )
      }
    }
  }

  // Build query
  let query = supabase
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
    .order('start_time', { ascending: true })

  // Apply filters
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }

  if (filters.booking_type && filters.booking_type.length > 0) {
    query = query.in('booking_type', filters.booking_type)
  }

  if (filters.aircraft_id) {
    query = query.eq('aircraft_id', filters.aircraft_id)
  }

  if (filters.instructor_id) {
    query = query.eq('instructor_id', filters.instructor_id)
  }

  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id)
  }

  if (filters.start_date) {
    query = query.gte('start_time', filters.start_date)
  }

  if (filters.end_date) {
    query = query.lte('end_time', filters.end_date)
  }

  // Execute query (RLS will filter based on user permissions)
  const { data: bookings, error } = await query

  if (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }

  // Apply search filter in memory (since we need to search across joined relations)
  let filteredBookings = (bookings || []) as BookingWithRelations[]

  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredBookings = filteredBookings.filter((booking) => {
      const aircraftMatch = booking.aircraft?.registration?.toLowerCase().includes(searchLower) ||
                           booking.aircraft?.type?.toLowerCase().includes(searchLower) ||
                           booking.aircraft?.model?.toLowerCase().includes(searchLower)
      
      const studentMatch = booking.student?.first_name?.toLowerCase().includes(searchLower) ||
                          booking.student?.last_name?.toLowerCase().includes(searchLower) ||
                          booking.student?.email?.toLowerCase().includes(searchLower)
      
      const instructorMatch = booking.instructor?.first_name?.toLowerCase().includes(searchLower) ||
                             booking.instructor?.last_name?.toLowerCase().includes(searchLower) ||
                             booking.instructor?.user?.email?.toLowerCase().includes(searchLower)

      return aircraftMatch || studentMatch || instructorMatch
    })
  }

  return NextResponse.json({
    bookings: filteredBookings,
    total: filteredBookings.length,
  })
}
