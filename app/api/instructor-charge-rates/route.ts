import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * GET /api/instructor-charge-rates
 *
 * Query params:
 * - instructor_id (required)
 * - flight_type_id (optional)
 *
 * Security:
 * - This is financial data. Only staff (instructor/admin/owner) may view.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Viewing instructor charge rates requires instructor, admin, or owner role' },
      { status: 403 }
    )
  }

  const searchParams = req.nextUrl.searchParams
  const instructorId = searchParams.get('instructor_id')
  const flightTypeId = searchParams.get('flight_type_id')

  if (!instructorId) {
    return NextResponse.json({ error: 'instructor_id is required' }, { status: 400 })
  }

  // If both parameters are provided, get a specific rate
  if (flightTypeId) {
    // instructor rates are stored in instructor_flight_type_rates:
    // - rate is tax-exclusive hourly rate
    // - effective_from selects the current rate
    const { data, error } = await supabase
      .from('instructor_flight_type_rates')
      .select('id, instructor_id, flight_type_id, rate, currency, effective_from, created_at, updated_at')
      .eq('instructor_id', instructorId)
      .eq('flight_type_id', flightTypeId)
      .lte('effective_from', todayIsoDate())
      .order('effective_from', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Map DB schema -> check-in UI schema
    return NextResponse.json({
      charge_rate: {
        id: data.id,
        instructor_id: data.instructor_id,
        flight_type_id: data.flight_type_id,
        rate_per_hour: data.rate,
        // instructor billing basis is derived from aircraft by default in UI
        charge_hobbs: false,
        charge_tacho: false,
        charge_airswitch: false,
        currency: data.currency,
        effective_from: data.effective_from,
      },
    })
  }

  // Otherwise return all rates for the instructor
  // For the management UI, we want to show all rates (including historical ones)
  // but we'll group by flight_type_id and show the most recent effective rate per flight type
  const { data, error } = await supabase
    .from('instructor_flight_type_rates')
    .select('id, instructor_id, flight_type_id, rate, currency, effective_from, created_at, updated_at')
    .eq('instructor_id', instructorId)
    .order('flight_type_id', { ascending: true })
    .order('effective_from', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by flight_type_id and keep only the most recent rate per flight type
  // This ensures we show one rate per flight type in the management UI
  const ratesByFlightType = new Map<string, typeof data[0]>()
  if (data) {
    for (const rate of data) {
      const existing = ratesByFlightType.get(rate.flight_type_id)
      if (!existing || new Date(rate.effective_from) > new Date(existing.effective_from)) {
        ratesByFlightType.set(rate.flight_type_id, rate)
      }
    }
  }

  return NextResponse.json({
    rates: Array.from(ratesByFlightType.values()).map((r) => ({
      id: r.id,
      instructor_id: r.instructor_id,
      flight_type_id: r.flight_type_id,
      rate_per_hour: r.rate,
      charge_hobbs: false,
      charge_tacho: false,
      charge_airswitch: false,
      currency: r.currency,
      effective_from: r.effective_from,
    })),
  })
}

/**
 * POST /api/instructor-charge-rates
 *
 * Security: Only admin/owner
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Adding instructor charge rates requires admin or owner role' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { instructor_id, flight_type_id, rate_per_hour, currency = 'NZD', effective_from = todayIsoDate() } = body

    if (!instructor_id || !flight_type_id || rate_per_hour === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('instructor_flight_type_rates')
      .insert({
        instructor_id,
        flight_type_id,
        rate: rate_per_hour,
        currency,
        effective_from,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rate: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * PATCH /api/instructor-charge-rates
 *
 * Security: Only admin/owner
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Updating instructor charge rates requires admin or owner role' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { id, rate_per_hour, currency, effective_from } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const updates: {
      rate?: number
      currency?: string
      effective_from?: string
    } = {}
    if (rate_per_hour !== undefined) updates.rate = rate_per_hour
    if (currency) updates.currency = currency
    if (effective_from) updates.effective_from = effective_from

    const { data, error } = await supabase
      .from('instructor_flight_type_rates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rate: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * DELETE /api/instructor-charge-rates
 *
 * Security: Only admin/owner
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Deleting instructor charge rates requires admin or owner role' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('instructor_flight_type_rates')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
