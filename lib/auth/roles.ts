/**
 * Server-side role checking utilities
 * 
 * These functions provide the authoritative role checking for server components,
 * API routes, and middleware. They check the database first, with JWT claims
 * as a performance optimization.
 */

import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types/roles';
import { isValidRole } from '@/lib/types/roles';

/**
 * Get the user's role from the database
 * This is the authoritative source of truth
 * Works with existing roles table structure (role_id foreign key)
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  
  // Join with roles table to get role name
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      roles!inner (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
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
 */
export async function getUserRoleCached(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check JWT custom claims first (fast)
  const roleFromClaims = user?.user_metadata?.role as string | undefined;
  if (roleFromClaims && isValidRole(roleFromClaims)) {
    return roleFromClaims;
  }
  
  // Fallback to database lookup using database function
  // This uses the optimized database function we created
  const { data, error } = await supabase.rpc('get_user_role', {
    user_id: userId
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
 * Uses database RPC function for better performance
 */
export async function userHasRole(
  userId: string,
  requiredRole: UserRole
): Promise<boolean> {
  const supabase = await createClient();
  
  // Try using database RPC function first (more efficient)
  const { data: hasRole, error } = await supabase.rpc('user_has_role', {
    required_role_name: requiredRole,
    user_id: userId
  });
  
  if (!error && hasRole !== null) {
    return hasRole;
  }
  
  // Fallback to checking cached role
  const userRole = await getUserRoleCached(userId);
  if (!userRole) return false;
  
  return userRole === requiredRole;
}

/**
 * Check if user has any of the provided roles
 * Uses database RPC function for better performance
 */
export async function userHasAnyRole(
  userId: string,
  requiredRoles: UserRole[]
): Promise<boolean> {
  const supabase = await createClient();
  
  // Try using database RPC function first (more efficient)
  const { data: hasRole, error } = await supabase.rpc('user_has_any_role', {
    required_role_names: requiredRoles,
    user_id: userId
  });
  
  if (!error && hasRole !== null) {
    return hasRole;
  }
  
  // Fallback to checking cached role
  const userRole = await getUserRoleCached(userId);
  if (!userRole) return false;
  
  return requiredRoles.includes(userRole);
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
