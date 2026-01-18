import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

const ObservationSchema = z.object({
  reported_by: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(), // Legacy support
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  aircraft_id: z.string().uuid(),
  stage: z.enum(['open', 'investigation', 'resolution', 'closed']).default('open'),
  observation_stage: z.enum(['open', 'investigation', 'resolution', 'closed']).optional(), // Legacy support
  resolution_comments: z.string().nullable().optional(),
  closed_by: z.string().uuid().nullable().optional(),
  resolved_at: z.string().datetime().nullable().optional(),
  reported_date: z.string().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get tenant context (includes auth check)
    let tenantContext
    try {
      tenantContext = await getTenantContext(supabase)
    } catch (err) {
      const error = err as { code?: string }
      if (error.code === 'UNAUTHORIZED') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      if (error.code === 'NO_MEMBERSHIP') {
        return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
      }
      return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
    }

    const { userId: currentUserId, userRole } = tenantContext

    // Role authorization check - observations are safety-critical data
    const hasAccess = ['owner', 'admin', 'instructor', 'member'].includes(userRole)
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Forbidden: Observations access requires member role or above' 
      }, { status: 403 })
    }

  // Members can only view observations for aircraft they have bookings for
  const isMember = userRole === 'member'
  if (isMember) {
    const aircraft_id = new URL(req.url).searchParams.get('aircraft_id')
    
    if (!aircraft_id) {
      return NextResponse.json({ 
        error: 'Forbidden: Members must specify aircraft_id to view observations' 
      }, { status: 403 })
    }

    // Verify the member has a booking for this aircraft
    const { data: userBooking, error: bookingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", currentUserId)
      .eq("aircraft_id", aircraft_id)
      .limit(1)

    if (bookingError || !userBooking || userBooking.length === 0) {
      return NextResponse.json({ 
        error: 'Forbidden: You can only view observations for aircraft you have bookings for' 
      }, { status: 403 })
    }
  }
  
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const aircraft_id = searchParams.get('aircraft_id')
  
  let query = supabase.from('observations').select(`
    *,
    reported_by_user:users!observations_reported_by_fkey (
      id,
      first_name,
      last_name,
      email
    ),
    assigned_to_user:users!observations_assigned_to_fkey (
      id,
      first_name,
      last_name,
      email
    )
  `)
  
  if (id) {
    const { data, error } = await query.eq('id', id).single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json(data)
  }
  
  if (aircraft_id) {
    query = query.eq('aircraft_id', aircraft_id)
  }
  
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      console.error('Error fetching observations:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
    
    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Unexpected error in GET /api/observations:', err)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userId: currentUserId, userRole } = tenantContext

  // Role authorization check - observations creation requires instructor role or above
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Observation creation requires instructor role or above' 
    }, { status: 403 })
  }
  
  const body = await req.json()
  const parse = ObservationSchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })
  }
  
  // Map frontend fields to database fields (support both old and new field names)
  const dbData = {
    aircraft_id: parse.data.aircraft_id,
    name: parse.data.name,
    description: parse.data.description || null,
    stage: parse.data.stage || parse.data.observation_stage || 'open',
    reported_by: parse.data.reported_by || parse.data.user_id || currentUserId,
    priority: parse.data.priority || 'medium',
    resolution_comments: parse.data.resolution_comments || null,
    closed_by: parse.data.closed_by || null,
    resolved_at: parse.data.resolved_at || null,
    assigned_to: parse.data.assigned_to || null,
    notes: parse.data.notes || null
  }
  
  const { data, error } = await supabase
    .from('observations')
    .insert([dbData])
    .select(`
      *,
      reported_by_user:users!observations_reported_by_fkey (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .single()
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userRole } = tenantContext

  // Role authorization check - observations modification requires instructor role or above
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Observation modification requires instructor role or above' 
    }, { status: 403 })
  }
  
  const body = await req.json()
  const { id, ...update } = body
  
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  
  const parse = ObservationSchema.partial().safeParse(update)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 })
  }
  
  // Map frontend fields to database fields (support both old and new field names)
  const dbUpdate: Record<string, unknown> = {}
  if (parse.data.stage !== undefined || parse.data.observation_stage !== undefined) {
    dbUpdate.stage = parse.data.stage || parse.data.observation_stage!
  }
  if (parse.data.reported_by !== undefined || parse.data.user_id !== undefined) {
    dbUpdate.reported_by = parse.data.reported_by || parse.data.user_id!
  }
  if (parse.data.name !== undefined) {
    dbUpdate.name = parse.data.name
  }
  if (parse.data.description !== undefined) {
    dbUpdate.description = parse.data.description
  }
  if (parse.data.priority !== undefined) {
    dbUpdate.priority = parse.data.priority
  }
  if (parse.data.resolution_comments !== undefined) {
    dbUpdate.resolution_comments = parse.data.resolution_comments
  }
  if (parse.data.closed_by !== undefined) {
    dbUpdate.closed_by = parse.data.closed_by
  }
  if (parse.data.resolved_at !== undefined) {
    dbUpdate.resolved_at = parse.data.resolved_at
  }
  if (parse.data.assigned_to !== undefined) {
    dbUpdate.assigned_to = parse.data.assigned_to
  }
  if (parse.data.notes !== undefined) {
    dbUpdate.notes = parse.data.notes
  }
  
  const { data, error } = await supabase
    .from('observations')
    .update(dbUpdate)
    .eq('id', id)
    .select(`
      *,
      reported_by_user:users!observations_reported_by_fkey (
        id,
        first_name,
        last_name,
        email
      ),
      assigned_to_user:users!observations_assigned_to_fkey (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .single()
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userRole } = tenantContext

  // Role authorization check - observations deletion requires admin or owner role
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Observation deletion requires admin or owner role' 
    }, { status: 403 })
  }
  
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  
  const { error } = await supabase
    .from('observations')
    .delete()
    .eq('id', id)
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
