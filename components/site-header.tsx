"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"

export function SiteHeader() {
  const isMobile = useIsMobile()
  
  return (
    <header className={`flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) ${
      isMobile 
        ? "bg-slate-800 dark:bg-slate-900 border-slate-700/50 dark:border-slate-800/50 shadow-sm" 
        : "border-border/40 bg-gradient-to-r from-slate-50 via-blue-50/40 to-background dark:from-slate-900 dark:via-slate-800/60 dark:to-background"
    }`}>
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className={`-ml-1 ${isMobile ? "text-slate-100 hover:text-white" : ""}`} />
        <Separator
          orientation="vertical"
          className={`mx-2 data-[orientation=vertical]:h-4 ${
            isMobile ? "bg-slate-600/50" : ""
          }`}
        />
        <div className={`ml-auto flex items-center gap-2 ${isMobile ? "text-slate-100" : ""}`}>
          <span className={`text-sm ${isMobile ? "text-slate-300" : "text-muted-foreground"}`}>Hello,</span>
          <span className={`text-sm font-medium ${isMobile ? "text-slate-100" : ""}`}>Callum Soutar</span>
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatars/callum.jpg" alt="Callum Soutar" />
            <AvatarFallback className={isMobile ? "bg-slate-700/80 text-slate-100" : ""}>CS</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
