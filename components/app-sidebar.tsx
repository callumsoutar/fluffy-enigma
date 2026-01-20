"use client"

import * as React from "react"
import {
  IconHome,
  IconCalendar,
  IconBook,
  IconPlane,
  IconUsers,
  IconUserCog,
  IconFileInvoice,
  IconSchool,
  IconTool,
  IconReport,
  IconSettings,
  IconPlaneDeparture,
  IconCalendarTime,
} from "@tabler/icons-react"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types/roles"
import { getCachedRole } from "@/lib/auth/resolve-role"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { useIsMobile } from "@/hooks/use-mobile"
import { getInitialsFromName } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Navigation configuration with role-based access
import type { Icon } from "@tabler/icons-react"

interface NavItem {
  title: string
  url: string
  icon: Icon
  isActive?: boolean
  roles: UserRole[] // Roles that can see this item
}

interface NavSection {
  label?: string
  items: NavItem[]
}

const navigationConfig: NavSection[] = [
    {
      items: [
        {
          title: "Dashboard",
        url: "/",
          icon: IconHome,
        roles: ['owner', 'admin', 'instructor', 'member', 'student'],
        },
        {
          title: "Scheduler",
        url: "/scheduler",
          icon: IconCalendar,
        roles: ['owner', 'admin', 'instructor', 'member', 'student'],
        },
        {
          title: "Bookings",
        url: "/bookings",
          icon: IconBook,
        roles: ['owner', 'admin', 'instructor', 'member', 'student'],
        },
      ],
    },
    {
      label: "Resources",
      items: [
        {
          title: "Aircraft",
        url: "/aircraft",
          icon: IconPlane,
        roles: ['owner', 'admin', 'instructor'],
        },
        {
          title: "Members",
        url: "/members",
          icon: IconUsers,
        roles: ['owner', 'admin', 'instructor'],
        },
        {
          title: "Staff",
        url: "/staff",
          icon: IconUserCog,
        roles: ['owner', 'admin'],
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          title: "Invoicing",
          url: "/invoices",
          icon: IconFileInvoice,
          roles: ['owner', 'admin', 'instructor'],
        },
        {
          title: "Training",
        url: "/training",
          icon: IconSchool,
        roles: ['owner', 'admin', 'instructor'],
        },
        {
          title: "Equipment",
        url: "/equipment",
          icon: IconTool,
        roles: ['owner', 'admin', 'instructor'],
        },
        {
          title: "Rosters",
          url: "/rosters",
          icon: IconCalendarTime,
          roles: ['owner', 'admin', 'instructor'],
        },
      ],
    },
    {
      label: "Management",
      items: [
        {
          title: "Reports",
        url: "/reports",
          icon: IconReport,
        roles: ['owner', 'admin', 'instructor'],
        },
      ],
    },
]

const secondaryNavItems: NavItem[] = [
    {
      title: "Settings",
    url: "/settings",
      icon: IconSettings,
    roles: ['owner', 'admin'],
    },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, role, profile, loading } = useAuth()
  const isMobile = useIsMobile()
  const [mounted, setMounted] = React.useState(false)
  const [localCachedRole, setLocalCachedRole] = React.useState<UserRole | null>(null)
  
  // Load cached role after mount (prevents hydration mismatch)
  // Uses centralized cache function for consistency
  React.useEffect(() => {
    setMounted(true)
    const cached = getCachedRole()
    if (cached) {
      setLocalCachedRole(cached)
    }
  }, [])
  
  // Sync local state with auth context role
  // This effect runs whenever role, user, loading, or mounted changes
  React.useEffect(() => {
    if (!mounted) return
    
    if (role) {
      // Role is available from auth context - use it
      setLocalCachedRole(role)
    } else if (!loading && user === null) {
      // Not loading and no user - clear the cached role
      // This handles the logout case
      setLocalCachedRole(null)
    } else if (!loading && user !== null && role === null) {
      // Edge case: user exists but role is null (role resolution failed)
      // Clear the stale cached role to prevent showing wrong permissions
      setLocalCachedRole(null)
    }
    // Note: When loading=true, we keep the localCachedRole to prevent flicker
  }, [role, user, loading, mounted])
  
  // Use current role from context (authoritative), or fall back to cached during loading
  // Only use cached role after mount to prevent hydration mismatch
  const effectiveRole = role || (mounted && loading ? localCachedRole : null)

  // Filter navigation items based on user role
  // Use effectiveRole to prevent navigation from disappearing during refresh
  const filteredNavMain = React.useMemo(() => {
    // During SSR or before mount, return empty to prevent hydration mismatch
    if (!mounted) return []
    
    const roleToUse = effectiveRole || localCachedRole
    if (!roleToUse) return []
    
    return navigationConfig
      .map(section => ({
        label: section.label,
        items: section.items
          .filter(item => item.roles.includes(roleToUse))
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ roles, ...item }) => item), // Remove roles property
      }))
      .filter(section => section.items.length > 0) // Remove empty sections
  }, [effectiveRole, localCachedRole, mounted])

  const filteredNavSecondary = React.useMemo(() => {
    // During SSR or before mount, return empty to prevent hydration mismatch
    if (!mounted) return []
    
    const roleToUse = effectiveRole || localCachedRole
    if (!roleToUse) return []
    
    return secondaryNavItems
      .filter(item => item.roles.includes(roleToUse))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ roles, ...item }) => item) // Remove roles property
  }, [effectiveRole, localCachedRole, mounted])

  const userData = React.useMemo(() => {
    if (!user) {
      return {
        name: "Guest",
        email: "",
        avatar: "",
        initials: "GU",
      }
    }

    // Use profile from auth context (cached and persisted across navigations)
    const name = profile?.displayName ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User"
    const email = profile?.email || user.email || ""
    const initials = getInitialsFromName(name, email)

    return {
      name,
      email,
      avatar: profile?.avatarUrl || user.user_metadata?.avatar_url || "",
      initials,
    }
  }, [user, profile])

  // Determine if we should show the loading state
  // Show loading when:
  // 1. Not yet mounted (SSR/hydration)
  // 2. Auth is loading AND we don't have a role to display
  // Note: If loading is false but role is null (role resolution failed), we still render
  // the navigation (which will be empty) - this is better than showing loading forever
  const hasAnyRole = !!role || !!localCachedRole
  const isAuthLoading = loading
  const isInitialLoad = !mounted || (isAuthLoading && !hasAnyRole)

  // Show loading state during SSR, initial load, or before mount
  if (isInitialLoad) {
    return (
      <Sidebar collapsible="offcanvas" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="data-[slot=sidebar-menu-button]:!p-1.5"
              >
                <a href="#">
                  <IconPlaneDeparture className="!size-5" />
                  {!isMobile && (
                    <span className="text-base font-semibold">Flight Desk Pro</span>
                  )}
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            Loading navigation...
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            Loading...
          </div>
        </SidebarFooter>
      </Sidebar>
    )
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className={`data-[slot=sidebar-menu-button]:!p-1.5 ${isMobile ? 'justify-center' : ''}`}
            >
              <a href="#">
                <IconPlaneDeparture className="!size-5" />
                {!isMobile && (
                  <span className="text-base font-semibold">Flight Desk Pro</span>
                )}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={filteredNavMain} />
        <NavSecondary items={filteredNavSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
