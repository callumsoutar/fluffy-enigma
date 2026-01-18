import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Auth callback handler for:
 * - Email verification links
 * - OAuth provider redirects (Google, Apple)
 * - Password reset links
 * - Magic links
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  
  // Get the auth code from the URL
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  
  // Handle OAuth errors
  if (error) {
    console.error('Auth callback error:', error, error_description)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description || error)}`
    )
  }
  
  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error('Code exchange error:', exchangeError)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      )
    }
    
    // Check if this is a new OAuth user who needs tenant setup
    if (data.user) {
      const userMetadata = data.user.user_metadata
      
      // If user signed up via OAuth and doesn't have a tenant yet
      if (!userMetadata?.tenant_id) {
        // Check if user has any tenant memberships
        const { data: tenantMemberships } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', data.user.id)
          .limit(1)
        
        if (!tenantMemberships || tenantMemberships.length === 0) {
          // New OAuth user without tenant - redirect to organization setup
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }
    }
    
    // Successful auth - redirect to the intended destination
    return NextResponse.redirect(`${origin}${next}`)
  }

  // No code provided - redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
