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

  // It's safe to read the user object from cookie storage after we verify the JWT signature.
  // (We also confirm the IDs match as an extra guard.)
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  if (!user || user.id !== claims.sub) {
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

