import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults"

export type SchoolConfig = {
  timeZone: string
  business_open_time: string
  business_close_time: string
  business_is_24_hours: boolean
  business_is_closed: boolean
}

export const DEFAULT_SCHOOL_TIMEZONE = "Pacific/Auckland"

// Use consistent defaults from the central settings defaults
export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  timeZone: DEFAULT_SCHOOL_TIMEZONE,
  business_open_time: DEFAULT_SETTINGS.business_open_time,
  business_close_time: DEFAULT_SETTINGS.business_close_time,
  business_is_24_hours: DEFAULT_SETTINGS.business_is_24_hours,
  business_is_closed: DEFAULT_SETTINGS.business_is_closed,
}

/**
 * Fetch minimal, safe-to-expose school configuration needed for consistent time handling.
 *
 * This function requires a tenantId to fetch the correct tenant's settings from
 * the new tenant_settings table (flat JSONB structure).
 * 
 * We use the service_role client to avoid coupling core app correctness to RLS.
 * Returned keys are intentionally limited.
 */
export async function getSchoolConfigServer(tenantId: string): Promise<SchoolConfig> {
  const admin = createAdminClient()

  // First, get tenant profile for timezone
  const { data: tenantData } = await admin
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .single()

  // Fetch tenant settings from the new tenant_settings table (flat JSONB)
  const { data: settingsData, error } = await admin
    .from("tenant_settings")
    .select("settings")
    .eq("tenant_id", tenantId)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found (not an error, just means no overrides)
    console.error("Error fetching school config:", error)
    return DEFAULT_SCHOOL_CONFIG
  }

  // Get the settings object (may be null if no overrides exist)
  const settings = settingsData?.settings as Record<string, unknown> | null

  // Handle both nested (legacy) and flat (new) formats
  const flatSettings = settings ? flattenIfNested(settings) : {}

  // Extract values with fallback to defaults
  const open = flatSettings.business_open_time
  const close = flatSettings.business_close_time
  const is24 = flatSettings.business_is_24_hours
  const isClosed = flatSettings.business_is_closed

  return {
    timeZone: 
      typeof tenantData?.timezone === "string" && tenantData.timezone.length > 0 
        ? tenantData.timezone 
        : DEFAULT_SCHOOL_CONFIG.timeZone,
    business_open_time:
      typeof open === "string" && open.length > 0 ? open : DEFAULT_SCHOOL_CONFIG.business_open_time,
    business_close_time:
      typeof close === "string" && close.length > 0 ? close : DEFAULT_SCHOOL_CONFIG.business_close_time,
    business_is_24_hours: typeof is24 === "boolean" ? is24 : DEFAULT_SCHOOL_CONFIG.business_is_24_hours,
    business_is_closed: typeof isClosed === "boolean" ? isClosed : DEFAULT_SCHOOL_CONFIG.business_is_closed,
  }
}

/**
 * Flatten nested settings structure to flat structure.
 * This handles migration from old nested format to new flat format.
 */
function flattenIfNested(settings: Record<string, unknown>): Record<string, unknown> {
  const nestedCategories = ['general', 'bookings', 'invoicing', 'maintenance', 'memberships', 'notifications', 'security', 'system', 'training']
  const hasNestedStructure = Object.keys(settings).some(
    key => nestedCategories.includes(key) && typeof settings[key] === 'object' && settings[key] !== null
  )

  if (!hasNestedStructure) {
    return settings
  }

  const flattened: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(settings)) {
    if (nestedCategories.includes(key) && typeof value === 'object' && value !== null) {
      Object.assign(flattened, value)
    } else {
      flattened[key] = value
    }
  }

  return flattened
}


