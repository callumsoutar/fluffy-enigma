import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * GET /api/dashboard/stats
 * 
 * Fetch dashboard statistics:
 * - Total members
 * - Total flying hours last 30 days
 * - Average flying hours per member
 * - Number of flights completed last 30 days
 * 
 * Requires authentication and instructor/admin/owner role
 */
export async function GET() {
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

  // Check authorization - only instructors, admins, and owners can view dashboard stats
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

    // 1. Get total members (active users)
    const { count: totalMembers, error: membersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (membersError) {
      console.error('Error fetching total members:', membersError)
      return NextResponse.json(
        { error: 'Failed to fetch total members' },
        { status: 500 }
      )
    }

    // 2. Get completed flights from last 30 days with flight_time
    // We'll use end_time to determine when the flight was completed
    // For completed flights, end_time represents when the flight ended
    const { data: recentFlights, error: flightsError } = await supabase
      .from('bookings')
      .select('id, flight_time, end_time')
      .eq('status', 'complete')
      .not('flight_time', 'is', null)
      .gte('end_time', thirtyDaysAgoISO)
      .order('end_time', { ascending: false })

    if (flightsError) {
      console.error('Error fetching recent flights:', flightsError)
      return NextResponse.json(
        { error: 'Failed to fetch flight data' },
        { status: 500 }
      )
    }

    // 3. Calculate statistics
    const totalFlyingHours = (recentFlights || []).reduce((sum, flight) => {
      return sum + (flight.flight_time || 0)
    }, 0)

    const numberOfFlightsCompleted = recentFlights?.length || 0

    // Calculate average flying hours per member
    // If no members, average is 0
    const averageFlyingHoursPerMember = totalMembers && totalMembers > 0
      ? Number((totalFlyingHours / totalMembers).toFixed(2))
      : 0

    return NextResponse.json({
      totalMembers: totalMembers || 0,
      totalFlyingHoursLast30Days: Number(totalFlyingHours.toFixed(2)),
      averageFlyingHoursPerMember,
      numberOfFlightsCompletedLast30Days: numberOfFlightsCompleted,
    })
  } catch (error) {
    console.error('Error calculating dashboard statistics:', error)
    return NextResponse.json(
      { error: 'Failed to calculate dashboard statistics' },
      { status: 500 }
    )
  }
}