"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  sections,
}: {
  sections: {
    label?: string
    items: {
      title: string
      url: string
      icon?: Icon
      isActive?: boolean
    }[]
  }[]
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, sectionIndex) => (
        <SidebarGroup key={sectionIndex}>
          {section.label && (
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                // Determine if item is active based on current pathname
                // Match exact path or if pathname starts with item.url (for nested routes)
                const isActive = pathname === item.url || 
                  (item.url !== '/' && pathname?.startsWith(item.url + '/'))
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                    >
                      <Link href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  )
}
