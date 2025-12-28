"use client"

import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ResourceTimelineScheduler } from "@/components/scheduler/resource-timeline-scheduler"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function SchedulerPage() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">Scheduler</h1>
                    <p className="text-sm text-muted-foreground">
                      Resource timeline view. Designed for fast scanning and clean day planning.
                    </p>
                  </div>
                  <ResourceTimelineScheduler />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


