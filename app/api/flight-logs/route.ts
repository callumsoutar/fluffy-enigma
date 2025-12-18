import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

const ALLOWED_FIELDS = [
  "booking_id", "checked_out_aircraft_id", "checked_out_instructor_id",
  "actual_start", "actual_end", "eta", "hobbs_start", "hobbs_end", 
  "tach_start", "tach_end", "flight_time_hobbs", "flight_time_tach", 
  "flight_time", "fuel_on_board", "passengers", "route", "equipment",
  "briefing_completed", "authorization_completed", 
  "flight_remarks", "solo_end_hobbs", "dual_time", "solo_time",
  "total_hours_start", "total_hours_end",
  "flight_type_id", "lesson_id", "description", "remarks"
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check authorization - only instructors, admins, and owners can create flight logs
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }
  
  const body = await req.json()
  const { booking_id, ...fields } = body
  
  if (!booking_id) {
    return NextResponse.json({ error: "Missing booking_id" }, { status: 400 })
  }

  // Check for existing flight log for this booking (idempotent upsert)
  const { data: existing } = await supabase
    .from("flight_logs")
    .select("id")
    .eq("booking_id", booking_id)
    .maybeSingle()

  // Build payload
  const payload: Record<string, unknown> = {}
  
  for (const key of ALLOWED_FIELDS) {
    if (key in fields) payload[key] = fields[key]
  }

  // Add updated_at timestamp for updates
  if (existing && existing.id) {
    payload.updated_at = new Date().toISOString()
  }

  const selectQuery = `
    *,
    checked_out_aircraft:aircraft!flight_logs_checked_out_aircraft_id_fkey(id, registration, type, model),
    checked_out_instructor:instructors!flight_logs_checked_out_instructor_id_fkey(
      id,
      first_name,
      last_name,
      user_id,
      users:users!instructors_user_id_fkey(id, first_name, last_name, email)
    ),
    booking:bookings!flight_logs_booking_id_fkey(
      id,
      aircraft_id,
      user_id,
      instructor_id,
      start_time,
      end_time,
      purpose,
      student:users!bookings_user_id_fkey(id, first_name, last_name, email),
      instructor:instructors!bookings_instructor_id_fkey(
        id,
        first_name,
        last_name,
        user_id,
        users:users!instructors_user_id_fkey(id, first_name, last_name, email)
      )
    )
  `

  let data, error

  if (existing && existing.id) {
    // Update existing flight log
    const updatePayload = { ...payload }
    // Don't update booking_id on update
    delete updatePayload.booking_id
    
    const result = await supabase
      .from("flight_logs")
      .update(updatePayload)
      .eq("id", existing.id)
      .select(selectQuery)
      .single()
    
    data = result.data
    error = result.error
  } else {
    // Insert new flight log
    const insertPayload = { booking_id, ...payload }
    
    const result = await supabase
      .from("flight_logs")
      .insert([insertPayload])
      .select(selectQuery)
      .single()
    
    data = result.data
    error = result.error
  }

  if (error) {
    console.error('Error upserting flight log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ flight_log: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check authorization - only instructors, admins, and owners can update flight logs
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }
  
  const body = await req.json()
  const { id, ...fields } = body
  
  if (!id) {
    return NextResponse.json({ error: "Missing flight log id" }, { status: 400 })
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {}
  
  for (const key of ALLOWED_FIELDS) {
    if (key in fields) updatePayload[key] = fields[key]
  }

  // Add updated_at timestamp
  updatePayload.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from("flight_logs")
    .update(updatePayload)
    .eq("id", id)
    .select(`
      *,
      checked_out_aircraft:aircraft!flight_logs_checked_out_aircraft_id_fkey(id, registration, type, model),
      checked_out_instructor:instructors!flight_logs_checked_out_instructor_id_fkey(
        id,
        first_name,
        last_name,
        user_id,
        users:users!instructors_user_id_fkey(id, first_name, last_name, email)
      ),
      booking:bookings!flight_logs_booking_id_fkey(
        id,
        aircraft_id,
        user_id,
        instructor_id,
        start_time,
        end_time,
        purpose,
        student:users!bookings_student_id_fkey(id, first_name, last_name, email),
        instructor:instructors!bookings_instructor_id_fkey(
          id,
          first_name,
          last_name,
          user_id,
          users:users!instructors_user_id_fkey(id, first_name, last_name, email)
        )
      )
    `)
    .single()

  if (error) {
    console.error('Error updating flight log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ flight_log: data })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check authorization - only instructors, admins, and owners can view flight logs
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get("booking_id")
  const aircraftId = searchParams.get("aircraft_id")

  try {
    let query = supabase
      .from("flight_logs")
      .select(`
        *,
        checked_out_aircraft:aircraft!flight_logs_checked_out_aircraft_id_fkey(id, registration, type, model),
        checked_out_instructor:instructors!flight_logs_checked_out_instructor_id_fkey(
          id,
          first_name,
          last_name,
          user_id,
          users:users!instructors_user_id_fkey(id, first_name, last_name, email)
        ),
        booking:bookings!flight_logs_booking_id_fkey(
          id,
          aircraft_id,
          user_id,
          instructor_id,
          start_time,
          end_time,
          purpose,
          student:users!bookings_user_id_fkey(id, first_name, last_name, email),
          instructor:instructors!bookings_instructor_id_fkey(
            id,
            first_name,
            last_name,
            user_id,
            users:users!instructors_user_id_fkey(id, first_name, last_name, email)
          )
        )
      `)

    if (bookingId) {
      query = query.eq("booking_id", bookingId)
      const { data, error } = await query.maybeSingle()
      if (error) {
        console.error('Error fetching flight log:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      // Return null if no flight log exists (this is expected for new bookings)
      return NextResponse.json({ flight_log: data ?? null })
    }

    // Filter by aircraft_id - can use checked_out_aircraft_id directly
    if (aircraftId) {
      query = query.eq("checked_out_aircraft_id", aircraftId)
    }

    const { data, error } = await query.order("created_at", { ascending: false })
    if (error) {
      console.error('Error fetching flight logs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ flight_logs: data || [] })
  } catch (error) {
    console.error('Error in flight logs GET:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
