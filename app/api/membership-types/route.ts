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

/**
 * POST /api/membership-types
 * Create a new membership type
 * Requires admin or owner role
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { name, code, description, duration_months, benefits, is_active, chargeable_id } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!code || code.trim() === '') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('membership_types')
      .insert({
        name: name.trim(),
        code: code.trim().toLowerCase(),
        description: description?.trim() || null,
        duration_months: parseInt(duration_months) || 12,
        benefits: benefits || [],
        is_active: is_active !== undefined ? is_active : true,
        chargeable_id: chargeable_id || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ membership_type: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 }
    )
  }
}
