"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  IconArrowLeft,
  IconHistory,
  IconAlertTriangle,
  IconTool,
  IconSettings,
  IconChartBar,
} from "@tabler/icons-react"
import Link from "next/link"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent } from "@/components/ui/card"
import * as Tabs from "@radix-ui/react-tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { ObservationWithUser } from "@/lib/types/observations"
import type { AircraftComponent } from "@/lib/types/aircraft_components"
import type { MaintenanceVisit } from "@/lib/types/maintenance_visits"
import { AircraftOverviewTab } from "@/components/aircraft/aircraft-overview-tab"
import { AircraftFlightHistoryTab } from "@/components/aircraft/aircraft-flight-history-tab"
import { AircraftObservationsTab } from "@/components/aircraft/aircraft-observations-tab"
import { AircraftMaintenanceItemsTab } from "@/components/aircraft/aircraft-maintenance-items-tab"
import { AircraftMaintenanceHistoryTab } from "@/components/aircraft/aircraft-maintenance-history-tab"
import { AircraftSettingsTab } from "@/components/aircraft/aircraft-settings-tab"

interface FlightEntry {
  id: string
  user_id: string | null
  instructor_id: string | null
  checked_out_aircraft_id: string | null
  checked_out_instructor_id: string | null
  start_time: string
  end_time: string
  status: string
  purpose: string
  hobbs_start: number | null
  hobbs_end: number | null
  tach_start: number | null
  tach_end: number | null
  flight_time: number | null
  created_at: string
  student?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  }
  instructor?: {
    id: string
    first_name: string | null
    last_name: string | null
    user_id: string | null
  }
  flight_type?: {
    id: string
    name: string
  }
  lesson?: {
    id: string
    name: string
  }
}

interface AircraftDetailData {
  aircraft: AircraftWithType
  flights: FlightEntry[]
  maintenanceVisits: MaintenanceVisit[]
  observations: ObservationWithUser[]
  components: AircraftComponent[]
}

async function fetchAircraft(id: string): Promise<AircraftDetailData> {
  const response = await fetch(`/api/aircraft/${id}`)
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Aircraft not found')
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Insufficient permissions')
    }
    throw new Error('Failed to fetch aircraft')
  }
  const data = await response.json()
  return data
}


function formatTotalHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) {
    return "0.0h"
  }
  return `${hours.toFixed(1)}h`
}

export default function AircraftDetailPage() {
  const params = useParams()
  const aircraftId = params.id as string
  const [activeTab, setActiveTab] = React.useState("overview")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  const {
    data: aircraftData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["aircraft", aircraftId],
    queryFn: () => fetchAircraft(aircraftId),
    enabled: !!aircraftId,
  })

  // Update underline position when tab changes
  React.useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab]
    const tabsList = tabsListRef.current
    
    if (activeTabElement && tabsList) {
      const tabsListRect = tabsList.getBoundingClientRect()
      const activeTabRect = activeTabElement.getBoundingClientRect()
      
      setUnderlineStyle({
        left: activeTabRect.left - tabsListRect.left,
        width: activeTabRect.width
      })

      if (window.innerWidth < 768) {
        const scrollLeft = tabsList.scrollLeft
        const tabLeft = activeTabRect.left - tabsListRect.left
        const tabWidth = activeTabRect.width
        const containerWidth = tabsListRect.width
        
        const targetScroll = scrollLeft + tabLeft - (containerWidth / 2) + (tabWidth / 2)
        
        tabsList.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: 'smooth'
        })
      }
    }
  }, [activeTab])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const activeTabElement = tabRefs.current[activeTab]
      const tabsList = tabsListRef.current
      
      if (activeTabElement && tabsList) {
        const tabsListRect = tabsList.getBoundingClientRect()
        const activeTabRect = activeTabElement.getBoundingClientRect()
        
        setUnderlineStyle({
          left: activeTabRect.left - tabsListRect.left,
          width: activeTabRect.width
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [activeTab])

  React.useEffect(() => {
    const tabsList = tabsListRef.current
    if (!tabsList) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = tabsList
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }

    checkScroll()
    tabsList.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)

    return () => {
      tabsList.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [activeTab])

  const tabItems = [
    { id: "overview", label: "Overview", icon: IconChartBar },
    { id: "flight-history", label: "Flight History", icon: IconHistory },
    { id: "observations", label: "Observations", icon: IconAlertTriangle },
    { id: "maintenance-items", label: "Maintenance Items", icon: IconTool },
    { id: "maintenance-history", label: "Maintenance History", icon: IconHistory },
    { id: "settings", label: "Settings", icon: IconSettings },
  ]

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading aircraft...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (isError || !aircraftData) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load aircraft"}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const { aircraft, flights, observations, components } = aircraftData
  const registration = aircraft.registration || ""
  const model = aircraft.model || ""
  const type = aircraft.type || ""
  const imageUrl = aircraft.aircraft_image_url
  const status = aircraft.status || "active"
  const isActive = status.toLowerCase() === "active"
  const totalHours = aircraft.total_hours || 0

  // Calculate statistics
  const activeObservations = observations.filter((o) => !o.resolved_at).length
  const overdueComponents = components.filter((c) => {
    if (!c.current_due_date && !c.current_due_hours) return false
    if (c.current_due_date) {
      return new Date(c.current_due_date) < new Date()
    }
    if (c.current_due_hours && aircraft.total_hours) {
      return aircraft.total_hours >= c.current_due_hours
    }
    return false
  }).length

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
          <div className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
            {/* Back Link */}
            <Link
              href="/aircraft"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <IconArrowLeft className="h-4 w-4" />
              Back to Aircraft
            </Link>

            {/* Aircraft Summary Card */}
            <Card className="mb-6 shadow-sm border border-border/50 bg-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 sm:gap-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-20 w-20 rounded-full bg-gray-100 border-2 border-gray-200">
                      {imageUrl ? (
                        <AvatarImage src={imageUrl} alt={registration} />
                      ) : null}
                      <AvatarFallback className="bg-gray-100 text-gray-600 text-xl font-bold">
                        {registration.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900">{registration}</h1>
                        <Badge
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            isActive 
                              ? "bg-green-100 text-green-700 border-0" 
                              : "bg-red-100 text-red-700 border-0"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                        {model && <span className="font-medium">{model}</span>}
                        {type && <span>{type}</span>}
                        {aircraft.aircraft_type?.name && (
                          <span>{aircraft.aircraft_type.name}</span>
                        )}
                        <span>Total Hours: {formatTotalHours(totalHours)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabbed Content */}
            <Card className="shadow-sm border border-border/50 bg-card">
              <CardContent className="p-0">
                <Tabs.Root
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full flex flex-col"
                >
                  {/* Tab Header */}
                  <div className="w-full border-b border-gray-200 bg-white relative">
                    {/* Mobile: Simple Tab Switcher */}
                    <div className="md:hidden px-4 pt-3 pb-3">
                      <Select value={activeTab} onValueChange={setActiveTab}>
                        <SelectTrigger className="w-full h-11 border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                          <SelectValue>
                            {(() => {
                              const activeTabItem = tabItems.find(t => t.id === activeTab)
                              const Icon = activeTabItem?.icon || IconChartBar
                              return (
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-indigo-600" />
                                  <span className="font-medium">{activeTabItem?.label || "Select tab"}</span>
                                </div>
                              )
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {tabItems.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                              <SelectItem 
                                key={tab.id} 
                                value={tab.id}
                                className={isActive ? "bg-indigo-50" : ""}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-gray-500"}`} />
                                  <span className={isActive ? "font-semibold text-indigo-900" : ""}>
                                    {tab.label}
                                  </span>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Desktop: Horizontal scrollable tabs */}
                    <div className="hidden md:flex items-center px-6 pt-2 relative">
                      {showScrollLeft && (
                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                      )}
                      {showScrollRight && (
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                      )}
                      <div className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
                        <Tabs.List
                          ref={tabsListRef}
                          className="flex flex-row gap-1 min-h-[48px] relative min-w-max"
                          aria-label="Aircraft tabs"
                        >
                          <div
                            className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                            style={{
                              left: `${underlineStyle.left}px`,
                              width: `${underlineStyle.width}px`,
                            }}
                          />
                          {tabItems.map((tab) => {
                            const Icon = tab.icon
                            return (
                              <Tabs.Trigger
                                key={tab.id}
                                ref={(el) => { tabRefs.current[tab.id] = el }}
                                value={tab.id}
                                className="inline-flex items-center gap-2 px-4 py-3 pb-1 text-base font-medium border-b-2 border-transparent transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer data-[state=active]:text-indigo-800 data-[state=inactive]:text-gray-500 hover:text-indigo-600 whitespace-nowrap flex-shrink-0 min-h-[48px] min-w-[44px] touch-manipulation active:bg-gray-50"
                                style={{ background: "none", boxShadow: "none", borderRadius: 0 }}
                                aria-label={`${tab.label} tab`}
                                role="tab"
                                aria-selected={activeTab === tab.id}
                              >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span>{tab.label}</span>
                              </Tabs.Trigger>
                            )
                          })}
                        </Tabs.List>
                      </div>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="w-full p-4 sm:p-6">
                    <Tabs.Content value="overview">
                      <AircraftOverviewTab 
                        aircraft={aircraft} 
                        flights={flights}
                        observations={observations}
                        components={components}
                        activeObservations={activeObservations}
                        overdueComponents={overdueComponents}
                      />
                    </Tabs.Content>

                    <Tabs.Content value="flight-history">
                      <AircraftFlightHistoryTab flights={flights} />
                    </Tabs.Content>

                    <Tabs.Content value="observations">
                      <AircraftObservationsTab aircraftId={aircraftId} />
                    </Tabs.Content>

                    <Tabs.Content value="maintenance-items">
                      <AircraftMaintenanceItemsTab components={components || []} aircraft={aircraft} />
                    </Tabs.Content>

                    <Tabs.Content value="maintenance-history">
                      <AircraftMaintenanceHistoryTab aircraftId={aircraftId} />
                    </Tabs.Content>

                    <Tabs.Content value="settings">
                      <AircraftSettingsTab aircraft={aircraft} />
                    </Tabs.Content>
                  </div>
                </Tabs.Root>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
