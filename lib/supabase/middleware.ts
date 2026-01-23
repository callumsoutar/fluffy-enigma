import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export type UpdateSessionResult = {
  response: NextResponse
  userId: string | null
}

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Supabase guidance: use getClaims() (signature-verified) in the proxy/middleware.
  // This refreshes the session cookie if needed and is safe to trust.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub ?? null

  // Public routes that don't require authentication
  const publicPaths = ["/login", "/signup", "/auth", "/onboarding", "/api/auth"]
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (!userId && !isPublicPath) {
    // no user and not on a public path, redirect to login
    // IMPORTANT: Copy cookies to the redirect response
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    const redirectResponse = NextResponse.redirect(url)
    
    // Copy any cookies that were set during the session check
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    
    return { response: redirectResponse, userId: null }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return { response: supabaseResponse, userId }
}

