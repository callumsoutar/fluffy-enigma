import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"
import { memberIdSchema } from "@/lib/validation/members"

/**
 * GET /api/members/[id]/training/comments
 * 
 * Returns paginated instructor comments from lesson_progress for a specific member.
 * Includes aircraft and instructor details via joins.
 */
export async function GET(
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

  // Check authorization - members can see their own training comments, 
  // but trainers/admins can see anyone's
  const { id: memberId } = await params
  
  const isSelf = user.id === memberId
  const hasStaffAccess = await userHasAnyRole(user.id, ["owner", "admin", "instructor"])
  
  if (!isSelf && !hasStaffAccess) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    )
  }

  const idValidation = memberIdSchema.safeParse(memberId)
  if (!idValidation.success) {
    return NextResponse.json({ error: "Invalid member ID format" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const offset = parseInt(searchParams.get("offset") || "0")
  const limit = parseInt(searchParams.get("limit") || "5")

  // Fetch lesson progress records with comments
  const { data, error } = await supabase
    .from("lesson_progress")
    .select(`
      id,
      date,
      instructor_comments,
      booking:bookings!lesson_progress_booking_id_fkey(
        aircraft:aircraft!bookings_aircraft_id_fkey(registration)
      ),
      instructor:instructors!lesson_progress_instructor_id_fkey(
        user:users!instructors_user_id_fkey(first_name, last_name)
      )
    `)
    .eq("user_id", memberId)
    .not("instructor_comments", "is", null) // Only fetch records that have comments
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error("Error fetching lesson progress comments:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comments: data || [] })
}

