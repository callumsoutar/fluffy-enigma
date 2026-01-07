import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSchoolConfigServer } from "@/lib/utils/school-config"

/**
 * GET /api/public-config
 *
 * Returns minimal, non-sensitive school configuration needed for consistent client-side
 * time handling (timezone + business hours). We require authentication to avoid turning this
 * into a public fingerprinting endpoint, but we deliberately do NOT gate it to admin-only.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await getSchoolConfigServer()
  return NextResponse.json({ config })
}


