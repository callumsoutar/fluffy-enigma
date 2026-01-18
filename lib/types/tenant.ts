/**
 * Tenant types for multi-tenancy support
 * 
 * A tenant represents an aero club/organization operating within the platform.
 * Users can belong to one or more tenants with different roles at each.
 */

import type { UserRole } from './roles'

/**
 * Tenant (aero club/organization)
 */
export interface Tenant {
  id: string
  name: string
  slug: string
  settings: TenantSettings
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Tenant-specific settings stored as JSONB
 */
export interface TenantSettings {
  timezone?: string
  currency?: string
  logo_url?: string
  primary_color?: string
  // Migration metadata
  migrated_from_single_tenant?: boolean
  migration_date?: string
  // Add more settings as needed
  [key: string]: unknown
}

/**
 * Tenant membership - links a user to a tenant with a specific role
 */
export interface TenantUser {
  id: string
  tenant_id: string
  user_id: string
  role_id: string
  is_active: boolean
  granted_by: string | null
  granted_at: string
  created_at: string
  updated_at: string
}

/**
 * Tenant membership with expanded relations
 */
export interface TenantUserWithRelations extends TenantUser {
  tenant?: Tenant
  role?: {
    id: string
    name: UserRole
    description: string | null
  }
}

/**
 * Context object representing the current tenant for a request
 */
export interface TenantContext {
  tenantId: string
  tenant: Tenant
  userRole: UserRole
  userId: string
}

/**
 * Error thrown when tenant resolution fails
 */
export class TenantError extends Error {
  constructor(
    message: string,
    public code: 'NO_MEMBERSHIP' | 'MULTIPLE_TENANTS' | 'INVALID_TENANT' | 'UNAUTHORIZED'
  ) {
    super(message)
    this.name = 'TenantError'
  }
}
