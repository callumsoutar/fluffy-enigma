import type { SupabaseClient, User } from "@supabase/supabase-js"

export interface UserProfile {
  firstName: string | null
  lastName: string | null
  displayName: string
  email: string
  avatarUrl: string | null
}

function buildFallbackDisplayName(params: {
  email: string | undefined
  userMetadata: Record<string, unknown> | undefined
}) {
  return (
    (params.userMetadata?.full_name as string) ||
    (params.userMetadata?.name as string) ||
    params.email?.split("@")[0] ||
    "User"
  )
}

/**
 * Fetches a friendly profile for UI display.
 *
 * Notes:
 * - This is intentionally "best effort": if the `users` row is missing or RLS blocks it,
 *   we fall back to auth metadata (so UI never hangs on profile fetch).
 * - Keep this function isomorphic (server + client safe).
 */
export async function fetchUserProfile(
  supabase: SupabaseClient,
  user: User
): Promise<UserProfile> {
  const email = user.email || ""
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>

  try {
    const { data: userData, error } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    if (error || !userData) {
      const fallbackName = buildFallbackDisplayName({ email: user.email, userMetadata })
      return {
        firstName: null,
        lastName: null,
        displayName: fallbackName,
        email,
        avatarUrl: (userMetadata.avatar_url as string) || null,
      }
    }

    const firstName = userData.first_name || ""
    const lastName = userData.last_name || ""
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()

    const displayName =
      fullName || buildFallbackDisplayName({ email: user.email, userMetadata })

    return {
      firstName: userData.first_name,
      lastName: userData.last_name,
      displayName,
      email,
      avatarUrl: (userMetadata.avatar_url as string) || null,
    }
  } catch {
    const fallbackName = buildFallbackDisplayName({ email: user.email, userMetadata })
    return {
      firstName: null,
      lastName: null,
      displayName: fallbackName,
      email,
      avatarUrl: (userMetadata.avatar_url as string) || null,
    }
  }
}

