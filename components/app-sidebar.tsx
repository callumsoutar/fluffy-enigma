"use client"

import * as React from "react"
import {
  IconChartBar,
  IconHome,
  IconCalendar,
  IconBook,
  IconPlane,
  IconUsers,
  IconUserCog,
  IconFileInvoice,
  IconSchool,
  IconTool,
  IconCheckbox,
  IconReport,
  IconSettings,
  IconPlaneDeparture,
} from "@tabler/icons-react"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types/roles"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

function getUserInitials(name: string, email: string): string {
  if (name) {
    const parts = name.trim().split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

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
        url: "/dashboard",
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
        isActive: true,
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
        url: "/invoicing",
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
    ],
  },
  {
    label: "Management",
    items: [
      {
        title: "Tasks",
        url: "/tasks",
        icon: IconCheckbox,
        roles: ['owner', 'admin', 'instructor'],
      },
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
    roles: ['owner', 'admin', 'instructor', 'member', 'student'],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, role, loading } = useAuth()

  // Filter navigation items based on user role
  const filteredNavMain = React.useMemo(() => {
    if (!role) return []
    
    return navigationConfig
      .map(section => ({
        label: section.label,
        items: section.items
          .filter(item => item.roles.includes(role))
          .map(({ roles, ...item }) => item), // Remove roles property
      }))
      .filter(section => section.items.length > 0) // Remove empty sections
  }, [role])

  const filteredNavSecondary = React.useMemo(() => {
    if (!role) return []
    
    return secondaryNavItems
      .filter(item => item.roles.includes(role))
      .map(({ roles, ...item }) => item) // Remove roles property
  }, [role])

  const userData = React.useMemo(() => {
    if (!user) {
      return {
        name: "Guest",
        email: "",
        avatar: "",
        initials: "GU",
      }
    }

    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User"
    const email = user.email || ""
    const initials = getUserInitials(name, email)

    return {
      name,
      email,
      avatar: user.user_metadata?.avatar_url || "",
      initials,
    }
  }, [user])

  if (loading) {
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
                  <span className="text-base font-semibold">Flight Desk Pro</span>
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
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconPlaneDeparture className="!size-5" />
                <span className="text-base font-semibold">Flight Desk Pro</span>
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
