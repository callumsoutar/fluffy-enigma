import { NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"
import type { UserRole } from "@/lib/types/roles"
import type { TenantContext } from "@/lib/types/tenant"

type OperationsAccessSuccess = {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: User
  /** Tenant context - available after migration to multi-tenant */
  tenantContext: TenantContext
}

type OperationsAccessResult = OperationsAccessSuccess | { error: NextResponse }

/**
 * Require operations access (staff roles) for an API route
 * Returns supabase client, user, and tenant context if access granted
 * 
 * @param _request - NextRequest (unused but kept for API compatibility)
 * @param roles - Array of roles that grant access (default: owner, admin, instructor)
 */
export async function requireOperationsAccess(
  _request: NextRequest,
  roles: UserRole[] = ["owner", "admin", "instructor"]
): Promise<OperationsAccessResult> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const userId = claims?.sub

  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  try {
    // We rely on getClaims() for signature verification.
    // If we also need a full user object, it is safe to read it from the session
    // (cookie storage) as long as we confirm it matches the verified `sub`.
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const sessionUser = session?.user

    const tenantContext = await getTenantContext(supabase)
    
    // Check if user has any of the required roles at their tenant
    if (!roles.includes(tenantContext.userRole)) {
      return {
        error: NextResponse.json(
          { error: "Forbidden: insufficient permissions" },
          { status: 403 }
        ),
      }
    }

    return {
      supabase,
      user: (sessionUser && sessionUser.id === userId
        ? sessionUser
        : ({ id: userId } as User)),
      tenantContext,
    }
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === "NO_MEMBERSHIP") {
      return {
        error: NextResponse.json(
          { error: "Forbidden: No tenant membership" },
          { status: 403 }
        ),
      }
    }
    
    return {
      error: NextResponse.json(
        { error: "Failed to resolve tenant context" },
        { status: 500 }
      ),
    }
  }
}

