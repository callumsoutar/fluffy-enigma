import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

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
 * - type: string - Filter by chargeable type code (e.g., 'landing_fee')
 * - include_rates: boolean - Include landing fee rates for landing fees
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

  // Check authorization - only instructors, admins, and owners can view chargeables
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
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
  const typeCode = searchParams.get('type')
  const includeRates = searchParams.get('include_rates') === 'true'

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

  // Filter by type code if specified
  let filteredChargeables = chargeables || []
  if (typeCode && filteredChargeables) {
    filteredChargeables = filteredChargeables.filter((c) => c.chargeable_type?.code === typeCode)
  }

  // Include landing fee rates if requested
  if (includeRates && filteredChargeables) {
    for (const chargeable of filteredChargeables) {
      const { data: rates } = await supabase
        .from('landing_fee_rates')
        .select('*')
        .eq('chargeable_id', chargeable.id)
      
      chargeable.landing_fee_rates = rates || []
    }
  }

  return NextResponse.json({
    chargeables: filteredChargeables,
    total: filteredChargeables.length,
  })
}

/**
 * POST /api/chargeables
 * Create a new chargeable
 * Requires admin or owner role
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

  const { userRole } = tenantContext
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { name, description, chargeable_type_id, rate, is_taxable, is_active } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!chargeable_type_id) {
      return NextResponse.json({ error: 'Chargeable type is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('chargeables')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        chargeable_type_id,
        rate: rate || 0,
        is_taxable: is_taxable !== undefined ? is_taxable : true,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ chargeable: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 }
    )
  }
}

/**
 * PATCH /api/chargeables
 * Update an existing chargeable
 * Requires admin or owner role
 */
export async function PATCH(request: NextRequest) {
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
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { id, name, description, rate, is_taxable, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('chargeables')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        rate: rate !== undefined ? rate : undefined,
        is_taxable: is_taxable !== undefined ? is_taxable : undefined,
        is_active: is_active !== undefined ? is_active : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ chargeable: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 }
    )
  }
}

/**
 * DELETE /api/chargeables
 * Soft delete (void) a chargeable
 * Requires admin or owner role
 */
export async function DELETE(request: NextRequest) {
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
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  // Soft delete - set voided_at and make inactive
  const { data, error } = await supabase
    .from('chargeables')
    .update({
      is_active: false,
      voided_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ chargeable: data })
}
