import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"
import { memberIdSchema } from "@/lib/validation/members"
import { createSyllabusEnrollmentSchema } from "@/lib/validation/training"

/**
 * POST /api/members/[id]/training/enrollments
 *
 * Enroll a member into a syllabus.
 * - Validates input
 * - Prevents duplicate active enrollment for the same syllabus
 * - Audited via DB trigger (public.log_table_audit)
 *
 * Requires authentication and instructor/admin/owner role.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === "NO_MEMBERSHIP") {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userRole } = tenantContext
  const hasAccess = ["owner", "admin", "instructor"].includes(userRole)
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
  const parsed = createSyllabusEnrollmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { syllabus_id, notes, primary_instructor_id, aircraft_type, enrolled_at } = parsed.data

  // Confirm member exists (and caller has access) before proceeding
  const { data: memberRow, error: memberError } = await supabase
    .from("users")
    .select("id")
    .eq("id", memberId)
    .single()

  if (memberError || !memberRow) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  // Confirm syllabus exists and is selectable (RLS policy limits to active+non-voided)
  const { data: syllabus, error: syllabusError } = await supabase
    .from("syllabus")
    .select("id, name")
    .eq("id", syllabus_id)
    .single()

  if (syllabusError || !syllabus) {
    return NextResponse.json({ error: "Invalid syllabus selection" }, { status: 400 })
  }

  // Prevent multiple active enrollments for the same member+syllabus
  const { data: existingActive, error: existingError } = await supabase
    .from("student_syllabus_enrollment")
    .select("id")
    .eq("user_id", memberId)
    .eq("syllabus_id", syllabus_id)
    .eq("status", "active")
    .is("completion_date", null)
    .limit(1)

  if (existingError) {
    console.error("Error checking existing enrollments:", existingError)
    return NextResponse.json({ error: "Failed to validate enrollment" }, { status: 500 })
  }

  if (existingActive && existingActive.length > 0) {
    return NextResponse.json(
      { error: "Member is already actively enrolled in this syllabus" },
      { status: 409 }
    )
  }

  const { data: created, error: createError } = await supabase
    .from("student_syllabus_enrollment")
    .insert({
      user_id: memberId,
      syllabus_id,
      status: "active",
      notes: notes ?? null,
      primary_instructor_id: primary_instructor_id ?? null,
      aircraft_type: aircraft_type ?? null,
      enrolled_at: enrolled_at ?? new Date().toISOString(),
    })
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
          name
        )
      `
    )
    .single()

  if (createError || !created) {
    console.error("Error creating enrollment:", createError)
    return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 })
  }

  return NextResponse.json({ enrollment: created }, { status: 201 })
}


