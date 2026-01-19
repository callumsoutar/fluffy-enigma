"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { UserRole } from "@/lib/types/roles"
import {
  resolveUserRole,
  getCachedRole,
  setCachedRole,
  clearCachedRole,
} from "@/lib/auth/resolve-role"
import { signOut as signOutAction } from "@/app/actions/auth"

// User profile data from the database
export interface UserProfile {
  firstName: string | null
  lastName: string | null
  displayName: string
  email: string
  avatarUrl: string | null
}

// Role change tracking
const ROLE_CHECK_INTERVAL = 60000 // Check for role changes every 60 seconds

// Cache keys for user profile
const PROFILE_CACHE_KEY = 'auth_user_profile'

function getCachedProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

function setCachedProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } catch {
    // Ignore localStorage errors
  }
}

function clearCachedProfile(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    // Ignore localStorage errors
  }
}

interface AuthContextType {
  user: User | null
  role: UserRole | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  roleChangedSinceLogin: boolean // True if role has changed since JWT was issued
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [role, setRole] = React.useState<UserRole | null>(null)
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [roleChangedSinceLogin, setRoleChangedSinceLogin] = React.useState(false)
  
  // Use refs to track initialization state without causing re-renders
  // This prevents race conditions between getSession and onAuthStateChange
  const isInitializedRef = React.useRef(false)
  const isProcessingAuthChangeRef = React.useRef(false)
  // Queue for auth events that arrive while processing
  const pendingAuthEventRef = React.useRef<{ event: string; user: User | null } | null>(null)
  
  // Create supabase client once and memoize
  const supabase = React.useMemo(() => createClient(), [])

  /**
   * Fetch user profile from database
   */
  const fetchUserProfile = React.useCallback(async (userId: string, userEmail: string | undefined, userMetadata: Record<string, unknown> | undefined): Promise<UserProfile> => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', userId)
        .single()

      if (error || !userData) {
        // Fallback to user_metadata
        const fallbackName = (userMetadata?.full_name as string) ||
          (userMetadata?.name as string) ||
          userEmail?.split("@")[0] ||
          "User"
        
        return {
          firstName: null,
          lastName: null,
          displayName: fallbackName,
          email: userEmail || "",
          avatarUrl: (userMetadata?.avatar_url as string) || null,
        }
      }

      const firstName = userData.first_name || ""
      const lastName = userData.last_name || ""
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
      
      const displayName = fullName || 
        (userMetadata?.full_name as string) ||
        (userMetadata?.name as string) ||
        userEmail?.split("@")[0] ||
        "User"

      return {
        firstName: userData.first_name,
        lastName: userData.last_name,
        displayName,
        email: userEmail || "",
        avatarUrl: (userMetadata?.avatar_url as string) || null,
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      const fallbackName = (userMetadata?.full_name as string) ||
        (userMetadata?.name as string) ||
        userEmail?.split("@")[0] ||
        "User"
      
      return {
        firstName: null,
        lastName: null,
        displayName: fallbackName,
        email: userEmail || "",
        avatarUrl: (userMetadata?.avatar_url as string) || null,
      }
    }
  }, [supabase])

  /**
   * Handle session changes from onAuthStateChange
   * This is the single source of truth for auth state
   */
  const handleAuthChange = React.useCallback(async (
    eventType: string,
    sessionUser: User | null
  ) => {
    // If we're already processing an event, queue this one instead of dropping it
    // This is critical for handling stale token scenarios where multiple events
    // fire in quick succession (e.g., INITIAL_SESSION followed by TOKEN_REFRESHED)
    if (isProcessingAuthChangeRef.current) {
      console.log(`🔐 [AUTH] Queueing event: ${eventType} (currently processing another event)`)
      pendingAuthEventRef.current = { event: eventType, user: sessionUser }
      return
    }
    isProcessingAuthChangeRef.current = true

    try {
      console.log(`🔐 [AUTH] Processing event: ${eventType}, user: ${sessionUser?.id || 'null'}`)
      
      // Determine if this is a sign in/out event that needs loading state
      const isSignIn = eventType === 'SIGNED_IN'
      const isSignOut = eventType === 'SIGNED_OUT'
      const isInitialSession = eventType === 'INITIAL_SESSION'
      const isTokenRefreshed = eventType === 'TOKEN_REFRESHED'

      // Only show loading for actual auth state changes, not token refreshes
      // This prevents UI flicker on page refresh
      if (isSignIn || isSignOut) {
        setLoading(true)
      }

      if (sessionUser) {
        // First, validate the session is actually valid by checking with the server
        // This is critical for handling stale cookies/tokens
        // We do this BEFORE updating state to prevent UI flicker with invalid data
        const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !validatedUser) {
          // The session from cookies is stale/invalid - clear everything
          console.warn('🔐 [AUTH] Session validation failed - clearing stale session', userError?.message)
          setUser(null)
          setRole(null)
          setProfile(null)
          clearCachedRole()
          clearCachedProfile()
          
          // Mark as initialized since we've determined the auth state (no valid session)
          isInitializedRef.current = true
          
          // Also sign out to clear the invalid cookies
          // Note: This will trigger a SIGNED_OUT event which will be queued
          try {
            await supabase.auth.signOut()
          } catch (signOutError) {
            console.error('🔐 [AUTH] Error signing out stale session:', signOutError)
          }
          return
        }

        // Session is valid - update user state with validated user
        setUser(validatedUser)

        // Use the validated user for role resolution
        const { role: resolvedRole } = await resolveUserRole(supabase, validatedUser)
        
        if (resolvedRole) {
          setRole(resolvedRole)
          setCachedRole(resolvedRole)
        } else {
          // Failed to resolve role - clear cached role to prevent stale state
          console.warn('🔐 [AUTH] Failed to resolve role for authenticated user')
          setRole(null)
          clearCachedRole()
        }

        // Fetch and cache user profile
        const userProfile = await fetchUserProfile(validatedUser.id, validatedUser.email, validatedUser.user_metadata)
        setProfile(userProfile)
        setCachedProfile(userProfile)
      } else {
        // No user - clear all state
        setUser(null)
        setRole(null)
        setProfile(null)
        clearCachedRole()
        clearCachedProfile()
      }

      // Reset role changed flag on fresh sign-in
      if (isSignIn) {
        setRoleChangedSinceLogin(false)
      }

      // Mark as initialized after first auth event or token refresh
      // TOKEN_REFRESHED can be the first meaningful event after stale cookies are cleared
      if (isInitialSession || isSignIn || isSignOut || isTokenRefreshed) {
        isInitializedRef.current = true
      }
    } catch (error) {
      console.error('🔐 [AUTH] Error processing auth change:', error)
      // On error, ensure we still mark as initialized to prevent infinite loading
      isInitializedRef.current = true
    } finally {
      // Always clear loading state after processing - don't gate on isInitializedRef
      // This ensures loading is cleared even if initialization failed
      setLoading(false)
      isProcessingAuthChangeRef.current = false

      // Process any queued event
      const pendingEvent = pendingAuthEventRef.current
      if (pendingEvent) {
        pendingAuthEventRef.current = null
        console.log(`🔐 [AUTH] Processing queued event: ${pendingEvent.event}`)
        // Use setTimeout to allow state updates to flush before processing next event
        setTimeout(() => {
          handleAuthChange(pendingEvent.event, pendingEvent.user)
        }, 0)
      }
    }
  }, [supabase, fetchUserProfile])

  /**
   * Manual refresh function for when components need to re-fetch auth state
   */
  const refreshUser = React.useCallback(async () => {
    // Get cached data immediately to prevent UI flicker
    const cachedRole = getCachedRole()
    if (cachedRole) {
      setRole(cachedRole)
    }
    const cachedProfile = getCachedProfile()
    if (cachedProfile) {
      setProfile(cachedProfile)
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

        // Fetch and cache user profile
        const userProfile = await fetchUserProfile(currentUser.id, currentUser.email, currentUser.user_metadata)
        setProfile(userProfile)
        setCachedProfile(userProfile)
      } else {
        setRole(null)
        setProfile(null)
        clearCachedRole()
        clearCachedProfile()
      }
    } catch (error) {
      console.error("Error refreshing user:", error)
      setUser(null)
      setRole(null)
      setProfile(null)
      clearCachedRole()
      clearCachedProfile()
    } finally {
      setLoading(false)
    }
  }, [supabase, fetchUserProfile])

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
    let initTimeout: NodeJS.Timeout | null = null

    // Load cached data immediately to prevent UI flicker during initialization
    // Note: This is optimistic - if the session is invalid, we'll clear these
    const cachedRole = getCachedRole()
    if (cachedRole) {
      setRole(cachedRole)
    }
    const cachedProfile = getCachedProfile()
    if (cachedProfile) {
      setProfile(cachedProfile)
    }

    // Safety timeout: If auth doesn't initialize within 5 seconds, force loading to false
    // This handles edge cases where onAuthStateChange doesn't fire properly
    // (e.g., corrupted cookies, browser extensions blocking requests)
    initTimeout = setTimeout(() => {
      if (!isInitializedRef.current && mounted) {
        console.warn('🔐 [AUTH] Initialization timeout - forcing loading to false')
        isInitializedRef.current = true
        setLoading(false)
        // Clear potentially stale cached data since we couldn't verify the session
        clearCachedRole()
        clearCachedProfile()
        setRole(null)
        setProfile(null)
      }
    }, 5000)

    // Set up the auth state change listener
    // INITIAL_SESSION is fired synchronously when listener is created
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      // Clear the timeout since we received an auth event
      if (initTimeout) {
        clearTimeout(initTimeout)
        initTimeout = null
      }
      
      await handleAuthChange(event, session?.user ?? null)
    })

    return () => {
      mounted = false
      if (initTimeout) {
        clearTimeout(initTimeout)
      }
      subscription.unsubscribe()
    }
  }, [supabase, handleAuthChange])

  /**
   * Periodic role change detection
   * 
   * This checks if the user's role has changed in the database since their
   * JWT was issued. If so, it sets a flag that can be used to prompt the
   * user to refresh their session.
   */
  React.useEffect(() => {
    if (!user) return

    const checkForRoleChanges = async () => {
      try {
        // Get the JWT issued at time
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        // Decode the JWT to get iat (issued at)
        const payload = JSON.parse(atob(session.access_token.split('.')[1]))
        const tokenIssuedAt = new Date(payload.iat * 1000)

        // Call the database function to check if role changed
        const { data, error } = await supabase.rpc('needs_session_refresh', {
          p_user_id: user.id,
          p_token_issued_at: tokenIssuedAt.toISOString()
        })

        if (error) {
          console.error('Error checking for role changes:', error)
          return
        }

        if (data === true && !roleChangedSinceLogin) {
          console.log('🔐 [AUTH] Role has changed since login, user should refresh session')
          setRoleChangedSinceLogin(true)
          // Also refresh the user data to get the new role
          await refreshUser()
        }
      } catch (error) {
        console.error('Error in role change check:', error)
      }
    }

    // Initial check
    checkForRoleChanges()

    // Set up periodic check
    const intervalId = setInterval(checkForRoleChanges, ROLE_CHECK_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
  }, [user, supabase, roleChangedSinceLogin, refreshUser])

  /**
   * Sign out the current user
   * Uses server action to properly clear HTTP-only cookies
   */
  const signOut = React.useCallback(async () => {
    console.log("🔐 [AUTH] signOut() called")
    try {
      // Clear local state first for immediate UI feedback
      console.log("🔐 [AUTH] Clearing local state")
      setUser(null)
      setRole(null)
      setProfile(null)
      clearCachedRole()
      clearCachedProfile()
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        try {
          Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase') || key.includes('sb-') || key.includes('auth')) {
              localStorage.removeItem(key)
            }
          })
        } catch (e) {
          console.error("Error clearing localStorage:", e)
        }
      }
      
      // Call server action to clear server-side cookies
      console.log("🔐 [AUTH] Calling server action signOut()")
      const result = await signOutAction()
      
      if (result.error) {
        console.error("🔐 [AUTH] Server signOut error:", result.error)
      } else {
        console.log("🔐 [AUTH] Server signOut successful")
      }
      
      // Redirect to login page
      console.log("🔐 [AUTH] Redirecting to /login")
      window.location.href = "/login"
    } catch (error) {
      console.error("🔐 [AUTH] Error signing out:", error)
      // Force redirect anyway - we've already cleared local state
      window.location.href = "/login"
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
        roleChangedSinceLogin,
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
