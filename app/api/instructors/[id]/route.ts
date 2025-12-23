import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type {
  EmploymentType,
  InstructorStatus,
  InstructorWithUser,
} from "@/lib/types/instructors"
import type { InstructorCategory } from "@/lib/types/instructor-categories"
import { z } from "zod"
import { requireStaffAccess } from "@/lib/api/require-staff-access"

const instructorIdSchema = z.string().uuid()
const employmentTypeSchema = z.enum(["full_time", "part_time", "casual", "contractor"])
const statusSchema = z.enum(["active", "inactive", "deactivated", "suspended"])

const instructorUpdateSchema = z
  .object({
    first_name: z.string().max(100).optional(),
    last_name: z.string().max(100).optional(),
    rating: z.string().max(255).nullable().optional(),
    instructor_check_due_date: z.string().nullable().optional(),
    instrument_check_due_date: z.string().nullable().optional(),
    class_1_medical_due_date: z.string().nullable().optional(),
    employment_type: employmentTypeSchema.nullable().optional(),
    is_actively_instructing: z.boolean().optional(),
    status: statusSchema.optional(),
    notes: z.string().nullable().optional(),
    night_removal: z.boolean().optional(),
    aerobatics_removal: z.boolean().optional(),
    multi_removal: z.boolean().optional(),
    tawa_removal: z.boolean().optional(),
    ifr_removal: z.boolean().optional(),
  })
  .strict()

interface InstructorRecord {
  id: string
  user_id: string
  status: string | null
  employment_type: string | null
  hire_date: string | null
  termination_date: string | null
  is_actively_instructing: boolean | null
  rating: string | null
  instructor_check_due_date: string | null
  instrument_check_due_date: string | null
  class_1_medical_due_date: string | null
  notes: string | null
  night_removal: boolean | null
  aerobatics_removal: boolean | null
  multi_removal: boolean | null
  tawa_removal: boolean | null
  ifr_removal: boolean | null
  created_at: string
  updated_at: string
  users?: InstructorWithUser["user"] | InstructorWithUser["user"][]
}

const normalizeStatus = (value: string | null | undefined): InstructorStatus => {
  if (typeof value === "string" && statusSchema.options.includes(value as InstructorStatus)) {
    return value as InstructorStatus
  }

  return "inactive"
}

const normalizeEmploymentType = (value: string | null | undefined): EmploymentType | null => {
  if (typeof value === "string" && employmentTypeSchema.options.includes(value as EmploymentType)) {
    return value as EmploymentType
  }

  return null
}

async function loadInstructor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  instructorId: string
): Promise<InstructorWithUser | null> {
  const { data, error } = await supabase
    .from("instructors")
    .select(`
      id,
      user_id,
      status,
      employment_type,
      hire_date,
      termination_date,
      is_actively_instructing,
      rating,
      instructor_check_due_date,
      instrument_check_due_date,
      class_1_medical_due_date,
      notes,
      night_removal,
      aerobatics_removal,
      multi_removal,
      tawa_removal,
      ifr_removal,
      created_at,
      updated_at,
      users!inner (
        id,
        email,
        first_name,
        last_name,
        phone,
        is_active
      )
    `)
    .eq("id", instructorId)
    .single()

  if (error) {
    console.error("Failed to load instructor:", error)
    return null
  }

  const record = data as InstructorRecord

  const userRecord = Array.isArray(record.users) ? record.users[0] : record.users
  if (!userRecord) {
    return null
  }

  let ratingCategory: InstructorCategory | null = null
  if (record.rating) {
    const { data: ratingData, error: ratingError } = await supabase
      .from("instructor_categories")
      .select("id, name")
      .eq("id", record.rating)
      .maybeSingle()

    if (ratingError) {
      console.error("Failed to load rating category:", ratingError)
    } else {
      ratingCategory = ratingData ?? null
    }
  }

  return {
    id: record.id,
    user_id: record.user_id,
    status: normalizeStatus(record.status),
    employment_type: normalizeEmploymentType(record.employment_type),
    hire_date: record.hire_date,
    termination_date: record.termination_date,
    is_actively_instructing: Boolean(record.is_actively_instructing),
    rating: record.rating,
    instructor_check_due_date: record.instructor_check_due_date,
    instrument_check_due_date: record.instrument_check_due_date,
    class_1_medical_due_date: record.class_1_medical_due_date,
    notes: record.notes,
    night_removal: record.night_removal,
    aerobatics_removal: record.aerobatics_removal,
    multi_removal: record.multi_removal,
    tawa_removal: record.tawa_removal,
    ifr_removal: record.ifr_removal,
    created_at: record.created_at,
    updated_at: record.updated_at,
    user: {
      id: userRecord.id,
      email: userRecord.email,
      first_name: userRecord.first_name,
      last_name: userRecord.last_name,
      phone: userRecord.phone,
      is_active: userRecord.is_active,
    },
    rating_category: ratingCategory,
  }
}

function sanitizeNullableString(
  value: string | null | undefined
): string | null | undefined {
  if (value === null) return null
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireStaffAccess(request)
  if (unauthorized) {
    return unauthorized
  }

  const { id: instructorId } = await params
  const idValidation = instructorIdSchema.safeParse(instructorId)
  if (!idValidation.success) {
    return NextResponse.json({ error: "Invalid instructor ID" }, { status: 400 })
  }

  const supabase = await createClient()
  const instructor = await loadInstructor(supabase, instructorId)
  if (!instructor) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
  }

  return NextResponse.json({ instructor })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireStaffAccess(request)
  if (unauthorized) {
    return unauthorized
  }

  const { id: instructorId } = await params
  const idValidation = instructorIdSchema.safeParse(instructorId)
  if (!idValidation.success) {
    return NextResponse.json({ error: "Invalid instructor ID" }, { status: 400 })
  }

  const supabase = await createClient()
  const existing = await loadInstructor(supabase, instructorId)
  if (!existing) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = instructorUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const updates = parsed.data

  const userUpdates: Record<string, string> = {}
  const instructorUpdates: Record<string, unknown> = {}

  if (updates.first_name !== undefined) {
    userUpdates.first_name = updates.first_name
  }

  if (updates.last_name !== undefined) {
    userUpdates.last_name = updates.last_name
  }

  if (updates.rating !== undefined) {
    instructorUpdates.rating = sanitizeNullableString(updates.rating)
  }

  if (updates.instructor_check_due_date !== undefined) {
    instructorUpdates.instructor_check_due_date = sanitizeNullableString(
      updates.instructor_check_due_date
    )
  }

  if (updates.instrument_check_due_date !== undefined) {
    instructorUpdates.instrument_check_due_date = sanitizeNullableString(
      updates.instrument_check_due_date
    )
  }

  if (updates.class_1_medical_due_date !== undefined) {
    instructorUpdates.class_1_medical_due_date = sanitizeNullableString(
      updates.class_1_medical_due_date
    )
  }

  if (updates.employment_type !== undefined) {
    instructorUpdates.employment_type = updates.employment_type
  }

  if (updates.is_actively_instructing !== undefined) {
    instructorUpdates.is_actively_instructing = updates.is_actively_instructing
  }

  if (updates.status !== undefined) {
    instructorUpdates.status = updates.status
  }

  if (updates.notes !== undefined) {
    instructorUpdates.notes = sanitizeNullableString(updates.notes)
  }

  if (updates.night_removal !== undefined) {
    instructorUpdates.night_removal = updates.night_removal
  }

  if (updates.aerobatics_removal !== undefined) {
    instructorUpdates.aerobatics_removal = updates.aerobatics_removal
  }

  if (updates.multi_removal !== undefined) {
    instructorUpdates.multi_removal = updates.multi_removal
  }

  if (updates.tawa_removal !== undefined) {
    instructorUpdates.tawa_removal = updates.tawa_removal
  }

  if (updates.ifr_removal !== undefined) {
    instructorUpdates.ifr_removal = updates.ifr_removal
  }

  if (Object.keys(userUpdates).length === 0 && Object.keys(instructorUpdates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  if (Object.keys(userUpdates).length > 0) {
    const { error } = await supabase.from("users").update(userUpdates).eq("id", existing.user.id)
    if (error) {
      console.error("Failed to update user:", error)
      return NextResponse.json({ error: "Failed to update instructor profile" }, { status: 500 })
    }
  }

  if (Object.keys(instructorUpdates).length > 0) {
    const { error } = await supabase
      .from("instructors")
      .update(instructorUpdates)
      .eq("id", existing.id)
    if (error) {
      console.error("Failed to update instructor:", error)
      return NextResponse.json({ error: "Failed to update instructor" }, { status: 500 })
    }
  }

  const updatedInstructor = await loadInstructor(supabase, instructorId)
  if (!updatedInstructor) {
    return NextResponse.json({ error: "Failed to reload instructor" }, { status: 500 })
  }

  return NextResponse.json({ instructor: updatedInstructor })
}

