import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  // Supabase SSR guidance: keep middleware focused on session refresh + redirect.
  // Authorization should be enforced via RLS + server-side checks in route handlers/components.
  const { response } = await updateSession(request)
  
  // If the response is a redirect (e.g., to login), return it immediately
  if (response.headers.get('location')) {
    return response
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

