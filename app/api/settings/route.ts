import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * GET /api/settings
 * 
 * Fetch settings from the settings table
 * Requires authentication and owner/admin role
 * 
 * Query parameters:
 * - category: string - Filter by category
 * - key: string - Filter by setting key
 */
export async function GET(request: NextRequest) {
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

  // Check authorization - only owners and admins can view settings
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams
  const category = searchParams.get('category')
  const key = searchParams.get('key')

  // Build query
  let query = supabase
    .from('settings')
    .select('*')

  // Apply filters
  if (category) {
    query = query.eq('category', category)
  }

  if (key) {
    query = query.eq('setting_key', key)
  }

  // Execute query
  const { data: settings, error } = await query

  if (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }

  // If both category and key are provided, return single setting
  if (category && key && settings && settings.length > 0) {
    return NextResponse.json({
      setting: settings[0],
    })
  }

  return NextResponse.json({
    settings: settings || [],
  })
}

/**
 * PATCH /api/settings
 * 
 * Update a setting value
 * Requires authentication and owner/admin role
 * 
 * Body:
 * - category: string - Setting category
 * - setting_key: string - Setting key
 * - setting_value: any - New value
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

  const { userId: currentUserId, userRole } = tenantContext

  // Check authorization - only owners and admins can update settings
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

  const { category, setting_key, setting_value } = body as {
    category?: string
    setting_key?: string
    setting_value?: unknown
  }

  // Validate required fields
  if (!category || !setting_key) {
    return NextResponse.json(
      { error: 'Missing required fields: category and setting_key' },
      { status: 400 }
    )
  }

  // Find the setting
  const { data: existingSetting, error: findError } = await supabase
    .from('settings')
    .select('*')
    .eq('category', category)
    .eq('setting_key', setting_key)
    .single()

  if (findError || !existingSetting) {
    return NextResponse.json(
      { error: 'Setting not found' },
      { status: 404 }
    )
  }

  // Update the setting
  const { data: updatedSetting, error: updateError } = await supabase
    .from('settings')
    .update({
      setting_value,
      updated_by: currentUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingSetting.id)
    .select()
    .single()

  if (updateError) {
    console.error('Error updating setting:', updateError)
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    setting: updatedSetting,
  })
}
