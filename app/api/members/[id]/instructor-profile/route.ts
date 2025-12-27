import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireStaffAccess } from "@/lib/api/require-staff-access"
import { memberIdSchema } from "@/lib/validation/members"

const EMPLOYMENT_TYPE_VALUES = ["full_time", "part_time", "casual", "contractor"] as const
const INSTRUCTOR_STATUS_VALUES = ["active", "inactive", "deactivated", "suspended"] as const

const createInstructorProfileSchema = z
  .object({
    employment_type: z.enum(EMPLOYMENT_TYPE_VALUES).nullable().optional(),
    hire_date: z.string().nullable().optional(), // YYYY-MM-DD
    is_actively_instructing: z.boolean().optional(),
    status: z.enum(INSTRUCTOR_STATUS_VALUES).optional(),
    // NOTE: stored in instructors.rating today; interpreted as instructor_categories.id.
    rating: z.string().uuid().nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .strict()

function toMidnightUtcIso(dateValue: string): string {
  // Accept "YYYY-MM-DD" and store as a stable timestamp.
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString()
}

/**
 * POST /api/members/[id]/instructor-profile
 *
 * Explicitly creates an instructors row for the given user_id.
 *
 * Security:
 * - Restricted to staff (admin/owner) via server-side check + Supabase RLS.
 * - No role changes are performed here (role management remains separate).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireStaffAccess(request)
  if (unauthorized) return unauthorized

  const { id: memberId } = await params
  const idValidation = memberIdSchema.safeParse(memberId)
  if (!idValidation.success) {
    return NextResponse.json({ error: "Invalid member ID format" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
  }

  const parsed = createInstructorProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request data", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Ensure member exists
  const { data: existingMember, error: memberError } = await supabase
    .from("users")
    .select("id")
    .eq("id", memberId)
    .single()

  if (memberError || !existingMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  // If already exists, return existing id (no destructive side effects)
  const { data: existingInstructor, error: existingInstructorError } = await supabase
    .from("instructors")
    .select("id, user_id")
    .eq("user_id", memberId)
    .maybeSingle()

  if (existingInstructorError) {
    console.error("Failed checking existing instructor:", existingInstructorError)
    return NextResponse.json({ error: "Failed to create instructor profile" }, { status: 500 })
  }

  if (existingInstructor) {
    return NextResponse.json({ instructor: existingInstructor }, { status: 200 })
  }

  const payload = parsed.data

  const insertData: Record<string, unknown> = {
    user_id: memberId,
    status: payload.status ?? "active",
    employment_type: payload.employment_type ?? null,
    is_actively_instructing: payload.is_actively_instructing ?? false,
    rating: payload.rating ?? null,
    notes: payload.notes ?? null,
  }

  if (payload.hire_date) {
    insertData.hire_date = toMidnightUtcIso(payload.hire_date)
  }

  const { data: created, error: insertError } = await supabase
    .from("instructors")
    .insert(insertData)
    .select("id, user_id")
    .single()

  if (insertError || !created) {
    console.error("Failed to create instructor profile:", insertError)
    return NextResponse.json({ error: "Failed to create instructor profile" }, { status: 500 })
  }

  return NextResponse.json({ instructor: created }, { status: 201 })
}


