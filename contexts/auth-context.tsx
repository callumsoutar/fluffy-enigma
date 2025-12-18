"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/lib/types/roles"
import { isValidRole } from "@/lib/types/roles"

interface AuthContextType {
  user: User | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [role, setRole] = React.useState<UserRole | null>(null)
  const [loading, setLoading] = React.useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchUserRole = React.useCallback(async (userId: string) => {
    try {
      // First check JWT claims (fast)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const roleFromClaims = currentUser?.user_metadata?.role as string | undefined
      
      if (roleFromClaims && isValidRole(roleFromClaims)) {
        setRole(roleFromClaims)
        return
      }
      
      // Fallback to database lookup - use RPC function for optimized query
      const { data: roleName, error: rpcError } = await supabase.rpc('get_user_role', {
        user_id: userId
      })
      
      if (!rpcError && roleName && isValidRole(roleName)) {
        setRole(roleName)
        return
      }
      
      // If RPC fails, try direct query with join
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
        .single()
      
      if (!error && data && data.roles) {
        // Supabase returns joined relations as arrays
        const roles = Array.isArray(data.roles) ? data.roles : [data.roles]
        const roleObj = roles[0] as { name: string } | undefined
        if (roleObj?.name && isValidRole(roleObj.name)) {
          setRole(roleObj.name)
        } else {
          setRole(null)
        }
      } else {
        setRole(null)
      }
    } catch (error) {
      console.error("Error fetching user role:", error)
      setRole(null)
    }
  }, [supabase])

  const refreshUser = React.useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        await fetchUserRole(user.id)
      } else {
        setRole(null)
      }
    } catch (error) {
      console.error("Error refreshing user:", error)
      setUser(null)
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [supabase, fetchUserRole])

  React.useEffect(() => {
    refreshUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchUserRole(session.user.id)
      } else {
        setRole(null)
      }
      
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, refreshUser, fetchUserRole])

  const signOut = React.useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setRole(null)
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Error signing out:", error)
      throw error
    }
  }, [supabase, router])

  const hasRole = React.useCallback((requiredRole: UserRole): boolean => {
    return role === requiredRole
  }, [role])

  const hasAnyRole = React.useCallback((requiredRoles: UserRole[]): boolean => {
    if (!role) return false
    return requiredRoles.includes(role)
  }, [role])

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signOut,
        refreshUser,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

