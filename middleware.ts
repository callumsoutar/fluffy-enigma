import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { createServerClient } from "@supabase/ssr"
import { isRoleAllowedForRoute } from "@/lib/auth/route-permissions"
import type { UserRole } from "@/lib/types/roles"
import { isValidRole } from "@/lib/types/roles"

export async function middleware(request: NextRequest) {
  // First, update session (handles authentication)
  // This returns both the response with updated cookies AND the user
  const { response, user } = await updateSession(request)
  
  // If the response is a redirect (e.g., to login), return it immediately
  if (response.headers.get('location')) {
    return response
  }
  
  // Get the pathname
  const pathname = request.nextUrl.pathname
  
  if (user) {
    // Get role from JWT claims (fast) or database
    let role: UserRole | null = null
    
    // Check JWT claims first
    const roleFromClaims = user.user_metadata?.role as string | undefined
    if (roleFromClaims && isValidRole(roleFromClaims)) {
      role = roleFromClaims
    } else {
      // Create a lightweight supabase client just for the role query
      // Use the cookies from the request (already updated by updateSession)
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              // Forward any cookie changes to the response
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              )
            },
          },
        }
      )
      
      // Fallback to database lookup using tenant_users
      const { data: roleData } = await supabase
        .from('tenant_users')
        .select(`
          role_id,
          roles!inner (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      
      if (roleData && roleData.roles) {
        // Supabase returns joined relations as arrays
        const roles = Array.isArray(roleData.roles) ? roleData.roles : [roleData.roles]
        const roleObj = roles[0] as { name: string } | undefined
        if (roleObj?.name && isValidRole(roleObj.name)) {
          role = roleObj.name
        }
      }
    }
    
    // Check if role is allowed for this route
    const isAllowed = isRoleAllowedForRoute(role, pathname)
    
    if (!isAllowed) {
      // API routes should return 403, page routes should redirect
      if (pathname.startsWith('/api/')) {
        const apiResponse = new NextResponse(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
        // Copy cookies to the API response
        response.cookies.getAll().forEach((cookie) => {
          apiResponse.cookies.set(cookie.name, cookie.value)
        })
        return apiResponse
      }
      
      // Page routes redirect
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('error', 'unauthorized')
      const redirectResponse = NextResponse.redirect(url)
      // Copy cookies to the redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      return redirectResponse
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

