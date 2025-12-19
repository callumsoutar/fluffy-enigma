import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"

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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ["owner", "admin", "instructor"])
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

