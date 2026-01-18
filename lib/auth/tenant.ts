/**
 * Server-side tenant resolution and authorization
 * 
 * These functions are the authoritative source for tenant context in API routes
 * and server components. They query the database directly and should be used
 * for all tenant-scoped operations.
 * 
 * CRITICAL: Never trust client-provided tenant IDs. Always resolve tenant
 * from the authenticated user's memberships.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types/roles'
import type { Tenant, TenantContext, TenantError } from '@/lib/types/tenant'

/**
 * Get the current user's tenant ID
 * 
 * Resolution order:
 * 1. If user has exactly one active tenant membership, return that tenant
 * 2. If user has multiple memberships, return the first one (future: implement preference)
 * 3. If user has no memberships, throw TenantError
 * 
 * @param supabase - Supabase client (optional, will create if not provided)
 * @returns The tenant ID for the current user
 * @throws TenantError if user has no tenant membership
 */
export async function getTenantId(supabase?: SupabaseClient): Promise<string> {
  const client = supabase ?? await createClient()
  const { data: { user } } = await client.auth.getUser()
  
  if (!user) {
    const error = new Error('Not authenticated') as TenantError
    error.code = 'UNAUTHORIZED'
    throw error
  }
  
  const { data: memberships, error } = await client
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
  
  if (error) {
    console.error('Error fetching tenant memberships:', error)
    throw new Error('Failed to resolve tenant')
  }
  
  if (!memberships || memberships.length === 0) {
    const tenantError = new Error('User has no tenant membership') as TenantError
    tenantError.code = 'NO_MEMBERSHIP'
    throw tenantError
  }
  
  // For now, return the first tenant (single-tenant scenario)
  // Future: implement tenant selection for multi-tenant users
  return memberships[0].tenant_id
}

/**
 * Get full tenant context including tenant details and user role
 * 
 * @param supabase - Supabase client (optional)
 * @returns Full tenant context with tenant details and user's role
 */
export async function getTenantContext(supabase?: SupabaseClient): Promise<TenantContext> {
  const client = supabase ?? await createClient()
  const { data: { user } } = await client.auth.getUser()
  
  if (!user) {
    const error = new Error('Not authenticated') as TenantError
    error.code = 'UNAUTHORIZED'
    throw error
  }
  
  // Get user's tenant membership with tenant and role details
  const { data: membership, error } = await client
    .from('tenant_users')
    .select(`
      tenant_id,
      tenant:tenants!inner (
        id,
        name,
        slug,
        settings,
        is_active,
        created_at,
        updated_at
      ),
      role:roles!inner (
        name
      )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  
  if (error || !membership) {
    const tenantError = new Error('User has no tenant membership') as TenantError
    tenantError.code = 'NO_MEMBERSHIP'
    throw tenantError
  }
  
  // Handle Supabase's array return for joins
  const tenant = Array.isArray(membership.tenant) 
    ? membership.tenant[0] 
    : membership.tenant
  const role = Array.isArray(membership.role)
    ? membership.role[0]
    : membership.role
  
  return {
    tenantId: membership.tenant_id,
    tenant: tenant as Tenant,
    userRole: role.name as UserRole,
    userId: user.id,
  }
}

/**
 * Check if the current user has any of the specified roles at their tenant
 * 
 * @param requiredRoles - Array of roles that would grant access
 * @param supabase - Supabase client (optional)
 * @returns true if user has any of the required roles
 */
export async function hasTenantRole(
  requiredRoles: UserRole[],
  supabase?: SupabaseClient
): Promise<boolean> {
  try {
    const context = await getTenantContext(supabase)
    return requiredRoles.includes(context.userRole)
  } catch {
    return false
  }
}

/**
 * Check if user has any of the specified roles at a specific tenant
 * 
 * @param userId - User ID to check
 * @param tenantId - Tenant ID to check
 * @param requiredRoles - Array of roles that would grant access
 * @param supabase - Supabase client (optional)
 * @returns true if user has any of the required roles at the tenant
 */
export async function userHasTenantRole(
  userId: string,
  tenantId: string,
  requiredRoles: UserRole[],
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase ?? await createClient()
  
  const { data, error } = await client
    .from('tenant_users')
    .select(`
      role:roles!inner (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single()
  
  if (error || !data) {
    return false
  }
  
  const role = Array.isArray(data.role) ? data.role[0] : data.role
  return requiredRoles.includes(role.name as UserRole)
}

/**
 * Get the user's role at their current tenant
 * 
 * @param supabase - Supabase client (optional)
 * @returns The user's role or null if not a member
 */
export async function getCurrentTenantRole(supabase?: SupabaseClient): Promise<UserRole | null> {
  try {
    const context = await getTenantContext(supabase)
    return context.userRole
  } catch {
    return null
  }
}

/**
 * Validate that a tenant ID belongs to the current user
 * Use this when a tenant ID is provided in a request to prevent tenant spoofing
 * 
 * @param providedTenantId - Tenant ID from request
 * @param supabase - Supabase client (optional)
 * @returns true if the user is a member of the provided tenant
 */
export async function validateTenantAccess(
  providedTenantId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase ?? await createClient()
  const { data: { user } } = await client.auth.getUser()
  
  if (!user) return false
  
  const { data, error } = await client
    .from('tenant_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('tenant_id', providedTenantId)
    .eq('is_active', true)
    .single()
  
  return !error && !!data
}

/**
 * Get all tenants the current user belongs to
 * Useful for tenant switcher UI
 * 
 * @param supabase - Supabase client (optional)
 * @returns Array of tenants with user's role at each
 */
export async function getUserTenants(supabase?: SupabaseClient): Promise<Array<{
  tenant: Tenant
  role: UserRole
}>> {
  const client = supabase ?? await createClient()
  const { data: { user } } = await client.auth.getUser()
  
  if (!user) return []
  
  const { data: memberships, error } = await client
    .from('tenant_users')
    .select(`
      tenant:tenants!inner (
        id,
        name,
        slug,
        settings,
        is_active,
        created_at,
        updated_at
      ),
      role:roles!inner (
        name
      )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
  
  if (error || !memberships) return []
  
  return memberships.map(m => ({
    tenant: (Array.isArray(m.tenant) ? m.tenant[0] : m.tenant) as Tenant,
    role: (Array.isArray(m.role) ? m.role[0] : m.role).name as UserRole,
  }))
}
