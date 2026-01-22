import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveUserRole } from "@/lib/auth/resolve-role"
import { fetchUserProfile } from "@/lib/auth/user-profile"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { user: null, role: null, profile: null },
      { status: 200 }
    )
  }

  const [roleResult, profile] = await Promise.all([
    resolveUserRole(supabase, user),
    fetchUserProfile(supabase, user),
  ])

  return NextResponse.json(
    { user, role: roleResult.role, profile },
    { status: 200 }
  )
}

