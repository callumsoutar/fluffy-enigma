import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { bookingCreateSchema, bookingsQuerySchema } from '@/lib/validation/bookings'
import type { BookingStatus, BookingType, BookingsFilter, BookingWithRelations } from '@/lib/types/bookings'
import { dayOfWeekFromYyyyMmDd, getZonedYyyyMmDdAndHHmm } from '@/lib/utils/timezone'
import { getSchoolConfigServer } from '@/lib/utils/school-config'

/**
 * GET /api/bookings
 * 
 * Fetch bookings with optional filters
 * Requires authentication and tenant membership
 * 
 * Security:
 * - All tenant members can access (RLS enforces tenant isolation)
 * - Users can only filter by their own user_id unless admin/instructor
 * - Instructors can only filter by their own instructor_id unless admin
 * - RLS policies enforce final data access and tenant boundaries
 */
export async function GET(request: NextRequest) {
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
  // Check if user is admin/instructor (can query any user's bookings within tenant)
  const isAdminOrInstructor = ['owner', 'admin', 'instructor'].includes(userRole)

  // Validate user_id filter - users can only filter by their own user_id unless admin/instructor
  // Instructors and admins can see all bookings within their tenant (no user_id filter restriction)
  if (filters.user_id) {
    if (!isAdminOrInstructor && filters.user_id !== currentUserId) {
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
      filters.user_id = currentUserId
    }
    // Instructors and admins: filters.user_id remains undefined, allowing all bookings
  }

  // Validate instructor_id filter - instructors can only filter by their own instructor_id unless admin
  if (filters.instructor_id) {
    const isAdmin = ['owner', 'admin'].includes(userRole)
    if (!isAdmin) {
      // Check if the current user has an instructor record and if it matches the filter
      const { data: instructor } = await supabase
        .from('instructors')
        .select('id')
        .eq('user_id', currentUserId)
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

/**
 * POST /api/bookings
 *
 * Create a new booking.
 *
 * Security:
 * - Requires authentication and tenant membership
 * - Members/students can only create bookings for themselves (user_id forced)
 * - Only staff (owner/admin/instructor) can create on behalf of others and set non-default status
 * - RLS policies enforce final write access and tenant boundaries
 * - tenant_id is automatically set via database default
 */
export async function POST(request: NextRequest) {
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
  const isStaff = ['owner', 'admin', 'instructor'].includes(userRole)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const parsed = bookingCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Enforce privilege rules
  if (!isStaff && data.user_id !== undefined && data.user_id !== null && data.user_id !== currentUserId) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot create booking for another user' },
      { status: 403 }
    )
  }
  if (!isStaff && data.status && data.status !== 'unconfirmed') {
    return NextResponse.json(
      { error: 'Forbidden: Only staff can set booking status' },
      { status: 403 }
    )
  }

  const userIdForBooking = isStaff ? (data.user_id ?? currentUserId) : currentUserId
  const statusForBooking = isStaff ? (data.status ?? 'unconfirmed') : 'unconfirmed'

  // Lightweight referential checks (RLS/constraints are still authoritative)
  // Ensure aircraft exists and is on-line
  const { data: aircraftRow, error: aircraftErr } = await supabase
    .from('aircraft')
    .select('id, on_line')
    .eq('id', data.aircraft_id)
    .single()

  if (aircraftErr || !aircraftRow) {
    return NextResponse.json({ error: 'Invalid aircraft' }, { status: 400 })
  }
  if (aircraftRow.on_line === false) {
    return NextResponse.json({ error: 'Aircraft is not available for booking' }, { status: 400 })
  }

  // Ensure user exists + active when staff creates on behalf of another user
  if (isStaff && userIdForBooking !== currentUserId) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('id', userIdForBooking)
      .single()
    if (!userRow) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    }
    if (userRow.is_active === false) {
      return NextResponse.json({ error: 'User is inactive' }, { status: 400 })
    }
  }

  // Ensure instructor exists + actively instructing if provided
  if (data.instructor_id) {
    const { data: instructorRow } = await supabase
      .from('instructors')
      .select('id, is_actively_instructing')
      .eq('id', data.instructor_id)
      .single()
    if (!instructorRow) {
      return NextResponse.json({ error: 'Invalid instructor' }, { status: 400 })
    }
    if (instructorRow.is_actively_instructing === false) {
      return NextResponse.json({ error: 'Instructor is not actively instructing' }, { status: 400 })
    }

    // Ensure instructor is rostered on for the proposed time range
    // (UI filters this, but we must enforce it server-side to prevent stale selections / direct API calls)
    const start = new Date(data.start_time)
    const end = new Date(data.end_time)
    const { timeZone: tz } = await getSchoolConfigServer(tenantContext.tenantId)

    // Convert UTC instants into school-local calendar date + wall-clock time.
    // This is DST-safe and avoids server-local timezone bugs.
    const startLocal = getZonedYyyyMmDdAndHHmm(start, tz)
    const endLocal = getZonedYyyyMmDdAndHHmm(end, tz)

    // This roster rule validation only supports bookings within a single school-local calendar date.
    // If cross-midnight bookings are required later, this should be expanded to split the interval and validate both days.
    if (startLocal.yyyyMmDd !== endLocal.yyyyMmDd) {
      return NextResponse.json(
        { error: 'Instructor roster rules cannot be validated for bookings spanning midnight (local time)' },
        { status: 400 }
      )
    }

    const bookingDate = startLocal.yyyyMmDd
    const dow = dayOfWeekFromYyyyMmDd(bookingDate)
    const startHHmm = startLocal.hhmm
    const endHHmm = endLocal.hhmm

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
      console.error('Error checking instructor roster rules:', rosterErr)
      return NextResponse.json({ error: 'Failed to verify instructor roster rules' }, { status: 500 })
    }
    if (!rosterRule) {
      return NextResponse.json({ error: 'Instructor is not rostered on for this time range' }, { status: 400 })
    }
  }

  // Create booking
  const insertPayload = {
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
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert(insertPayload)
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
      ),
      lesson:lesson_id (
        id,
        name,
        description
      )
    `)
    .single()

  if (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  return NextResponse.json({ booking: booking as BookingWithRelations }, { status: 201 })
}
