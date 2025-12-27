import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireStaffAccess } from "@/lib/api/require-staff-access"
import { memberIdSchema } from "@/lib/validation/members"
import type { UserRole } from "@/lib/types/roles"
import { isValidRole } from "@/lib/types/roles"

const updateMemberRoleSchema = z
  .object({
    role: z.enum(["member", "student", "instructor", "admin", "owner"]),
  })
  .strict()

/**
 * PATCH /api/members/[id]/role
 *
 * Assigns exactly one active role to a user by updating ONLY user_roles.
 *
 * Security:
 * - Restricted to staff (admin/owner) via server-side check + Supabase RLS.
 * - No side effects (does not create/delete instructor records).
 */
export async function PATCH(
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

  const parsed = updateMemberRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request data", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user: actor },
  } = await supabase.auth.getUser()

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Ensure target user exists (and that caller can see it through RLS)
  const { data: existingMember, error: memberError } = await supabase
    .from("users")
    .select("id")
    .eq("id", memberId)
    .single()

  if (memberError || !existingMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  const desiredRole = parsed.data.role as UserRole

  // Resolve role_id from roles table
  const { data: roleRow, error: roleError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("name", desiredRole)
    .eq("is_active", true)
    .single()

  if (roleError || !roleRow?.id) {
    return NextResponse.json({ error: "Unknown or inactive role" }, { status: 400 })
  }

  // If already exactly-one active role and it's the desired one, no-op.
  const { data: activeUserRoles, error: activeRolesError } = await supabase
    .from("user_roles")
    .select("id, role_id")
    .eq("user_id", memberId)
    .eq("is_active", true)

  if (activeRolesError) {
    console.error("Failed to load active user roles:", activeRolesError)
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
  }

  if (
    Array.isArray(activeUserRoles) &&
    activeUserRoles.length === 1 &&
    activeUserRoles[0]?.role_id === roleRow.id
  ) {
    return NextResponse.json({ role: desiredRole })
  }

  // Deactivate any existing active roles (cleanly enforces "exactly one role").
  const { error: deactivateError } = await supabase
    .from("user_roles")
    .update({ is_active: false })
    .eq("user_id", memberId)
    .eq("is_active", true)

  if (deactivateError) {
    console.error("Failed to deactivate existing roles:", deactivateError)
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
  }

  const { error: insertError } = await supabase.from("user_roles").insert({
    user_id: memberId,
    role_id: roleRow.id,
    granted_by: actor.id,
    is_active: true,
  })

  if (insertError) {
    console.error("Failed to assign role:", insertError)
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 })
  }

  const normalizedRoleName = String(roleRow.name)
  return NextResponse.json({
    role: isValidRole(normalizedRoleName) ? normalizedRoleName : desiredRole,
  })
}


