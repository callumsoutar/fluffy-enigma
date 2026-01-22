import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { createClient } from "@/lib/supabase/server"
import { resolveUserRole } from "@/lib/auth/resolve-role"
import { fetchUserProfile } from "@/lib/auth/user-profile"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flight Desk Pro - Safety Management System",
  description: "Comprehensive safety management system for flight schools",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve auth state on the server (cookie-based SSR via @supabase/ssr).
  // This makes auth predictable across reloads/new tabs and avoids client-side deadlocks.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const initialRole = user ? (await resolveUserRole(supabase, user)).role : null
  const initialProfile = user ? await fetchUserProfile(supabase, user) : null

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <QueryProvider>
        <AuthProvider initialUser={user} initialRole={initialRole} initialProfile={initialProfile}>
          {children}
          <Toaster />
          <SpeedInsights />
        </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
