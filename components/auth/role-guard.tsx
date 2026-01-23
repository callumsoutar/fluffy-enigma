/**
 * Role Guard Component
 * 
 * Server component that protects routes based on user roles.
 * Redirects unauthorized users to dashboard with error message.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types/roles'
import { resolveUserRole } from '@/lib/auth/resolve-role'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
}

export async function RoleGuard({
  children,
  allowedRoles,
  fallback,
}: RoleGuardProps) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  
  // Use getUser() to authenticate with Supabase Auth server (eliminates security warning).
  const {
    data: { user: authenticatedUser },
    error: userError,
  } = await supabase.auth.getUser()
  
  // Verify the user ID matches the JWT claim
  const user = claims?.sub && authenticatedUser?.id === claims.sub && !userError ? authenticatedUser : null

  if (!user) {
    redirect('/login')
  }

  // Resolve role using centralized utility
  // This checks JWT claims first, then falls back to database
  const { role: userRole } = await resolveUserRole(supabase, user)

  if (!userRole || !allowedRoles.includes(userRole)) {
    if (fallback) {
      return <>{fallback}</>
    }
    redirect('/?error=unauthorized')
  }

  return <>{children}</>
}
