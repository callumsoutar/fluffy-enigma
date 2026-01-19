"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/lib/types/roles"
import {
  resolveUserRole,
  getCachedRole,
  setCachedRole,
  clearCachedRole,
} from "@/lib/auth/resolve-role"

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
  
  // Use refs to track initialization state without causing re-renders
  // This prevents race conditions between getSession and onAuthStateChange
  const isInitializedRef = React.useRef(false)
  const isProcessingAuthChangeRef = React.useRef(false)
  
  // Create supabase client once and memoize
  const supabase = React.useMemo(() => createClient(), [])

  /**
   * Handle session changes from onAuthStateChange
   * This is the single source of truth for auth state
   */
  const handleAuthChange = React.useCallback(async (
    eventType: string,
    sessionUser: User | null
  ) => {
    // Prevent concurrent processing
    if (isProcessingAuthChangeRef.current) {
      return
    }
    isProcessingAuthChangeRef.current = true

    try {
      // Determine if this is a sign in/out event that needs loading state
      const isSignIn = eventType === 'SIGNED_IN'
      const isSignOut = eventType === 'SIGNED_OUT'
      const isInitialSession = eventType === 'INITIAL_SESSION'

      // Only show loading for actual auth state changes, not token refreshes
      // This prevents UI flicker on page refresh
      if (isSignIn || isSignOut) {
        setLoading(true)
      }

      // Update user state
      setUser(sessionUser)

      if (sessionUser) {
        // Resolve role using centralized utility
        const { role: resolvedRole } = await resolveUserRole(supabase, sessionUser)
        
        if (resolvedRole) {
          setRole(resolvedRole)
          setCachedRole(resolvedRole)
        } else {
          setRole(null)
          clearCachedRole()
        }
      } else {
        // No user - clear role
        setRole(null)
        clearCachedRole()
      }

      // Mark as initialized after first auth event
      if (isInitialSession || isSignIn || isSignOut) {
        isInitializedRef.current = true
      }
    } finally {
      // Always clear loading state after processing
      if (isInitializedRef.current) {
        setLoading(false)
      }
      isProcessingAuthChangeRef.current = false
    }
  }, [supabase])

  /**
   * Manual refresh function for when components need to re-fetch auth state
   */
  const refreshUser = React.useCallback(async () => {
    // Get cached role immediately to prevent UI flicker
    const cachedRole = getCachedRole()
    if (cachedRole) {
      setRole(cachedRole)
    }

    setLoading(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      if (currentUser) {
        const { role: resolvedRole } = await resolveUserRole(supabase, currentUser)
        if (resolvedRole) {
          setRole(resolvedRole)
          setCachedRole(resolvedRole)
        } else {
          setRole(null)
          clearCachedRole()
        }
      } else {
        setRole(null)
        clearCachedRole()
      }
    } catch (error) {
      console.error("Error refreshing user:", error)
      setUser(null)
      setRole(null)
      clearCachedRole()
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Initialize auth state on mount
   * 
   * We use onAuthStateChange as the single source of truth.
   * The INITIAL_SESSION event is fired synchronously when the listener
   * is set up, which handles the initial auth check.
   * 
   * This approach eliminates race conditions between getSession()
   * and onAuthStateChange by not calling getSession() at all.
   */
  React.useEffect(() => {
    let mounted = true

    // Load cached role immediately to prevent UI flicker during initialization
    const cachedRole = getCachedRole()
    if (cachedRole) {
      setRole(cachedRole)
    }

    // Set up the auth state change listener
    // INITIAL_SESSION is fired synchronously when listener is created
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      await handleAuthChange(event, session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, handleAuthChange])

  /**
   * Sign out the current user
   */
  const signOut = React.useCallback(async () => {
    try {
      await supabase.auth.signOut()
      // State will be updated by onAuthStateChange listener
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Error signing out:", error)
      throw error
    }
  }, [supabase, router])

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
