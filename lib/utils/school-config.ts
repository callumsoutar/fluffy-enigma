import { createAdminClient } from "@/lib/supabase/admin"

export type SchoolConfig = {
  timeZone: string
  business_open_time: string
  business_close_time: string
  business_is_24_hours: boolean
  business_is_closed: boolean
}

export const DEFAULT_SCHOOL_TIMEZONE = "Pacific/Auckland"

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  timeZone: DEFAULT_SCHOOL_TIMEZONE,
  business_open_time: "09:00:00",
  business_close_time: "17:00:00",
  business_is_24_hours: false,
  business_is_closed: false,
}

/**
 * Fetch minimal, safe-to-expose school configuration needed for consistent time handling.
 *
 * We use the service_role client to avoid coupling core app correctness to settings-table RLS.
 * Returned keys are intentionally limited.
 */
export async function getSchoolConfigServer(): Promise<SchoolConfig> {
  const admin = createAdminClient()

  const keys = [
    "timezone",
    "business_open_time",
    "business_close_time",
    "business_is_24_hours",
    "business_is_closed",
  ] as const

  const { data, error } = await admin
    .from("settings")
    .select("setting_key, setting_value")
    .eq("category", "general")
    .in("setting_key", [...keys])

  if (error || !data) return DEFAULT_SCHOOL_CONFIG

  const map = new Map<string, unknown>()
  for (const row of data) {
    map.set(row.setting_key as string, (row as { setting_value?: unknown }).setting_value)
  }

  const tz = map.get("timezone")
  const open = map.get("business_open_time")
  const close = map.get("business_close_time")
  const is24 = map.get("business_is_24_hours")
  const isClosed = map.get("business_is_closed")

  return {
    timeZone: typeof tz === "string" && tz.length > 0 ? tz : DEFAULT_SCHOOL_CONFIG.timeZone,
    business_open_time:
      typeof open === "string" && open.length > 0 ? open : DEFAULT_SCHOOL_CONFIG.business_open_time,
    business_close_time:
      typeof close === "string" && close.length > 0 ? close : DEFAULT_SCHOOL_CONFIG.business_close_time,
    business_is_24_hours: typeof is24 === "boolean" ? is24 : DEFAULT_SCHOOL_CONFIG.business_is_24_hours,
    business_is_closed: typeof isClosed === "boolean" ? isClosed : DEFAULT_SCHOOL_CONFIG.business_is_closed,
  }
}


