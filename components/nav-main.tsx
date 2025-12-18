"use client"

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
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, sectionIndex) => (
        <SidebarGroup key={sectionIndex}>
          {section.label && (
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    tooltip={item.title}
                    isActive={item.isActive}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  )
}
