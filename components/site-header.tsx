import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/40 bg-gradient-to-r from-slate-50 via-blue-50/40 to-background dark:from-slate-900 dark:via-slate-800/60 dark:to-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Hello,</span>
          <span className="text-sm font-medium">Callum Soutar</span>
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatars/callum.jpg" alt="Callum Soutar" />
            <AvatarFallback>CS</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
