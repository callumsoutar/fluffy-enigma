import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"
import { getSchoolConfigServer } from "@/lib/utils/school-config"

/**
 * GET /api/public-config
 *
 * Returns minimal, non-sensitive school configuration needed for consistent client-side
 * time handling (timezone + business hours). We require authentication and tenant membership
 * to avoid turning this into a public fingerprinting endpoint.
 */
export async function GET() {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  try {
    await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === "NO_MEMBERSHIP") {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const config = await getSchoolConfigServer()
  return NextResponse.json({ config })
}


