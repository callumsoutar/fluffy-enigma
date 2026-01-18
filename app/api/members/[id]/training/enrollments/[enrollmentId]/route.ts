import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"
import { memberIdSchema } from "@/lib/validation/members"
import { createSyllabusEnrollmentSchema } from "@/lib/validation/training"

/**
 * PATCH /api/members/[id]/training/enrollments/[enrollmentId]
 *
 * Update an existing syllabus enrollment.
 *
 * Requires authentication and instructor/admin/owner role.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
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

  const { id: memberId, enrollmentId } = await params
  
  const idValidation = memberIdSchema.safeParse(memberId)
  if (!idValidation.success) {
    return NextResponse.json({ error: "Invalid member ID format" }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  
  // We reuse the creation schema for validation, but make it partial-like
  const parsed = createSyllabusEnrollmentSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { notes, primary_instructor_id, aircraft_type, status, enrolled_at } = parsed.data

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  
  if (notes !== undefined) updatePayload.notes = notes
  if (primary_instructor_id !== undefined) updatePayload.primary_instructor_id = primary_instructor_id
  if (aircraft_type !== undefined) updatePayload.aircraft_type = aircraft_type
  if (status !== undefined) updatePayload.status = status
  if (enrolled_at !== undefined) updatePayload.enrolled_at = enrolled_at

  const { data: updated, error: updateError } = await supabase
    .from("student_syllabus_enrollment")
    .update(updatePayload)
    .eq("id", enrollmentId)
    .eq("user_id", memberId)
    .select()
    .single()

  if (updateError) {
    console.error("Error updating enrollment:", updateError)
    return NextResponse.json({ error: "Failed to update enrollment" }, { status: 500 })
  }

  return NextResponse.json({ enrollment: updated })
}

