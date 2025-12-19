"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconPlaneDeparture } from "@tabler/icons-react"
import { useAuth } from "@/contexts/auth-context"

function getUserInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  if (email) {
    return email.substring(0, 2).toUpperCase()
  }
  return "U"
}

export function SiteHeader() {
  const isMobile = useIsMobile()
  const { toggleSidebar } = useSidebar()
  const { user } = useAuth()
  
  const userName = user
    ? user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User"
    : "Guest"
  
  const userEmail = user?.email || ""
  const userAvatar = user?.user_metadata?.avatar_url || ""
  const userInitials = getUserInitials(userName, userEmail)
  
  return (
    <header className={`flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) ${
      isMobile 
        ? "bg-slate-800 dark:bg-slate-900 border-slate-700/50 dark:border-slate-800/50 shadow-sm" 
        : "border-border/40 bg-gradient-to-r from-slate-50 via-blue-50/40 to-background dark:from-slate-900 dark:via-slate-800/60 dark:to-background"
    }`}>
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {isMobile ? (
          <>
            {/* Mobile: Hamburger menu (left), Flight Desk Pro (center), Avatar (right) */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-slate-100 hover:text-white hover:bg-slate-700/50"
              onClick={toggleSidebar}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <div className="flex flex-1 items-center justify-center gap-2">
              <IconPlaneDeparture className="h-5 w-5 text-slate-100" />
              <span className="text-base font-semibold text-slate-100">Flight Desk Pro</span>
            </div>
            <div className="flex items-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback className="bg-slate-700/80 text-slate-100">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </div>
          </>
        ) : (
          <>
            {/* Desktop: Original layout */}
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Hello,</span>
              <span className="text-sm font-medium">{userName}</span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
