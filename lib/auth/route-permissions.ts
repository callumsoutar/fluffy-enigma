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

/**
 * Route permissions matrix
 * Routes are checked in order - first match wins
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Public routes (no role check needed - handled by auth middleware)
  { path: '/login', allowedRoles: [] },
  { path: '/auth', allowedRoles: [] },
  
  // Dashboard - all authenticated users
  { path: '/dashboard', allowedRoles: ['owner', 'admin', 'instructor', 'member', 'student'] },
  
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
  
  // Member and above
  { path: '/scheduler', allowedRoles: ['owner', 'admin', 'instructor', 'member'] },
  
  // All authenticated users
  { path: '/bookings', allowedRoles: ['owner', 'admin', 'instructor', 'member', 'student'] },
];

/**
 * Find the permission configuration for a given path
 */
export function getRoutePermission(pathname: string): RoutePermission | null {
  // Check exact matches first
  const exactMatch = ROUTE_PERMISSIONS.find(
    perm => perm.exact && perm.path === pathname
  );
  if (exactMatch) return exactMatch;
  
  // Check prefix matches
  const prefixMatch = ROUTE_PERMISSIONS.find(
    perm => !perm.exact && pathname.startsWith(perm.path)
  );
  if (prefixMatch) return prefixMatch;
  
  return null;
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
