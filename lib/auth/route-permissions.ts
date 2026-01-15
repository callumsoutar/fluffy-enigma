/**
 * Route permissions configuration
 * 
 * Defines which roles can access which routes.
 * Used by middleware for route protection.
 */

import type { UserRole } from '@/lib/types/roles';

export interface RoutePermission {
  path: string;
  allowedRoles: UserRole[];
  exact?: boolean; // If true, path must match exactly (not just start with)
}

function escapeRegexLiteral(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Supports simple dynamic segments in the permission path:
 * - Next.js-style: /bookings/[id]/checkin
 * - Express-style: /bookings/:id/checkin
 * - Wildcard segment: *
 */
function permissionToRegex(permissionPath: string, exact: boolean): RegExp {
  const segments = permissionPath.split('/').map((seg) => {
    if (seg === '') return ''
    if (seg === '*') return '.*'
    if ((seg.startsWith('[') && seg.endsWith(']')) || seg.startsWith(':')) return '[^/]+'
    return escapeRegexLiteral(seg)
  })

  const pattern = segments.join('/')
  // For prefix matches, ensure we match the start and a segment boundary.
  return exact
    ? new RegExp(`^${pattern}$`)
    : new RegExp(`^${pattern}(?:$|/)`)
}

/**
 * Route permissions matrix
 * Routes are checked in order - first match wins
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Public routes (no role check needed - handled by auth middleware)
  { path: '/login', allowedRoles: [] },
  { path: '/auth', allowedRoles: [] },
  
  // Dashboard - all authenticated users
  { path: '/', allowedRoles: ['owner', 'admin', 'instructor', 'member', 'student'], exact: true },
  
  // Admin-only routes
  { path: '/admin', allowedRoles: ['owner', 'admin'] },
  { path: '/staff', allowedRoles: ['owner', 'admin'] },
  
  // Settings - all authenticated users can access
  { path: '/settings', allowedRoles: ['owner', 'admin', 'instructor', 'member', 'student'] },
  
  // Instructor and above
  { path: '/instructor', allowedRoles: ['owner', 'admin', 'instructor'] },
  { path: '/reports', allowedRoles: ['owner', 'admin', 'instructor'] },
  { path: '/aircraft', allowedRoles: ['owner', 'admin', 'instructor'] },
  { path: '/members', allowedRoles: ['owner', 'admin', 'instructor'] },
  { path: '/training', allowedRoles: ['owner', 'admin', 'instructor'] },
  { path: '/equipment', allowedRoles: ['owner', 'admin', 'instructor'] },
  { path: '/invoices', allowedRoles: ['owner', 'admin', 'instructor'] },
  { path: '/tasks', allowedRoles: ['owner', 'admin', 'instructor'] },

  // Booking operational flows (staff only)
  // These are intentionally stricter than /bookings (which students can access for self-service booking).
  { path: '/bookings/[id]/checkin', allowedRoles: ['owner', 'admin', 'instructor'], exact: true },
  { path: '/bookings/[id]/checkout', allowedRoles: ['owner', 'admin', 'instructor'], exact: true },
  // API endpoints for check-in flows (defense in depth; handlers also enforce this)
  { path: '/api/bookings/[id]/checkin', allowedRoles: ['owner', 'admin', 'instructor'] },
  
  // Member and above (students can also view for booking purposes)
  { path: '/scheduler', allowedRoles: ['owner', 'admin', 'instructor', 'member', 'student'] },
  
  // All authenticated users
  { path: '/bookings', allowedRoles: ['owner', 'admin', 'instructor', 'member', 'student'] },
];

/**
 * Find the permission configuration for a given path
 */
export function getRoutePermission(pathname: string): RoutePermission | null {
  for (const perm of ROUTE_PERMISSIONS) {
    const regex = permissionToRegex(perm.path, !!perm.exact)
    if (regex.test(pathname)) return perm
  }
  return null
}

/**
 * Check if a role is allowed to access a route
 */
export function isRoleAllowedForRoute(
  role: UserRole | null,
  pathname: string
): boolean {
  const permission = getRoutePermission(pathname);
  
  // If no permission config, allow access (will be handled by auth middleware)
  if (!permission) return true;
  
  // If no roles required, allow access
  if (permission.allowedRoles.length === 0) return true;
  
  // If no role provided, deny access
  if (!role) return false;
  
  return permission.allowedRoles.includes(role);
}
