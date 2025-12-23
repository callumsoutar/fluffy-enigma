import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"

export async function requireStaffAccess(request: NextRequest): Promise<NextResponse | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ["owner", "admin"])
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    )
  }

  return null
}

