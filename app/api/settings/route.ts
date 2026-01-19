import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { 
  getEffectiveSettings, 
  extractOverrides,
  PartialSettingsSchema,
  type PartialSettings,
} from '@/lib/settings'

/**
 * GET /api/settings
 * 
 * Fetch settings with defaults merged with tenant overrides.
 * Returns FLAT settings object (not nested by category).
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

  // Check authorization - only owners and admins can view settings
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Fetch tenant overrides from tenant_settings
  const { data: tenantSettings, error } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (not an error, just means no overrides)
    console.error('Error fetching tenant settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }

  // Handle both nested (legacy) and flat (new) formats
  const rawOverrides = tenantSettings?.settings || {}
  const overrides = flattenIfNested(rawOverrides) as PartialSettings

  // Return effective settings (defaults merged with overrides)
  const effectiveSettings = getEffectiveSettings(overrides)
  
  return NextResponse.json({
    settings: effectiveSettings,
  })
}

/**
 * PATCH /api/settings
 * 
 * Update settings. Accepts flat key-value pairs.
 * Only non-default values are stored.
 * 
 * Body:
 * - settings: object - Settings to update (partial, flat structure)
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

  const { tenantId, userId, userRole } = tenantContext

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

  const { settings: newSettings } = body as {
    settings?: Record<string, unknown>
  }

  if (!newSettings || typeof newSettings !== 'object') {
    return NextResponse.json(
      { error: 'Missing required field: settings' },
      { status: 400 }
    )
  }

  // Fetch current tenant settings
  const { data: currentTenantSettings } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .single()

  // Handle both nested (legacy) and flat (new) formats
  const rawCurrentOverrides = currentTenantSettings?.settings || {}
  const currentOverrides = flattenIfNested(rawCurrentOverrides) as PartialSettings
  
  // Merge new settings with current overrides
  const mergedSettings: PartialSettings = {
    ...currentOverrides,
    ...newSettings,
  }

  // Extract only non-default values to store
  const settingsToStore = extractOverrides(mergedSettings)

  // Validate the settings
  const validationResult = PartialSettingsSchema.safeParse(settingsToStore)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid settings', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  // Upsert the tenant settings (store as flat structure)
  const { error: upsertError } = await supabase
    .from('tenant_settings')
    .upsert({
      tenant_id: tenantId,
      settings: settingsToStore,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id',
    })

  if (upsertError) {
    console.error('Error updating settings:', upsertError)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }

  // Return the effective settings
  const effectiveSettings = getEffectiveSettings(settingsToStore)

  return NextResponse.json({
    settings: effectiveSettings,
    message: 'Settings updated successfully',
  })
}

/**
 * Flatten nested settings structure to flat structure.
 * This handles migration from old nested format to new flat format.
 * 
 * Old format: { general: { business_open_time: "..." }, bookings: { ... } }
 * New format: { business_open_time: "...", allow_past_bookings: ... }
 */
function flattenIfNested(settings: Record<string, unknown>): Record<string, unknown> {
  // Check if this is nested format (has category keys)
  const nestedCategories = ['general', 'bookings', 'invoicing', 'maintenance', 'memberships', 'notifications', 'security', 'system', 'training']
  const hasNestedStructure = Object.keys(settings).some(
    key => nestedCategories.includes(key) && typeof settings[key] === 'object' && settings[key] !== null
  )

  if (!hasNestedStructure) {
    // Already flat format
    return settings
  }

  // Flatten the nested structure
  const flattened: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(settings)) {
    if (nestedCategories.includes(key) && typeof value === 'object' && value !== null) {
      // Spread category contents to top level
      Object.assign(flattened, value)
    } else {
      // Keep non-category keys as-is
      flattened[key] = value
    }
  }

  return flattened
}
