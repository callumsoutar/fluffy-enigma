import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { userHasAnyRole } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const reorderAircraftSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        order: z.number().int().min(0),
      })
    )
    .min(1),
})

/**
 * PATCH /api/aircraft/reorder
 *
 * Update aircraft display order (scheduler resource ordering).
 * Restricted to owner/admin/instructor.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ["owner", "admin", "instructor"])
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
  }

  const parsed = reorderAircraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request data", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { items } = parsed.data
  const updatedAt = new Date().toISOString()

  // Use service_role to avoid RLS friction, but keep strict app-layer auth checks above.
  const admin = createAdminClient()

  const results = await Promise.all(
    items.map(async (item) => {
      const { error } = await admin
        .from("aircraft")
        .update({ order: item.order, updated_at: updatedAt })
        .eq("id", item.id)
      return error
    })
  )

  const firstError = results.find(Boolean)
  if (firstError) {
    console.error("Error reordering aircraft:", firstError)
    return NextResponse.json({ error: "Failed to update aircraft order" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

