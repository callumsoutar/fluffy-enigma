"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  IconPlane,
  IconAlertTriangle,
  IconTool,
  IconClock,
  IconTrendingUp,
} from "@tabler/icons-react"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { ObservationWithUser } from "@/lib/types/observations"
import type { AircraftComponent } from "@/lib/types/aircraft_components"

interface FlightLog {
  id: string
  booking_id: string | null
  flight_time: number | null
  created_at: string
  booking?: {
    student?: {
      first_name: string | null
      last_name: string | null
      email: string
    }
  }
}

interface OverviewTabProps {
  aircraft: AircraftWithType
  flightLogs: FlightLog[]
  observations: ObservationWithUser[]
  components: AircraftComponent[]
  activeObservations: number
  overdueComponents: number
}

function formatTotalHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) {
    return "0.0h"
  }
  return `${hours.toFixed(1)}h`
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

export function AircraftOverviewTab({
  aircraft,
  flightLogs,
  observations,
  activeObservations,
  overdueComponents,
}: OverviewTabProps) {
  const totalHours = aircraft.total_hours || 0
  const currentHobbs = aircraft.current_hobbs || 0
  const currentTach = aircraft.current_tach || 0
  const recentFlights = flightLogs.slice(0, 5)
  const recentObservations = observations.filter((o) => !o.resolved_at).slice(0, 3)

  // Calculate hours since last flight
  const lastFlight = flightLogs[0]
  const hoursSinceLastFlight = lastFlight?.created_at
    ? Math.round((new Date().getTime() - new Date(lastFlight.created_at).getTime()) / (1000 * 60 * 60))
    : null

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-semibold tracking-tight">{formatTotalHours(totalHours)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                <IconPlane className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Flight Logs</p>
                <p className="text-2xl font-semibold tracking-tight">{flightLogs.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                <IconClock className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Active Observations</p>
                <p className={`text-2xl font-semibold tracking-tight ${activeObservations > 0 ? "text-orange-600" : ""}`}>
                  {activeObservations}
                </p>
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${activeObservations > 0 ? "bg-orange-50" : "bg-muted/50"}`}>
                <IconAlertTriangle className={`h-5 w-5 ${activeObservations > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Overdue Components</p>
                <p className={`text-2xl font-semibold tracking-tight ${overdueComponents > 0 ? "text-red-600" : ""}`}>
                  {overdueComponents}
                </p>
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${overdueComponents > 0 ? "bg-red-50" : "bg-muted/50"}`}>
                <IconTool className={`h-5 w-5 ${overdueComponents > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aircraft Details */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <IconPlane className="h-4 w-4 text-muted-foreground" />
              </div>
              Aircraft Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Registration</p>
                <p className="text-sm font-semibold">{aircraft.registration}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
                <p className="text-sm font-semibold">{aircraft.type}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</p>
                <p className="text-sm font-semibold">{aircraft.model || "—"}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                <Badge 
                  variant={aircraft.status === "active" ? "default" : "secondary"} 
                  className={`${
                    aircraft.status === "active" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                      : "bg-muted text-muted-foreground"
                  } font-medium`}
                >
                  {aircraft.status || "Unknown"}
                </Badge>
              </div>
              {aircraft.year_manufactured && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Year Manufactured</p>
                  <p className="text-sm font-semibold">{aircraft.year_manufactured}</p>
                </div>
              )}
              {aircraft.manufacturer && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Manufacturer</p>
                  <p className="text-sm font-semibold">{aircraft.manufacturer}</p>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Hobbs</p>
                <p className="text-sm font-semibold">{formatTotalHours(currentHobbs)}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Tach</p>
                <p className="text-sm font-semibold">{formatTotalHours(currentTach)}</p>
              </div>
            </div>

            {hoursSinceLastFlight !== null && (
              <>
                <Separator className="my-4" />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hours Since Last Flight</p>
                  <p className="text-sm font-semibold">{hoursSinceLastFlight}h</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentFlights.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Recent Flights</p>
                {recentFlights.map((flight, index) => (
                  <React.Fragment key={flight.id}>
                    <div className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                          <IconPlane className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {flight.booking?.student
                              ? `${flight.booking.student.first_name || ""} ${flight.booking.student.last_name || ""}`.trim() || flight.booking.student.email
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {flight.created_at ? formatDate(flight.created_at) : "—"}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {formatTotalHours(flight.flight_time)}
                      </p>
                    </div>
                    {index < recentFlights.length - 1 && <Separator className="my-1" />}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">No recent flights</div>
            )}

            {recentObservations.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Recent Observations</p>
                  {recentObservations.map((obs, index) => (
                    <React.Fragment key={obs.id}>
                      <div className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="h-8 w-8 rounded-md bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <IconAlertTriangle className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{obs.name}</p>
                          {obs.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{obs.description}</p>
                          )}
                          <Badge variant="outline" className="mt-2 text-xs border-orange-200 text-orange-700 bg-orange-50">
                            {obs.priority || "Normal"}
                          </Badge>
                        </div>
                      </div>
                      {index < recentObservations.length - 1 && <Separator className="my-1" />}
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
