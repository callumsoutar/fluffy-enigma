import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasTenantRole, getTenantContext } from "@/lib/auth/tenant"
import type { TenantContext } from "@/lib/types/tenant"

/**
 * Require staff (owner/admin) access for an API route
 * Returns null if access is granted, or a NextResponse error if denied
 * 
 * @deprecated Consider using requireTenantAccess for more explicit tenant context
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requireStaffAccess(_request: NextRequest): Promise<NextResponse | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasAccess = await hasTenantRole(["owner", "admin"], supabase)
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: Insufficient permissions" },
      { status: 403 }
    )
  }

  return null
}

/**
 * Result of tenant access check
 */
export interface TenantAccessResult {
  /** Error response if access denied, null if granted */
  error: NextResponse | null
  /** Tenant context if access granted */
  context: TenantContext | null
}

/**
 * Require tenant membership and optionally specific roles
 * Returns tenant context if access is granted
 * 
 * @param requiredRoles - Optional array of roles that grant access (any match = access)
 *                        If not provided, any tenant membership grants access
 */
export async function requireTenantAccess(
  requiredRoles?: ("owner" | "admin" | "instructor" | "member" | "student")[]
): Promise<TenantAccessResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      context: null,
    }
  }

  try {
    const context = await getTenantContext(supabase)
    
    // If specific roles required, check them
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(context.userRole)) {
        return {
          error: NextResponse.json(
            { error: "Forbidden: Insufficient permissions" },
            { status: 403 }
          ),
          context: null,
        }
      }
    }
    
    return { error: null, context }
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === "NO_MEMBERSHIP") {
      return {
        error: NextResponse.json(
          { error: "Forbidden: No tenant membership" },
          { status: 403 }
        ),
        context: null,
      }
    }
    
    return {
      error: NextResponse.json(
        { error: "Failed to resolve tenant context" },
        { status: 500 }
      ),
      context: null,
    }
  }
}

