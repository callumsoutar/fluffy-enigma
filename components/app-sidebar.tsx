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

  // Filter navigation items based on user role
  const filteredNavMain = React.useMemo(() => {
    if (!role) return []
    
    return navigationConfig
      .map(section => ({
        label: section.label,
        items: section.items
          .filter(item => item.roles.includes(role))
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ roles, ...item }) => item), // Remove roles property
      }))
      .filter(section => section.items.length > 0) // Remove empty sections
  }, [role])

  const filteredNavSecondary = React.useMemo(() => {
    if (!role) return []
    
    return secondaryNavItems
      .filter(item => item.roles.includes(role))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ roles, ...item }) => item) // Remove roles property
  }, [role])

  const userData = React.useMemo(() => {
    // Priority 1: Use profile from auth context (cached and persisted across navigations)
    // This prevents the "Guest" flicker on refresh since profile is cached in localStorage
    if (profile) {
      return {
        name: profile.displayName,
        email: profile.email,
        avatar: profile.avatarUrl || user?.user_metadata?.avatar_url || "",
        initials: getInitialsFromName(profile.displayName, profile.email),
      }
    }

    // Priority 2: Fallback to user metadata if session is active but profile query hasn't finished
    if (user) {
      const name = user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User"
      const email = user.email || ""
      const initials = getInitialsFromName(name, email)

      return {
        name,
        email,
        avatar: user.user_metadata?.avatar_url || "",
        initials,
      }
    }

    // Priority 3: Only show Guest if we are not loading and have no data
    return {
      name: "Guest",
      email: "",
      avatar: "",
      initials: "GU",
    }
  }, [user, profile])

  // Determine if we should show the loading state
  // Only show loading while auth state is being resolved.
  // If role is null after loading completes, we render an empty nav rather than hanging.
  const isInitialLoad = loading

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
