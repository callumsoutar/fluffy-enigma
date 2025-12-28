"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TrainingTable } from "@/components/training/training-table"
import type { TrainingOverviewResponse } from "@/lib/types/training-overview"

async function fetchTrainingOverview(): Promise<TrainingOverviewResponse> {
  const res = await fetch("/api/training/overview")
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized")
    if (res.status === 403) throw new Error("Forbidden: Insufficient permissions")
    const payload = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to fetch training overview")
  }
  return (await res.json()) as TrainingOverviewResponse
}

export default function TrainingPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["training-overview"],
    queryFn: fetchTrainingOverview,
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
                {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
                  <div className="text-sm font-medium text-slate-500">Loading training overview...</div>
                </div>
              ) : isError || !data ? (
                <div className="flex items-center justify-center py-32">
                  <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm max-w-md text-center">
                    <p className="text-sm font-medium text-slate-600">
                      Failed to load training. You may not have permission to view this page.
                    </p>
                  </div>
                </div>
              ) : (
                <TrainingTable data={data} />
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
    </SidebarProvider>
  )
}


