import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveUserRole } from "@/lib/auth/resolve-role"
import { fetchUserProfile } from "@/lib/auth/user-profile"

export async function GET() {
  const supabase = await createClient()
  // Align with Supabase guidance: validate via getClaims() (signature verified).
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims

  if (!claims?.sub) {
    return NextResponse.json(
      { user: null, role: null, profile: null },
      { status: 200 }
    )
  }

  // Use getUser() to authenticate with Supabase Auth server (eliminates security warning).
  // We've already verified the JWT signature via getClaims(), but getUser() ensures
  // the user data is authentic and up-to-date from the Auth server.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user || user.id !== claims.sub) {
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

