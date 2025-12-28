"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns"
import { Loader2 } from "lucide-react"
import { IconCalendar, IconChartBar, IconClock, IconPlane, IconSchool, IconChevronDown } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { MemberFlightHistoryEntry, MemberFlightHistoryResponse } from "@/lib/types/flight-history"

export type MemberFlightHistoryTabProps = {
  memberId: string
}

async function fetchMemberFlightHistory(memberId: string): Promise<MemberFlightHistoryResponse> {
  const res = await fetch(`/api/members/${memberId}/flight-history`)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || "Failed to load flight history")
  }
  return payload as MemberFlightHistoryResponse
}

function getInstructorName(flight: MemberFlightHistoryEntry): string {
  const first = flight.instructor?.first_name ?? ""
  const last = flight.instructor?.last_name ?? ""
  const full = [first, last].filter(Boolean).join(" ").trim()
  return full || "Instructor"
}

function getFlightHours(flight: MemberFlightHistoryEntry): number {
  const flightTime = flight.flight_time
  if (flightTime == null) return 0
  const hours = typeof flightTime === "string" ? Number(flightTime) : flightTime
  return Number.isFinite(hours) ? hours : 0
}

function getFlightHoursDisplay(flight: MemberFlightHistoryEntry): string {
  const flightTime = flight.flight_time
  if (flightTime == null) return "-"
  const hoursStr = String(flightTime)
  return hoursStr.includes(".") ? hoursStr : `${hoursStr}.0`
}

export function MemberFlightHistoryTab({ memberId }: MemberFlightHistoryTabProps) {
  const historyQuery = useQuery({
    queryKey: ["member-flight-history", memberId],
    queryFn: () => fetchMemberFlightHistory(memberId),
    enabled: !!memberId,
    refetchOnWindowFocus: true,
  })

  const allFlights = historyQuery.data?.flights ?? []

  // Date range state - default to last 30 days
  const [dateFrom, setDateFrom] = React.useState<Date>(startOfDay(subDays(new Date(), 30)))
  const [dateTo, setDateTo] = React.useState<Date>(endOfDay(new Date()))

  const handlePresetClick = (days: number) => {
    setDateFrom(startOfDay(subDays(new Date(), days)))
    setDateTo(endOfDay(new Date()))
  }

  const flights = allFlights.filter((flight) => {
    // primary date for filtering: scheduled end_time
    const dateToCheck = flight.end_time
    if (!dateToCheck) return false
    const flightDate = new Date(dateToCheck)
    return isWithinInterval(flightDate, { start: dateFrom, end: dateTo })
  })

  const totalFlightHours = flights.reduce((total, f) => total + getFlightHours(f), 0)
  const avgHoursPerFlight = flights.length ? totalFlightHours / flights.length : 0

  if (historyQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading flight history...
        </div>
      </div>
    )
  }

  if (historyQuery.isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">
          {historyQuery.error instanceof Error ? historyQuery.error.message : "Failed to load flight history"}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Flight History</h3>

        {/* Date Range Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Quick shortcuts */}
          <div className="flex gap-2">
            <Button
              variant={dateFrom && dateTo && (new Date().getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24) <= 31 && (new Date().getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24) >= 29 ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetClick(30)}
              className="flex-1 sm:flex-none"
            >
              30 days
            </Button>
            <Button
              variant={dateFrom && dateTo && (new Date().getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24) <= 91 && (new Date().getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24) >= 89 ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetClick(90)}
              className="flex-1 sm:flex-none"
            >
              90 days
            </Button>
          </div>

          {/* Date pickers */}
          <div className="flex gap-2 items-center flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("flex-1 sm:flex-none sm:w-[150px] justify-start text-left font-normal text-sm", !dateFrom && "text-muted-foreground")}
                >
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(date) => date && setDateFrom(startOfDay(date))}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground text-sm">to</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("flex-1 sm:flex-none sm:w-[150px] justify-start text-left font-normal text-sm", !dateTo && "text-muted-foreground")}
                >
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "MMM dd, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(date) => date && setDateTo(endOfDay(date))}
                  disabled={(date) => date > new Date() || date < dateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-col md:flex-row items-stretch gap-4 bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconPlane className="w-6 h-6 mb-1 text-indigo-600" />
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total Flights</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{flights.length}</div>
        </div>
        <div className="hidden md:block w-px bg-slate-300 mx-2" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconClock className="w-6 h-6 mb-1 text-blue-600" />
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total Hours</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{totalFlightHours.toFixed(1)}h</div>
        </div>
        <div className="hidden md:block w-px bg-slate-300 mx-2" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconChartBar className="w-6 h-6 mb-1 text-emerald-600" />
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Avg Hours / Flight</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{avgHoursPerFlight.toFixed(1)}h</div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Date
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Aircraft
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Instructor
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Description
              </th>
              <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-slate-600">
                Flight Time
              </th>
              <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {flights.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-24 text-center text-slate-500 font-medium">
                  No completed flights found in this date range.
                </td>
              </tr>
            ) : (
              flights.map((flight) => {
                const flightDate = flight.end_time
                const aircraftLabel =
                  flight.aircraft?.registration || (flight.aircraft?.id ? `Aircraft ${flight.aircraft.id.slice(0, 8)}` : "Aircraft")
                const description = flight.lesson?.name || flight.flight_type?.name || flight.purpose || "Flight"
                const isSolo = !flight.instructor

                return (
                  <tr key={flight.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-semibold text-slate-900">
                        {flightDate ? format(new Date(flightDate), "dd MMM yyyy") : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <IconPlane className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-slate-900">{aircraftLabel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {isSolo ? (
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-medium px-2 py-0.5">
                          Solo
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <IconSchool className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-700">{getInstructorName(flight)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle max-w-[250px]">
                      <span className="text-slate-600 text-sm truncate block" title={description}>
                        {description}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-right">
                      <span className="font-mono font-semibold text-slate-900">{getFlightHoursDisplay(flight)}h</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (window.location.href = `/bookings/${flight.id}`)}
                        className="h-8 px-3 text-xs font-medium"
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {flights.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200">
            <div className="text-slate-500 font-medium mb-4">No completed flights found</div>
            <Button onClick={() => (window.location.href = "/bookings")} variant="outline" size="sm">
              <IconCalendar className="w-4 h-4 mr-2" />
              Schedule Flight
            </Button>
          </div>
        ) : (
          flights.map((flight) => {
            const flightDate = flight.end_time
            const aircraftLabel =
              flight.aircraft?.registration || (flight.aircraft?.id ? `Aircraft ${flight.aircraft.id.slice(0, 8)}` : "Aircraft")
            const description = flight.lesson?.name || flight.flight_type?.name || flight.purpose || "Flight"
            const isSolo = !flight.instructor

            return (
              <div
                key={flight.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => (window.location.href = `/bookings/${flight.id}`)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-l-lg" />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <IconPlane className="w-4 h-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900">{aircraftLabel}</h3>
                    </div>
                    <span className="text-xs text-slate-600">{description}</span>
                  </div>
                  {isSolo && (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-medium px-2 py-0.5">
                      Solo
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconCalendar className="w-3 h-3" /> Date
                    </div>
                    <div className="font-semibold text-sm text-slate-900">
                      {flightDate ? format(new Date(flightDate), "dd MMM yyyy") : "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconClock className="w-3 h-3" /> Flight Time
                    </div>
                    <div className="font-mono font-semibold text-sm text-slate-900">
                      {getFlightHoursDisplay(flight)}h
                    </div>
                  </div>
                  {!isSolo && (
                    <div className="space-y-1 col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                        <IconSchool className="w-3 h-3" /> Instructor
                      </div>
                      <div className="font-semibold text-sm text-slate-700">
                        {getInstructorName(flight)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute right-4 bottom-4">
                  <IconChevronDown className="w-4 h-4 text-slate-400 transform -rotate-90" />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}


