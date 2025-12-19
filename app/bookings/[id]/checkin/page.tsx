"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconArrowLeft,
  IconClock,
  IconPlane,
  IconSchool,
  IconFileText,
  IconDeviceFloppy,
  IconRotateClockwise,
} from "@tabler/icons-react"
import { toast } from "sonner"
import Link from "next/link"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BookingWithRelations } from "@/lib/types/bookings"
import { bookingUpdateSchema } from "@/lib/validation/bookings"
import { z } from "zod"

type FlightLogCheckinFormData = z.infer<typeof bookingUpdateSchema>
import { useAuth } from "@/contexts/auth-context"
import { useIsMobile } from "@/hooks/use-mobile"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = "Request failed"
    try {
      const data = await res.json()
      if (typeof data?.error === "string") message = data.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

interface BookingOptions {
  aircraft: Array<{ id: string; registration: string; type: string; model: string | null; manufacturer: string | null }>
  members: Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>
  instructors: Array<{ id: string; first_name: string | null; last_name: string | null; user: { id: string; email: string } | null }>
  flightTypes: Array<{ id: string; name: string }>
  lessons: Array<{ id: string; name: string; description: string | null }>
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "Request failed"
}

// Calculate flight hours from meter readings
function calculateFlightHours(start: number | null | undefined, end: number | null | undefined): number {
  if (!start || !end || end < start) return 0
  return parseFloat((end - start).toFixed(1))
}

export default function BookingCheckinPage() {
  const params = useParams()
  const { role } = useAuth()
  const bookingId = params.id as string
  const isMobile = useIsMobile()

  const queryClient = useQueryClient()
  
  // Track sidebar state for banner positioning - must be called before any conditional returns
  const [sidebarLeft, setSidebarLeft] = React.useState(0)
  
  React.useEffect(() => {
    if (isMobile) {
      setSidebarLeft(0)
      return
    }

    const updateSidebarPosition = () => {
      // Find the sidebar gap element which shows the actual sidebar width
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]')
      if (sidebarGap) {
        const computedWidth = window.getComputedStyle(sidebarGap).width
        const width = parseFloat(computedWidth) || 0
        setSidebarLeft(width)
        return
      }

      // Fallback: Check sidebar state from data attributes
      const sidebar = document.querySelector('[data-slot="sidebar"]')
      if (!sidebar) {
        setSidebarLeft(0)
        return
      }

      const state = sidebar.getAttribute('data-state')
      const collapsible = sidebar.getAttribute('data-collapsible')
      
      // Calculate left offset based on sidebar state
      if (state === 'collapsed') {
        if (collapsible === 'icon') {
          // Icon mode: use icon width (3rem = 48px)
          setSidebarLeft(48)
        } else {
          // Offcanvas mode: sidebar is hidden
          setSidebarLeft(0)
        }
      } else {
        // Expanded: get actual width from CSS variable or computed style
        const sidebarContainer = sidebar.querySelector('[data-slot="sidebar-container"]')
        if (sidebarContainer) {
          const computedWidth = window.getComputedStyle(sidebarContainer).width
          const width = parseFloat(computedWidth) || 256
          setSidebarLeft(width)
        } else {
          setSidebarLeft(256) // Fallback
        }
      }
    }

    // Initial check with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateSidebarPosition, 100)

    // Watch for changes using MutationObserver
    const observer = new MutationObserver(updateSidebarPosition)
    const sidebarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]')
    if (sidebarWrapper) {
      observer.observe(sidebarWrapper, {
        attributes: true,
        attributeFilter: ['data-state', 'data-collapsible'],
        subtree: true,
        childList: true,
        attributeOldValue: false
      })
    }

    // Also listen for resize in case sidebar width changes
    window.addEventListener('resize', updateSidebarPosition)
    // Listen for transition end in case sidebar is animating
    window.addEventListener('transitionend', updateSidebarPosition)

    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
      window.removeEventListener('resize', updateSidebarPosition)
      window.removeEventListener('transitionend', updateSidebarPosition)
    }
  }, [isMobile])

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<FlightLogCheckinFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(bookingUpdateSchema) as any,
    mode: 'onChange',
    defaultValues: {},
  })

  // Local state
  const [isInitialized, setIsInitialized] = React.useState(false)
  
  // Use a ref to track if we're currently initializing
  const isInitializingRef = React.useRef(false)

  // Track form dirty state - only show changes after initialization is complete
  const [hasChanges, setHasChanges] = React.useState(false)
  
  React.useEffect(() => {
    // Don't show banner during initialization
    if (isInitializingRef.current || !isInitialized) {
      setHasChanges(false)
      return
    }
    
    // Only show banner if form is actually dirty
    setHasChanges(isDirty)
  }, [isDirty, isInitialized])

  // Fetch booking
  const bookingQuery = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!bookingId,
    queryFn: () => fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`),
    staleTime: 30_000,
  })

  // Extract booking data (now contains all flight log fields)
  const booking = bookingQuery.data?.booking ?? null

  // Get lesson_id from booking for options query
  const selectedLessonId = booking?.lesson_id

  const optionsQuery = useQuery({
    queryKey: ["bookingOptions", selectedLessonId],
    queryFn: () => {
      const url = selectedLessonId 
        ? `/api/bookings/options?lesson_id=${selectedLessonId}`
        : `/api/bookings/options`
      return fetchJson<BookingOptions>(url)
    },
    staleTime: 15 * 60_000,
  })

  const options = optionsQuery.data ?? null

  // Helper function to normalize date strings to a format Zod accepts
  const normalizeDateString = (value: string | null | undefined): string | null => {
    if (!value || value === "" || typeof value !== "string") return null
    let trimmed = value.trim()
    if (trimmed === "") return null
    
    // Normalize +00:00 or +00 to Z (UTC)
    if (trimmed.endsWith('+00:00') || trimmed.endsWith('-00:00')) {
      trimmed = trimmed.slice(0, -6) + 'Z'
    } else if (trimmed.endsWith('+00') || trimmed.endsWith('-00')) {
      trimmed = trimmed.slice(0, -3) + 'Z'
    }
    
    // Check short format (YYYY-MM-DDTHH:mm)
    const shortFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    if (shortFormatRegex.test(trimmed)) {
      return trimmed
    }
    
    // Validate it's a valid ISO datetime
    try {
      const datetimeResult = z.string().datetime().safeParse(trimmed)
      if (datetimeResult.success) {
        return trimmed
      }
    } catch {
      // Continue
    }
    
    // If validation fails, try to fix common issues
    const postgresMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})[\+\-]00:?00?$/)
    if (postgresMatch) {
      return `${postgresMatch[1]}T${postgresMatch[2]}Z`
    }
    
    return trimmed
  }

  // Watch meter readings for auto-calculation
  const hobbsStart = watch("hobbs_start")
  const hobbsEnd = watch("hobbs_end")
  const tachStart = watch("tach_start")
  const tachEnd = watch("tach_end")

  // Calculate flight hours from meter readings
  React.useEffect(() => {
    if (isInitializingRef.current) return

    const hobbsHours = calculateFlightHours(hobbsStart, hobbsEnd)
    const tachHours = calculateFlightHours(tachStart, tachEnd)
    
    // Use hobbs if available, otherwise tach, otherwise 0
    const flightHours = hobbsHours > 0 ? hobbsHours : (tachHours > 0 ? tachHours : 0)

    if (hobbsHours > 0) {
      setValue("flight_time_hobbs", hobbsHours, { shouldDirty: false })
    }
    if (tachHours > 0) {
      setValue("flight_time_tach", tachHours, { shouldDirty: false })
    }
    if (flightHours > 0) {
      setValue("flight_time", flightHours, { shouldDirty: false })
    }
  }, [hobbsStart, hobbsEnd, tachStart, tachEnd, setValue])

  // Track initialization key to reload form when booking changes
  const lastInitializedKey = React.useRef<string | null>(null)
  
  // Populate form when booking loads
  React.useEffect(() => {
    if (!booking) return
    
    const initializationKey = bookingId
    
    if (lastInitializedKey.current === initializationKey) {
      return
    }
    
    isInitializingRef.current = true
    lastInitializedKey.current = initializationKey

    // Reset form with initial values (use booking fields directly)
    const initialValues: FlightLogCheckinFormData = {
      hobbs_start: booking.hobbs_start || null,
      hobbs_end: booking.hobbs_end || null,
      tach_start: booking.tach_start || null,
      tach_end: booking.tach_end || null,
      flight_time_hobbs: booking.flight_time_hobbs || null,
      flight_time_tach: booking.flight_time_tach || null,
      flight_time: booking.flight_time || null,
      checked_out_aircraft_id: booking.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: booking.checked_out_instructor_id || booking.instructor_id || null,
      actual_start: normalizeDateString(booking.actual_start || booking.start_time || null),
      actual_end: normalizeDateString(booking.actual_end || booking.end_time || null),
      flight_type_id: booking.flight_type_id || null,
      lesson_id: booking.lesson_id || null,
      remarks: null,
      fuel_on_board: null,
      passengers: null,
      route: null,
      flight_remarks: null,
      solo_end_hobbs: booking.solo_end_hobbs || null,
      dual_time: booking.dual_time || null,
      solo_time: booking.solo_time || null,
      total_hours_start: booking.total_hours_start || null,
      total_hours_end: booking.total_hours_end || null,
    }
    
    reset(initialValues, { keepDirty: false, keepDefaultValues: false })
    
    // Wait for reset to complete, then mark as initialized
    Promise.resolve().then(() => {
      // Small delay to ensure form state has settled
      setTimeout(() => {
        setIsInitialized(true)
        isInitializingRef.current = false
        // Force update hasChanges after initialization
        setHasChanges(false)
      }, 300)
    })
  }, [booking, bookingId, reset])


  const checkinMutation = useMutation({
    mutationFn: async (data: FlightLogCheckinFormData) => {
      const cleanDateField = normalizeDateString
      
      // Calculate flight times if meter readings are provided
      const hobbsHours = calculateFlightHours(data.hobbs_start, data.hobbs_end)
      const tachHours = calculateFlightHours(data.tach_start, data.tach_end)
      const flightHours = hobbsHours > 0 ? hobbsHours : (tachHours > 0 ? tachHours : 0)

      // Prepare booking update with all flight log fields
      const bookingUpdate: Record<string, unknown> = {
        // Set booking status to 'complete' when checking in
        status: 'complete',
        // Flight log fields (now part of bookings table)
        ...(data.checked_out_aircraft_id !== undefined && { checked_out_aircraft_id: data.checked_out_aircraft_id }),
        ...(data.checked_out_instructor_id !== undefined && { checked_out_instructor_id: data.checked_out_instructor_id }),
        actual_start: cleanDateField(data.actual_start),
        actual_end: cleanDateField(data.actual_end),
        hobbs_start: data.hobbs_start,
        hobbs_end: data.hobbs_end,
        tach_start: data.tach_start,
        tach_end: data.tach_end,
        flight_time_hobbs: hobbsHours > 0 ? hobbsHours : data.flight_time_hobbs,
        flight_time_tach: tachHours > 0 ? tachHours : data.flight_time_tach,
        flight_time: flightHours > 0 ? flightHours : data.flight_time,
        ...(data.flight_type_id !== undefined && { flight_type_id: data.flight_type_id }),
        ...(data.lesson_id !== undefined && { lesson_id: data.lesson_id }),
      }
      
      // Update booking directly (includes all flight log fields)
      return fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingUpdate),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
      await queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Flight checked in successfully")
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const onSubmit = (data: FlightLogCheckinFormData) => {
    checkinMutation.mutate(data)
  }
  
  const handleFormSubmit = handleSubmit(onSubmit)

  const handleUndo = () => {
    if (!booking) return
    
    isInitializingRef.current = true
    setHasChanges(false)

    const originalValues: FlightLogCheckinFormData = {
      hobbs_start: booking.hobbs_start || null,
      hobbs_end: booking.hobbs_end || null,
      tach_start: booking.tach_start || null,
      tach_end: booking.tach_end || null,
      flight_time_hobbs: booking.flight_time_hobbs || null,
      flight_time_tach: booking.flight_time_tach || null,
      flight_time: booking.flight_time || null,
      checked_out_aircraft_id: booking.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: booking.checked_out_instructor_id || booking.instructor_id || null,
      actual_start: normalizeDateString(booking.actual_start || booking.start_time || null),
      actual_end: normalizeDateString(booking.actual_end || booking.end_time || null),
      flight_type_id: booking.flight_type_id || null,
      lesson_id: booking.lesson_id || null,
      remarks: null,
      fuel_on_board: null,
      passengers: null,
      route: null,
      flight_remarks: null,
      solo_end_hobbs: booking.solo_end_hobbs || null,
      dual_time: booking.dual_time || null,
      solo_time: booking.solo_time || null,
      total_hours_start: booking.total_hours_start || null,
      total_hours_end: booking.total_hours_end || null,
    }
    
    reset(originalValues, { keepDirty: false, keepDefaultValues: false })
    
    setTimeout(() => {
      isInitializingRef.current = false
      setHasChanges(false)
    }, 300)
    
    toast.info('Changes reverted')
  }

  const isAdminOrInstructor = role === 'owner' || role === 'admin' || role === 'instructor'

  const isLoading = bookingQuery.isLoading || optionsQuery.isLoading
  const isError = bookingQuery.isError

  if (isLoading) {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="text-muted-foreground">Loading booking check-in...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (isError || !booking) {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Booking not found</h2>
              <p className="text-muted-foreground mb-4">
                The booking {"you're"} looking for doesn{"'"}t exist.
              </p>
              <Button asChild>
                <Link href="/bookings">Back to Bookings</Link>
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  // Only allow check-in for flight bookings
  if (booking.booking_type !== 'flight') {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Invalid Booking Type</h2>
              <p className="text-muted-foreground mb-4">
                Flight check-in is only available for flight bookings.
              </p>
              <Button asChild>
                <Link href={`/bookings/${bookingId}`}>Back to Booking</Link>
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const studentName = booking.student
    ? [booking.student.first_name, booking.student.last_name].filter(Boolean).join(" ") || booking.student.email
    : "—"
  
  const instructorName = booking.instructor
    ? [booking.instructor.first_name, booking.instructor.last_name].filter(Boolean).join(" ") || booking.instructor.user?.email || "—"
    : "—"

  const aircraftRegistration = booking.aircraft?.registration || "—"

  // Calculate displayed flight hours
  const displayedHobbsHours = calculateFlightHours(hobbsStart, hobbsEnd)
  const displayedTachHours = calculateFlightHours(tachStart, tachEnd)

  return (
    <>
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-muted/30">
          <div className="flex flex-1 flex-col">
            {/* Header Section */}
            <div className="border-b border-border/40 bg-gradient-to-br from-slate-50 via-blue-50/30 to-background dark:from-slate-900 dark:via-slate-800/50 dark:to-background">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Top Row: Back Button */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <Link
                    href={`/bookings/${bookingId}`}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconArrowLeft className="h-4 w-4" />
                    Back to Booking
                  </Link>
                </div>

                {/* Title Row */}
                <div className="mb-6 sm:mb-8">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-foreground">
                    Flight Check-In
                  </h1>
                  <div className="mt-2 text-sm sm:text-base text-muted-foreground">
                    <span className="font-medium text-foreground">Member:</span> {studentName}
                    {aircraftRegistration !== "—" && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="font-medium text-foreground">Aircraft:</span> {aircraftRegistration}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 ${
              isMobile ? "pt-8 pb-24" : "pt-10 pb-8"
            }`}>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
                {/* Left Column: Check-In Form */}
                <div className="lg:col-span-2 space-y-6 lg:space-y-8">
                  {/* Flight Details Form */}
                  <Card className="bg-card shadow-md border border-border/50 rounded-xl">
                    <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                      <form onSubmit={handleFormSubmit}>
                        <FieldSet className="w-full max-w-full">
                          <FieldGroup className="w-full max-w-full">
                            {/* Meter Readings Section */}
                            <FieldSet className="p-4 sm:p-3 gap-4 sm:gap-3 rounded-lg w-full max-w-full box-border bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
                              <FieldGroup className="gap-4 sm:gap-3">
                                {/* Tacho Meter */}
                                <FieldSet className="gap-3 sm:gap-2">
                                  <div className="flex items-center justify-between mb-2 sm:mb-1.5">
                                    <FieldLegend className="flex items-center gap-2 sm:gap-1.5 text-base sm:text-sm font-semibold">
                                      <IconPlane className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                      Tacho Meter
                                    </FieldLegend>
                                    <div className="text-sm sm:text-xs font-semibold sm:font-medium text-muted-foreground bg-white dark:bg-gray-800 px-2 py-1 rounded-md">
                                      {displayedTachHours > 0 ? `${displayedTachHours.toFixed(1)}h` : "0.0h"}
                                    </div>
                                  </div>
                                  <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2.5">
                                    <Field data-invalid={!!errors.tach_start} className="gap-2 sm:gap-1">
                                      <FieldLabel htmlFor="tach_start" className="text-sm sm:text-xs font-medium">Start Tacho</FieldLabel>
                                      <Input
                                        id="tach_start"
                                        type="number"
                                        step="0.1"
                                        {...register("tach_start", { valueAsNumber: true })}
                                        className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                        placeholder="8752.2"
                                        aria-invalid={!!errors.tach_start}
                                      />
                                      <FieldError errors={errors.tach_start ? [{ message: errors.tach_start.message }] : undefined} />
                                    </Field>
                                    <Field data-invalid={!!errors.tach_end} className="gap-2 sm:gap-1">
                                      <FieldLabel htmlFor="tach_end" className="text-sm sm:text-xs font-medium">End Tacho</FieldLabel>
                                      <Input
                                        id="tach_end"
                                        type="number"
                                        step="0.1"
                                        {...register("tach_end", { valueAsNumber: true })}
                                        className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                        placeholder="8754.5"
                                        aria-invalid={!!errors.tach_end}
                                      />
                                      <FieldError errors={errors.tach_end ? [{ message: errors.tach_end.message }] : undefined} />
                                    </Field>
                                  </FieldGroup>
                                </FieldSet>

                                {/* Hobbs Meter */}
                                <FieldSet className="gap-3 sm:gap-2">
                                  <div className="flex items-center justify-between mb-2 sm:mb-1.5">
                                    <FieldLegend className="flex items-center gap-2 sm:gap-1.5 text-base sm:text-sm font-semibold">
                                      <IconClock className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                      Hobbs Meter
                                    </FieldLegend>
                                    <div className="text-sm sm:text-xs font-semibold sm:font-medium text-muted-foreground bg-white dark:bg-gray-800 px-2 py-1 rounded-md">
                                      {displayedHobbsHours > 0 ? `${displayedHobbsHours.toFixed(1)}h` : "0.0h"}
                                    </div>
                                  </div>
                                  <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2.5">
                                    <Field data-invalid={!!errors.hobbs_start} className="gap-2 sm:gap-1">
                                      <FieldLabel htmlFor="hobbs_start" className="text-sm sm:text-xs font-medium">Start Hobbs</FieldLabel>
                                      <Input
                                        id="hobbs_start"
                                        type="number"
                                        step="0.1"
                                        {...register("hobbs_start", { valueAsNumber: true })}
                                        className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                        placeholder="8752.2"
                                        aria-invalid={!!errors.hobbs_start}
                                      />
                                      <FieldError errors={errors.hobbs_start ? [{ message: errors.hobbs_start.message }] : undefined} />
                                    </Field>
                                    <Field data-invalid={!!errors.hobbs_end} className="gap-2 sm:gap-1">
                                      <FieldLabel htmlFor="hobbs_end" className="text-sm sm:text-xs font-medium">End Hobbs</FieldLabel>
                                      <Input
                                        id="hobbs_end"
                                        type="number"
                                        step="0.1"
                                        {...register("hobbs_end", { valueAsNumber: true })}
                                        className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                        placeholder="8754.5"
                                        aria-invalid={!!errors.hobbs_end}
                                      />
                                      <FieldError errors={errors.hobbs_end ? [{ message: errors.hobbs_end.message }] : undefined} />
                                    </Field>
                                  </FieldGroup>
                                </FieldSet>
                                
                                {/* Calculate Button */}
                                <div className="pt-2">
                                  <Button
                                    type="button"
                                    size="lg"
                                    onClick={handleFormSubmit}
                                    disabled={checkinMutation.isPending}
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-12 sm:h-11 text-base sm:text-sm font-semibold"
                                  >
                                    <IconFileText className="h-5 w-5 mr-2" />
                                    {checkinMutation.isPending ? "Calculating..." : "Calculate Flight Charges"}
                                  </Button>
                                </div>
                              </FieldGroup>
                            </FieldSet>

                            {/* Flight Information */}
                            <FieldSet>
                              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                <Field data-invalid={!!errors.flight_type_id} className="gap-2 sm:gap-1.5">
                                  <FieldLabel htmlFor="flight_type_id" className="flex items-center gap-2 text-base sm:text-sm font-medium text-foreground">
                                    <IconClock className="h-5 w-5 sm:h-4 sm:w-4 text-primary" />
                                    Flight Type
                                  </FieldLabel>
                                  {options ? (
                                    <Select
                                      value={watch("flight_type_id") || "none"}
                                      onValueChange={(value) => setValue("flight_type_id", value === "none" ? null : value, { shouldDirty: true })}
                                    >
                                      <SelectTrigger id="flight_type_id" className="w-full h-12 sm:h-10 text-base sm:text-sm transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-2 focus:ring-primary/20" aria-invalid={!!errors.flight_type_id}>
                                        <SelectValue placeholder="Select Flight Type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">No flight type</SelectItem>
                                        {options.flightTypes.map((ft) => (
                                          <SelectItem key={ft.id} value={ft.id}>
                                            {ft.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="px-4 sm:px-3 py-3 sm:py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/50 text-base sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {booking.flight_type?.name || "—"}
                                    </div>
                                  )}
                                  {errors.flight_type_id && (
                                    <p className="text-sm text-destructive mt-1">{errors.flight_type_id.message}</p>
                                  )}
                                </Field>

                                <Field className="gap-2 sm:gap-1.5">
                                  <FieldLabel htmlFor="checked_out_instructor_id" className="flex items-center gap-2 text-base sm:text-sm font-medium text-foreground">
                                    <IconSchool className="h-5 w-5 sm:h-4 sm:w-4 text-foreground" />
                                    Instructor
                                  </FieldLabel>
                                  {isAdminOrInstructor && options ? (
                                    <Select
                                      value={watch("checked_out_instructor_id") || "none"}
                                      onValueChange={(value) => setValue("checked_out_instructor_id", value === "none" ? null : value, { shouldDirty: true })}
                                    >
                                      <SelectTrigger id="checked_out_instructor_id" className="w-full h-12 sm:h-10 text-base sm:text-sm transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-2 focus:ring-primary/20">
                                        <SelectValue placeholder="Select Instructor" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">No instructor</SelectItem>
                                        {options.instructors.map((instructor) => {
                                          const name = [instructor.first_name, instructor.last_name]
                                            .filter(Boolean)
                                            .join(" ") || instructor.user?.email || "Unknown"
                                          return (
                                            <SelectItem key={instructor.id} value={instructor.id}>
                                              {name}
                                            </SelectItem>
                                          )
                                        })}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="px-4 sm:px-3 py-3 sm:py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/50 text-base sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {instructorName}
                                    </div>
                                  )}
                                </Field>
                              </FieldGroup>
                            </FieldSet>
                          </FieldGroup>
                        </FieldSet>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Invoice Panel */}
                <div className="lg:col-span-3 space-y-6 lg:space-y-8">
                  <Card className="bg-card shadow-md border border-border/50 rounded-xl">
                    <CardHeader className="pb-5 border-b border-border/20">
                      <CardTitle className="text-xl font-bold text-foreground">
                        Invoice
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {/* Invoice Placeholder */}
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <IconFileText className="h-16 w-16 text-muted-foreground/40 mb-4" />
                        <p className="text-muted-foreground text-sm">
                          No items yet. Calculate flight charges to begin.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    
    {/* Sticky Bottom Bar - Save Changes */}
    {hasChanges && (
    <div 
      className="fixed border-t shadow-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
      role="banner"
      aria-label="Save changes"
      style={{ 
        position: 'fixed',
        bottom: 0,
        left: isMobile ? 0 : `${sidebarLeft}px`,
        right: 0,
        zIndex: 99999,
        minHeight: '60px',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-end gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handleUndo}
            disabled={checkinMutation.isPending}
            className={`h-12 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"}`}
          >
            <IconRotateClockwise className="h-4 w-4 mr-2" />
            Undo Changes
          </Button>
          <Button
            size="lg"
            onClick={handleFormSubmit}
            disabled={checkinMutation.isPending}
            className={`h-12 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all ${isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"}`}
          >
            <IconDeviceFloppy className="h-4 w-4 mr-2" />
            {checkinMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
    )}
    </>
  )
}
