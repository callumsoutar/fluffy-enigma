import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"

/**
 * GET /api/chargeable_types
 *
 * List chargeable types.
 * Requires authentication and instructor/admin/owner role.
 *
 * Query parameters:
 * - is_active: boolean (optional)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
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

  const { userRole } = tenantContext
  const hasAccess = ["owner", "admin", "instructor"].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const isActive = searchParams.get("is_active")

  let query = supabase.from("chargeable_types").select("*").order("code", { ascending: true })

  if (isActive !== null) {
    query = query.eq("is_active", isActive === "true")
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching chargeable types:", error)
    return NextResponse.json(
      { error: "Failed to fetch chargeable types" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    chargeable_types: data || [],
    total: (data || []).length,
  })
}

