import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

/**
 * GET /api/landing-fee-rates
 * Get landing fee rates
 * Requires authentication and instructor/admin/owner role
 * 
 * Query parameters:
 * - chargeable_id: string - Filter by chargeable (landing fee)
 * - aircraft_type_id: string - Filter by aircraft type
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const chargeableId = searchParams.get('chargeable_id')
  const aircraftTypeId = searchParams.get('aircraft_type_id')

  let query = supabase.from('landing_fee_rates').select('*')

  if (chargeableId) {
    query = query.eq('chargeable_id', chargeableId)
  }

  if (aircraftTypeId) {
    query = query.eq('aircraft_type_id', aircraftTypeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching landing fee rates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch landing fee rates' },
      { status: 500 }
    )
  }

  return NextResponse.json({ landing_fee_rates: data || [] })
}

/**
 * POST /api/landing-fee-rates
 * Create a new landing fee rate
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
    const { chargeable_id, aircraft_type_id, rate } = body

    if (!chargeable_id) {
      return NextResponse.json({ error: 'Chargeable ID is required' }, { status: 400 })
    }

    if (!aircraft_type_id) {
      return NextResponse.json({ error: 'Aircraft type ID is required' }, { status: 400 })
    }

    if (rate === undefined || rate === null) {
      return NextResponse.json({ error: 'Rate is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('landing_fee_rates')
      .insert({
        chargeable_id,
        aircraft_type_id,
        rate: parseFloat(rate),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ landing_fee_rate: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 }
    )
  }
}

/**
 * PATCH /api/landing-fee-rates
 * Update an existing landing fee rate
 * Requires admin or owner role
 */
export async function PATCH(request: NextRequest) {
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
    const { chargeable_id, aircraft_type_id, rate } = body

    if (!chargeable_id || !aircraft_type_id) {
      return NextResponse.json(
        { error: 'Chargeable ID and aircraft type ID are required' },
        { status: 400 }
      )
    }

    if (rate === undefined || rate === null) {
      return NextResponse.json({ error: 'Rate is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('landing_fee_rates')
      .update({
        rate: parseFloat(rate),
        updated_at: new Date().toISOString(),
      })
      .eq('chargeable_id', chargeable_id)
      .eq('aircraft_type_id', aircraft_type_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ landing_fee_rate: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 }
    )
  }
}

/**
 * DELETE /api/landing-fee-rates
 * Delete a landing fee rate
 * Requires admin or owner role
 */
export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const chargeableId = searchParams.get('chargeable_id')
  const aircraftTypeId = searchParams.get('aircraft_type_id')

  if (!chargeableId || !aircraftTypeId) {
    return NextResponse.json(
      { error: 'Chargeable ID and aircraft type ID are required' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('landing_fee_rates')
    .delete()
    .eq('chargeable_id', chargeableId)
    .eq('aircraft_type_id', aircraftTypeId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Landing fee rate deleted successfully' })
}

