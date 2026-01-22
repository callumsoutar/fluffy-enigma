"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import type { UserRole } from "@/lib/types/roles"
import type { UserProfile } from "@/lib/auth/user-profile"
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

type MeResponse = {
  user: User | null
  role: UserRole | null
  profile: UserProfile | null
}

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

  const [user, setUser] = React.useState<User | null>(initialUser)
  const [role, setRole] = React.useState<UserRole | null>(initialRole)
  const [profile, setProfile] = React.useState<UserProfile | null>(initialProfile)
  const [loading, setLoading] = React.useState(false)

  const refreshUser = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`Failed to load session: ${res.status}`)
      }
      const data = (await res.json()) as MeResponse
      setUser(data.user)
      setRole(data.role)
      setProfile(data.profile)
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
  }, [])

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

    // Cross-tab consistency: broadcast auth changes (logout/login) explicitly.
    const channel =
      typeof window !== "undefined" && "BroadcastChannel" in window
        ? new BroadcastChannel("aerosafety-auth")
        : null

    if (channel) {
      channel.onmessage = () => {
        refreshUser({ silent: true })
        router.refresh()
      }
    }

    const onFocus = () => {
      refreshUser({ silent: true })
    }
    window.addEventListener("focus", onFocus)

    return () => {
      isActive = false
      window.removeEventListener("focus", onFocus)
      channel?.close()
    }
  }, [refreshUser, router])

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

      // Notify other tabs to refresh auth state.
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const ch = new BroadcastChannel("aerosafety-auth")
        ch.postMessage({ type: "auth-changed" })
        ch.close()
      }

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
