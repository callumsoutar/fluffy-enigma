"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AircraftTable } from "@/components/aircraft/aircraft-table"
import type { AircraftFilter, AircraftWithType } from "@/lib/types/aircraft"

// Fetch aircraft from API
async function fetchAircraft(filters?: AircraftFilter): Promise<AircraftWithType[]> {
  const params = new URLSearchParams()
  
  if (filters?.search) {
    params.append('search', filters.search)
  }
  if (filters?.status) {
    params.append('status', filters.status)
  }
  if (filters?.aircraft_type_id) {
    params.append('aircraft_type_id', filters.aircraft_type_id)
  }

  const response = await fetch(`/api/aircraft?${params.toString()}`)
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Insufficient permissions')
    }
    throw new Error('Failed to fetch aircraft')
  }
  const data = await response.json()
  return data.aircraft
}

export default function AircraftPage() {
  const {
    data: aircraft = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["aircraft"],
    queryFn: () => fetchAircraft(),
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
                    <h1 className="text-2xl font-bold tracking-tight">Aircraft</h1>
                    <p className="text-muted-foreground">
                      Manage your fleet and maintenance schedules.
                    </p>
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading aircraft...</div>
                    </div>
                  ) : isError ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">
                        Failed to load aircraft. You may not have permission to view this page.
                      </div>
                    </div>
                  ) : (
                    <AircraftTable aircraft={aircraft} />
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
