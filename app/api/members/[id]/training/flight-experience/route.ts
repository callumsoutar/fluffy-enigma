import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"
import { memberIdSchema } from "@/lib/validation/members"
import { logFlightExperienceSchema } from "@/lib/validation/training"

/**
 * POST /api/members/[id]/training/flight-experience
 *
 * Log a flight experience record for a member manually.
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

  const { userId: currentUserId, userRole } = tenantContext
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
  const parsed = logFlightExperienceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { 
    experience_type_id, 
    value, 
    unit, 
    occurred_at, 
    notes, 
    conditions,
    instructor_id 
  } = parsed.data

  // Confirm member exists
  const { data: memberRow, error: memberError } = await supabase
    .from("users")
    .select("id")
    .eq("id", memberId)
    .single()

  if (memberError || !memberRow) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  // Log the experience
  const { data: created, error: createError } = await supabase
    .from("flight_experience")
    .insert({
      user_id: memberId,
      experience_type_id,
      value,
      unit,
      occurred_at,
      notes: notes ?? null,
      conditions: conditions ?? null,
      instructor_id: instructor_id ?? null,
      created_by: currentUserId
    })
    .select(`
      id,
      user_id,
      booking_id,
      instructor_id,
      experience_type_id,
      value,
      unit,
      occurred_at,
      notes,
      conditions,
      experience_type:experience_type_id (
        id,
        name
      ),
      instructor:instructor_id (
        id,
        user:user_id (
          first_name,
          last_name
        )
      )
    `)
    .single()

  if (createError || !created) {
    console.error("Error creating flight experience:", createError)
    return NextResponse.json({ error: "Failed to log flight experience" }, { status: 500 })
  }

  return NextResponse.json({ result: created }, { status: 201 })
}
