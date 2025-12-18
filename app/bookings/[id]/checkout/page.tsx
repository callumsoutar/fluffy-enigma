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
import { Badge } from "@/components/ui/badge"
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
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { BookingWithRelations } from "@/lib/types/bookings"
import { bookingUpdateSchema } from "@/lib/validation/bookings"
import { z } from "zod"

type FlightLogFormData = z.infer<typeof bookingUpdateSchema>
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
  } = useForm<FlightLogFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(bookingUpdateSchema) as any, // Type inference issue with zodResolver and complex Zod schemas
    mode: 'onChange', // Track changes as user types/interacts
    defaultValues: {},
  })

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
      // Include the selected lesson_id in the query if it exists
      const url = selectedLessonId 
        ? `/api/bookings/options?lesson_id=${selectedLessonId}`
        : `/api/bookings/options`
      return fetchJson<BookingOptions>(url)
    },
    staleTime: 15 * 60_000,
  })

  const options = optionsQuery.data ?? null

  // Get selected aircraft ID from form
  const selectedAircraftId = watch("checked_out_aircraft_id") || booking?.checked_out_aircraft_id || booking?.aircraft_id

  // Fetch selected aircraft details to get current meter readings
  const aircraftQuery = useQuery({
    queryKey: ["aircraft", selectedAircraftId],
    queryFn: () => fetchJson<{ aircraft: { id: string; registration: string; current_tach: number; current_hobbs: number } }>(`/api/aircraft/${selectedAircraftId}`),
    enabled: !!selectedAircraftId,
    staleTime: 30_000,
  })

  const selectedAircraft = aircraftQuery.data?.aircraft ?? null

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

  // One-time sync flags: first sync should NOT mark the form dirty.
  const didSyncActualStartRef = React.useRef(false)
  const didSyncActualEndRef = React.useRef(false)
  const didSyncEtaRef = React.useRef(false)

  // Some date defaults are applied programmatically (not user intent) — suppress dirty once.
  const suppressNextActualEndDirtyRef = React.useRef(false)

  // Match booking detail page behavior: banner strictly follows RHF dirty state.
  const hasChanges = isDirty
  


  // Track initialization key to reload form when booking changes
  const lastInitializedKey = React.useRef<string | null>(null)
  
  // Populate form when booking loads
  React.useEffect(() => {
    if (!booking) return
    
    // Create a unique key for this booking
    const initializationKey = bookingId
    
    // Check if we've already initialized for this booking
    if (lastInitializedKey.current === initializationKey) {
      return // Already initialized for this booking
    }
    
    // Mark that we're initializing - do this FIRST before any state changes
    isInitializingRef.current = true
    lastInitializedKey.current = initializationKey
    // Reset one-time sync flags for this initialization cycle
    didSyncActualStartRef.current = false
    didSyncActualEndRef.current = false
    didSyncEtaRef.current = false
    suppressNextActualEndDirtyRef.current = false
    
    // Calculate date/time values first (use booking fields directly)
    const actualStart = booking.actual_start 
      ? parseDateTime(booking.actual_start)
      : parseDateTime(booking.start_time)
    
    const actualEnd = booking.actual_end 
      ? parseDateTime(booking.actual_end)
      : booking.end_time
        ? parseDateTime(booking.end_time)
        : { date: undefined, time: "" }
    
    const eta = booking.eta 
      ? parseDateTime(booking.eta)
      : parseDateTime(booking.end_time)

    // Reset form with initial values - normalize date strings to ensure they're in the correct format
    const initialValues = {
      checked_out_aircraft_id: booking.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: booking.checked_out_instructor_id || booking.instructor_id || null,
      actual_start: normalizeDateString(booking.actual_start || booking.start_time || null),
      actual_end: normalizeDateString(booking.actual_end || null),
      eta: normalizeDateString(booking.eta || booking.end_time || null),
      fuel_on_board: booking.fuel_on_board || null,
      passengers: booking.passengers || null,
      route: booking.route || null,
      briefing_completed: booking.briefing_completed ?? false,
      authorization_completed: booking.authorization_completed ?? false,
      flight_remarks: booking.flight_remarks || null,
      // Flight log fields (now in bookings table)
      flight_type_id: booking.flight_type_id || null,
      lesson_id: booking.lesson_id || null,
      remarks: booking.remarks || null,
      // Booking fields
      purpose: booking.purpose || "",
    }
    
    // Reset form to establish defaults (this clears dirty state)
    // IMPORTANT: do NOT keepDefaultValues, otherwise RHF compares against stale defaults and marks dirty.
    reset(initialValues, { keepDirty: false })
    
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
  }, [booking, bookingId, reset])

  // Auto-set end date to start date if end date is not set (only after initialization)
  // Don't run during initialization or undo operations
  React.useEffect(() => {
    if (isInitializingRef.current) return // Don't auto-set during initialization or undo
    if (!isInitialized) return // Wait for initialization
    if (!actualStartDate) return // Need a start date
    if (actualEndDate) return // Already has an end date
    if (booking?.actual_end) return // Don't override if booking already has actual_end
    
    // Only auto-set if we don't have booking.end_time to use
    if (booking?.end_time) return // Use booking.end_time instead

    // This is a programmatic default, not a user edit
    suppressNextActualEndDirtyRef.current = true
    setActualEndDate(actualStartDate)
  }, [isInitialized, actualStartDate, actualEndDate, booking?.end_time, booking?.actual_end])

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
      const shouldDirty = didSyncActualStartRef.current
      setValue("actual_start", newValue, { shouldDirty, shouldTouch: shouldDirty })
    }

    // After the first eligible run, future changes should be considered user edits.
    didSyncActualStartRef.current = true
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
      const shouldDirty =
        didSyncActualEndRef.current && !suppressNextActualEndDirtyRef.current
      setValue("actual_end", newValue, { shouldDirty, shouldTouch: shouldDirty })
    }

    // Clear one-time suppression (if it was set)
    suppressNextActualEndDirtyRef.current = false
    didSyncActualEndRef.current = true
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
      const shouldDirty = didSyncEtaRef.current
      setValue("eta", newValue, { shouldDirty, shouldTouch: shouldDirty })
    }

    didSyncEtaRef.current = true
  }, [etaDate, etaTime, setValue, isInitialized, watch])

  const checkoutMutation = useMutation({
    mutationFn: async (data: FlightLogFormData) => {
      // Clean date fields - ensure empty strings become null and validate format
      // Use the same normalizeDateString function for consistency
      const cleanDateField = normalizeDateString
      
      // Set actual_end to booking's end_time if not already set
      // This ensures the booking has an end time when submitted, using the scheduled end time
      let actualEndValue = data.actual_end
      if (!actualEndValue || actualEndValue === null || actualEndValue === '') {
        // If actual_end is not set, use the booking's end_time
        if (booking?.end_time) {
          actualEndValue = booking.end_time
        } else {
          // Fallback to current time only if booking has no end_time
          actualEndValue = new Date().toISOString()
        }
      }
      
      // Get the selected aircraft ID (from form or booking)
      const checkedOutAircraftId = data.checked_out_aircraft_id || booking?.checked_out_aircraft_id || booking?.aircraft_id
      
      // Fetch aircraft to get current meter readings if not already fetched
      let aircraftCurrentTach: number | null = null
      let aircraftCurrentHobbs: number | null = null
      
      if (checkedOutAircraftId) {
        try {
          const aircraftData = await fetchJson<{ aircraft: { current_tach: number; current_hobbs: number } }>(`/api/aircraft/${checkedOutAircraftId}`)
          aircraftCurrentTach = aircraftData.aircraft.current_tach
          aircraftCurrentHobbs = aircraftData.aircraft.current_hobbs
        } catch (err) {
          console.error('Failed to fetch aircraft meter readings:', err)
        }
      }
      
      // Prepare booking update with all flight log fields
      const bookingUpdate: Record<string, unknown> = {
        // Booking fields
        ...(data.purpose !== undefined && { purpose: data.purpose }),
        // Set booking status to 'flying' when checking out
        status: 'flying',
        // Flight log fields (now part of bookings table)
        ...(data.checked_out_aircraft_id !== undefined && { checked_out_aircraft_id: data.checked_out_aircraft_id }),
        ...(data.checked_out_instructor_id !== undefined && { checked_out_instructor_id: data.checked_out_instructor_id }),
        actual_start: cleanDateField(data.actual_start),
        actual_end: cleanDateField(actualEndValue),
        ...(data.eta !== undefined && { eta: cleanDateField(data.eta) }),
        // Set tach_start and hobbs_start from aircraft's current values if not already set in form
        // Always set these values when checking out if aircraft is selected
        hobbs_start: data.hobbs_start !== undefined ? data.hobbs_start : (aircraftCurrentHobbs !== null ? aircraftCurrentHobbs : booking?.hobbs_start ?? null),
        ...(data.hobbs_end !== undefined && { hobbs_end: data.hobbs_end }),
        tach_start: data.tach_start !== undefined ? data.tach_start : (aircraftCurrentTach !== null ? aircraftCurrentTach : booking?.tach_start ?? null),
        ...(data.tach_end !== undefined && { tach_end: data.tach_end }),
        ...(data.flight_time_hobbs !== undefined && { flight_time_hobbs: data.flight_time_hobbs }),
        ...(data.flight_time_tach !== undefined && { flight_time_tach: data.flight_time_tach }),
        ...(data.flight_time !== undefined && { flight_time: data.flight_time }),
        ...(data.fuel_on_board !== undefined && { fuel_on_board: data.fuel_on_board }),
        ...(data.passengers !== undefined && { passengers: data.passengers }),
        ...(data.route !== undefined && { route: data.route }),
        ...(data.equipment !== undefined && { equipment: data.equipment }),
        ...(data.briefing_completed !== undefined && { briefing_completed: data.briefing_completed }),
        ...(data.authorization_completed !== undefined && { authorization_completed: data.authorization_completed }),
        ...(data.flight_remarks !== undefined && { flight_remarks: data.flight_remarks }),
        ...(data.solo_end_hobbs !== undefined && { solo_end_hobbs: data.solo_end_hobbs }),
        ...(data.dual_time !== undefined && { dual_time: data.dual_time }),
        ...(data.solo_time !== undefined && { solo_time: data.solo_time }),
        ...(data.total_hours_start !== undefined && { total_hours_start: data.total_hours_start }),
        ...(data.total_hours_end !== undefined && { total_hours_end: data.total_hours_end }),
        ...(data.flight_type_id !== undefined && { flight_type_id: data.flight_type_id }),
        ...(data.lesson_id !== undefined && { lesson_id: data.lesson_id }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
      }
      
      // Update booking directly (includes all flight log fields)
      const bookingResult = await fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingUpdate),
      })
      
      // Update aircraft current_tach and current_hobbs from booking's tach_start and hobbs_start
      // Use the updated booking values (from bookingResult) since they reflect what was just saved
      const updatedCheckedOutAircraftId = bookingResult.booking.checked_out_aircraft_id || bookingResult.booking.aircraft_id
      
      if (updatedCheckedOutAircraftId) {
        const aircraftUpdate: Record<string, unknown> = {}
        
        // Set current_tach from booking's tach_start (use updated booking value)
        // This ensures the aircraft's current_tach matches the booking's start tach
        const tachStartValue = bookingResult.booking.tach_start
        if (tachStartValue !== undefined && tachStartValue !== null) {
          aircraftUpdate.current_tach = tachStartValue
        }
        
        // Set current_hobbs from booking's hobbs_start (use updated booking value)
        // This ensures the aircraft's current_hobbs matches the booking's start hobbs
        const hobbsStartValue = bookingResult.booking.hobbs_start
        if (hobbsStartValue !== undefined && hobbsStartValue !== null) {
          aircraftUpdate.current_hobbs = hobbsStartValue
        }
        
        // Update aircraft if we have at least one value to update
        if (Object.keys(aircraftUpdate).length > 0) {
          try {
            await fetchJson(`/api/aircraft/${updatedCheckedOutAircraftId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(aircraftUpdate),
            })
          } catch (aircraftError) {
            // Log error but don't fail the checkout - aircraft update is secondary
            console.error('Failed to update aircraft meter readings:', aircraftError)
            // Still show success for booking update
          }
        } else {
          // Log if we couldn't update because values weren't available
          console.warn('Could not update aircraft meter readings: booking tach_start or hobbs_start not available', {
            tachStartValue,
            hobbsStartValue,
            bookingId: bookingResult.booking.id,
            bookingUpdate: bookingUpdate
          })
        }
      }
      
      return bookingResult
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
      await queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Booking updated successfully")
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
    const actualStart = booking.actual_start 
      ? parseDateTime(booking.actual_start)
      : parseDateTime(booking.start_time)
    
    // Match the initialization logic: use booking.end_time if no actual_end
    const actualEnd = booking.actual_end 
      ? parseDateTime(booking.actual_end)
      : booking.end_time
        ? parseDateTime(booking.end_time)
        : { date: undefined, time: "" }
    
    const eta = booking.eta 
      ? parseDateTime(booking.eta)
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
      checked_out_aircraft_id: booking.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: booking.checked_out_instructor_id || booking.instructor_id || null,
      actual_start: normalizeDateString(booking.actual_start || booking.start_time || null),
      actual_end: normalizeDateString(booking.actual_end || null),
      eta: normalizeDateString(booking.eta || booking.end_time || null),
      fuel_on_board: booking.fuel_on_board || null,
      passengers: booking.passengers || null,
      route: booking.route || null,
      briefing_completed: booking.briefing_completed ?? false,
      authorization_completed: booking.authorization_completed ?? false,
      flight_remarks: booking.flight_remarks || null,
      // Flight log fields (now in bookings table)
      flight_type_id: booking.flight_type_id || null,
      lesson_id: booking.lesson_id || null,
      remarks: booking.remarks || null,
      // Booking fields
      purpose: booking.purpose || "",
    }
    
    // IMPORTANT: do NOT keepDefaultValues, otherwise RHF compares against stale defaults and marks dirty.
    reset(originalValues, { keepDirty: false })
    
    // Clear the initialization flag after a brief delay
    setTimeout(() => {
      isInitializingRef.current = false
    }, 100)
    
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
                  <div className="flex items-center justify-between gap-4">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-foreground">
                      Flight Checkout
                    </h1>
                    <Badge 
                      className="bg-purple-600 text-white border-purple-700 hover:bg-purple-700 px-4 py-2 text-base font-semibold shadow-lg"
                      variant="default"
                      style={{
                        animation: 'subtle-pulse 3s ease-in-out infinite'
                      }}
                    >
                      <IconPlane className="h-5 w-5" />
                      Flying
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 ${
              isMobile ? "pt-8 pb-24" : "pt-10 pb-28"
            }`}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Left Column: Flight Log Form */}
                <div className="lg:col-span-2 space-y-6 lg:space-y-8">
                  {/* Flight Log Form */}
                  <Card className="bg-card shadow-md border border-border/50 rounded-xl">
                    <CardHeader className="pb-6 border-b border-border/20">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
                        <IconPlane className="h-6 w-6 text-foreground" />
                        Flight Log Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <p className="text-sm text-muted-foreground mb-4">
                        Please fill out all the details for this flight, including actual flight times, meter readings, and any other relevant information. All fields marked with required indicators must be completed before checking out.
                      </p>
                      <form onSubmit={handleFormSubmit}>
                        <FieldSet className="w-full max-w-full">
                          <FieldGroup className="w-full max-w-full">
                            {/* Actual Flight Times */}
                            <FieldSet className="p-6 rounded-xl w-full max-w-full box-border bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
                              
                            
                              <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <Field data-invalid={!!errors.actual_start}>
                                  <FieldLabel htmlFor="actual_start">Booking Start</FieldLabel>
                                  <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                      <Popover open={openActualStartDate} onOpenChange={setOpenActualStartDate}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            id="actual_start"
                                            variant="outline"
                                            className="w-full justify-between font-normal h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
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
                                        <SelectTrigger className="w-full h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
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
                                            className="w-full justify-between font-normal h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
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
                                        <SelectTrigger className="w-full h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
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
                              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field>
                                  <FieldLabel htmlFor="checked_out_aircraft_id" className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <IconPlane className="h-4 w-4 text-primary" />
                                    Aircraft
                                    {selectedAircraft && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className="inline-flex items-center justify-center rounded-full hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                                            aria-label="Aircraft meter readings"
                                          >
                                            <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="space-y-1">
                                            <p className="font-semibold text-xs mb-1">Aircraft Meter Readings</p>
                                            <p className="text-xs">Will be used as start values:</p>
                                            <div className="flex gap-4 text-xs mt-1">
                                              <span>
                                                <span className="font-semibold">Tach:</span> {selectedAircraft.current_tach?.toFixed(1) ?? '—'}
                                              </span>
                                              <span>
                                                <span className="font-semibold">Hobbs:</span> {selectedAircraft.current_hobbs?.toFixed(1) ?? '—'}
                                              </span>
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </FieldLabel>
                                  {options ? (
                                    <Select
                                      value={watch("checked_out_aircraft_id") || "none"}
                                      onValueChange={(value) => setValue("checked_out_aircraft_id", value === "none" ? null : value, { shouldDirty: true })}
                                    >
                                      <SelectTrigger id="checked_out_aircraft_id" className="w-full transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
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
                                    <div className="px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/50 text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                      <SelectTrigger id="checked_out_instructor_id" className="w-full transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
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
                                    <div className="px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/50 text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                      <SelectTrigger id="flight_type_id" className="w-full transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800" aria-invalid={!!errors.flight_type_id}>
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
                                    <div className="px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/50 text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                      <SelectTrigger id="lesson_id" className="w-full transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800" aria-invalid={!!errors.lesson_id}>
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
                                    <div className="px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/50 text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                    className="min-h-[100px] border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus-visible:ring-primary/20"
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
                            
                              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <Field data-invalid={!!errors.route}>
                                  <FieldLabel htmlFor="route" className="flex items-center gap-2">
                                    <IconRoute className="h-4 w-4 text-foreground" />
                                    Route
                                  </FieldLabel>
                                  <Input
                                    id="route"
                                    {...register("route")}
                                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
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
                                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
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
                                    className="border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
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
                                            className="w-full justify-between font-normal h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
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
                                        <SelectTrigger className="w-full h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
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
                            <FieldSet className="p-6 rounded-xl w-full max-w-full box-border bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
                              <div className="flex items-center gap-2 w-full">
                                <IconFileText className="h-4 w-4 shrink-0" />
                                <FieldLegend className="text-base font-medium break-words">Checklists</FieldLegend>
                              </div>
                              <FieldGroup className="mt-2">
                                <Field orientation="horizontal">
                                  <Switch
                                    id="briefing_completed"
                                    checked={watch("briefing_completed") ?? false}
                                    onCheckedChange={(checked) => setValue("briefing_completed", checked, { shouldDirty: true })}
                                  />
                                  <FieldContent>
                                    <FieldLabel htmlFor="briefing_completed">Briefing Completed</FieldLabel>
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
                                className="min-h-[100px] border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus-visible:ring-primary/20"
                                aria-invalid={!!errors.flight_remarks}
                              />
                              <FieldError errors={errors.flight_remarks ? [{ message: errors.flight_remarks.message }] : undefined} />
                            </Field>
                          </FieldGroup>
                        </FieldSet>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Summary */}
                <div className="space-y-6 lg:space-y-8">
                  <Card className="bg-card shadow-md border border-border/50 rounded-xl">
                    <CardHeader className="pb-5 border-b border-border/20">
                      <CardTitle className="text-xl font-bold text-foreground">
                        Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      {/* People Section */}
                      <div className="rounded-xl p-5 space-y-4 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Member:</span>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{studentName}</div>
                          {booking.student?.email && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{booking.student.email}</div>
                          )}
                        </div>
                        {instructorName !== "—" && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Instructor:</span>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{instructorName}</div>
                            {booking.instructor?.user?.email && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{booking.instructor.user.email}</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Flight Details Section */}
                      <div className="rounded-xl p-5 space-y-4 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
                        {booking.aircraft && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Aircraft:</span>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{booking.aircraft.registration}</div>
                          </div>
                        )}
                        {booking.start_time && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Start:</span>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
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
                            <span className="text-gray-600 dark:text-gray-400">End:</span>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
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
                            <span className="text-gray-600 dark:text-gray-400">Description:</span>
                            <div className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{booking.purpose}</div>
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
    
    {/* Sticky Bottom Bar - Save Changes & Check Out */}
    <div 
      className="fixed border-t shadow-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
      role="banner"
      aria-label="Save changes and checkout"
      style={{ 
        position: 'fixed',
        bottom: 0,
        // On mobile: full width, on desktop: start after sidebar (adjusts dynamically)
        left: isMobile ? 0 : `${sidebarLeft}px`,
        right: 0,
        zIndex: 99999, // Very high z-index to ensure it's on top
        minHeight: '60px',
        // Ensure it's visible on mobile with safe area support
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        // Use CSS custom property for better mobile support
        transform: 'translateZ(0)', // Force hardware acceleration
        WebkitTransform: 'translateZ(0)',
        // Ensure it's not hidden
        visibility: 'visible',
        opacity: 1,
        display: 'block',
      }}
    >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-end gap-4">
            {hasChanges && (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleUndo}
                  disabled={checkoutMutation.isPending}
                  className={`h-12 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"}`}
                >
                  <IconRotateClockwise className="h-4 w-4 mr-2" />
                  Undo Changes
                </Button>
                <Button
                  size="lg"
                  onClick={handleFormSubmit}
                  disabled={checkoutMutation.isPending}
                  className={`h-12 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all ${isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"}`}
                >
                  <IconDeviceFloppy className="h-4 w-4 mr-2" />
                  {checkoutMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
            {/* Only show Check Out button if booking status is 'confirmed' */}
            {booking?.status === 'confirmed' && (
              <Button
                size="lg"
                onClick={handleFormSubmit}
                disabled={checkoutMutation.isPending}
                className={`h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all ${isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"}`}
              >
                <IconPlane className="h-4 w-4 mr-2" />
                {checkoutMutation.isPending ? "Checking Out..." : "Check Out"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
