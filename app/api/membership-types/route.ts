import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

/**
 * GET /api/membership-types
 * 
 * Fetch membership types from the membership_types table
 * Requires authentication and instructor/admin/owner role
 * 
 * Query parameters:
 * - active_only: boolean - if true, only return active membership types
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

  // Check authorization - only instructors, admins, and owners can view membership types
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams
  const activeOnly = searchParams.get('active_only') === 'true'

  // Build query with chargeable join
  let query = supabase
    .from('membership_types')
    .select(`
      *,
      chargeables (
        id,
        name,
        rate,
        is_taxable
      )
    `)
    .order('name', { ascending: true })

  // Filter by active status if requested
  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  // Execute query
  const { data: membershipTypes, error } = await query

  if (error) {
    console.error('Error fetching membership types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch membership types' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    membership_types: membershipTypes || [],
  })
}
