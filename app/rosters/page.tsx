"use client"

import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { RosterScheduler } from "@/components/rosters/roster-scheduler"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function RostersPage() {
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
        <main className="flex-1 space-y-6 p-4 sm:p-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Rosters</h1>
            <p className="text-sm text-muted-foreground">
              Plan recurring and one-off staff coverage directly from the scheduling board.
            </p>
          </div>
          <RosterScheduler />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

