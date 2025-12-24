import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"
import type { InstructorUser, InstructorWithUser, InstructorsResponse } from "@/lib/types/instructors"

type InstructorRecord = Omit<InstructorWithUser, "user"> & {
  users?: InstructorUser | InstructorUser[]
}

/**
 * GET /api/instructors
 *
 * Returns the list of instructors joined with their user records so the UI
 * can render staff-specific information without additional lookups.
 *
 * Access is restricted to staff (admins/owners) and relies on Supabase RLS to
 * enforce row visibility.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ["owner", "admin"])
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

      return {
        id: typed.id,
        user_id: typed.user_id,
        status: typed.status,
        employment_type: typed.employment_type,
        hire_date: typed.hire_date,
        termination_date: typed.termination_date,
        is_actively_instructing: typed.is_actively_instructing,
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

