"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconPlaneDeparture } from "@tabler/icons-react"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

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
    <header className={cn(
      "flex h-12 shrink-0 items-center gap-2 border-b transition-[width] ease-linear shadow-sm",
      // Mobile: Sidebar blue theme, Desktop: White theme
      isMobile 
        ? "bg-sidebar text-sidebar-foreground border-sidebar-border"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
    )}>
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {isMobile ? (
          <>
            {/* Mobile: Hamburger menu (left), Flight Desk Pro (center), Avatar (right) */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-sidebar-foreground hover:text-sidebar-foreground/90 hover:bg-sidebar-accent"
              onClick={toggleSidebar}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <div className="flex flex-1 items-center justify-center gap-2">
              <IconPlaneDeparture className="h-5 w-5 text-sidebar-foreground" />
              <span className="text-base font-semibold text-sidebar-foreground">Flight Desk Pro</span>
            </div>
            <div className="flex items-center">
              <Avatar className="h-8 w-8 border-2 border-sidebar-border">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
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
