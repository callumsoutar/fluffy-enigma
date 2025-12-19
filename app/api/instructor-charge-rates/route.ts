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
  const { data, error } = await supabase
    .from('instructor_flight_type_rates')
    .select('id, instructor_id, flight_type_id, rate, currency, effective_from, created_at, updated_at')
    .eq('instructor_id', instructorId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    rates: (data || []).map((r) => ({
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
