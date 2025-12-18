"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  IconArrowLeft,
  IconClock,
  IconPlane,
  IconSchool,
  IconFileText,
  IconDeviceFloppy,
  IconRotateClockwise,
  IconInfoCircle,
  IconRoute,
  IconGasStation,
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDownIcon } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { FlightLogWithRelations } from "@/lib/types/flight-logs"
import { flightLogCheckoutSchema, type FlightLogFormData } from "@/lib/validation/flight-logs"
import { useAuth } from "@/contexts/auth-context"
import { useIsMobile } from "@/hooks/use-mobile"

// Generate time options in half-hour increments
function generateTimeOptions(): string[] {
  const times: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = String(hour).padStart(2, "0")
      const m = String(minute).padStart(2, "0")
      times.push(`${h}:${m}`)
    }
  }
  return times
}

const TIME_OPTIONS = generateTimeOptions()

// Format time for display (HH:mm to 12-hour format)
function formatTimeForDisplay(time: string): string {
  if (!time) return "Select time"
  const [hours, minutes] = time.split(":")
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? "pm" : "am"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

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

export default function BookingCheckoutPage() {
  const params = useParams()
  const { role } = useAuth()
  const bookingId = params.id as string
  const isMobile = useIsMobile()

  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<FlightLogFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(flightLogCheckoutSchema) as any, // Type inference issue with zodResolver and complex Zod schemas
    mode: 'onChange', // Track changes as user types/interacts
    defaultValues: {
      booking_id: bookingId,
    },
  })

  // Track form dirty state - use isDirty from react-hook-form
  const hasChanges = isDirty

  // Fetch booking
  const bookingQuery = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!bookingId,
    queryFn: () => fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`),
    staleTime: 30_000,
  })

  // Fetch existing flight log if it exists
  const flightLogQuery = useQuery({
    queryKey: ["flightLog", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const result = await fetchJson<{ flight_log: FlightLogWithRelations | null }>(`/api/flight-logs?booking_id=${bookingId}`)
      // API returns { flight_log: null } when no flight log exists (not a 404)
      return result
    },
    staleTime: 30_000,
  })

  // Extract booking and flight log data
  const booking = bookingQuery.data?.booking ?? null
  const existingFlightLog = flightLogQuery.data?.flight_log ?? null

  // Get lesson_id from flight log or booking for options query
  const selectedLessonId = existingFlightLog?.lesson_id || booking?.lesson_id

  const optionsQuery = useQuery({
    queryKey: ["bookingOptions", selectedLessonId],
    queryFn: () => {
      // Include the selected lesson_id in the query if it exists
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
    
    // Normalize +00:00 or +00 to Z (UTC) - be more explicit
    if (trimmed.endsWith('+00:00') || trimmed.endsWith('-00:00')) {
      trimmed = trimmed.slice(0, -6) + 'Z'
    } else if (trimmed.endsWith('+00') || trimmed.endsWith('-00')) {
      trimmed = trimmed.slice(0, -3) + 'Z'
    }
    
    // Check short format (YYYY-MM-DDTHH:mm) - return as-is, validation will transform
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
    // Check if it's PostgreSQL format (YYYY-MM-DD HH:mm:ss+00)
    const postgresMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})[\+\-]00:?00?$/)
    if (postgresMatch) {
      return `${postgresMatch[1]}T${postgresMatch[2]}Z`
    }
    
    // Return normalized value even if validation fails (let the API handle it)
    return trimmed
  }

  // Helper functions to convert ISO datetime string to Date and time string
  const parseDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return { date: undefined, time: "" }
    const date = new Date(isoString)
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return { date, time: `${hours}:${minutes}` }
  }

  // Helper function to combine Date and time string into ISO datetime string
  // Returns format: YYYY-MM-DDTHH:mm (short format that validation accepts) or null
  const combineDateTime = (date: Date | undefined, time: string): string | null => {
    if (!date || !time || time.trim() === "") return null
    const [hours, minutes] = time.split(":")
    if (!hours || !minutes || hours.trim() === "" || minutes.trim() === "") return null
    
    // Validate hours and minutes are numbers
    const hourNum = parseInt(hours, 10)
    const minuteNum = parseInt(minutes, 10)
    if (isNaN(hourNum) || isNaN(minuteNum)) return null
    if (hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) return null
    
    // Create date in local timezone, then format as YYYY-MM-DDTHH:mm
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hour = String(hourNum).padStart(2, "0")
    const minute = String(minuteNum).padStart(2, "0")
    
    // Return short format: YYYY-MM-DDTHH:mm (validation will transform to full ISO)
    return `${year}-${month}-${day}T${hour}:${minute}`
  }

  // Local state for date/time pickers
  const [actualStartDate, setActualStartDate] = React.useState<Date | undefined>()
  const [actualStartTime, setActualStartTime] = React.useState("")
  const [actualEndDate, setActualEndDate] = React.useState<Date | undefined>()
  const [actualEndTime, setActualEndTime] = React.useState("")
  const [etaDate, setEtaDate] = React.useState<Date | undefined>()
  const [etaTime, setEtaTime] = React.useState("")
  const [openActualStartDate, setOpenActualStartDate] = React.useState(false)
  const [openActualEndDate, setOpenActualEndDate] = React.useState(false)
  const [openEtaDate, setOpenEtaDate] = React.useState(false)
  const [isInitialized, setIsInitialized] = React.useState(false)
  
  // Use a ref to track if we're currently initializing (prevents effects from running during init)
  const isInitializingRef = React.useRef(false)
  
  // Debug: Log form state (remove in production)
  React.useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('Form state:', { 
        isDirty, 
        hasChanges,
        isInitialized,
        isInitializing: isInitializingRef.current,
        formValues: watch()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, hasChanges, isInitialized])

  // Track initialization key to reload form when flight log changes
  const lastInitializedKey = React.useRef<string | null>(null)
  
  // Populate form when booking/flight log loads (reload when flight log ID changes)
  React.useEffect(() => {
    if (!booking) return
    
    // Create a unique key for this booking/flight log combination
    const flightLogId = existingFlightLog?.id || 'none'
    const initializationKey = `${bookingId}-${flightLogId}`
    
    // Check if we've already initialized for this specific flight log
    if (lastInitializedKey.current === initializationKey) {
      return // Already initialized for this flight log
    }
    
    // Mark that we're initializing - do this FIRST before any state changes
    isInitializingRef.current = true
    lastInitializedKey.current = initializationKey

    // Mark that we're initializing - do this FIRST before any state changes
    isInitializingRef.current = true
    
    // Calculate date/time values first
    const actualStart = existingFlightLog?.actual_start 
      ? parseDateTime(existingFlightLog.actual_start)
      : parseDateTime(booking.start_time)
    
    const actualEnd = existingFlightLog?.actual_end 
      ? parseDateTime(existingFlightLog.actual_end)
      : booking.end_time && !existingFlightLog
        ? parseDateTime(booking.end_time)
        : { date: undefined, time: "" }
    
    const eta = existingFlightLog?.eta 
      ? parseDateTime(existingFlightLog.eta)
      : parseDateTime(booking.end_time)

    // Reset form with initial values - normalize date strings to ensure they're in the correct format
    const initialValues = {
      booking_id: bookingId,
      checked_out_aircraft_id: existingFlightLog?.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: existingFlightLog?.checked_out_instructor_id || booking.instructor_id || null,
      actual_start: normalizeDateString(existingFlightLog?.actual_start || booking.start_time || null),
      actual_end: normalizeDateString(existingFlightLog?.actual_end || null),
      eta: normalizeDateString(existingFlightLog?.eta || booking.end_time || null),
      fuel_on_board: existingFlightLog?.fuel_on_board || null,
      passengers: existingFlightLog?.passengers || null,
      route: existingFlightLog?.route || null,
      briefing_completed: existingFlightLog?.briefing_completed ?? false,
      authorization_completed: existingFlightLog?.authorization_completed ?? false,
      flight_remarks: existingFlightLog?.flight_remarks || null,
      // Flight log fields (now stored in flight_logs table)
      flight_type_id: existingFlightLog?.flight_type_id || booking.flight_type_id || null,
      lesson_id: existingFlightLog?.lesson_id || booking.lesson_id || null,
      description: existingFlightLog?.description || null,
      remarks: existingFlightLog?.remarks || booking.remarks || null,
      // Booking fields
      purpose: booking.purpose || "",
    }
    
    // Reset form to establish defaults (this clears dirty state)
    reset(initialValues, { keepDirty: false, keepDefaultValues: true })
    
    // Set date/time state AFTER reset - use a microtask to ensure reset completes first
    Promise.resolve().then(() => {
      setActualStartDate(actualStart.date)
      setActualStartTime(actualStart.time)
      setActualEndDate(actualEnd.date)
      setActualEndTime(actualEnd.time)
      setEtaDate(eta.date)
      setEtaTime(eta.time)
      
      // Mark as initialized
      setIsInitialized(true)
      
      // Clear initialization flag after effects have had a chance to run
      // Use a longer delay to ensure all effects complete
      setTimeout(() => {
        isInitializingRef.current = false
      }, 200)
    })
  }, [booking, existingFlightLog, bookingId, reset])

  // Auto-set end date to start date if end date is not set (only after initialization and if no existing flight log with actual_end)
  // Don't run during initialization or undo operations
  React.useEffect(() => {
    if (isInitializingRef.current) return // Don't auto-set during initialization or undo
    if (!isInitialized) return // Wait for initialization
    if (!actualStartDate) return // Need a start date
    if (actualEndDate) return // Already has an end date
    if (existingFlightLog?.actual_end) return // Don't override if there's an existing actual_end
    
    // Only auto-set if we don't have booking.end_time to use
    // If booking.end_time exists and no existingFlightLog, we should use that (handled in initialization)
    if (!existingFlightLog && booking?.end_time) return // Use booking.end_time instead
    
    setActualEndDate(actualStartDate)
  }, [isInitialized, actualStartDate, actualEndDate, existingFlightLog, booking?.end_time])

  // Update form values when date/time changes (only after initialization to avoid marking as dirty during initial load)
  React.useEffect(() => {
    // Skip if initializing or not initialized
    if (!isInitialized || isInitializingRef.current) return
    
    // Get current form value to compare
    const currentValue = watch("actual_start")
    const combined = combineDateTime(actualStartDate, actualStartTime)
    const newValue = combined || null // Ensure null instead of empty string
    
    // Only update if value actually changed (prevents marking as dirty when value matches default)
    if (currentValue !== newValue) {
      setValue("actual_start", newValue, { shouldDirty: true, shouldTouch: true })
    }
  }, [actualStartDate, actualStartTime, setValue, isInitialized, watch])

  React.useEffect(() => {
    // Skip if initializing or not initialized
    if (!isInitialized || isInitializingRef.current) return
    
    // Get current form value to compare
    const currentValue = watch("actual_end")
    const combined = combineDateTime(actualEndDate, actualEndTime)
    const newValue = combined || null // Ensure null instead of empty string
    
    // Only update if value actually changed (prevents marking as dirty when value matches default)
    if (currentValue !== newValue) {
      setValue("actual_end", newValue, { shouldDirty: true, shouldTouch: true })
    }
  }, [actualEndDate, actualEndTime, setValue, isInitialized, watch])

  React.useEffect(() => {
    // Skip if initializing or not initialized
    if (!isInitialized || isInitializingRef.current) return
    
    // Get current form value to compare
    const currentValue = watch("eta")
    const combined = combineDateTime(etaDate, etaTime)
    const newValue = combined || null // Ensure null instead of empty string
    
    // Only update if value actually changed (prevents marking as dirty when value matches default)
    if (currentValue !== newValue) {
      setValue("eta", newValue, { shouldDirty: true, shouldTouch: true })
    }
  }, [etaDate, etaTime, setValue, isInitialized, watch])

  const checkoutMutation = useMutation({
    mutationFn: async (data: FlightLogFormData) => {
      // Clean date fields - ensure empty strings become null and validate format
      // Use the same normalizeDateString function for consistency
      const cleanDateField = normalizeDateString
      
      // Separate booking fields from flight log fields
      // Note: flight_type_id, lesson_id, description, remarks are now flight log fields, not booking fields
      const { purpose, ...flightLogData } = data
      
      // Set actual_end to booking's end_time if not already set
      // This ensures the flight log has an end time when submitted, using the booking's scheduled end time
      let actualEndValue = flightLogData.actual_end
      if (!actualEndValue || actualEndValue === null || actualEndValue === '') {
        // If actual_end is not set, use the booking's end_time
        if (booking?.end_time) {
          actualEndValue = booking.end_time
        } else {
          // Fallback to current time only if booking has no end_time
          actualEndValue = new Date().toISOString()
        }
      }
      
      // Clean date fields in flightLogData
      const cleanedFlightLogData = {
        ...flightLogData,
        actual_start: cleanDateField(flightLogData.actual_start),
        actual_end: cleanDateField(actualEndValue),
        eta: cleanDateField(flightLogData.eta),
      }
      
      // Debug: Log the data being sent (remove in production)
      if (typeof window !== 'undefined') {
        console.log('Submitting flight log data:', {
          original: {
            actual_start: flightLogData.actual_start,
            actual_end: flightLogData.actual_end,
            eta: flightLogData.eta,
          },
          cleaned: {
            actual_start: cleanedFlightLogData.actual_start,
            actual_end: cleanedFlightLogData.actual_end,
            eta: cleanedFlightLogData.eta,
          },
          fullData: cleanedFlightLogData
        })
      }
      
      // Update booking - only update purpose and set status to 'flying'
      const bookingUpdate: Record<string, unknown> = {}
      if (purpose !== undefined) bookingUpdate.purpose = purpose
      
      // Set booking status to 'flying' when creating/updating flight log
      bookingUpdate.status = 'flying'
      
      // Update booking (always update status, and purpose if present)
      await fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingUpdate),
      })
      
      // Create/update flight log (includes flight_type_id, lesson_id, description, remarks)
      return fetchJson<{ flight_log: FlightLogWithRelations }>(`/api/flight-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedFlightLogData),
      })
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(["flightLog", bookingId], { flight_log: result.flight_log })
      await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
      await queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success(existingFlightLog ? "Flight log updated successfully" : "Flight log created successfully")
      // Don't redirect - stay on checkout page so user can continue editing
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const onSubmit = (data: FlightLogFormData) => {
    checkoutMutation.mutate(data)
  }
  
  // Create a properly typed submit handler
  const handleFormSubmit = handleSubmit(onSubmit)

  const handleUndo = () => {
    if (!booking) return
    
    // Mark that we're resetting (to prevent effects from marking as dirty)
    isInitializingRef.current = true
    
    // Use the same logic as initialization to determine what the "original" values should be
    const actualStart = existingFlightLog?.actual_start 
      ? parseDateTime(existingFlightLog.actual_start)
      : parseDateTime(booking.start_time)
    
    // Match the initialization logic: use booking.end_time if no existing flight log
    const actualEnd = existingFlightLog?.actual_end 
      ? parseDateTime(existingFlightLog.actual_end)
      : booking.end_time && !existingFlightLog
        ? parseDateTime(booking.end_time) // Match initialization: prepopulate with booking end_time if no existing flight log
        : { date: undefined, time: "" }
    
    const eta = existingFlightLog?.eta 
      ? parseDateTime(existingFlightLog.eta)
      : parseDateTime(booking.end_time)

    // Set date/time state first
    setActualStartDate(actualStart.date)
    setActualStartTime(actualStart.time)
    setActualEndDate(actualEnd.date)
    setActualEndTime(actualEnd.time)
    setEtaDate(eta.date)
    setEtaTime(eta.time)

    // Reset form to original values (same as initialization)
    const originalValues = {
      booking_id: bookingId,
      checked_out_aircraft_id: existingFlightLog?.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: existingFlightLog?.checked_out_instructor_id || booking.instructor_id || null,
      actual_start: existingFlightLog?.actual_start || booking.start_time || null,
      actual_end: existingFlightLog?.actual_end || null, // Form value should be null if no existing flight log
      eta: existingFlightLog?.eta || booking.end_time || null,
      fuel_on_board: existingFlightLog?.fuel_on_board || null,
      passengers: existingFlightLog?.passengers || null,
      route: existingFlightLog?.route || null,
      briefing_completed: existingFlightLog?.briefing_completed ?? false,
      authorization_completed: existingFlightLog?.authorization_completed ?? false,
      flight_remarks: existingFlightLog?.flight_remarks || null,
      // Flight log fields (now stored in flight_logs table)
      flight_type_id: existingFlightLog?.flight_type_id || booking.flight_type_id || null,
      lesson_id: existingFlightLog?.lesson_id || booking.lesson_id || null,
      description: existingFlightLog?.description || null,
      remarks: existingFlightLog?.remarks || booking.remarks || null,
      // Booking fields
      purpose: booking.purpose || "",
    }
    
    reset(originalValues, { keepDirty: false, keepDefaultValues: true })
    
    // Clear the initialization flag after a brief delay
    setTimeout(() => {
      isInitializingRef.current = false
    }, 100)
    
    toast.info('Changes reverted')
  }

  const isAdminOrInstructor = role === 'owner' || role === 'admin' || role === 'instructor'

  const isLoading = bookingQuery.isLoading || optionsQuery.isLoading || flightLogQuery.isLoading
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
            <div className="text-muted-foreground">Loading booking checkout...</div>
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

  // Only allow checkout for flight bookings
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
                Flight checkout is only available for flight bookings.
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
        <div className={`flex flex-1 flex-col ${isMobile ? "bg-slate-50 dark:bg-slate-950" : "bg-muted/30"}`}>
          <div className="flex flex-1 flex-col">
            {/* Header Section */}
            <div className={`border-b ${
              isMobile 
                ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/60 shadow-sm" 
                : "border-border/40 bg-gradient-to-br from-slate-50 via-blue-50/30 to-background dark:from-slate-900 dark:via-slate-800/50 dark:to-background"
            }`}>
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Top Row: Back Button */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <Link
                    href={`/bookings/${bookingId}`}
                    className={`inline-flex items-center gap-2 text-sm transition-colors ${
                      isMobile 
                        ? "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <IconArrowLeft className="h-4 w-4" />
                    Back to Booking
                  </Link>
                </div>

                {/* Title Row */}
                <div className="mb-4 sm:mb-6">
                  <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight ${
                    isMobile ? "text-slate-900 dark:text-white" : "text-foreground"
                  }`}>
                    Flight Checkout
                  </h1>
                  <p className={`mt-2 ${
                    isMobile ? "text-slate-600 dark:text-slate-400" : "text-muted-foreground"
                  }`}>
                    Convert booking to flight log for {studentName}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pb-8 ${
              isMobile ? "bg-white dark:bg-slate-950 pb-24" : "py-8"
            }`}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Flight Log Form */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Flight Log Form */}
                  <Card className={`bg-card ${
                    isMobile 
                      ? "border border-slate-200 dark:border-slate-800/60 shadow-sm" 
                      : "shadow-sm border border-border/50"
                  }`}>
                    <CardHeader className={`pb-6 border-b ${
                      isMobile 
                        ? "border-slate-200/60 dark:border-slate-800/50" 
                        : "border-border/20"
                    }`}>
                      <div className={`flex ${isMobile ? "flex-col gap-4" : "items-center justify-between"}`}>
                        <CardTitle className={`flex items-center gap-3 text-2xl font-bold ${
                          isMobile ? "text-slate-900 dark:text-white" : "text-foreground"
                        }`}>
                          <IconPlane className={`h-6 w-6 ${
                            isMobile ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                          }`} />
                          Flight Log Details
                        </CardTitle>
                        {hasChanges && (
                          <div className={`flex items-center gap-3 ${isMobile ? "w-full" : ""}`}>
                            <Button
                              variant="outline"
                              size="default"
                              onClick={handleUndo}
                              disabled={checkoutMutation.isPending}
                              className={`h-10 px-5 ${
                                isMobile 
                                  ? "flex-1 border border-slate-300/60 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                  : "border-border/50 hover:bg-accent/80"
                              }`}
                            >
                              <IconRotateClockwise className="h-4 w-4 mr-2" />
                              Undo Changes
                            </Button>
                            <Button
                              size="default"
                              onClick={handleFormSubmit}
                              disabled={checkoutMutation.isPending}
                              className={`bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all h-10 px-5 ${
                                isMobile ? "flex-1" : ""
                              }`}
                            >
                              <IconDeviceFloppy className="h-4 w-4 mr-2" />
                              {checkoutMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form onSubmit={handleFormSubmit}>
                        <FieldSet className="w-full max-w-full">
                          <FieldGroup className="w-full max-w-full">
                            {/* Actual Flight Times */}
                            <FieldSet className={`p-6 rounded-xl w-full max-w-full box-border ${
                              isMobile 
                                ? "bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/50 shadow-sm" 
                                : "bg-muted/30 border border-border/30"
                            }`}>
                              
                            
                              <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <Field data-invalid={!!errors.actual_start}>
                                  <FieldLabel htmlFor="actual_start">Booking Start</FieldLabel>
                                  <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                      <Popover open={openActualStartDate} onOpenChange={setOpenActualStartDate}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            id="actual_start"
                                            variant="outline"
                                            className={`w-full justify-between font-normal h-10 ${
                                              isMobile 
                                                ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                                : "border-border/50 bg-background hover:bg-accent/50"
                                            }`}
                                            aria-invalid={!!errors.actual_start}
                                          >
                                            {actualStartDate
                                              ? actualStartDate.toLocaleDateString("en-US", {
                                                  day: "2-digit",
                                                  month: "short",
                                                  year: "numeric",
                                                })
                                              : "Select date"}
                                            <ChevronDownIcon className="h-4 w-4" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={actualStartDate}
                                            captionLayout="dropdown"
                                            onSelect={(date) => {
                                              setActualStartDate(date)
                                              setOpenActualStartDate(false)
                                              if (date && !actualEndDate) {
                                                setActualEndDate(date)
                                              }
                                            }}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                    <div className="w-32">
                                      <Select
                                        value={actualStartTime || "none"}
                                        onValueChange={(value) => setActualStartTime(value === "none" ? "" : value)}
                                      >
                                        <SelectTrigger className={`w-full h-10 ${
                                          isMobile 
                                            ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                            : "border-border/50 bg-background hover:bg-accent/50"
                                        }`}>
                                          <SelectValue placeholder="Time">
                                            {actualStartTime ? formatTimeForDisplay(actualStartTime) : "Time"}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                          <SelectItem value="none">Select time</SelectItem>
                                          {TIME_OPTIONS.map((time) => (
                                            <SelectItem key={time} value={time}>
                                              {formatTimeForDisplay(time)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <FieldError errors={errors.actual_start ? [{ message: errors.actual_start.message }] : undefined} />
                                </Field>

                                <Field data-invalid={!!errors.actual_end}>
                                  <FieldLabel htmlFor="actual_end">Booking End</FieldLabel>
                                  <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                      <Popover open={openActualEndDate} onOpenChange={setOpenActualEndDate}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            id="actual_end"
                                            variant="outline"
                                            className={`w-full justify-between font-normal h-10 ${
                                              isMobile 
                                                ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                                : "border-border/50 bg-background hover:bg-accent/50"
                                            }`}
                                            aria-invalid={!!errors.actual_end}
                                          >
                                            {actualEndDate
                                              ? actualEndDate.toLocaleDateString("en-US", {
                                                  day: "2-digit",
                                                  month: "short",
                                                  year: "numeric",
                                                })
                                              : "Select date"}
                                            <ChevronDownIcon className="h-4 w-4" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={actualEndDate}
                                            captionLayout="dropdown"
                                            onSelect={(date) => {
                                              setActualEndDate(date)
                                              setOpenActualEndDate(false)
                                            }}
                                            disabled={actualStartDate ? { before: actualStartDate } : undefined}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                    <div className="w-32">
                                      <Select
                                        value={actualEndTime || "none"}
                                        onValueChange={(value) => setActualEndTime(value === "none" ? "" : value)}
                                      >
                                        <SelectTrigger className={`w-full h-10 ${
                                          isMobile 
                                            ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                            : "border-border/50 bg-background hover:bg-accent/50"
                                        }`}>
                                          <SelectValue placeholder="Time">
                                            {actualEndTime ? formatTimeForDisplay(actualEndTime) : "Time"}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                          <SelectItem value="none">Select time</SelectItem>
                                          {TIME_OPTIONS.map((time) => (
                                            <SelectItem key={time} value={time}>
                                              {formatTimeForDisplay(time)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <FieldError errors={errors.actual_end ? [{ message: errors.actual_end.message }] : undefined} />
                                </Field>
                              </FieldGroup>
                            </FieldSet>

                            {/* Booking Information - Two Column Layout */}
                            <FieldSet>
                              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <Field>
                                  <FieldLabel htmlFor="checked_out_aircraft_id" className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <IconPlane className="h-4 w-4 text-primary" />
                                    Aircraft
                                  </FieldLabel>
                                  {options ? (
                                    <Select
                                      value={watch("checked_out_aircraft_id") || "none"}
                                      onValueChange={(value) => setValue("checked_out_aircraft_id", value === "none" ? null : value, { shouldDirty: true })}
                                    >
                                      <SelectTrigger id="checked_out_aircraft_id" className={`w-full transition-colors ${
                                        isMobile 
                                          ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                          : "border-border/50 bg-background hover:bg-accent/50"
                                      }`}>
                                        <SelectValue placeholder="Select Aircraft" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">No aircraft</SelectItem>
                                        {options.aircraft.map((aircraft) => (
                                          <SelectItem key={aircraft.id} value={aircraft.id}>
                                            {aircraft.registration} - {aircraft.manufacturer} {aircraft.type} {aircraft.model && `(${aircraft.model})`}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                      {booking.aircraft
                                        ? `${booking.aircraft.registration} - ${booking.aircraft.manufacturer} ${booking.aircraft.type}`
                                        : "—"}
                                    </div>
                                  )}
                                </Field>

                                <Field>
                                  <FieldLabel htmlFor="checked_out_instructor_id" className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <IconSchool className="h-4 w-4 text-foreground" />
                                    Instructor
                                  </FieldLabel>
                                  {isAdminOrInstructor && options ? (
                                    <Select
                                      value={watch("checked_out_instructor_id") || "none"}
                                      onValueChange={(value) => setValue("checked_out_instructor_id", value === "none" ? null : value, { shouldDirty: true })}
                                    >
                                      <SelectTrigger id="checked_out_instructor_id" className={`w-full transition-colors ${
                                        isMobile 
                                          ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                          : "border-border/50 bg-background hover:bg-accent/50"
                                      }`}>
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
                                    <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                      {instructorName}
                                    </div>
                                  )}
                                </Field>

                                <Field data-invalid={!!errors.flight_type_id}>
                                  <FieldLabel htmlFor="flight_type_id" className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <IconClock className="h-4 w-4 text-foreground" />
                                    Flight Type
                                  </FieldLabel>
                                  {options ? (
                                    <Select
                                      value={watch("flight_type_id") || "none"}
                                      onValueChange={(value) => setValue("flight_type_id", value === "none" ? null : value, { shouldDirty: true })}
                                    >
                                      <SelectTrigger id="flight_type_id" className={`w-full transition-colors ${
                                        isMobile 
                                          ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                          : "border-border/50 bg-background hover:bg-accent/50"
                                      }`} aria-invalid={!!errors.flight_type_id}>
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
                                    <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                      {booking.flight_type?.name || "—"}
                                    </div>
                                  )}
                                  {errors.flight_type_id && (
                                    <p className="text-sm text-destructive mt-1">{errors.flight_type_id.message}</p>
                                  )}
                                </Field>

                                <Field data-invalid={!!errors.lesson_id}>
                                  <FieldLabel htmlFor="lesson_id" className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <IconFileText className="h-4 w-4 text-foreground" />
                                    Lesson
                                  </FieldLabel>
                                  {options ? (
                                    <Select
                                      value={watch("lesson_id") || "none"}
                                      onValueChange={(value) => setValue("lesson_id", value === "none" ? null : value, { shouldDirty: true })}
                                    >
                                      <SelectTrigger id="lesson_id" className={`w-full transition-colors ${
                                        isMobile 
                                          ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                          : "border-border/50 bg-background hover:bg-accent/50"
                                      }`} aria-invalid={!!errors.lesson_id}>
                                        <SelectValue placeholder="Select Lesson" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">No lesson selected</SelectItem>
                                        {options.lessons.map((lesson) => (
                                          <SelectItem key={lesson.id} value={lesson.id}>
                                            {lesson.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                      {booking.lesson_id ? "Lesson selected" : "No lesson selected"}
                                    </div>
                                  )}
                                  {errors.lesson_id && (
                                    <p className="text-sm text-destructive mt-1">{errors.lesson_id.message}</p>
                                  )}
                                </Field>

                                <Field data-invalid={!!errors.purpose}>
                                  <FieldLabel htmlFor="purpose" className="text-sm font-medium text-foreground">Description</FieldLabel>
                                  <Textarea
                                    id="purpose"
                                    {...register("purpose")}
                                    placeholder="Enter booking description"
                                    className={`min-h-[100px] focus-visible:ring-primary/20 ${
                                      isMobile 
                                        ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm" 
                                        : "border-border/50 bg-background"
                                    }`}
                                    aria-invalid={!!errors.purpose}
                                  />
                                  {errors.purpose && (
                                    <p className="text-sm text-destructive mt-1">{errors.purpose.message}</p>
                                  )}
                                </Field>

                                <Field data-invalid={!!errors.remarks}>
                                  <FieldLabel htmlFor="remarks" className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <IconInfoCircle className="h-4 w-4 text-foreground" />
                                    Operational Remarks
                                  </FieldLabel>
                                  <Textarea
                                    id="remarks"
                                    {...register("remarks")}
                                    placeholder="Enter operational remarks or warnings"
                                    className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 min-h-[100px] focus-visible:ring-amber-500/20"
                                    aria-invalid={!!errors.remarks}
                                  />
                                  {errors.remarks && (
                                    <p className="text-sm text-destructive mt-1">{errors.remarks.message}</p>
                                  )}
                                </Field>
                              </FieldGroup>
                            </FieldSet>

                            {/* Flight Details */}
                            <FieldSet>
                              <FieldLegend>Flight Details</FieldLegend>
                            
                              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                                <Field data-invalid={!!errors.route}>
                                  <FieldLabel htmlFor="route" className="flex items-center gap-2">
                                    <IconRoute className="h-4 w-4 text-foreground" />
                                    Route
                                  </FieldLabel>
                                  <Input
                                    id="route"
                                    {...register("route")}
                                    className={`${
                                      isMobile 
                                        ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm" 
                                        : "border-border/50 bg-background"
                                    }`}
                                    placeholder="e.g., YMMB - YMMB"
                                    aria-invalid={!!errors.route}
                                  />
                                  <FieldError errors={errors.route ? [{ message: errors.route.message }] : undefined} />
                                </Field>

                                <Field data-invalid={!!errors.fuel_on_board}>
                                  <FieldLabel htmlFor="fuel_on_board" className="flex items-center gap-2">
                                    <IconGasStation className="h-4 w-4 text-foreground" />
                                    Fuel on Board (L)
                                  </FieldLabel>
                                  <Input
                                    id="fuel_on_board"
                                    type="number"
                                    step="1"
                                    {...register("fuel_on_board", { valueAsNumber: true })}
                                    className={`${
                                      isMobile 
                                        ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm" 
                                        : "border-border/50 bg-background"
                                    }`}
                                    placeholder="0"
                                    aria-invalid={!!errors.fuel_on_board}
                                  />
                                  <FieldError errors={errors.fuel_on_board ? [{ message: errors.fuel_on_board.message }] : undefined} />
                                </Field>

                                <Field data-invalid={!!errors.passengers}>
                                  <FieldLabel htmlFor="passengers">Passengers</FieldLabel>
                                  <Input
                                    id="passengers"
                                    {...register("passengers")}
                                    className={`${
                                      isMobile 
                                        ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm" 
                                        : "border-border/50 bg-background"
                                    }`}
                                    placeholder="Names of passengers"
                                    aria-invalid={!!errors.passengers}
                                  />
                                  <FieldError errors={errors.passengers ? [{ message: errors.passengers.message }] : undefined} />
                                </Field>

                                <Field data-invalid={!!errors.eta}>
                                  <FieldLabel htmlFor="eta">ETA (Estimated Time of Arrival)</FieldLabel>
                                 
                                  <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                      <Popover open={openEtaDate} onOpenChange={setOpenEtaDate}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            id="eta"
                                            variant="outline"
                                            className={`w-full justify-between font-normal h-10 ${
                                              isMobile 
                                                ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                                : "border-border/50 bg-background hover:bg-accent/50"
                                            }`}
                                            aria-invalid={!!errors.eta}
                                          >
                                            {etaDate
                                              ? etaDate.toLocaleDateString("en-US", {
                                                  day: "2-digit",
                                                  month: "short",
                                                  year: "numeric",
                                                })
                                              : "Select date"}
                                            <ChevronDownIcon className="h-4 w-4" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={etaDate}
                                            captionLayout="dropdown"
                                            onSelect={(date) => {
                                              setEtaDate(date)
                                              setOpenEtaDate(false)
                                            }}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                    <div className="w-32">
                                      <Select
                                        value={etaTime || "none"}
                                        onValueChange={(value) => setEtaTime(value === "none" ? "" : value)}
                                      >
                                        <SelectTrigger className={`w-full h-10 ${
                                          isMobile 
                                            ? "border border-slate-300/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm" 
                                            : "border-border/50 bg-background hover:bg-accent/50"
                                        }`}>
                                          <SelectValue placeholder="Time">
                                            {etaTime ? formatTimeForDisplay(etaTime) : "Time"}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                          <SelectItem value="none">Select time</SelectItem>
                                          {TIME_OPTIONS.map((time) => (
                                            <SelectItem key={time} value={time}>
                                              {formatTimeForDisplay(time)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <FieldError errors={errors.eta ? [{ message: errors.eta.message }] : undefined} />
                                </Field>
                              </FieldGroup>
                            </FieldSet>

                            {/* Checklists */}
                            <FieldSet className={`p-6 rounded-xl w-full max-w-full box-border ${
                              isMobile 
                                ? "bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/50 shadow-sm" 
                                : "bg-muted/30 border border-border/30"
                            }`}>
                              <div className="mb-3 flex items-center gap-2 w-full">
                                <IconFileText className="h-4 w-4 shrink-0" />
                                <FieldLegend className="text-base font-medium break-words">Checklists</FieldLegend>
                              </div>
                              <FieldDescription>
                                Confirm completion of required checklists before flight.
                              </FieldDescription>
                              <FieldGroup className="mt-4">
                                <Field orientation="horizontal">
                                  <Checkbox
                                    id="briefing_completed"
                                    checked={watch("briefing_completed") ?? false}
                                    onCheckedChange={(checked) => setValue("briefing_completed", checked === true, { shouldDirty: true })}
                                  />
                                  <FieldContent>
                                    <FieldLabel htmlFor="briefing_completed">Briefing Completed</FieldLabel>
                                  </FieldContent>
                                </Field>
                                <Field orientation="horizontal">
                                  <Checkbox
                                    id="authorization_completed"
                                    checked={watch("authorization_completed") ?? false}
                                    onCheckedChange={(checked) => setValue("authorization_completed", checked === true, { shouldDirty: true })}
                                  />
                                  <FieldContent>
                                    <FieldLabel htmlFor="authorization_completed">Authorization Completed</FieldLabel>
                                  </FieldContent>
                                </Field>
                              </FieldGroup>
                            </FieldSet>

                            {/* Flight Remarks */}
                            <Field data-invalid={!!errors.flight_remarks}>
                              <FieldLabel htmlFor="flight_remarks">Flight Remarks</FieldLabel>
                              <FieldDescription>
                                Any additional notes or remarks about this flight.
                              </FieldDescription>
                              <Textarea
                                id="flight_remarks"
                                {...register("flight_remarks")}
                                placeholder="Enter any flight remarks or notes"
                                className="min-h-[100px] border-border/50 bg-background focus-visible:ring-primary/20"
                                aria-invalid={!!errors.flight_remarks}
                              />
                              <FieldError errors={errors.flight_remarks ? [{ message: errors.flight_remarks.message }] : undefined} />
                            </Field>

                            {/* Submit Button */}
                            <div className={`flex items-center gap-3 pt-4 border-t ${
                              isMobile 
                                ? "flex-col border-slate-200/60 dark:border-slate-800/50" 
                                : "justify-end border-border/30"
                            }`}>
                              <Button
                                type="submit"
                                size="lg"
                                disabled={checkoutMutation.isPending}
                                className={`bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all h-11 ${
                                  isMobile ? "w-full px-8" : "px-8"
                                }`}
                              >
                                <IconPlane className="h-5 w-5 mr-2" />
                                {checkoutMutation.isPending ? "Checking Out..." : "Check Out"}
                              </Button>
                            </div>
                          </FieldGroup>
                        </FieldSet>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Summary */}
                <div className="space-y-6">
                  <Card className={`bg-card ${
                    isMobile 
                      ? "border border-slate-200/60 dark:border-slate-800/60 shadow-sm" 
                      : "shadow-sm border border-border/50"
                  }`}>
                    <CardHeader className={`pb-5 border-b ${
                      isMobile 
                        ? "border-slate-200/60 dark:border-slate-800/50" 
                        : "border-border/20"
                    }`}>
                      <CardTitle className={`text-xl font-bold ${
                        isMobile ? "text-slate-900 dark:text-white" : "text-foreground"
                      }`}>
                        Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      {/* People Section */}
                      <div className={`rounded-lg p-4 space-y-3 text-sm ${
                        isMobile 
                          ? "bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/50 shadow-sm" 
                          : "bg-muted/30 border border-border/30"
                      }`}>
                        <div>
                          <span className="text-muted-foreground">Member:</span>
                          <div className="font-semibold text-foreground">{studentName}</div>
                          {booking.student?.email && (
                            <div className="text-xs text-muted-foreground mt-0.5">{booking.student.email}</div>
                          )}
                        </div>
                        {instructorName !== "—" && (
                          <div>
                            <span className="text-muted-foreground">Instructor:</span>
                            <div className="font-semibold text-foreground">{instructorName}</div>
                            {booking.instructor?.user?.email && (
                              <div className="text-xs text-muted-foreground mt-0.5">{booking.instructor.user.email}</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Flight Details Section */}
                      <div className={`rounded-lg p-4 space-y-3 text-sm ${
                        isMobile 
                          ? "bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/50 shadow-sm" 
                          : "bg-muted/30 border border-border/30"
                      }`}>
                        {booking.aircraft && (
                          <div>
                            <span className="text-muted-foreground">Aircraft:</span>
                            <div className="font-semibold text-foreground">{booking.aircraft.registration}</div>
                          </div>
                        )}
                        {booking.start_time && (
                          <div>
                            <span className="text-muted-foreground">Start:</span>
                            <div className="font-semibold text-foreground">
                              {new Date(booking.start_time).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </div>
                          </div>
                        )}
                        {booking.end_time && (
                          <div>
                            <span className="text-muted-foreground">End:</span>
                            <div className="font-semibold text-foreground">
                              {new Date(booking.end_time).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </div>
                          </div>
                        )}
                        {booking.purpose && (
                          <div>
                            <span className="text-muted-foreground">Description:</span>
                            <div className="font-semibold text-foreground mt-0.5">{booking.purpose}</div>
                          </div>
                        )}
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
    
    {/* Sticky Bottom Bar for Mobile - Save Changes - Outside SidebarProvider for proper positioning */}
    {isMobile && hasChanges && (
      <div 
        className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl"
        role="banner"
        aria-label="Save changes"
      >
        <div className="px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="default"
              onClick={handleUndo}
              disabled={checkoutMutation.isPending}
              className="flex-1 h-11 border border-slate-300/60 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm"
            >
              <IconRotateClockwise className="h-4 w-4 mr-2" />
              Undo Changes
            </Button>
            <Button
              size="default"
              onClick={handleFormSubmit}
              disabled={checkoutMutation.isPending}
              className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all"
            >
              <IconDeviceFloppy className="h-4 w-4 mr-2" />
              {checkoutMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
