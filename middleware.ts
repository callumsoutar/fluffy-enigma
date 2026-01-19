import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { createServerClient } from "@supabase/ssr"
import { isRoleAllowedForRoute } from "@/lib/auth/route-permissions"
import { resolveUserRole } from "@/lib/auth/resolve-role"

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
    // Create a lightweight supabase client for role resolution
    // Uses cookies from the request (already updated by updateSession)
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
    
    // Resolve role using centralized utility
    // This checks JWT claims first, then falls back to database
    const { role } = await resolveUserRole(supabase, user)
    
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

