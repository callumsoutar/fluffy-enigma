import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * GET /api/users
 * 
 * Fetch users for selection (e.g., in invoice member select)
 * Requires authentication and instructor/admin/owner role
 * 
 * Query parameters:
 * - search: string - Search in first_name, last_name, email
 * - id: string - Get specific user by ID
 * - ids: string - Get multiple users by comma-separated IDs
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

  const { userRole } = tenantContext

  // Check authorization - only instructors, admins, and owners can view users
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')
  const userId = searchParams.get('id')
  const userIds = searchParams.get('ids')

  // Build query
  let query = supabase
    .from('users')
    .select('id, first_name, last_name, email')
    .eq('is_active', true)
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true })

  // Filter by specific user ID if provided
  if (userId) {
    query = query.eq('id', userId)
  }

  // Filter by multiple user IDs if provided
  if (userIds) {
    const idsArray = userIds.split(',').filter(id => id.trim())
    query = query.in('id', idsArray)
  }

  // Execute query
  const { data: users, error } = await query

  if (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }

  // Apply search filter in memory
  let filteredUsers = users || []

  if (search) {
    const searchLower = search.toLowerCase()
    filteredUsers = filteredUsers.filter((u) => {
      const firstNameMatch = u.first_name?.toLowerCase().includes(searchLower)
      const lastNameMatch = u.last_name?.toLowerCase().includes(searchLower)
      const emailMatch = u.email?.toLowerCase().includes(searchLower)
      return firstNameMatch || lastNameMatch || emailMatch
    })
  }

  return NextResponse.json({
    users: filteredUsers,
  })
}
