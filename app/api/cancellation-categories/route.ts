import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * GET /api/cancellation-categories
 * 
 * Fetch all active cancellation categories (global + tenant-specific)
 */
export async function GET() {
  const supabase = await createClient()
  
  try {
    await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 })
  }

  const { data: categories, error } = await supabase
    .from('cancellation_categories')
    .select('id, name, description, is_global, tenant_id')
    .is('voided_at', null)
    .order('is_global', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching cancellation categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cancellation categories' },
      { status: 500 }
    )
  }

  return NextResponse.json({ categories: categories ?? [] })
}

/**
 * POST /api/cancellation-categories
 * 
 * Create a new tenant-specific cancellation category
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  
  let tenantId: string
  try {
    const context = await getTenantContext(supabase)
    tenantId = context.tenant.id
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, description } = body

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cancellation_categories')
    .insert({
      name,
      description,
      tenant_id: tenantId,
      is_global: false
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating cancellation category:', error)
    return NextResponse.json(
      { error: 'Failed to create cancellation category' },
      { status: 500 }
    )
  }

  return NextResponse.json({ category: data })
}

/**
 * PATCH /api/cancellation-categories
 * 
 * Update a tenant-specific cancellation category
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  
  try {
    await getTenantContext(supabase)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, name, description } = body

  if (!id || !name) {
    return NextResponse.json({ error: 'ID and name are required' }, { status: 400 })
  }

  // RLS will handle the check to ensure it's not global and belongs to the tenant
  const { data, error } = await supabase
    .from('cancellation_categories')
    .update({
      name,
      description,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('is_global', false) // Extra safety check
    .select()
    .single()

  if (error) {
    console.error('Error updating cancellation category:', error)
    return NextResponse.json(
      { error: 'Failed to update cancellation category' },
      { status: 500 }
    )
  }

  return NextResponse.json({ category: data })
}

/**
 * DELETE /api/cancellation-categories
 * 
 * Void a tenant-specific cancellation category
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  const supabase = await createClient()
  
  try {
    await getTenantContext(supabase)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // We use voiding (soft delete) for cancellation categories
  const { error } = await supabase
    .from('cancellation_categories')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_global', false) // Extra safety check

  if (error) {
    console.error('Error deleting cancellation category:', error)
    return NextResponse.json(
      { error: 'Failed to delete cancellation category' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
