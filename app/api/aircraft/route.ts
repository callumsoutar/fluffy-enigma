import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import type { AircraftFilter, AircraftWithType } from '@/lib/types/aircraft'
import { aircraftCreateSchema } from '@/lib/validation/aircraft'

/**
 * GET /api/aircraft
 * 
 * Fetch aircraft with optional filters
 * Requires authentication only (all authenticated users can view aircraft)
 * 
 * Security:
 * - All authenticated users can view aircraft (needed for scheduler/booking)
 * - RLS policies enforce final data access
 * - Write operations (POST, PATCH, DELETE) still restricted to instructors and above
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication - all authenticated users can view aircraft
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // No additional role check needed for viewing aircraft
  // Students and members need to see aircraft in the scheduler for booking purposes

  // Get query parameters
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || undefined
  const status = searchParams.get('status') || undefined
  const aircraft_type_id = searchParams.get('aircraft_type_id') || undefined

  const filters: AircraftFilter = {
    search,
    status,
    aircraft_type_id,
  }

  // Build base query - select aircraft with related aircraft_type
  let query = supabase
    .from('aircraft')
    .select(`
      *,
      aircraft_type:aircraft_types (
        id,
        name,
        category,
        description,
        created_at,
        updated_at
      )
    `)
    .order('registration', { ascending: true })

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.aircraft_type_id) {
    query = query.eq('aircraft_type_id', filters.aircraft_type_id)
  }

  // Execute query (RLS will filter based on user permissions)
  const { data: aircraft, error } = await query

  if (error) {
    console.error('Error fetching aircraft:', error)
    return NextResponse.json(
      { error: 'Failed to fetch aircraft' },
      { status: 500 }
    )
  }

  if (!aircraft || aircraft.length === 0) {
    return NextResponse.json({
      aircraft: [],
      total: 0,
    })
  }

  // Transform results to match AircraftWithType interface
  const aircraftWithTypes: AircraftWithType[] = aircraft.map((a) => {
    // Handle case where aircraft_type might be an array or single object
    const aircraftType = Array.isArray(a.aircraft_type) 
      ? a.aircraft_type[0] 
      : a.aircraft_type
    
    return {
      ...a,
      aircraft_type: aircraftType ? {
        id: aircraftType.id,
        name: aircraftType.name,
        category: aircraftType.category,
        description: aircraftType.description,
        created_at: aircraftType.created_at,
        updated_at: aircraftType.updated_at,
      } : null,
    }
  })

  // Apply search filter if provided
  let filteredAircraft = aircraftWithTypes
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredAircraft = aircraftWithTypes.filter((aircraft) => {
      const registrationMatch = aircraft.registration?.toLowerCase().includes(searchLower)
      const modelMatch = aircraft.model?.toLowerCase().includes(searchLower)
      const typeMatch = aircraft.type?.toLowerCase().includes(searchLower)
      const aircraftTypeMatch = aircraft.aircraft_type?.name?.toLowerCase().includes(searchLower)

      return registrationMatch || modelMatch || typeMatch || aircraftTypeMatch
    })
  }

  return NextResponse.json({
    aircraft: filteredAircraft,
    total: filteredAircraft.length,
  })
}

/**
 * POST /api/aircraft
 *
 * Create an aircraft record.
 * Requires authentication and instructor/admin/owner role.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const parsed = aircraftCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const v = parsed.data

  // Normalize empty strings to null for nullable fields
  const aircraftToInsert = {
    registration: v.registration.trim(),
    type: v.type.trim(),
    model: v.model && v.model.trim() ? v.model.trim() : null,
    manufacturer: v.manufacturer && v.manufacturer.trim() ? v.manufacturer.trim() : null,
    year_manufactured: v.year_manufactured ?? null,
    status: v.status && v.status.trim() ? v.status.trim() : 'active',
    capacity: v.capacity ?? null,
    on_line: v.on_line ?? true,
    for_ato: v.for_ato ?? false,
    prioritise_scheduling: v.prioritise_scheduling ?? false,
    aircraft_image_url: v.aircraft_image_url && v.aircraft_image_url.trim() ? v.aircraft_image_url.trim() : null,
    total_hours: v.total_hours ?? null,
    current_tach: v.current_tach ?? 0,
    current_hobbs: v.current_hobbs ?? 0,
    record_tacho: v.record_tacho ?? false,
    record_hobbs: v.record_hobbs ?? false,
    record_airswitch: v.record_airswitch ?? false,
    fuel_consumption: v.fuel_consumption ?? null,
    total_time_method: v.total_time_method ?? null,
    aircraft_type_id: v.aircraft_type_id ?? null,
    notes: v.notes && v.notes.trim() ? v.notes.trim() : null,
  }

  const { data: aircraft, error } = await supabase
    .from('aircraft')
    .insert(aircraftToInsert)
    .select(`
      *,
      aircraft_type:aircraft_types (
        id,
        name,
        category,
        description,
        created_at,
        updated_at
      )
    `)
    .single()

  if (error) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: 'An aircraft with that registration already exists.' },
        { status: 409 }
      )
    }
    console.error('Error creating aircraft:', error)
    return NextResponse.json({ error: 'Failed to create aircraft' }, { status: 500 })
  }

  // Handle case where aircraft_type might be an array or single object
  const aircraftRaw = aircraft as Record<string, unknown> & { aircraft_type?: unknown }
  const aircraftTypeRaw = aircraftRaw.aircraft_type
  const aircraftType = Array.isArray(aircraftTypeRaw)
    ? aircraftTypeRaw[0]
    : aircraftTypeRaw

  const aircraftWithType: AircraftWithType = {
    ...(aircraft as Record<string, unknown>),
    aircraft_type: aircraftType ? {
      id: (aircraftType as Record<string, unknown>).id as string,
      name: (aircraftType as Record<string, unknown>).name as string,
      category: (aircraftType as Record<string, unknown>).category as string,
      description: (aircraftType as Record<string, unknown>).description as string | null,
      created_at: (aircraftType as Record<string, unknown>).created_at as string,
      updated_at: (aircraftType as Record<string, unknown>).updated_at as string,
    } : null,
  } as AircraftWithType

  return NextResponse.json({ aircraft: aircraftWithType }, { status: 201 })
}
