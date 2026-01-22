"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { UserRole } from "@/lib/types/roles"
import { resolveUserRole } from "@/lib/auth/resolve-role"
import type { UserProfile } from "@/lib/auth/user-profile"
import { fetchUserProfile } from "@/lib/auth/user-profile"
import { signOut as signOutAction } from "@/app/actions/auth"

interface AuthContextType {
  user: User | null
  role: UserRole | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({
  children,
  initialUser = null,
  initialRole = null,
  initialProfile = null,
}: {
  children: React.ReactNode
  initialUser?: User | null
  initialRole?: UserRole | null
  initialProfile?: UserProfile | null
}) {
  const router = useRouter()

  // Create supabase client once and memoize
  const supabase = React.useMemo(() => createClient(), [])

  const [user, setUser] = React.useState<User | null>(initialUser)
  const [role, setRole] = React.useState<UserRole | null>(initialRole)
  const [profile, setProfile] = React.useState<UserProfile | null>(initialProfile)
  const [loading, setLoading] = React.useState(false)

  const refreshUser = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser()

      if (error || !currentUser) {
        setUser(null)
        setRole(null)
        setProfile(null)
        return
      }

      // Resolve role + profile for the current user.
      const [{ role: resolvedRole }, resolvedProfile] = await Promise.all([
        resolveUserRole(supabase, currentUser),
        fetchUserProfile(supabase, currentUser),
      ])

      setUser(currentUser)
      setRole(resolvedRole)
      setProfile(resolvedProfile)
    } catch (e) {
      console.error("Auth refresh failed:", e)
      setUser(null)
      setRole(null)
      setProfile(null)
    } finally {
      // Always clear loading once a refresh completes.
      // `silent` only controls whether we *set* loading true (to avoid flicker),
      // not whether we can clear a loading state initiated by another event.
      setLoading(false)
    }
  }, [supabase])

  // On mount:
  // - sync from current session
  // - subscribe to auth events (including cross-tab broadcast)
  // - refresh server components when auth changes
  React.useEffect(() => {
    let isActive = true

    const run = async () => {
      if (!isActive) return
      await refreshUser({ silent: true })
    }

    run()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (!isActive) return
      const silent = event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION"
      await refreshUser({ silent })
      router.refresh()
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [supabase, refreshUser, router])

  /**
   * Sign out the current user
   * Uses server action to properly clear HTTP-only cookies
   */
  const signOut = React.useCallback(async () => {
    try {
      setUser(null)
      setRole(null)
      setProfile(null)

      // Clear server-side cookies via server action.
      // (This is the canonical source of session state in this app.)
      await signOutAction()

      // Hard navigation ensures all client state is reset.
      window.location.assign("/login")
    } catch (error) {
      console.error("Error signing out:", error)
      window.location.assign("/login")
    }
  }, [])

  /**
   * Check if user has a specific role
   */
  const hasRole = React.useCallback((requiredRole: UserRole): boolean => {
    return role === requiredRole
  }, [role])

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = React.useCallback((requiredRoles: UserRole[]): boolean => {
    if (!role) return false
    return requiredRoles.includes(role)
  }, [role])

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        profile,
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
