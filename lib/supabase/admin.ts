import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Admin client with service_role privileges.
 * ONLY use this in Server Components, API routes, or Server Actions.
 * NEVER expose this to the client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Missing Supabase admin environment variables")
  }

  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

