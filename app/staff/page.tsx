"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { InstructorsTable } from "@/components/staff/instructors-table"
import type { InstructorWithUser, InstructorsResponse } from "@/lib/types/instructors"

async function fetchInstructors(): Promise<InstructorWithUser[]> {
  const response = await fetch("/api/instructors")

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized")
    }
    if (response.status === 403) {
      throw new Error("Forbidden: Insufficient permissions")
    }
    throw new Error("Failed to fetch staff")
  }

  const data: InstructorsResponse = await response.json()
  return data.instructors
}

export default function StaffPage() {
  const {
    data: instructors = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => fetchInstructors(),
    staleTime: 30_000,
  })

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
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
                    <p className="text-muted-foreground">
                      Manage your organization&apos;s instructors and staff members.
                    </p>
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading staff...</div>
                    </div>
                  ) : isError ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">
                        Failed to load staff. You may not have permission to view this page.
                      </div>
                    </div>
                  ) : (
                    <InstructorsTable instructors={instructors} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

