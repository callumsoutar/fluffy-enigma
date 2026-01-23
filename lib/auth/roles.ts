/**
 * Server-side role checking utilities
 * 
 * This module provides tenant-aware role checking for server components,
 * API routes, and middleware. All functions are designed for multi-tenant
 * scenarios and query the canonical tenant_users table.
 * 
 * USAGE:
 * - For tenant context and role: Use getTenantContext() - returns full context
 * - For role checking: Use hasTenantRole() - checks if user has specific roles
 * - For session validation: Use needsSessionRefresh() - detects role drift
 * 
 * All deprecated legacy functions have been removed. Use the tenant-aware
 * equivalents from lib/auth/tenant.ts instead.
 */

import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types/roles';
import { isValidRole, ROLE_HIERARCHY } from '@/lib/types/roles';

// Re-export all tenant functions as the primary API
export { 
  getTenantId, 
  getTenantContext, 
  hasTenantRole, 
  userHasTenantRole,
  getCurrentTenantRole,
  validateTenantAccess,
  getUserTenants 
} from './tenant';

/**
 * Check if user's session needs to be refreshed due to role changes
 * 
 * This function checks if the user's role has changed since their JWT was issued.
 * Use this to detect when a user's permissions have been modified by an admin.
 * 
 * @param userId - The user's ID
 * @param tokenIssuedAt - When the current JWT was issued (from JWT claims)
 * @returns true if the session should be refreshed
 * 
 * @example
 * // In middleware or API route
 * const jwt = await getUser()
 * const needsRefresh = await needsSessionRefresh(jwt.id, new Date(jwt.iat * 1000))
 * if (needsRefresh) {
 *   // Force re-authentication or token refresh
 * }
 */
export async function needsSessionRefresh(
  userId: string,
  tokenIssuedAt: Date
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('needs_session_refresh', {
    p_user_id: userId,
    p_token_issued_at: tokenIssuedAt.toISOString()
  });
  
  if (error) {
    console.error('Error checking session refresh:', error);
    // On error, assume session is valid to prevent blocking users
    return false;
  }
  
  return data === true;
}

/**
 * Get the current role state from the database
 * 
 * Returns the user's current role as stored in the database, which can be
 * compared with JWT claims to detect role drift.
 * 
 * @param userId - The user's ID
 * @returns Current role state or null if not found
 */
export async function getCurrentRoleState(userId: string): Promise<{
  tenantId: string;
  roleName: UserRole;
  roleChangedAt: Date;
} | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('get_current_role_state', {
    p_user_id: userId
  });
  
  if (error || !data || !data.role_name) {
    return null;
  }
  
  return {
    tenantId: data.tenant_id,
    roleName: data.role_name as UserRole,
    roleChangedAt: new Date(data.role_changed_at)
  };
}

/**
 * Check if user has minimum role level within their current tenant
 * 
 * Uses the role hierarchy to determine if user has at least the specified
 * level of access.
 * 
 * @param userId - The user's ID
 * @param minimumRole - The minimum role required
 * @returns true if user has at least the minimum role
 */
export async function userHasMinimumRole(
  userId: string,
  minimumRole: UserRole
): Promise<boolean> {
  const supabase = await createClient();
  
  // Get user's current role from database
  const { data, error } = await supabase
    .from('tenant_users')
    .select(`
      role:roles!inner (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  
  if (error || !data) {
    return false;
  }
  
  const roleObj = Array.isArray(data.role) ? data.role[0] : data.role;
  const userRole = roleObj?.name;
  
  if (!userRole || !isValidRole(userRole)) {
    return false;
  }
  
  return ROLE_HIERARCHY[userRole as UserRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Get the current authenticated user's role
 * 
 * This is a convenience function that gets the current user and returns
 * their role. For full tenant context, use getTenantContext() instead.
 * 
 * @returns The user's role or null if not authenticated
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const userId = claims?.sub
  
  if (!userId) {
    return null;
  }
  
  // Check JWT claims first (fast path)
  const roleFromClaims = (claims?.user_metadata as Record<string, unknown> | undefined)?.role as
    | string
    | undefined
  if (roleFromClaims && isValidRole(roleFromClaims)) {
    return roleFromClaims;
  }
  
  // Fallback to database lookup
  const { data, error } = await supabase.rpc('get_tenant_user_role', {
    p_user_id: userId
  });
  
  if (error || !data) {
    return null;
  }
  
  return isValidRole(data) ? data : null;
}

/**
 * Check if current authenticated user has any of the provided roles
 * 
 * @param requiredRoles - Array of roles that would grant access
 * @returns true if user has any of the required roles
 */
export async function currentUserHasAnyRole(requiredRoles: UserRole[]): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (!role) return false;
  return requiredRoles.includes(role);
}

/**
 * Check if current authenticated user has a specific role
 * 
 * @param requiredRole - The exact role required
 * @returns true if user has the required role
 */
export async function currentUserHasRole(requiredRole: UserRole): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === requiredRole;
}
