"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconPlaneDeparture } from "@tabler/icons-react"
import { useAuth } from "@/contexts/auth-context"
import { cn, getInitialsFromName } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export function SiteHeader() {
  const isMobile = useIsMobile()
  const { toggleSidebar } = useSidebar()
  const { user } = useAuth()
  const [userName, setUserName] = useState<string>("Guest")
  const supabase = createClient()
  
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.id) {
        setUserName("Guest")
        return
      }

      try {
        // Fetch user's first_name and last_name from the database
        const { data: userData, error } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user name:', error)
          // Fallback to user_metadata or email
          const fallbackName = user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "User"
          setUserName(fallbackName)
          return
        }

        // Construct display name from first_name and last_name
        if (userData) {
          const firstName = userData.first_name || ""
          const lastName = userData.last_name || ""
          const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
          
          if (fullName) {
            setUserName(fullName)
          } else {
            // Fallback if both are empty
            const fallbackName = user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split("@")[0] ||
              "User"
            setUserName(fallbackName)
          }
        }
      } catch (error) {
        console.error('Error fetching user name:', error)
        // Fallback to user_metadata or email
        const fallbackName = user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User"
        setUserName(fallbackName)
      }
    }

    fetchUserName()
  }, [user, supabase])
  
  const userEmail = user?.email || ""
  const userAvatar = user?.user_metadata?.avatar_url || ""
  const userInitials = getInitialsFromName(userName, userEmail)
  
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
