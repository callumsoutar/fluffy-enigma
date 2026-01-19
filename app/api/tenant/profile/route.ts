import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { TenantProfileUpdateSchema, type TenantProfile } from '@/lib/settings'

/**
 * GET /api/tenant/profile
 * 
 * Fetch the current tenant's profile information.
 */
export async function GET() {
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

  const { tenantId, userRole } = tenantContext

  // Check authorization - only owners and admins can view tenant profile
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Fetch tenant profile
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(`
      id,
      name,
      slug,
      registration_number,
      description,
      website_url,
      logo_url,
      contact_email,
      contact_phone,
      address,
      billing_address,
      gst_number,
      timezone,
      currency
    `)
    .eq('id', tenantId)
    .single()

  if (error || !tenant) {
    console.error('Error fetching tenant:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tenant profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    profile: tenant as TenantProfile,
  })
}

/**
 * PATCH /api/tenant/profile
 * 
 * Update the current tenant's profile information.
 * 
 * Body: Partial tenant profile fields
 */
export async function PATCH(request: NextRequest) {
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

  const { tenantId, userRole } = tenantContext

  // Check authorization - only owners and admins can update tenant profile
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Parse request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }

  // Validate the update data
  const validationResult = TenantProfileUpdateSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid profile data', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const updateData = validationResult.data

  // Build update object (only include non-undefined fields)
  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updateData)) {
    if (value !== undefined) {
      updates[key] = value
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No fields to update' },
      { status: 400 }
    )
  }

  // Add updated_at
  updates.updated_at = new Date().toISOString()

  // Update tenant profile
  const { data: updatedTenant, error: updateError } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', tenantId)
    .select(`
      id,
      name,
      slug,
      registration_number,
      description,
      website_url,
      logo_url,
      contact_email,
      contact_phone,
      address,
      billing_address,
      gst_number,
      timezone,
      currency
    `)
    .single()

  if (updateError) {
    console.error('Error updating tenant:', updateError)
    return NextResponse.json(
      { error: 'Failed to update tenant profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    profile: updatedTenant as TenantProfile,
    message: 'Profile updated successfully',
  })
}
