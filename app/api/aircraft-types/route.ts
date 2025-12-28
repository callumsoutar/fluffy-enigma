import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

export async function GET() {
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

  const { data, error } = await supabase
    .from('aircraft_types')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ aircraft_types: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check - only admin/owner can create aircraft types
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Creating aircraft types requires admin or owner role' 
    }, { status: 403 })
  }

  const body = await req.json()
  const { name, category, description } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('aircraft_types')
    .insert({
      name: name.trim(),
      category: category?.trim() || null,
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ aircraft_type: data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check - only admin/owner can update aircraft types
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Updating aircraft types requires admin or owner role' 
    }, { status: 403 })
  }

  const body = await req.json()
  const { id, name, category, description } = body

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 })
  }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('aircraft_types')
    .update({
      name: name.trim(),
      category: category?.trim() || null,
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ aircraft_type: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check - only admin/owner can delete aircraft types
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Deleting aircraft types requires admin or owner role' 
    }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 })
  }

  // Check if any aircraft are using this type
  const { count, error: countError } = await supabase
    .from('aircraft')
    .select('*', { count: 'exact', head: true })
    .eq('aircraft_type_id', id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if (count && count > 0) {
    return NextResponse.json({ 
      error: "Cannot delete aircraft type because it is being used by aircraft" 
    }, { status: 400 })
  }

  const { error } = await supabase
    .from('aircraft_types')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
