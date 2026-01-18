import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import type { AircraftWithType } from '@/lib/types/aircraft'

/**
 * GET /api/aircraft/[id]
 * 
 * Fetch a single aircraft with all related data
 * Requires authentication and instructor/admin/owner role
 * 
 * Security:
 * - Only instructors, admins, and owners can access
 * - RLS policies enforce final data access and tenant isolation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Check authorization - only instructors, admins, and owners can view aircraft
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const { id: aircraftId } = await params

  // Fetch aircraft with related aircraft_type
  const { data: aircraft, error: aircraftError } = await supabase
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
    .eq('id', aircraftId)
    .single()

  if (aircraftError || !aircraft) {
    if (aircraftError?.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Aircraft not found' },
        { status: 404 }
      )
    }
    console.error('Error fetching aircraft:', aircraftError)
    return NextResponse.json(
      { error: 'Failed to fetch aircraft' },
      { status: 500 }
    )
  }

  // Handle case where aircraft_type might be an array or single object
  const aircraftType = Array.isArray(aircraft.aircraft_type) 
    ? aircraft.aircraft_type[0] 
    : aircraft.aircraft_type

  const aircraftWithType: AircraftWithType = {
    ...aircraft,
    aircraft_type: aircraftType ? {
      id: aircraftType.id,
      name: aircraftType.name,
      category: aircraftType.category,
      description: aircraftType.description,
      created_at: aircraftType.created_at,
      updated_at: aircraftType.updated_at,
    } : null,
  }

  // Fetch related data in parallel
  const [
    bookingsResult,
    maintenanceVisitsResult,
    observationsResult,
    componentsResult,
  ] = await Promise.all([
    // Flight history from bookings
    supabase
      .from('bookings')
      .select(`
        id,
        user_id,
        instructor_id,
        checked_out_aircraft_id,
        checked_out_instructor_id,
        start_time,
        end_time,
        status,
        purpose,
        hobbs_start,
        hobbs_end,
        tach_start,
        tach_end,
        flight_time,
        created_at,
        student:users!user_id(id, first_name, last_name, email),
        instructor:instructors!checked_out_instructor_id (
          id,
          first_name,
          last_name,
          user_id
        ),
        flight_type:flight_types (
          id,
          name
        ),
        lesson:lessons (
          id,
          name
        )
      `)
      .eq('checked_out_aircraft_id', aircraftId)
      .eq('status', 'complete')
      .not('flight_time', 'is', null)
      .order('end_time', { ascending: false })
      .limit(50),
    
    // Maintenance visits
    supabase
      .from('maintenance_visits')
      .select(`
        *
      `)
      .eq('aircraft_id', aircraftId)
      .order('visit_date', { ascending: false })
      .limit(50),
    
    // Observations (defects)
    supabase
      .from('observations')
      .select(`
        *,
        reported_by_user:users!reported_by (
          id,
          first_name,
          last_name,
          email
        ),
        assigned_to_user:users!assigned_to (
          id,
          first_name,
          last_name,
          email
        ),
        comments:observation_comments (
          id,
          comment,
          created_at,
          user:users (
            id,
            first_name,
            last_name,
            email
          )
        )
      `)
      .eq('aircraft_id', aircraftId)
      .order('reported_date', { ascending: false }),
    
    // Aircraft components (maintenance items)
    supabase
      .from('aircraft_components')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .is('voided_at', null)
      .order('priority', { ascending: true })
      .order('current_due_date', { ascending: true }),
  ])

  return NextResponse.json({
    aircraft: aircraftWithType,
    flights: bookingsResult.data || [],
    maintenanceVisits: maintenanceVisitsResult.data || [],
    observations: observationsResult.data || [],
    components: componentsResult.data || [],
  })
}

/**
 * PATCH /api/aircraft/[id]
 * 
 * Update an aircraft
 * Requires authentication and instructor/admin/owner role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Check authorization - only instructors, admins, and owners can update aircraft
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const { id: aircraftId } = await params
  const body = await request.json()

  // Remove id from body if present (shouldn't be updated)
  const { id: bodyId, ...updateData } = body
  
  // Ensure we're updating the correct aircraft (if id is provided in body)
  if (bodyId && bodyId !== aircraftId) {
    return NextResponse.json(
      { error: 'Aircraft ID mismatch' },
      { status: 400 }
    )
  }

  // Add updated_at timestamp
  updateData.updated_at = new Date().toISOString()

  // Update aircraft
  const { data: aircraft, error: updateError } = await supabase
    .from('aircraft')
    .update(updateData)
    .eq('id', aircraftId)
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

  if (updateError) {
    console.error('Error updating aircraft:', updateError)
    return NextResponse.json(
      { error: updateError.message || 'Failed to update aircraft' },
      { status: 500 }
    )
  }

  // Handle case where aircraft_type might be an array or single object
  const aircraftType = Array.isArray(aircraft.aircraft_type) 
    ? aircraft.aircraft_type[0] 
    : aircraft.aircraft_type

  const aircraftWithType: AircraftWithType = {
    ...aircraft,
    aircraft_type: aircraftType ? {
      id: aircraftType.id,
      name: aircraftType.name,
      category: aircraftType.category,
      description: aircraftType.description,
      created_at: aircraftType.created_at,
      updated_at: aircraftType.updated_at,
    } : null,
  }

  return NextResponse.json({ aircraft: aircraftWithType })
}
