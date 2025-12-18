import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  const searchParams = req.nextUrl.searchParams
  const aircraftId = searchParams.get('aircraft_id')
  const id = searchParams.get('id')

  if (id) {
    const { data, error } = await supabase
      .from('aircraft_components')
      .select('*')
      .eq('id', id)
      .is('voided_at', null)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  }

  if (aircraftId) {
    const { data, error } = await supabase
      .from('aircraft_components')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .is('voided_at', null)
      .order('priority', { ascending: true })
      .order('current_due_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: "aircraft_id is required" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check - only instructors and above can create components
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Creating components requires instructor role or above' 
    }, { status: 403 })
  }

  const body = await req.json()
  const { aircraft_id, ...componentData } = body

  if (!aircraft_id) {
    return NextResponse.json({ error: "aircraft_id is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('aircraft_components')
    .insert({
      aircraft_id,
      ...componentData,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check - only instructors and above can update components
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Updating components requires instructor role or above' 
    }, { status: 403 })
  }

  const body = await req.json()
  const { id, ...updateData } = body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  // Add updated_at timestamp
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('aircraft_components')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check - only instructors and above can delete components
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Deleting components requires instructor role or above' 
    }, { status: 403 })
  }

  const body = await req.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  // Soft delete by setting voided_at
  const { error } = await supabase
    .from('aircraft_components')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
