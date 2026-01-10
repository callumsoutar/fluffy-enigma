"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { IconUsers, IconClock, IconPlane, IconTrendingUp, IconInfoCircle } from "@tabler/icons-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface DashboardStats {
  totalMembers: number
  totalFlyingHoursLast30Days: number
  averageFlyingHoursPerMember: number
  numberOfFlightsCompletedLast30Days: number
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Insufficient permissions')
    }
    throw new Error(`Failed to fetch: ${response.statusText}`)
  }
  return response.json()
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(num)
}

interface StatCardProps {
  title: string
  value: number | undefined
  isLoading: boolean
  icon: React.ReactNode
  tooltip: string
  subtitle?: string
}

function StatCard({ title, value, isLoading, icon, tooltip, subtitle }: StatCardProps) {
  return (
    <Card className="@container/card">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-2">
          <CardDescription className="leading-tight">{title}</CardDescription>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                type="button"
                className="outline-none focus:outline-none flex-shrink-0 mt-0.5"
                aria-label="More information"
              >
                <IconInfoCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-28" />
        ) : (
          <CardTitle className="text-3xl font-semibold tabular-nums @[250px]/card:text-4xl leading-none">
            {formatNumber(value ?? 0)}
          </CardTitle>
        )}
        {subtitle && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {icon}
            <span className="truncate">{subtitle}</span>
          </div>
        )}
      </CardHeader>
    </Card>
  )
}

export function SectionCards() {
  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery<DashboardStats>({
    queryKey: ["dashboardStats"],
    queryFn: () => fetchJson<DashboardStats>("/api/dashboard/stats"),
    staleTime: 60_000, // Cache for 1 minute
    refetchOnWindowFocus: true,
  })

  if (isError) {
    return (
      <div className="px-4 lg:px-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
          Failed to load dashboard statistics. Please try again later.
        </div>
      </div>
    )
  }

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard
        title="Total Members"
        value={stats?.totalMembers}
        isLoading={isLoading}
        icon={<IconUsers className="h-4 w-4" />}
        tooltip="Total number of active members in the system. This includes all users with active accounts."
        subtitle="Active user accounts"
      />
      <StatCard
        title="Flying Hours"
        value={stats?.totalFlyingHoursLast30Days}
        isLoading={isLoading}
        icon={<IconClock className="h-4 w-4" />}
        tooltip="Total flying hours from all completed flights in the last 30 days. Based on flight_time from bookings with completed status."
        subtitle="Last 30 days"
      />
      <StatCard
        title="Avg Hours/Member"
        value={stats?.averageFlyingHoursPerMember}
        isLoading={isLoading}
        icon={<IconTrendingUp className="h-4 w-4" />}
        tooltip="Average flying hours per active member, calculated by dividing total flying hours by the number of active members over the last 30 days."
        subtitle="Last 30 days"
      />
      <StatCard
        title="Flights Completed"
        value={stats?.numberOfFlightsCompletedLast30Days}
        isLoading={isLoading}
        icon={<IconPlane className="h-4 w-4" />}
        tooltip="Number of flights completed in the last 30 days. Only includes bookings with completed status and recorded flight time."
        subtitle="Last 30 days"
      />
    </div>
  )
}
