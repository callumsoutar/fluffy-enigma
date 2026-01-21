import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"

/**
 * GET /api/chargeable_types
 *
 * List chargeable types (hybrid: global + tenant-specific).
 * Returns global types available to all tenants AND custom types for the user's tenant.
 * Requires authentication and instructor/admin/owner role.
 *
 * Query parameters:
 * - is_active: boolean (optional) - filter by active status
 * - scope: "all" | "global" | "tenant" (optional) - filter by type scope
 */
export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams
  const isActive = searchParams.get("is_active")
  const scope = searchParams.get("scope") // "all" | "global" | "tenant"

  // RLS policies will automatically filter to global types + tenant-specific types
  // We just need to apply additional filters based on query params
  let query = supabase
    .from("chargeable_types")
    .select("*")
    .order("is_global", { ascending: false }) // Global types first
    .order("code", { ascending: true })

  if (isActive !== null) {
    query = query.eq("is_active", isActive === "true")
  }

  // Optional scope filter
  if (scope === "global") {
    query = query.eq("is_global", true)
  } else if (scope === "tenant") {
    query = query.eq("is_global", false)
  }
  // "all" or null = return both (default behavior via RLS)

  const { data, error } = await query

  if (error) {
    console.error("Error fetching chargeable types:", error)
    return NextResponse.json(
      { error: "Failed to fetch chargeable types" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    chargeable_types: data || [],
    total: (data || []).length,
  })
}

/**
 * POST /api/chargeable_types
 *
 * Create a new tenant-specific chargeable type.
 * Requires authentication and admin/owner role.
 *
 * Body:
 * - code: string (required, unique within tenant)
 * - name: string (required)
 * - description: string (optional)
 * - is_active: boolean (optional, defaults to true)
 */
export async function POST(request: NextRequest) {
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

  const { userRole, tenantId } = tenantContext
  const hasAccess = ["owner", "admin"].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions. Admin or owner role required." },
      { status: 403 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }

  const { code, name, description, is_active = true } = body

  if (!code || !name) {
    return NextResponse.json(
      { error: "Missing required fields: code and name" },
      { status: 400 }
    )
  }

  // Validate code format (lowercase, alphanumeric, underscores)
  if (!/^[a-z0-9_]+$/.test(code)) {
    return NextResponse.json(
      { error: "Code must contain only lowercase letters, numbers, and underscores" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("chargeable_types")
    .insert({
      code,
      name,
      description: description || null,
      is_global: false, // Tenant-specific type
      tenant_id: tenantId,
      is_active,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating chargeable type:", error)
    
    // Check for unique constraint violation
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A chargeable type with this code already exists for your organization" },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to create chargeable type" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    chargeable_type: data,
    message: "Chargeable type created successfully",
  }, { status: 201 })
}

/**
 * PUT /api/chargeable_types
 *
 * Update an existing chargeable type.
 * Can only update tenant-specific types (not global types, unless you're a system owner).
 * Requires authentication and admin/owner role.
 *
 * Body:
 * - id: string (required)
 * - name: string (optional)
 * - description: string (optional)
 * - is_active: boolean (optional)
 */
export async function PUT(request: NextRequest) {
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
  const hasAccess = ["owner", "admin"].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions. Admin or owner role required." },
      { status: 403 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }

  const { id, name, description, is_active } = body

  if (!id) {
    return NextResponse.json(
      { error: "Missing required field: id" },
      { status: 400 }
    )
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (is_active !== undefined) updates.is_active = is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("chargeable_types")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating chargeable type:", error)
    
    // Check if the error is due to RLS (trying to update a global type or another tenant's type)
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Chargeable type not found or you don't have permission to update it" },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to update chargeable type" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    chargeable_type: data,
    message: "Chargeable type updated successfully",
  })
}

/**
 * DELETE /api/chargeable_types
 *
 * Delete a chargeable type.
 * Can only delete tenant-specific types (not global types, unless you're a system owner).
 * Requires authentication and owner role.
 *
 * Query parameters:
 * - id: string (required)
 */
export async function DELETE(request: NextRequest) {
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
  const hasAccess = userRole === "owner"
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: Owner role required to delete chargeable types" },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json(
      { error: "Missing required parameter: id" },
      { status: 400 }
    )
  }

  // Check if any chargeables are using this type
  const { data: chargeables, error: checkError } = await supabase
    .from("chargeables")
    .select("id")
    .eq("chargeable_type_id", id)
    .limit(1)

  if (checkError) {
    console.error("Error checking chargeable usage:", checkError)
    return NextResponse.json(
      { error: "Failed to verify if chargeable type is in use" },
      { status: 500 }
    )
  }

  if (chargeables && chargeables.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete chargeable type that is in use by chargeables" },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from("chargeable_types")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting chargeable type:", error)
    
    // Check if the error is due to RLS (trying to delete a global type or another tenant's type)
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Chargeable type not found or you don't have permission to delete it" },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: "Failed to delete chargeable type" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    message: "Chargeable type deleted successfully",
  })
}

