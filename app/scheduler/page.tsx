"use client"

import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ResourceTimelineScheduler } from "@/components/scheduler/resource-timeline-scheduler"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function SchedulerPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <main className="flex-1 space-y-6 p-4 pt-2 sm:p-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Scheduler</h1>
            <p className="text-sm text-muted-foreground">
              Resource timeline view. Designed for fast scanning and clean day planning.
            </p>
          </div>
          <ResourceTimelineScheduler />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}


