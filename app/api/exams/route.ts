import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"

/**
 * GET /api/exams
 *
 * Returns a list of exams, optionally filtered by syllabus_id.
 *
 * Requires authentication.
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

  const { searchParams } = new URL(request.url)
  const syllabusId = searchParams.get("syllabus_id")

  let query = supabase
    .from("exam")
    .select(`
      id,
      name,
      passing_score,
      syllabus_id,
      created_at,
      updated_at
    `)
    .order("name", { ascending: true })

  if (syllabusId) {
    query = query.eq("syllabus_id", syllabusId)
  }

  const { data: exams, error } = await query

  if (error) {
    console.error("Error fetching exams:", error)
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 })
  }

  return NextResponse.json({ exams })
}

