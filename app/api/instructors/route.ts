import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"
import type { InstructorUser, InstructorWithUser, InstructorsResponse } from "@/lib/types/instructors"

type InstructorRecord = Omit<InstructorWithUser, "user" | "rating_category"> & {
  users?: InstructorUser | InstructorUser[]
  rating_category?: { id: string; name: string }[] | { id: string; name: string }
}

/**
 * GET /api/instructors
 *
 * Returns the list of instructors joined with their user records so the UI
 * can render staff-specific information without additional lookups.
 *
 * Access is restricted to staff (admins/owners) and relies on Supabase RLS to
 * enforce row visibility and tenant isolation.
 */
export async function GET() {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userRole } = tenantContext
  const hasAccess = ["owner", "admin"].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 })
  }

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
      rating_category:instructor_categories (
        id,
        name
      ),
      users!inner (
        id,
        email,
        first_name,
        last_name,
        phone,
        is_active
      )
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch instructors:", error)
    return NextResponse.json(
      { error: "Failed to fetch instructors" },
      { status: 500 }
    )
  }

  const instructors = (data || [])
    .map((record) => {
      const typed = record as InstructorRecord
      const userRecord = Array.isArray(typed.users) ? typed.users[0] : typed.users
      if (!userRecord) return null

      const ratingCategory = Array.isArray(typed.rating_category) 
        ? typed.rating_category[0] 
        : typed.rating_category

      return {
        id: typed.id,
        user_id: typed.user_id,
        status: typed.status,
        employment_type: typed.employment_type,
        hire_date: typed.hire_date,
        termination_date: typed.termination_date,
        is_actively_instructing: typed.is_actively_instructing,
        rating: typed.rating,
        rating_category: ratingCategory,
        instructor_check_due_date: typed.instructor_check_due_date,
        instrument_check_due_date: typed.instrument_check_due_date,
        class_1_medical_due_date: typed.class_1_medical_due_date,
        notes: typed.notes,
        night_removal: typed.night_removal,
        aerobatics_removal: typed.aerobatics_removal,
        multi_removal: typed.multi_removal,
        tawa_removal: typed.tawa_removal,
        ifr_removal: typed.ifr_removal,
        created_at: typed.created_at,
        updated_at: typed.updated_at,
        user: userRecord,
      }
    })
    .filter(Boolean) as InstructorWithUser[]

  const response: InstructorsResponse = {
    instructors,
    total: instructors.length,
  }

  return NextResponse.json(response)
}

