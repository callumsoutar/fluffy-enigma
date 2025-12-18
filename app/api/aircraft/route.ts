import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import type { AircraftFilter, AircraftWithType } from '@/lib/types/aircraft'

/**
 * GET /api/aircraft
 * 
 * Fetch aircraft with optional filters
 * Requires authentication and instructor/admin/owner role
 * 
 * Security:
 * - Only instructors, admins, and owners can access
 * - RLS policies enforce final data access
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

  // Check authorization - only instructors, admins, and owners can view aircraft
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

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
