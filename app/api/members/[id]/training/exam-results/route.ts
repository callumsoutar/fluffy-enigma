import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"
import { memberIdSchema } from "@/lib/validation/members"
import { logExamResultSchema } from "@/lib/validation/training"

/**
 * POST /api/members/[id]/training/exam-results
 *
 * Log an exam result for a member.
 *
 * Requires authentication and instructor/admin/owner role.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: memberId } = await params
  const idValidation = memberIdSchema.safeParse(memberId)
  if (!idValidation.success) {
    return NextResponse.json({ error: "Invalid member ID format" }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = logExamResultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { exam_id, result, score, exam_date, notes } = parsed.data

  // Confirm member exists
  const { data: memberRow, error: memberError } = await supabase
    .from("users")
    .select("id")
    .eq("id", memberId)
    .single()

  if (memberError || !memberRow) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  // Confirm exam exists
  const { data: examRow, error: examError } = await supabase
    .from("exam")
    .select("id")
    .eq("id", exam_id)
    .single()

  if (examError || !examRow) {
    return NextResponse.json({ error: "Exam not found" }, { status: 400 })
  }

  const { data: created, error: createError } = await supabase
    .from("exam_results")
    .insert({
      user_id: memberId,
      exam_id,
      result,
      score: score ?? 0,
      exam_date,
      notes: notes ?? null,
    })
    .select(`
      id,
      exam_id,
      user_id,
      score,
      result,
      exam_date,
      notes,
      created_at,
      updated_at,
      exam:exam_id (
        id,
        name,
        passing_score,
        syllabus_id,
        syllabus:syllabus_id (
          id,
          name
        )
      )
    `)
    .single()

  if (createError || !created) {
    console.error("Error creating exam result:", createError)
    return NextResponse.json({ error: "Failed to log exam result" }, { status: 500 })
  }

  return NextResponse.json({ result: created }, { status: 201 })
}

