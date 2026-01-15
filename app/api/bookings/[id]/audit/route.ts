import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { bookingIdSchema } from '@/lib/validation/bookings'

async function getInstructorIdForUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("instructors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * GET /api/bookings/[id]/audit
 * 
 * Fetch audit logs for a specific booking
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

  // First, verify user has access to this booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('user_id, instructor_id')
    .eq('id', bookingId)
    .single()

  // Check permissions before revealing if booking exists (prevent information leakage)
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  const instructorIdForUser = await getInstructorIdForUser(supabase, user.id)
  const canAccess = booking && (
    isAdminOrInstructor || 
    booking.user_id === user.id ||
    (!!instructorIdForUser && booking.instructor_id === instructorIdForUser)
  )

  if (bookingError || !booking || !canAccess) {
    // Return generic "not found" to prevent information leakage
    return NextResponse.json(
      { error: 'Booking not found' },
      { status: 404 }
    )
  }

  // Fetch audit logs for this booking
  const { data: auditLogs, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      action,
      old_data,
      new_data,
      column_changes,
      user_id,
      created_at
    `)
    .eq('table_name', 'bookings')
    .eq('record_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }

  const auditLogsList = auditLogs || []

  // Collect related IDs from column changes to resolve display names
  const aircraftIds = new Set<string>()
  const lessonIds = new Set<string>()
  const instructorIds = new Set<string>()
  const flightTypeIds = new Set<string>()

  for (const log of auditLogsList) {
    const changes = log.column_changes as Record<string, { old?: unknown; new?: unknown }> | null
    if (!changes) continue

    for (const [key, change] of Object.entries(changes)) {
      if (key === 'aircraft_id' || key === 'checked_out_aircraft_id') {
        if (typeof change?.old === 'string') aircraftIds.add(change.old)
        if (typeof change?.new === 'string') aircraftIds.add(change.new)
      }
      if (key === 'lesson_id') {
        if (typeof change?.old === 'string') lessonIds.add(change.old)
        if (typeof change?.new === 'string') lessonIds.add(change.new)
      }
      if (key === 'instructor_id' || key === 'checked_out_instructor_id') {
        if (typeof change?.old === 'string') instructorIds.add(change.old)
        if (typeof change?.new === 'string') instructorIds.add(change.new)
      }
      if (key === 'flight_type_id') {
        if (typeof change?.old === 'string') flightTypeIds.add(change.old)
        if (typeof change?.new === 'string') flightTypeIds.add(change.new)
      }
    }
  }

  const [aircraftResult, lessonsResult, instructorsResult, flightTypesResult] = await Promise.all([
    aircraftIds.size > 0
      ? supabase
          .from('aircraft')
          .select('id, registration, type')
          .in('id', Array.from(aircraftIds))
      : Promise.resolve({ data: [] as { id: string; registration: string; type: string }[] }),
    lessonIds.size > 0
      ? supabase
          .from('lessons')
          .select('id, name')
          .in('id', Array.from(lessonIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    instructorIds.size > 0
      ? supabase
          .from('instructors')
          .select('id, first_name, last_name')
          .in('id', Array.from(instructorIds))
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
    flightTypeIds.size > 0
      ? supabase
          .from('flight_types')
          .select('id, name')
          .in('id', Array.from(flightTypeIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const aircraftNameMap = (aircraftResult.data || []).reduce((acc, aircraft) => {
    acc[aircraft.id] = `${aircraft.registration} (${aircraft.type})`
    return acc
  }, {} as Record<string, string>)

  const lessonNameMap = (lessonsResult.data || []).reduce((acc, lesson) => {
    acc[lesson.id] = lesson.name
    return acc
  }, {} as Record<string, string>)

  const instructorNameMap = (instructorsResult.data || []).reduce((acc, instructor) => {
    const name = [instructor.first_name, instructor.last_name].filter(Boolean).join(' ').trim()
    acc[instructor.id] = name || 'Unknown Instructor'
    return acc
  }, {} as Record<string, string>)

  const flightTypeNameMap = (flightTypesResult.data || []).reduce((acc, flightType) => {
    acc[flightType.id] = flightType.name
    return acc
  }, {} as Record<string, string>)

  const replaceIfMapped = (value: unknown, map: Record<string, string>) => {
    if (typeof value === 'string' && map[value]) return map[value]
    return value
  }

  const auditLogsWithNames = auditLogsList.map(log => {
    const changes = log.column_changes as Record<string, { old?: unknown; new?: unknown }> | null
    if (!changes) return log

    const updatedChanges = Object.fromEntries(
      Object.entries(changes).map(([key, change]) => {
        if (key === 'aircraft_id' || key === 'checked_out_aircraft_id') {
          return [
            key,
            {
              ...change,
              old: replaceIfMapped(change?.old, aircraftNameMap),
              new: replaceIfMapped(change?.new, aircraftNameMap),
            },
          ]
        }
        if (key === 'lesson_id') {
          return [
            key,
            {
              ...change,
              old: replaceIfMapped(change?.old, lessonNameMap),
              new: replaceIfMapped(change?.new, lessonNameMap),
            },
          ]
        }
        if (key === 'instructor_id' || key === 'checked_out_instructor_id') {
          return [
            key,
            {
              ...change,
              old: replaceIfMapped(change?.old, instructorNameMap),
              new: replaceIfMapped(change?.new, instructorNameMap),
            },
          ]
        }
        if (key === 'flight_type_id') {
          return [
            key,
            {
              ...change,
              old: replaceIfMapped(change?.old, flightTypeNameMap),
              new: replaceIfMapped(change?.new, flightTypeNameMap),
            },
          ]
        }
        return [key, change]
      })
    )

    return {
      ...log,
      column_changes: updatedChanges,
    }
  })

  // Fetch user details separately if user_id exists
  const userIds = [...new Set(auditLogsWithNames
    .map(log => log.user_id)
    .filter((id): id is string => id !== null))]
  
  let usersMap: Record<string, { id: string; first_name: string | null; last_name: string | null; email: string }> = {}
  
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', userIds)
    
    if (users) {
      usersMap = users.reduce((acc, user) => {
        acc[user.id] = user
        return acc
      }, {} as typeof usersMap)
    }
  }

  // Combine audit logs with user data
  const auditLogsWithUsers = auditLogsWithNames.map(log => ({
    ...log,
    user: log.user_id ? usersMap[log.user_id] || null : null,
  }))

  return NextResponse.json({ auditLogs: auditLogsWithUsers })
}
