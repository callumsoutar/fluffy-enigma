import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

/**
 * GET /api/chargeables
 * 
 * Search/list chargeables
 * Requires authentication and instructor/admin/owner role
 * 
 * Query parameters:
 * - search: string - Search in name/description
 * - is_active: boolean - Filter by active status
 * - is_taxable: boolean - Filter by taxable status
 * - chargeable_type_id: string - Filter by chargeable type
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

  // Check authorization - only instructors, admins, and owners can view chargeables
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get and validate query parameters
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')
  const isActive = searchParams.get('is_active')
  const isTaxable = searchParams.get('is_taxable')
  const chargeableTypeId = searchParams.get('chargeable_type_id')

  // Build query
  let query = supabase
    .from('chargeables')
    .select(`
      *,
      chargeable_type:chargeable_type_id (
        id,
        code,
        name
      )
    `)
    .is('voided_at', null) // Only non-voided chargeables
    .order('name', { ascending: true })

  // Apply filters
  if (isActive !== null) {
    const activeValue = isActive === 'true'
    query = query.eq('is_active', activeValue)
  } else {
    // Default to active only if not specified
    query = query.eq('is_active', true)
  }

  if (isTaxable !== null) {
    const taxableValue = isTaxable === 'true'
    query = query.eq('is_taxable', taxableValue)
  }

  if (chargeableTypeId) {
    query = query.eq('chargeable_type_id', chargeableTypeId)
  }

  if (search) {
    // Server-side search for name or description
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }

  // Execute query
  const { data: chargeables, error } = await query

  if (error) {
    console.error('Error fetching chargeables:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chargeables' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    chargeables: chargeables || [],
    total: (chargeables || []).length,
  })
}
