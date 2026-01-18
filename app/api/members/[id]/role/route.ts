import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"
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
 * Assigns exactly one active role to a user by updating tenant_users.
 *
 * Security:
 * - Restricted to staff (admin/owner) via server-side check + Supabase RLS.
 * - No side effects (does not create/delete instructor records).
 */
export async function PATCH(
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
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userId: actorId, userRole, tenantId } = tenantContext
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 })
  }

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

  // Check if user already has this role in tenant_users
  const { data: existingTenantUser, error: existingError } = await supabase
    .from("tenant_users")
    .select("id, role_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", memberId)
    .eq("is_active", true)
    .maybeSingle()

  if (existingError) {
    console.error("Failed to load tenant user:", existingError)
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
  }

  if (existingTenantUser?.role_id === roleRow.id) {
    return NextResponse.json({ role: desiredRole })
  }

  // Update or insert tenant_users record
  if (existingTenantUser) {
    const { error: updateError } = await supabase
      .from("tenant_users")
      .update({ role_id: roleRow.id, granted_by: actorId })
      .eq("id", existingTenantUser.id)

    if (updateError) {
      console.error("Failed to update tenant user role:", updateError)
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
    }
  } else {
    const { error: insertError } = await supabase.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: memberId,
      role_id: roleRow.id,
      granted_by: actorId,
      is_active: true,
    })

    if (insertError) {
      console.error("Failed to create tenant user:", insertError)
      return NextResponse.json({ error: "Failed to assign role" }, { status: 500 })
    }
  }

  const normalizedRoleName = String(roleRow.name)
  return NextResponse.json({
    role: isValidRole(normalizedRoleName) ? normalizedRoleName : desiredRole,
  })
}


