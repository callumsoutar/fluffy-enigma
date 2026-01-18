import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

export async function GET() {
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
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('exam')
    .select('*')
    .is('voided_at', null)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ exams: data || [] })
}

export async function POST(request: NextRequest) {
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
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, description, syllabus_id, passing_score, is_active } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('exam')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        syllabus_id: (syllabus_id && syllabus_id !== 'none') ? syllabus_id : null,
        passing_score: passing_score !== undefined ? passing_score : 70,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ exam: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Invalid request body' 
    }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
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
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, name, description, syllabus_id, passing_score, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('exam')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        syllabus_id: (syllabus_id && syllabus_id !== 'none') ? syllabus_id : null,
        passing_score: passing_score !== undefined ? passing_score : 70,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ exam: data })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Invalid request body' 
    }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
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
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  // Soft delete - mark with voided_at instead of actually deleting
  const { data, error } = await supabase
    .from('exam')
    .update({
      voided_at: new Date().toISOString(),
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ exam: data })
}
