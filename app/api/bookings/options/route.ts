import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/bookings/options
 * 
 * Fetch dropdown options for booking form
 * (aircraft, members, instructors, flight types)
 * Requires authentication
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Fetch all options in parallel
  const [aircraftResult, membersResult, instructorsResult, flightTypesResult, lessonsResult] = await Promise.all([
    // Aircraft
    supabase
      .from('aircraft')
      .select('id, registration, type, model, manufacturer')
      .eq('on_line', true)
      .order('registration'),
    
    // Members (users)
    supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('is_active', true)
      .order('first_name, last_name'),
    
    // Instructors
    supabase
      .from('instructors')
      .select(`
        id,
        first_name,
        last_name,
        user:user_id (
          id,
          email
        )
      `)
      .eq('is_actively_instructing', true)
      .order('first_name, last_name'),
    
    // Flight Types
    supabase
      .from('flight_types')
      .select('id, name')
      .eq('is_active', true)
      .is('voided_at', null)
      .order('name'),
    
    // Lessons
    supabase
      .from('lessons')
      .select('id, name, description')
      .eq('is_active', true)
      .order('order'),
  ])

  return NextResponse.json({
    aircraft: aircraftResult.data || [],
    members: membersResult.data || [],
    instructors: instructorsResult.data || [],
    flightTypes: flightTypesResult.data || [],
    lessons: lessonsResult.data || [],
  })
}
