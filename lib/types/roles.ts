/**
 * User role types and utilities
 * 
 * Defines the role hierarchy and provides type-safe role checking functions.
 */

export type UserRole = "owner" | "admin" | "instructor" | "member" | "student"

export const USER_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  INSTRUCTOR: "instructor",
  MEMBER: "member",
  STUDENT: "student",
} as const

/**
 * Role hierarchy for permission checks
 * Higher number = more privileges
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  admin: 4,
  instructor: 3,
  member: 2,
  student: 1,
}

/**
 * Check if a string is a valid user role
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(USER_ROLES).includes(role as UserRole)
}

/**
 * Check if role1 has at least the privileges of role2
 */
export function hasMinimumRole(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2]
}

/**
 * User with role information
 */
export interface UserWithRole {
  id: string
  email?: string
  role: UserRole
  user_metadata?: Record<string, unknown>
}
