/**
 * Server-side role checking utilities
 * 
 * These functions provide the authoritative role checking for server components,
 * API routes, and middleware. They check the database first, with JWT claims
 * as a performance optimization.
 * 
 * MULTI-TENANT MIGRATION NOTE:
 * This file contains both legacy (global role) and new (tenant-scoped role) functions.
 * 
 * DEPRECATED functions (will be removed after migration):
 * - getUserRole() - Use getTenantContext() from lib/auth/tenant.ts
 * - userHasRole() - Use hasTenantRole() from lib/auth/tenant.ts  
 * - userHasAnyRole() - Use hasTenantRole() from lib/auth/tenant.ts
 * 
 * These legacy functions now query tenant_users instead of user_roles,
 * but still work for single-tenant scenarios (returning the user's only tenant role).
 */

import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types/roles';
import { isValidRole } from '@/lib/types/roles';
// Re-export tenant functions for convenience
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
 * Get the user's role from the database
 * 
 * @deprecated Use getTenantContext() from lib/auth/tenant.ts for tenant-aware role checking
 * 
 * This function now queries tenant_users (the new multi-tenant table).
 * For single-tenant scenarios, it returns the user's role at their only tenant.
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  
  // Query tenant_users instead of user_roles (migrated table)
  const { data, error } = await supabase
    .from('tenant_users')
    .select(`
      role_id,
      roles!inner (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (error || !data || !data.roles) {
    return null;
  }
  
  // Supabase returns joined relations as arrays
  const roles = Array.isArray(data.roles) ? data.roles : [data.roles];
  const roleObj = roles[0] as { name: string } | undefined;
  
  if (!roleObj?.name) {
    return null;
  }
  
  return isValidRole(roleObj.name) ? roleObj.name : null;
}

/**
 * Get user role from JWT custom claims (fast, cached)
 * Falls back to database lookup if not in claims
 * 
 * @deprecated Use getTenantContext() from lib/auth/tenant.ts for tenant-aware role checking
 */
export async function getUserRoleCached(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check JWT custom claims first (fast)
  const roleFromClaims = user?.user_metadata?.role as string | undefined;
  if (roleFromClaims && isValidRole(roleFromClaims)) {
    return roleFromClaims;
  }
  
  // Fallback to database lookup using new tenant-aware function
  const { data, error } = await supabase.rpc('get_tenant_user_role', {
    p_user_id: userId
  });
  
  if (error || !data) {
    // If RPC fails, try direct query
    return getUserRole(userId);
  }
  
  return isValidRole(data) ? data : null;
}

/**
 * Get the current authenticated user's role
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }
  
  return getUserRoleCached(user.id);
}

/**
 * Check if user has a specific role
 * 
 * @deprecated Use hasTenantRole() from lib/auth/tenant.ts for tenant-aware role checking
 * 
 * This function now queries tenant_users for backwards compatibility.
 */
export async function userHasRole(
  userId: string,
  requiredRole: UserRole
): Promise<boolean> {
  const supabase = await createClient();
  
  // Query tenant_users directly (backwards compatible for single-tenant)
  const { data, error } = await supabase
    .from('tenant_users')
    .select(`
      roles!inner (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  const role = Array.isArray(data.roles) ? data.roles[0] : data.roles;
  return role?.name === requiredRole;
}

/**
 * Check if user has any of the provided roles
 * 
 * @deprecated Use hasTenantRole() from lib/auth/tenant.ts for tenant-aware role checking
 * 
 * This function now queries tenant_users for backwards compatibility.
 */
export async function userHasAnyRole(
  userId: string,
  requiredRoles: UserRole[]
): Promise<boolean> {
  const supabase = await createClient();
  
  // Query tenant_users directly (backwards compatible for single-tenant)
  const { data, error } = await supabase
    .from('tenant_users')
    .select(`
      roles!inner (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  const role = Array.isArray(data.roles) ? data.roles[0] : data.roles;
  return requiredRoles.includes(role?.name as UserRole);
}

/**
 * Check if user has minimum role level
 */
export async function userHasMinimumRole(
  userId: string,
  minimumRole: UserRole
): Promise<boolean> {
  const userRole = await getUserRoleCached(userId);
  if (!userRole) return false;
  
  const ROLE_HIERARCHY: Record<UserRole, number> = {
    owner: 5,
    admin: 4,
    instructor: 3,
    member: 2,
    student: 1,
  };
  
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Check if current authenticated user has a specific role
 */
export async function currentUserHasRole(requiredRole: UserRole): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  return userHasRole(user.id, requiredRole);
}

/**
 * Check if current authenticated user has any of the provided roles
 */
export async function currentUserHasAnyRole(requiredRoles: UserRole[]): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  return userHasAnyRole(user.id, requiredRoles);
}
