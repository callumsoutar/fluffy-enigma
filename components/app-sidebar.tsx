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

const data = {
  navMain: [
    {
      items: [
        {
          title: "Dashboard",
          url: "#",
          icon: IconHome,
        },
        {
          title: "Scheduler",
          url: "#",
          icon: IconCalendar,
        },
        {
          title: "Bookings",
          url: "#",
          icon: IconBook,
          isActive: true,
        },
      ],
    },
    {
      label: "Resources",
      items: [
        {
          title: "Aircraft",
          url: "#",
          icon: IconPlane,
        },
        {
          title: "Members",
          url: "#",
          icon: IconUsers,
        },
        {
          title: "Staff",
          url: "#",
          icon: IconUserCog,
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          title: "Invoicing",
          url: "#",
          icon: IconFileInvoice,
        },
        {
          title: "Training",
          url: "#",
          icon: IconSchool,
        },
        {
          title: "Equipment",
          url: "#",
          icon: IconTool,
        },
      ],
    },
    {
      label: "Management",
      items: [
        {
          title: "Tasks",
          url: "#",
          icon: IconCheckbox,
        },
        {
          title: "Reports",
          url: "#",
          icon: IconReport,
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, loading } = useAuth()

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
          <NavMain sections={data.navMain} />
          <NavSecondary items={data.navSecondary} className="mt-auto" />
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
        <NavMain sections={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
