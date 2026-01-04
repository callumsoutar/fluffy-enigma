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

  // Fetch user details separately if user_id exists
  const userIds = [...new Set((auditLogs || [])
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
  const auditLogsWithUsers = (auditLogs || []).map(log => ({
    ...log,
    user: log.user_id ? usersMap[log.user_id] || null : null,
  }))

  return NextResponse.json({ auditLogs: auditLogsWithUsers })
}
