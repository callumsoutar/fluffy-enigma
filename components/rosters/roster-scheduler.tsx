"use client"

import * as React from "react"
import { format } from "date-fns"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  buildTimeSlots,
  formatTimeLabel,
  getBookingLayout,
  withTime,
} from "@/components/scheduler/scheduler-utils"
import { parseTimeToMinutes } from "@/lib/roster/availability"
import { RosterShiftModal } from "@/components/rosters/roster-shift-modal"
import type { InstructorWithUser } from "@/lib/types/instructors"
import type { RosterRule } from "@/lib/types/roster"
import { useSettingsManager } from "@/hooks/use-settings"
import type { TimelineConfig } from "@/components/scheduler/scheduler-utils"
import { dayOfWeekFromYyyyMmDd } from "@/lib/utils/timezone"

const ROW_HEIGHT = 44
const LEFT_COL_WIDTH = "w-[160px] sm:w-[220px]"

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDaysToDate(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function parseTimeForDate(baseDate: Date, time: string) {
  const [hours, minutes] = time.split(":").map((value) => Number(value))
  return withTime(baseDate, hours, minutes)
}

async function fetchInstructors() {
  const res = await fetch("/api/instructors")
  if (!res.ok) {
    throw new Error("Failed to load instructors")
  }

  const data = await res.json()
  return (data.instructors as InstructorWithUser[]).map((instructor) => instructor)
}

async function fetchRosterRulesForDay(dayOfWeek: number) {
  const params = new URLSearchParams()
  params.set("day_of_week", String(dayOfWeek))

  const res = await fetch(`/api/roster-rules?${params.toString()}`)
  if (!res.ok) {
    throw new Error("Failed to load roster rules")
  }

  const data = await res.json()
  return data.roster_rules as RosterRule[]
}

interface DraftSlot {
  instructorId: string
  startTime: string
  endTime: string
  date: string
  dayOfWeek: number
  isRecurring?: boolean
}

export function RosterScheduler() {
  const queryClient = useQueryClient()

  const [selectedDate, setSelectedDate] = React.useState(() => startOfDay(new Date()))
  const [draftSlot, setDraftSlot] = React.useState<DraftSlot | null>(null)
  const [editingRule, setEditingRule] = React.useState<RosterRule | null>(null)

  // Fetch business hours settings
  const { getSettingValue, settings } = useSettingsManager("general")

  // Parse business hours and create timeline config
  const TIMELINE_CONFIG: TimelineConfig = React.useMemo(() => {
    const openTime = getSettingValue<string>("business_open_time", "09:00:00")
    const closeTime = getSettingValue<string>("business_close_time", "17:00:00")
    const is24Hours = getSettingValue<boolean>("business_is_24_hours", false)
    const isClosed = getSettingValue<boolean>("business_is_closed", false)

    // If closed, show a minimal range (still show something)
    if (isClosed) {
      return {
        startHour: 0,
        endHour: 24,
        intervalMinutes: 30,
      }
    }

    // If 24/7, show full day
    if (is24Hours) {
      return {
        startHour: 0,
        endHour: 24,
        intervalMinutes: 30,
      }
    }

    // Regular hours: parse time strings to get hours
    const openMinutes = parseTimeToMinutes(openTime)
    const closeMinutes = parseTimeToMinutes(closeTime)

    // Default fallback if parsing fails
    if (openMinutes === null || closeMinutes === null) {
      return {
        startHour: 6,
        endHour: 22,
        intervalMinutes: 30,
      }
    }

    const startHour = Math.floor(openMinutes / 60)
    const endHour = Math.ceil(closeMinutes / 60)

    return {
      startHour,
      endHour,
      intervalMinutes: 30,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const { slots, start: timelineStart, end: timelineEnd } = React.useMemo(
    () => buildTimeSlots(selectedDate, TIMELINE_CONFIG),
    [selectedDate, TIMELINE_CONFIG]
  )

  const slotCount = slots.length
  // Prevent cramped time labels by enforcing a minimum per-slot width and allowing horizontal scroll.
  // Layout only (no roster/time math changes).
  const slotMinWidthPx = React.useMemo(() => {
    // Reduced ~25% vs previous values to match smaller header label typography.
    if (TIMELINE_CONFIG.intervalMinutes >= 30) return 42
    if (TIMELINE_CONFIG.intervalMinutes >= 20) return 36
    if (TIMELINE_CONFIG.intervalMinutes >= 15) return 33
    return 30
  }, [TIMELINE_CONFIG.intervalMinutes])
  const timelineMinWidth = slotCount > 0 ? slotCount * slotMinWidthPx : undefined

  const dayKey = format(selectedDate, "yyyy-MM-dd")
  const dayOfWeek = React.useMemo(() => dayOfWeekFromYyyyMmDd(dayKey), [dayKey])
  const rosterQueryKey = React.useMemo(() => ["roster-rules", dayKey], [dayKey])

  const {
    data: instructors = [],
    isLoading: instructorsLoading,
    isError: instructorsError,
  } = useQuery({
    queryKey: ["roster", "instructors"],
    queryFn: () => fetchInstructors(),
    staleTime: 60_000,
  })

  const {
    data: rosterRules = [],
    isLoading: rosterLoading,
    isError: rosterError,
  } = useQuery({
    queryKey: rosterQueryKey,
    queryFn: () => fetchRosterRulesForDay(dayOfWeek),
    enabled: instructors.length > 0,
    staleTime: 30_000,
  })

  const instructorOptions = React.useMemo(
    () =>
      instructors
        .map((instructor) => {
          const firstName = instructor.user.first_name?.trim() || ""
          const lastName = instructor.user.last_name?.trim() || ""
          const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
          return {
            id: instructor.id,
            name: fullName || instructor.user.email || "Instructor",
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [instructors]
  )

  const dayLabel = format(selectedDate, "EEEE, dd MMM yyyy")

  const visibleShifts = React.useMemo(() => {
    return rosterRules.filter((rule) => {
      if (!rule.is_active || rule.voided_at) {
        return false
      }

      if (rule.day_of_week !== dayOfWeek) {
        return false
      }

      // Roster effective_from/effective_until are DATE-ONLY fields (school-local calendar dates).
      // Never parse these via `new Date(...)` (it introduces implicit timezone shifts).
      if (rule.effective_from && rule.effective_from > dayKey) return false
      if (rule.effective_until && rule.effective_until < dayKey) return false

      return true
    })
  }, [rosterRules, dayKey, dayOfWeek])

  const shiftsByInstructor = React.useMemo(() => {
    const map: Record<string, RosterRule[]> = {}

    visibleShifts.forEach((rule) => {
      if (!map[rule.instructor_id]) {
        map[rule.instructor_id] = []
      }
      map[rule.instructor_id].push(rule)
    })

    return map
  }, [visibleShifts])

  const handleDateChange = React.useCallback(
    (deltaDays: number) => {
      setSelectedDate((prev) => addDaysToDate(prev, deltaDays))
      setDraftSlot(null)
      setEditingRule(null)
    },
    []
  )

  const goToToday = React.useCallback(() => {
    setSelectedDate(startOfDay(new Date()))
    setDraftSlot(null)
    setEditingRule(null)
  }, [])

  const openDraft = React.useCallback(
    (slot: DraftSlot) => {
      setDraftSlot(slot)
      setEditingRule(null)
    },
    []
  )

  const handleShiftClick = React.useCallback((rule: RosterRule, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setEditingRule(rule)
    setDraftSlot(null)
  }, [])

  const handleRowClick = React.useCallback(
    (instructorId: string, clientX: number, containerWidth: number, containerLeft: number) => {
      const relativeX = Math.max(0, Math.min(clientX - containerLeft, containerWidth))
      const index = Math.floor((relativeX / containerWidth) * slotCount)
      const selectedSlotTime = slots[Math.min(index, slotCount - 1)] ?? timelineStart
      const endTimeCandidate = new Date(selectedSlotTime.getTime() + TIMELINE_CONFIG.intervalMinutes * 60_000)
      const endTime = endTimeCandidate > timelineEnd ? timelineEnd : endTimeCandidate

      openDraft({
        instructorId,
        startTime: formatTimeLabel(selectedSlotTime),
        endTime: formatTimeLabel(endTime),
        date: dayKey,
        dayOfWeek,
        isRecurring: true,
      })
    },
    [dayKey, dayOfWeek, openDraft, slotCount, slots, timelineEnd, timelineStart, TIMELINE_CONFIG.intervalMinutes]
  )

  const handleModalClose = React.useCallback(() => {
    setDraftSlot(null)
    setEditingRule(null)
  }, [])

  const refreshRosters = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: rosterQueryKey })
  }, [queryClient, rosterQueryKey])

  const quickCreate = () => {
    if (!instructorOptions.length) {
      toast.error("Add an instructor before creating a roster entry.")
      return
    }

    openDraft({
      instructorId: instructorOptions[0].id,
      startTime: "09:00",
      endTime: "17:00",
      date: dayKey,
      dayOfWeek: selectedDate.getDay(),
      isRecurring: true,
    })
  }

  const renderRows = () => {
    if (instructorsLoading) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading instructors...</div>
      )
    }

    if (instructorsError) {
      return (
        <div className="py-8 text-center text-sm text-destructive">
          Unable to load instructors. Check your permissions.
        </div>
      )
    }

    if (!instructorOptions.length) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No instructors found. Add staff from the{" "}
          <span className="font-semibold text-primary">Staff</span> section before rostering.
        </div>
      )
    }

    return (
      <div className="border-t border-border/60">
        {instructorOptions.map((instructor) => (
          <RosterTimelineRow
            key={instructor.id}
            instructorId={instructor.id}
            instructorName={instructor.name}
            slots={slots}
            slotCount={slotCount}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            rowHeight={ROW_HEIGHT}
            shifts={shiftsByInstructor[instructor.id] ?? []}
            onEmptySlotClick={(clientX, container) =>
              handleRowClick(instructor.id, clientX, container.clientWidth, container.getBoundingClientRect().left)
            }
            onShiftClick={handleShiftClick}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleDateChange(-1)} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 justify-start gap-2 px-3 font-semibold">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{dayLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => handleDateChange(1)} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={goToToday} className="hidden sm:inline-flex">
            Today
          </Button>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Button
            className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800"
            onClick={quickCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            New roster entry
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex">
          {/* Left column */}
          <div className={cn("shrink-0 border-r border-border/60 bg-muted/10", LEFT_COL_WIDTH)}>
            <div className="sticky top-0 z-30 flex h-10 items-center border-b border-border/60 bg-card/90 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Instructors
            </div>
            {instructorOptions.map((instructor) => (
              <div
                key={instructor.id}
                className="flex items-center border-b border-border/60 px-3 text-sm font-semibold text-foreground last:border-b-0"
                style={{ height: ROW_HEIGHT }}
              >
                {instructor.name}
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div style={timelineMinWidth ? { minWidth: timelineMinWidth } : undefined}>
              <div className="sticky top-0 z-20 h-10 border-b border-border/60 bg-card/90 backdrop-blur">
                <div
                  className="grid h-full"
                  style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
                >
                  {slots.map((slot) => (
                    <div
                      key={slot.getTime()}
                      className="flex items-center justify-center border-r last:border-r-0 px-0.5 text-[8px] text-muted-foreground sm:text-[9px]"
                    >
                      <span className="select-none whitespace-nowrap font-medium tabular-nums">
                        {formatTimeLabel(slot)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {renderRows()}
            </div>
          </div>
        </div>

        {!rosterLoading && visibleShifts.length === 0 && instructorOptions.length > 0 && (
          <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            No roster entries for {format(selectedDate, "EEEE, MMM d")}. Click a slot to add one.
          </div>
        )}
        {rosterLoading && (
          <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            Loading roster data...
          </div>
        )}
        {(rosterError || instructorsError) && (
          <div className="border-t border-border/60 px-4 py-3 text-xs text-destructive">
            Unable to load roster data at this time.
          </div>
        )}
      </div>

      {draftSlot && (
        <RosterShiftModal
          open
          mode="create"
          instructors={instructorOptions}
          initialValues={{
            instructor_id: draftSlot.instructorId,
            day_of_week: draftSlot.dayOfWeek,
            start_time: draftSlot.startTime,
            end_time: draftSlot.endTime,
            is_recurring: draftSlot.isRecurring ?? false,
            effective_from: draftSlot.date,
            effective_until: draftSlot.date,
            notes: null,
          }}
          onClose={handleModalClose}
          onSaved={refreshRosters}
        />
      )}

      {editingRule && (
        <RosterShiftModal
          open
          mode="edit"
          ruleId={editingRule.id}
          instructors={instructorOptions}
          initialValues={{
            instructor_id: editingRule.instructor_id,
            day_of_week: editingRule.day_of_week,
            start_time: editingRule.start_time.substring(0, 5),
            end_time: editingRule.end_time.substring(0, 5),
            is_recurring: Boolean(!editingRule.effective_until || editingRule.effective_until !== editingRule.effective_from),
            effective_from: editingRule.effective_from,
            effective_until: editingRule.effective_until ?? "",
            notes: editingRule.notes,
          }}
          onClose={handleModalClose}
          onSaved={refreshRosters}
        />
      )}
    </div>
  )
}

function RosterTimelineRow({
  instructorId,
  instructorName,
  slots,
  slotCount,
  timelineStart,
  timelineEnd,
  rowHeight,
  shifts,
  onEmptySlotClick,
  onShiftClick,
}: {
  instructorId: string
  instructorName: string
  slots: Date[]
  slotCount: number
  timelineStart: Date
  timelineEnd: Date
  rowHeight: number
  shifts: RosterRule[]
  onEmptySlotClick: (clientX: number, container: HTMLDivElement) => void
  onShiftClick: (rule: RosterRule, event: React.MouseEvent) => void
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    onEmptySlotClick(event.clientX, containerRef.current)
  }

  const shiftElements = shifts.map((shift) => {
    const shiftStart = parseTimeForDate(timelineStart, shift.start_time)
    const shiftEnd = parseTimeForDate(timelineStart, shift.end_time)
    const layout = getBookingLayout({
      bookingStart: shiftStart,
      bookingEnd: shiftEnd,
      timelineStart,
      timelineEnd,
    })
    if (!layout) return null

    const isRecurring = !shift.effective_until || shift.effective_until !== shift.effective_from
    const background = isRecurring ? "from-emerald-600 to-emerald-500" : "from-sky-600 to-sky-500"

    return (
      <div
        key={shift.id}
        className="absolute inset-y-0 pointer-events-auto"
        style={{
          left: `${layout.leftPct}%`,
          width: `max(${layout.widthPct}%, 4%)`,
        }}
      >
        <button
          type="button"
          onClick={(event) => onShiftClick(shift, event)}
          className={cn(
            "h-full w-full rounded-md px-2 text-left text-xs font-semibold leading-tight text-white transition-shadow duration-200",
            "shadow-sm border border-white/30",
            `bg-gradient-to-r ${background}`
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{isRecurring ? "Recurring shift" : "One-off shift"}</span>
            <span className="text-[10px] opacity-80">
              {shift.start_time}–{shift.end_time}
            </span>
          </div>
          {shift.notes && (
            <p className="text-[10px] text-white/90 line-clamp-2 mt-1">{shift.notes}</p>
          )}
        </button>
      </div>
    )
  })

  return (
    <div className="relative border-b border-border/60 last:border-b-0" style={{ height: rowHeight }}>
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-pointer"
        onClick={handleClick}
        aria-label={`Timeline row for ${instructorName}`}
      >
        <div
          className="grid h-full"
          style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
        >
          {slots.map((slot, idx) => (
            <div
              key={`${instructorId}-${slot.toISOString()}`}
              className={cn(
                "border-r border-border/60 last:border-r-0",
                idx % 2 === 1 ? "bg-muted/[0.02]" : "",
                slot.getMinutes() === 0 ? "bg-muted/[0.04]" : ""
              )}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">{shiftElements}</div>
    </div>
  )
}

