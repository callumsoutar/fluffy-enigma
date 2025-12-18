"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookingsTable } from "@/components/bookings/bookings-table"
import type { BookingWithRelations, BookingsFilter } from "@/lib/types/bookings"

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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return {
    start: today.toISOString(),
    end: tomorrow.toISOString(),
  }
}

export default function BookingsPage() {
  const [activeTab, setActiveTab] = React.useState("today")
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch by only calculating dates after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const {
    data: allBookings = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => fetchBookings(),
    staleTime: 30_000,
  })

  // Memoize today's range to prevent recalculation on every render
  const todayRange = React.useMemo(() => {
    if (!mounted) return { start: "", end: "" }
    return getTodayRange()
  }, [mounted])

  // Calculate tab counts (memoized to prevent recalculation)
  const tabCounts = React.useMemo(() => {
    if (!mounted || isLoading) {
      return { today: 0, flying: 0, unconfirmed: 0 }
    }

    const today = getTodayRange()
    return {
      today: allBookings.filter((b) => {
        const startTime = new Date(b.start_time)
        return (
          startTime >= new Date(today.start) &&
          startTime < new Date(today.end)
        )
      }).length,
      flying: allBookings.filter((b) => b.status === "flying").length,
      unconfirmed: allBookings.filter((b) => b.status === "unconfirmed").length,
    }
  }, [allBookings, isLoading, mounted])

  // Filter bookings based on active tab
  const filteredBookings = React.useMemo(() => {
    if (isLoading || !mounted) return []

    const today = getTodayRange()

    switch (activeTab) {
      case "today":
        return allBookings.filter((booking) => {
          const startTime = new Date(booking.start_time)
          return (
            startTime >= new Date(today.start) &&
            startTime < new Date(today.end)
          )
        })
      case "flying":
        return allBookings.filter((booking) => booking.status === "flying")
      case "unconfirmed":
        return allBookings.filter((booking) => booking.status === "unconfirmed")
      default:
        return allBookings
    }
  }, [allBookings, activeTab, isLoading, mounted])

  // Handle filter changes (for future API integration)
  const handleFiltersChange = React.useCallback((filters: {
    search?: string
    status?: string[]
    booking_type?: string[]
  }) => {
    // For now, filtering is done client-side
    // In the future, you can refetch from API with these filters
    console.log('Filters changed:', filters)
  }, [])

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
                    <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
                    <p className="text-muted-foreground">
                      View and manage all flight bookings
                    </p>
                  </div>

                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="today">
                        Today ({tabCounts.today})
                      </TabsTrigger>
                      <TabsTrigger value="flying">
                        Flying ({tabCounts.flying})
                      </TabsTrigger>
                      <TabsTrigger value="unconfirmed">
                        Unconfirmed ({tabCounts.unconfirmed})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="today" className="mt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Loading bookings...</div>
                        </div>
                      ) : isError ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Failed to load bookings.</div>
                        </div>
                      ) : (
                        <BookingsTable
                          bookings={filteredBookings}
                          onFiltersChange={handleFiltersChange}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="flying" className="mt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Loading bookings...</div>
                        </div>
                      ) : isError ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Failed to load bookings.</div>
                        </div>
                      ) : (
                        <BookingsTable
                          bookings={filteredBookings}
                          onFiltersChange={handleFiltersChange}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="unconfirmed" className="mt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Loading bookings...</div>
                        </div>
                      ) : isError ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Failed to load bookings.</div>
                        </div>
                      ) : (
                        <BookingsTable
                          bookings={filteredBookings}
                          onFiltersChange={handleFiltersChange}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
