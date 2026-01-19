/**
 * Centralized User Role Resolution
 * 
 * This module provides a single source of truth for resolving user roles.
 * Both middleware and client-side auth context should use these utilities
 * to ensure consistent role resolution across the application.
 * 
 * Resolution Order:
 * 1. JWT claims (fastest - no database call)
 * 2. tenant_users table (canonical source for multi-tenant roles)
 * 
 * Note: The old user_roles table and get_user_role RPC are deprecated.
 * All role lookups should go through tenant_users.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types/roles'
import { isValidRole } from '@/lib/types/roles'

export type RoleSource = 'jwt_claims' | 'database' | null

export interface RoleResolutionResult {
  role: UserRole | null
  source: RoleSource
}

/**
 * Extract role from Supabase's joined relation response
 * Handles both array and object formats that Supabase may return
 */
function extractRoleFromJoin(roleData: unknown): string | null {
  if (!roleData) return null
  
  // Supabase may return joined relations as arrays or objects
  const roleObj = Array.isArray(roleData) ? roleData[0] : roleData
  
  if (roleObj && typeof roleObj === 'object' && 'name' in roleObj) {
    return (roleObj as { name: string }).name
  }
  
  return null
}

/**
 * Resolve user role from JWT claims or database
 * 
 * This is the single source of truth for role resolution logic.
 * Use this function in both middleware and client-side contexts.
 * 
 * @param supabase - Any Supabase client (browser, server, or middleware)
 * @param user - The authenticated user object
 * @returns The resolved role and its source
 */
export async function resolveUserRole(
  supabase: SupabaseClient,
  user: User
): Promise<RoleResolutionResult> {
  // 1. Check JWT claims first (fastest - no database call)
  const roleFromClaims = user.user_metadata?.role as string | undefined
  if (roleFromClaims && isValidRole(roleFromClaims)) {
    return { role: roleFromClaims, source: 'jwt_claims' }
  }

  // 2. Database lookup using tenant_users (canonical source)
  // This is the authoritative source for multi-tenant role assignment
  try {
    const { data: membership, error } = await supabase
      .from('tenant_users')
      .select(`
        role:roles!inner (
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error querying tenant_users for role:', error.message)
      return { role: null, source: null }
    }

    const roleName = extractRoleFromJoin(membership?.role)
    if (roleName && isValidRole(roleName)) {
      return { role: roleName, source: 'database' }
    }
  } catch (error) {
    console.error('Error resolving user role:', error)
  }

  return { role: null, source: null }
}

/**
 * Resolve user role synchronously from JWT claims only
 * 
 * Use this for fast, synchronous role checks when you only need
 * to check JWT claims (e.g., initial render optimization).
 * Falls back to null if role isn't in claims.
 * 
 * @param user - The authenticated user object
 * @returns The role from JWT claims, or null
 */
export function resolveUserRoleFromClaims(user: User): UserRole | null {
  const roleFromClaims = user.user_metadata?.role as string | undefined
  if (roleFromClaims && isValidRole(roleFromClaims)) {
    return roleFromClaims
  }
  return null
}

/**
 * Cache key for localStorage role caching
 */
export const ROLE_CACHE_KEY = 'user_role'

/**
 * Get cached role from localStorage
 * Returns null on server or if no valid cached role exists
 */
export function getCachedRole(): UserRole | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(ROLE_CACHE_KEY)
    if (stored && isValidRole(stored)) {
      return stored as UserRole
    }
  } catch {
    // localStorage access may fail in some contexts
  }
  
  return null
}

/**
 * Cache role in localStorage
 * No-op on server
 */
export function setCachedRole(role: UserRole): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(ROLE_CACHE_KEY, role)
  } catch {
    // localStorage access may fail in some contexts
  }
}

/**
 * Clear cached role from localStorage
 * No-op on server
 */
export function clearCachedRole(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(ROLE_CACHE_KEY)
  } catch {
    // localStorage access may fail in some contexts
  }
}
