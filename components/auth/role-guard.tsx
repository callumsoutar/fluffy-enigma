/**
 * Role Guard Component
 * 
 * Server component that protects routes based on user roles.
 * Redirects unauthorized users to dashboard with error message.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types/roles'
import { isValidRole } from '@/lib/types/roles'

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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get role from JWT claims or database
  let userRole: UserRole | null = null
  
  // Check JWT claims first
  const roleFromClaims = user.user_metadata?.role as string | undefined
  if (roleFromClaims && isValidRole(roleFromClaims)) {
    userRole = roleFromClaims
  } else {
    // Fallback to database lookup using RPC function
    const { data: roleName, error: rpcError } = await supabase.rpc('get_user_role', {
      user_id: user.id
    })
    
    if (!rpcError && roleName && isValidRole(roleName)) {
      userRole = roleName
    } else {
      // If RPC fails, try direct query with join
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles!inner (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()
      
      if (!error && data && data.roles) {
        // Supabase returns joined relations as arrays
        const roles = Array.isArray(data.roles) ? data.roles : [data.roles]
        const roleObj = roles[0] as { name: string } | undefined
        if (roleObj?.name && isValidRole(roleObj.name)) {
          userRole = roleObj.name
        }
      }
    }
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    if (fallback) {
      return <>{fallback}</>
    }
    redirect('/dashboard?error=unauthorized')
  }

  return <>{children}</>
}
