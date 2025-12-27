import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"
import { memberIdSchema } from "@/lib/validation/members"

/**
 * GET /api/members/[id]/training
 *
 * Returns training data for a member:
 * - exam results (joined to exam + syllabus)
 * - syllabus enrollments (joined to syllabus)
 * - active syllabi (for enrollment UI)
 *
 * Requires authentication and instructor/admin/owner role.
 */
export async function GET(
  _request: NextRequest,
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

  // Fetch enrollments with joined syllabus
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("student_syllabus_enrollment")
    .select(
      `
        id,
        user_id,
        syllabus_id,
        enrolled_at,
        completion_date,
        status,
        notes,
        primary_instructor_id,
        aircraft_type,
        created_at,
        updated_at,
        syllabus:syllabus_id (
          id,
          name,
          description,
          is_active,
          voided_at
        ),
        aircraft_types:aircraft_type (
          id,
          name
        )
      `
    )
    .eq("user_id", memberId)
    .order("enrolled_at", { ascending: false })

  if (enrollmentError) {
    console.error("Error fetching syllabus enrollments:", enrollmentError)
    return NextResponse.json(
      { error: "Failed to fetch syllabus enrollments" },
      { status: 500 }
    )
  }

  // Fetch exam results with joined exam and syllabus
  const { data: examResults, error: examResultsError } = await supabase
    .from("exam_results")
    .select(
      `
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
      `
    )
    .eq("user_id", memberId)
    .order("exam_date", { ascending: false })

  if (examResultsError) {
    console.error("Error fetching exam results:", examResultsError)
    return NextResponse.json({ error: "Failed to fetch exam results" }, { status: 500 })
  }

  // Fetch active syllabi for enrollment UI (RLS policy limits to active+non-voided)
  const { data: syllabi, error: syllabiError } = await supabase
    .from("syllabus")
    .select("id, name, description, is_active, number_of_exams, created_at, updated_at, voided_at")
    .eq("is_active", true)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (syllabiError) {
    console.error("Error fetching syllabi:", syllabiError)
    return NextResponse.json({ error: "Failed to fetch syllabi" }, { status: 500 })
  }

  return NextResponse.json({
    training: {
      examResults: examResults || [],
      enrollments: enrollments || [],
      syllabi: syllabi || [],
    },
  })
}


