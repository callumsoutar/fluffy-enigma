import { NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"
import type { UserRole } from "@/lib/types/roles"

type OperationsAccessSuccess = {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: User
}

type OperationsAccessResult = OperationsAccessSuccess | { error: NextResponse }

export async function requireOperationsAccess(
  request: NextRequest,
  roles: UserRole[] = ["owner", "admin", "instructor"]
): Promise<OperationsAccessResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const hasAccess = await userHasAnyRole(user.id, roles)
  if (!hasAccess) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      ),
    }
  }

  return {
    supabase,
    user,
  }
}

