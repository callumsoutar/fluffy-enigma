"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { BookingsTable } from "@/components/bookings/bookings-table"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { BookingsFilter, BookingStatus, BookingType } from "@/lib/types/bookings"
import { zonedDayRangeUtcIso, zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

// Fetch bookings from API
async function fetchBookings(filters?: BookingsFilter): Promise<BookingWithRelations[]> {
  const params = new URLSearchParams()
  
  if (filters?.status) {
    params.append('status', filters.status.join(','))
  }
  if (filters?.booking_type) {
    params.append('booking_type', filters.booking_type.join(','))
  }
  if (filters?.search) {
    params.append('search', filters.search)
  }
  if (filters?.aircraft_id) {
    params.append('aircraft_id', filters.aircraft_id)
  }
  if (filters?.instructor_id) {
    params.append('instructor_id', filters.instructor_id)
  }
  if (filters?.user_id) {
    params.append('user_id', filters.user_id)
  }
  if (filters?.start_date) {
    params.append('start_date', filters.start_date)
  }
  if (filters?.end_date) {
    params.append('end_date', filters.end_date)
  }

  const response = await fetch(`/api/bookings?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch bookings')
  }
  const data = await response.json()
  return data.bookings
}

// Get today's date range (start and end of day)
function getTodayRange() {
  // Canonical strategy: the app operates in the school timezone (NZ).
  // We compute day boundaries explicitly in that timezone so DST transitions are safe and
  // results do not depend on the browser's configured timezone.
  const timeZone = "Pacific/Auckland"
  const todayKey = zonedTodayYyyyMmDd(timeZone)
  const { startUtcIso, endUtcIso } = zonedDayRangeUtcIso({ dateYyyyMmDd: todayKey, timeZone })
  return { start: startUtcIso, end: endUtcIso }
}

export default function BookingsPage() {
  const [activeTab, setActiveTab] = React.useState("all")
  const [mounted, setMounted] = React.useState(false)
  const [filters, setFilters] = React.useState<BookingsFilter>({})

  // Prevent hydration mismatch by only calculating dates after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Build filters based on active tab and user filters
  // When searching, ignore tab filters to search across all bookings
  const queryFilters = React.useMemo(() => {
    const today = getTodayRange()
    const baseFilters: BookingsFilter = { ...filters }

    // If there's a search query, search across all bookings (ignore tab filters)
    // Otherwise, apply tab-specific filters
    if (!filters.search) {
      switch (activeTab) {
        case "today":
          baseFilters.start_date = today.start
          baseFilters.end_date = today.end
          break
        case "flying":
          baseFilters.status = ["flying"]
          break
        case "unconfirmed":
          baseFilters.status = ["unconfirmed"]
          break
        case "all":
          // No filters for "all" tab
          break
      }
    }
    // When searching, don't apply tab filters - search across all bookings

    return baseFilters
  }, [activeTab, filters])

  const {
    data: allBookings = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["bookings", queryFilters],
    queryFn: () => fetchBookings(queryFilters),
    staleTime: 30_000,
    // Keep previous data while loading to avoid showing empty state when switching tabs
    placeholderData: (previousData) => previousData,
  })

  // Calculate tab counts (memoized to prevent recalculation)
  // For accurate counts, we need to fetch all bookings without tab filters
  // but with search filter if present
  const countsFilters: BookingsFilter = filters.search ? { search: filters.search } : {}
  const {
    data: allBookingsForCounts = [],
    isLoading: isLoadingCounts,
  } = useQuery({
    queryKey: ["bookings", "counts", countsFilters],
    queryFn: () => fetchBookings(countsFilters),
    staleTime: 30_000,
    // Keep previous data while loading to avoid showing zeros
    placeholderData: (previousData) => previousData,
  })

  const tabCounts = React.useMemo(() => {
    // Only return zeros if we haven't mounted yet or if we're loading counts for the first time
    // Use the counts query loading state, not the main query loading state
    if (!mounted || (isLoadingCounts && allBookingsForCounts.length === 0)) {
      return { all: 0, today: 0, flying: 0, unconfirmed: 0 }
    }

    const today = getTodayRange()
    return {
      all: allBookingsForCounts.length,
      today: allBookingsForCounts.filter((b) => {
        const startTime = new Date(b.start_time)
        return (
          startTime >= new Date(today.start) &&
          startTime < new Date(today.end)
        )
      }).length,
      flying: allBookingsForCounts.filter((b) => b.status === "flying").length,
      unconfirmed: allBookingsForCounts.filter((b) => b.status === "unconfirmed").length,
    }
  }, [allBookingsForCounts, isLoadingCounts, mounted])

  // Filter bookings based on active tab (already filtered by API, but keep for consistency)
  const filteredBookings = React.useMemo(() => {
    if (isLoading || !mounted) return []
    return allBookings
  }, [allBookings, isLoading, mounted])

  // Handle filter changes from table component
  const handleFiltersChange = React.useCallback((tableFilters: {
    search?: string
    status?: BookingStatus[]
    booking_type?: BookingType[]
  }) => {
    setFilters((prev) => {
      const newFilters: BookingsFilter = { ...prev }
      
      // Update search - remove property if undefined/empty
      if (tableFilters.search) {
        newFilters.search = tableFilters.search
      } else {
        delete newFilters.search
      }
      
      // Update booking_type
      if (tableFilters.booking_type) {
        newFilters.booking_type = tableFilters.booking_type
      } else {
        delete newFilters.booking_type
      }
      
      // Handle status filter based on whether we're searching
      if (tableFilters.search) {
        // When searching, allow status filter to work independently of tabs
        if (tableFilters.status) {
          newFilters.status = tableFilters.status
        } else {
          delete newFilters.status
        }
      } else {
        // When not searching, respect tab filters (flying/unconfirmed tabs set status)
        if (activeTab !== "flying" && activeTab !== "unconfirmed" && tableFilters.status) {
          newFilters.status = tableFilters.status
        } else if (activeTab === "flying" || activeTab === "unconfirmed") {
          // Clear status filter when in a tab that sets it (will be set by queryFilters)
          delete newFilters.status
        }
      }
      
      return newFilters
    })
  }, [activeTab])

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
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading bookings...</div>
                    </div>
                  ) : isError ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">
                        Failed to load bookings. You may not have permission to view this page.
                      </div>
                    </div>
                  ) : (
                    <BookingsTable
                      bookings={filteredBookings}
                      onFiltersChange={handleFiltersChange}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      tabCounts={tabCounts}
                    />
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
