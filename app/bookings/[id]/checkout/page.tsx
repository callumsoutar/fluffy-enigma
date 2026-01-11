"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconClock,
  IconPlane,
  IconSchool,
  IconFileText,
  IconDeviceFloppy,
  IconRotateClockwise,
  IconInfoCircle,
  IconRoute,
  IconGasStation,
  IconCheck,
  IconChevronDown,
} from "@tabler/icons-react"
import { toast } from "sonner"
import Link from "next/link"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { BookingHeader } from "@/components/bookings/booking-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
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
import { CheckoutWarnings } from "@/components/bookings/checkout-warnings"
import { CheckoutObservations } from "@/components/bookings/checkout-observations"
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
      // Surface validation details when present (Zod issues from API routes)
      if (Array.isArray(data?.details) && data.details.length > 0) {
        const first = data.details[0]
        const path = Array.isArray(first?.path) ? first.path.join(".") : undefined
        const issue = typeof first?.message === "string" ? first.message : undefined
        if (issue) message = path ? `${message}: ${path} — ${issue}` : `${message}: ${issue}`
      }
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
  flightTypes: Array<{ id: string; name: string; instruction_type: 'trial' | 'dual' | 'solo' | null }>
  lessons: Array<{ id: string; name: string; description: string | null }>
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "Request failed"
}

export default function BookingCheckoutPage() {
  const params = useParams()
  const router = useRouter()
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
  const selectedInstructorId = watch("checked_out_instructor_id") || booking?.checked_out_instructor_id || booking?.instructor_id

  // Fetch selected aircraft details to get current meter readings and fuel consumption
  const aircraftQuery = useQuery({
    queryKey: ["aircraft", selectedAircraftId],
    queryFn: () => fetchJson<{ 
      aircraft: { 
        id: string; 
        registration: string; 
        current_tach: number; 
        current_hobbs: number;
        fuel_consumption: number | null;
      } 
    }>(`/api/aircraft/${selectedAircraftId}`),
    enabled: !!selectedAircraftId,
    staleTime: 30_000,
  })

  const selectedAircraft = aircraftQuery.data?.aircraft ?? null

  const fuelOnBoard = watch("fuel_on_board")
  const fuelConsumption = selectedAircraft?.fuel_consumption

  const endurance = React.useMemo(() => {
    if (!fuelOnBoard || typeof fuelOnBoard !== "number" || isNaN(fuelOnBoard) || !fuelConsumption || fuelConsumption <= 0) return null
    const hours = fuelOnBoard / fuelConsumption
    return hours.toFixed(1)
  }, [fuelOnBoard, fuelConsumption])

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
  // Returns a canonical ISO-8601 instant string with timezone offset (via `toISOString()`), or undefined.
  const combineDateTime = (date: Date | undefined, time: string): string | undefined => {
    if (!date || !time || time.trim() === "") return undefined
    const [hours, minutes] = time.split(":")
    if (!hours || !minutes || hours.trim() === "" || minutes.trim() === "") return undefined
    
    // Validate hours and minutes are numbers
    const hourNum = parseInt(hours, 10)
    const minuteNum = parseInt(minutes, 10)
    if (isNaN(hourNum) || isNaN(minuteNum)) return undefined
    if (hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) return undefined

    // Interpret the picked date+time in the user's local timezone, then store as a UTC instant.
    const local = new Date(date)
    local.setHours(hourNum, minuteNum, 0, 0)
    return local.toISOString()
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
  const [isCheckingOut, setIsCheckingOut] = React.useState(false)
  
  // When default values are async, avoid showing "dirty" UI before `reset()` runs.
  const [isFormReady, setIsFormReady] = React.useState(false)

  // Match booking detail page behavior: banner strictly follows RHF dirty state.
  const hasChanges = isFormReady && isDirty
  


  // Populate form when booking loads
  React.useEffect(() => {
    if (!booking) return

    // Never overwrite unsaved edits on background refetches.
    if (isDirty) return

    setIsFormReady(false)
    
    // Calculate date/time values first (use booking fields directly)
    const actualStart = parseDateTime(booking.start_time)
    
    const actualEnd = booking.end_time
      ? parseDateTime(booking.end_time)
      : { date: undefined, time: "" }
    
    const eta = booking.eta 
      ? parseDateTime(booking.eta)
      : parseDateTime(booking.end_time)

    // Reset form with initial values - normalize date strings to ensure they're in the correct format
    const initialValues = {
      checked_out_aircraft_id: booking.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: booking.checked_out_instructor_id || booking.instructor_id || null,
      start_time: normalizeDateString(booking.start_time || null) ?? undefined,
      end_time: normalizeDateString(booking.end_time || null) ?? undefined,
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

    // Keep local pickers in sync with the saved booking values (display-only).
    setActualStartDate(actualStart.date)
    setActualStartTime(actualStart.time)
    setActualEndDate(actualEnd.date)
    setActualEndTime(actualEnd.time)
    setEtaDate(eta.date)
    setEtaTime(eta.time)

    setIsFormReady(true)
  }, [booking, bookingId, reset, isDirty])

  const checkoutMutation = useMutation({
    mutationFn: async (data: FlightLogFormData) => {
      // Clean date fields - ensure empty strings become null and validate format
      // Use the same normalizeDateString function for consistency
      const cleanDateField = normalizeDateString
      
      // Ensure end_time is set (fallback to scheduled end_time, then "now" as last resort)
      let endTimeValue = data.end_time
      if (!endTimeValue || endTimeValue === null || endTimeValue === '') {
        if (booking?.end_time) {
          endTimeValue = booking.end_time
        } else {
          endTimeValue = new Date().toISOString()
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
        ...(data.start_time !== undefined && { start_time: cleanDateField(data.start_time) }),
        ...(data.end_time !== undefined && { end_time: cleanDateField(endTimeValue) }),
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
    onSuccess: async (result) => {
      // Simulate a delay for the loading screen (minimum 2 seconds for UX)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
      await queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success("Flight checked out successfully!")

      // Immediately align RHF defaults to what we just saved so the sticky bar does not appear
      // until the user makes another edit.
      if (result?.booking) {
        const savedBooking = result.booking

        setIsFormReady(false)

        const actualStart = parseDateTime(savedBooking.start_time)
        const actualEnd = savedBooking.end_time
          ? parseDateTime(savedBooking.end_time)
          : { date: undefined, time: "" }
        const eta = savedBooking.eta
          ? parseDateTime(savedBooking.eta)
          : parseDateTime(savedBooking.end_time)

        reset(
          {
            checked_out_aircraft_id:
              savedBooking.checked_out_aircraft_id || savedBooking.aircraft_id || null,
            checked_out_instructor_id:
              savedBooking.checked_out_instructor_id || savedBooking.instructor_id || null,
            start_time: normalizeDateString(savedBooking.start_time || null) ?? undefined,
            end_time: normalizeDateString(savedBooking.end_time || null) ?? undefined,
            eta: normalizeDateString(savedBooking.eta || savedBooking.end_time || null),
            fuel_on_board: savedBooking.fuel_on_board || null,
            passengers: savedBooking.passengers || null,
            route: savedBooking.route || null,
            briefing_completed: savedBooking.briefing_completed ?? false,
            authorization_completed: savedBooking.authorization_completed ?? false,
            flight_remarks: savedBooking.flight_remarks || null,
            flight_type_id: savedBooking.flight_type_id || null,
            lesson_id: savedBooking.lesson_id || null,
            remarks: savedBooking.remarks || null,
            purpose: savedBooking.purpose || "",
          },
          { keepDirty: false }
        )

        setActualStartDate(actualStart.date)
        setActualStartTime(actualStart.time)
        setActualEndDate(actualEnd.date)
        setActualEndTime(actualEnd.time)
        setEtaDate(eta.date)
        setEtaTime(eta.time)

        setIsFormReady(true)
      }
      
      // Refresh the page to reset form state and show updated booking
      router.refresh()
      
      // Clear checking out state
      setIsCheckingOut(false)
    },
    onError: (error) => {
      setIsCheckingOut(false)
      toast.error(getErrorMessage(error))
    },
  })

  const onSubmit = (data: FlightLogFormData) => {
    checkoutMutation.mutate(data)
  }
  
  // Create a properly typed submit handler
  const handleFormSubmit = handleSubmit(onSubmit)
  
  // Handle Check Out button click - always submits form
  const handleCheckOut = () => {
    setIsCheckingOut(true)
    handleFormSubmit()
  }

  const handleUndo = () => {
    if (!booking) return
    setIsFormReady(false)
    
    // Use the same logic as initialization to determine what the "original" values should be
    const actualStart = parseDateTime(booking.start_time)
    
    const actualEnd = booking.end_time
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
      start_time: normalizeDateString(booking.start_time || null) ?? undefined,
      end_time: normalizeDateString(booking.end_time || null) ?? undefined,
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

    setIsFormReady(true)
    toast.info('Changes reverted')
  }

  const handleCheckFlightIn = () => {
    if (!booking) return
    // Route to check-in page
    router.push(`/bookings/${bookingId}/checkin`)
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

  const bookingInstructorId = booking?.checked_out_instructor_id ?? booking?.instructor_id ?? null
  const bookingAircraftId = booking?.checked_out_aircraft_id ?? booking?.aircraft_id ?? null
  const bookingFlightTypeId = booking?.flight_type_id ?? null
  const bookingLessonId = booking?.lesson_id ?? null

  const bookingInstructorLabel = instructorName
  const bookingAircraftLabel = booking.aircraft
    ? `${booking.aircraft.registration} - ${booking.aircraft.manufacturer} ${booking.aircraft.type}`
    : "—"
  const bookingFlightTypeLabel = booking.flight_type?.name || "—"
  const bookingLessonLabel = booking.lesson?.name || "—"

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
            {booking && (
              <BookingHeader
                status={booking.status}
                title="Flight Checkout"
                backHref={`/bookings/${bookingId}`}
                backLabel="Back to Booking"
              />
            )}

            {/* Main Content */}
            {/* Calculate bottom padding based on sticky bar height on mobile:
                - When status is 'confirmed': only Check Out button shows (~140px)
                - When status is 'flying' with changes: 3 stacked buttons (~260px)
                - When status is 'flying' no changes: only Check In button shows (~140px)
                Add extra padding (40-60px) for comfortable scrolling */}
            <div className={`flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 ${
              isMobile 
                ? hasChanges && booking?.status === 'flying'
                  ? "pt-8 pb-[260px]" // 3 stacked buttons (Save/Undo/Check In): 208px + 52px extra
                  : (booking?.status === 'confirmed' || booking?.status === 'flying')
                    ? "pt-8 pb-[140px]" // 1 button (Check Out or Check In): 80px + 60px extra
                    : "pt-8 pb-24" // Fallback: no buttons or minimal
                : "pt-10 pb-28"
            }`}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Left Column: Flight Log Form */}
                <div className="lg:col-span-2 space-y-6 lg:space-y-8">
                  {/* Checkout Warnings */}
                  <CheckoutWarnings 
                    memberId={booking?.user_id ?? undefined}
                    instructorId={selectedInstructorId || undefined}
                    aircraftId={selectedAircraftId || undefined}
                  />
                  {/* Checkout Observations */}
                  <CheckoutObservations 
                    aircraftId={selectedAircraftId || undefined}
                  />
                  {/* Flight Log Form */}
                  <Card className="bg-card shadow-md border border-border/50 rounded-xl">
                    <CardHeader className="pb-6 border-b border-border/20">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
                        <IconPlane className="h-6 w-6 text-foreground" />
                        Flight Log Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <form onSubmit={handleFormSubmit}>
                        <FieldSet className="w-full max-w-full">
                          <FieldGroup className="w-full max-w-full">
                            {/* Collapsible Booking Information */}
                            <Collapsible defaultOpen={false} className="w-full">
                              <CollapsibleTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  className="flex w-full items-center justify-between py-4 px-2 h-auto hover:bg-muted/30 transition-all group rounded-xl gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <IconInfoCircle className="h-5 w-5 text-muted-foreground group-data-[state=open]:text-primary transition-colors flex-shrink-0" />
                                    <div className="flex flex-col items-start text-left min-w-0 flex-1">
                                      <span className="text-base font-bold text-foreground group-hover:text-primary transition-colors">Booking Information</span>
                                      <p className="text-xs text-muted-foreground leading-relaxed break-words">
                                        <span className="group-data-[state=open]:hidden">
                                          <span className="hidden sm:inline">Click to view or edit aircraft, instructor, lesson, and remarks</span>
                                          <span className="sm:hidden">Tap to view booking details</span>
                                        </span>
                                        <span className="hidden group-data-[state=open]:inline text-primary/80 font-medium italic">Showing full booking configuration</span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 pl-2 flex-shrink-0">
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground group-hover:text-primary transition-colors hidden sm:inline">
                                      <span className="group-data-[state=open]:hidden">Expand</span>
                                      <span className="hidden group-data-[state=open]:inline">Collapse</span>
                                    </span>
                                    <IconChevronDown className="h-6 w-6 sm:h-5 sm:w-5 text-muted-foreground transition-all duration-300 group-data-[state=open]:rotate-180 group-hover:text-primary flex-shrink-0" />
                                  </div>
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-6 px-2 pb-6 pt-2">
                                {/* Booking Times */}
                                <FieldSet className="w-full max-w-full">
                                  <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <Field data-invalid={!!errors.start_time}>
                                      <FieldLabel htmlFor="start_time">Booking Start</FieldLabel>
                                      <div className="flex gap-3 items-end">
                                        <div className="flex-1">
                                          <Popover open={openActualStartDate} onOpenChange={setOpenActualStartDate}>
                                            <PopoverTrigger asChild>
                                              <Button
                                                id="start_time"
                                                variant="outline"
                                                className="w-full justify-between font-normal h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                aria-invalid={!!errors.start_time}
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
                                                  const nextDate = date ?? undefined
                                                  setActualStartDate(nextDate)
                                                  setOpenActualStartDate(false)

                                                  // Only write to RHF when we have a complete datetime (date + time),
                                                  // or when explicitly clearing the date.
                                                  if (!nextDate) {
                                                    setValue("start_time", undefined, {
                                                      shouldDirty: true,
                                                      shouldTouch: true,
                                                      shouldValidate: true,
                                                    })
                                                  } else if (actualStartTime) {
                                                    const nextIso = combineDateTime(nextDate, actualStartTime)
                                                    if (nextIso) {
                                                      setValue("start_time", nextIso, {
                                                        shouldDirty: true,
                                                        shouldTouch: true,
                                                        shouldValidate: true,
                                                      })
                                                    }
                                                  }

                                                  // UX: if the user is setting the start date and there's no end date yet,
                                                  // default the end date to match (user action => can be dirty).
                                                  if (nextDate && !actualEndDate) {
                                                    setActualEndDate(nextDate)
                                                    if (actualEndTime) {
                                                      const nextEndIso = combineDateTime(nextDate, actualEndTime)
                                                      if (nextEndIso) {
                                                        setValue("end_time", nextEndIso, {
                                                          shouldDirty: true,
                                                          shouldTouch: true,
                                                          shouldValidate: true,
                                                        })
                                                      }
                                                    }
                                                  }
                                                }}
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                        <div className="w-32">
                                          <Select
                                            value={actualStartTime || "none"}
                                            onValueChange={(value) => {
                                              const nextTime = value === "none" ? "" : value
                                              setActualStartTime(nextTime)

                                              if (!nextTime) {
                                                setValue("start_time", undefined, {
                                                  shouldDirty: true,
                                                  shouldTouch: true,
                                                  shouldValidate: true,
                                                })
                                                return
                                              }

                                              if (!actualStartDate) return
                                              const nextIso = combineDateTime(actualStartDate, nextTime)
                                              if (!nextIso) return
                                              setValue("start_time", nextIso, {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                              })
                                            }}
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
                                      <FieldError errors={errors.start_time ? [{ message: errors.start_time.message }] : undefined} />
                                    </Field>

                                    <Field data-invalid={!!errors.end_time}>
                                      <FieldLabel htmlFor="end_time">Booking End</FieldLabel>
                                      <div className="flex gap-3 items-end">
                                        <div className="flex-1">
                                          <Popover open={openActualEndDate} onOpenChange={setOpenActualEndDate}>
                                            <PopoverTrigger asChild>
                                              <Button
                                                id="end_time"
                                                variant="outline"
                                                className="w-full justify-between font-normal h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                aria-invalid={!!errors.end_time}
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
                                                  const nextDate = date ?? undefined
                                                  setActualEndDate(nextDate)
                                                  setOpenActualEndDate(false)

                                                  if (!nextDate) {
                                                    setValue("end_time", undefined, {
                                                      shouldDirty: true,
                                                      shouldTouch: true,
                                                      shouldValidate: true,
                                                    })
                                                    return
                                                  }

                                                  if (!actualEndTime) return
                                                  const nextIso = combineDateTime(nextDate, actualEndTime)
                                                  if (!nextIso) return
                                                  setValue("end_time", nextIso, {
                                                    shouldDirty: true,
                                                    shouldTouch: true,
                                                    shouldValidate: true,
                                                  })
                                                }}
                                                disabled={actualStartDate ? { before: actualStartDate } : undefined}
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                        <div className="w-32">
                                          <Select
                                            value={actualEndTime || "none"}
                                            onValueChange={(value) => {
                                              const nextTime = value === "none" ? "" : value
                                              setActualEndTime(nextTime)

                                              if (!nextTime) {
                                                setValue("end_time", undefined, {
                                                  shouldDirty: true,
                                                  shouldTouch: true,
                                                  shouldValidate: true,
                                                })
                                                return
                                              }

                                              if (!actualEndDate) return
                                              const nextIso = combineDateTime(actualEndDate, nextTime)
                                              if (!nextIso) return
                                              setValue("end_time", nextIso, {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                              })
                                            }}
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
                                      <FieldError errors={errors.end_time ? [{ message: errors.end_time.message }] : undefined} />
                                    </Field>
                                  </FieldGroup>
                                </FieldSet>

                                {/* Booking Information Details */}
                                <FieldSet>
                                  <FieldGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Field>
                                      <FieldLabel htmlFor="checked_out_aircraft_id" className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <IconPlane className="h-4 w-4 text-primary" />
                                        Aircraft
                                        {selectedAircraft && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="h-5 w-5 rounded-full"
                                                aria-label="Aircraft meter readings"
                                              >
                                                <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                                              </Button>
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
                                          value={(watch("checked_out_aircraft_id") ?? bookingAircraftId ?? "none") as string}
                                          onValueChange={(value) => setValue("checked_out_aircraft_id", value === "none" ? null : value, { shouldDirty: true })}
                                        >
                                          <SelectTrigger id="checked_out_aircraft_id" className="w-full transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <SelectValue placeholder="Select Aircraft" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No aircraft</SelectItem>
                                            {!!bookingAircraftId &&
                                              !!bookingAircraftLabel &&
                                              !options.aircraft.some((a) => a.id === bookingAircraftId) && (
                                                <SelectItem value={bookingAircraftId}>
                                                  {bookingAircraftLabel} (inactive)
                                                </SelectItem>
                                              )}
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
                                          value={(watch("checked_out_instructor_id") ?? bookingInstructorId ?? "none") as string}
                                          onValueChange={(value) => setValue("checked_out_instructor_id", value === "none" ? null : value, { shouldDirty: true })}
                                        >
                                          <SelectTrigger id="checked_out_instructor_id" className="w-full transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <SelectValue placeholder="Select Instructor" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No instructor</SelectItem>
                                            {!!bookingInstructorId &&
                                              !!bookingInstructorLabel &&
                                              !options.instructors.some((i) => i.id === bookingInstructorId) && (
                                                <SelectItem value={bookingInstructorId}>
                                                  {bookingInstructorLabel} (inactive)
                                                </SelectItem>
                                              )}
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
                                          value={(watch("flight_type_id") ?? bookingFlightTypeId ?? "none") as string}
                                          onValueChange={(value) => setValue("flight_type_id", value === "none" ? null : value, { shouldDirty: true })}
                                        >
                                          <SelectTrigger id="flight_type_id" className="w-full transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800" aria-invalid={!!errors.flight_type_id}>
                                            <SelectValue placeholder="Select Flight Type" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No flight type</SelectItem>
                                            {!!bookingFlightTypeId &&
                                              !!bookingFlightTypeLabel &&
                                              !options.flightTypes.some((ft) => ft.id === bookingFlightTypeId) && (
                                                <SelectItem value={bookingFlightTypeId}>
                                                  {bookingFlightTypeLabel} (inactive)
                                                </SelectItem>
                                              )}
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
                                          value={(watch("lesson_id") ?? bookingLessonId ?? "none") as string}
                                          onValueChange={(value) => setValue("lesson_id", value === "none" ? null : value, { shouldDirty: true })}
                                        >
                                          <SelectTrigger id="lesson_id" className="w-full transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800" aria-invalid={!!errors.lesson_id}>
                                            <SelectValue placeholder="Select Lesson" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No lesson selected</SelectItem>
                                            {!!bookingLessonId &&
                                              !!bookingLessonLabel &&
                                              !options.lessons.some((l) => l.id === bookingLessonId) && (
                                                <SelectItem value={bookingLessonId}>
                                                  {bookingLessonLabel} (inactive)
                                                </SelectItem>
                                              )}
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
                              </CollapsibleContent>
                            </Collapsible>

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
                                  <div className="flex items-center justify-between gap-2">
                                    <FieldLabel htmlFor="fuel_on_board" className="flex items-center gap-2">
                                      <IconGasStation className="h-4 w-4 text-foreground" />
                                      Useable Fuel
                                    </FieldLabel>
                                    {endurance && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 cursor-help transition-colors hover:bg-primary/20 animate-in fade-in zoom-in-95 duration-200">
                                            <IconClock className="h-3 w-3" />
                                            <span>{endurance}h Endurance</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end" className="text-xs">
                                          <div className="flex flex-col gap-1">
                                            <p className="font-medium text-muted-foreground">Safe Endurance Calculation</p>
                                            <p>{fuelOnBoard}L / {fuelConsumption}L/hr = <span className="font-bold text-foreground">{endurance} hours</span></p>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
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
                                              const nextDate = date ?? undefined
                                              setEtaDate(nextDate)
                                              setOpenEtaDate(false)

                                              if (!nextDate) {
                                                setValue("eta", null, {
                                                  shouldDirty: true,
                                                  shouldTouch: true,
                                                  shouldValidate: true,
                                                })
                                                return
                                              }

                                              if (!etaTime) return
                                              const nextIso = combineDateTime(nextDate, etaTime)
                                              if (!nextIso) return
                                              setValue("eta", nextIso, {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                              })
                                            }}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                    <div className="w-32">
                                      <Select
                                        value={etaTime || "none"}
                                        onValueChange={(value) => {
                                          const nextTime = value === "none" ? "" : value
                                          setEtaTime(nextTime)

                                          if (!nextTime) {
                                            setValue("eta", null, {
                                              shouldDirty: true,
                                              shouldTouch: true,
                                              shouldValidate: true,
                                            })
                                            return
                                          }

                                          if (!etaDate) return
                                          const nextIso = combineDateTime(etaDate, nextTime)
                                          if (!nextIso) return
                                          setValue("eta", nextIso, {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                            shouldValidate: true,
                                          })
                                        }}
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

                                {/* Compact Checklist Row */}
                                <div className="md:col-span-2 flex items-center justify-between p-3.5 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm mt-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                                      <IconFileText className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Briefing Completed</p>
                                      <p className="text-[11px] text-muted-foreground">Confirm all pre-flight briefings are finished</p>
                                    </div>
                                  </div>
                                  <Switch
                                    id="briefing_completed"
                                    checked={watch("briefing_completed") ?? false}
                                    onCheckedChange={(checked) => setValue("briefing_completed", checked, { shouldDirty: true })}
                                  />
                                </div>
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
    {/* When status is 'confirmed', only show Check Out button (no Save/Undo) */}
    {/* When status is 'flying', show Save/Undo (if dirty) + Check In button */}
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
          {/* On mobile: stack vertically when multiple buttons, otherwise horizontal */}
          {/* On desktop: always horizontal */}
          <div className={`flex items-center gap-4 ${
            isMobile && hasChanges && booking?.status === 'flying'
              ? 'flex-col' 
              : isMobile 
                ? 'flex-col sm:flex-row sm:justify-end' 
                : 'flex-row justify-end'
          }`}>
            {/* Only show Save/Undo when status is 'flying' (not 'confirmed') */}
            {hasChanges && booking?.status !== 'confirmed' && (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleUndo}
                  disabled={checkoutMutation.isPending}
                  className={`h-12 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium ${
                    isMobile && hasChanges && booking?.status === 'flying'
                      ? 'w-full'
                      : isMobile
                        ? 'w-full sm:w-auto sm:flex-1 sm:max-w-[200px]'
                        : 'px-8 min-w-[160px]'
                  }`}
                >
                  <IconRotateClockwise className="h-4 w-4 mr-2" />
                  Undo Changes
                </Button>
                <Button
                  size="lg"
                  onClick={handleFormSubmit}
                  disabled={checkoutMutation.isPending}
                  className={`h-12 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all ${
                    isMobile && hasChanges && booking?.status === 'flying'
                      ? 'w-full'
                      : isMobile
                        ? 'w-full sm:w-auto sm:flex-1 sm:max-w-[200px]'
                        : 'px-8 min-w-[160px]'
                  }`}
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
                onClick={handleCheckOut}
                disabled={checkoutMutation.isPending || isCheckingOut}
                className={`h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all ${
                  isMobile
                    ? 'w-full sm:w-auto sm:flex-1 sm:max-w-[200px]'
                    : 'px-8 min-w-[160px]'
                }`}
              >
                <IconPlane className="h-4 w-4 mr-2" />
                {checkoutMutation.isPending || isCheckingOut ? "Checking Out..." : "Check Out"}
              </Button>
            )}
            {/* Show Check In button if booking status is 'flying' */}
            {booking?.status === 'flying' && (
              <Button
                size="lg"
                onClick={handleCheckFlightIn}
                className={`h-12 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all ${
                  isMobile && hasChanges && booking?.status === 'flying'
                    ? 'w-full'
                    : isMobile
                      ? 'w-full sm:w-auto sm:flex-1 sm:max-w-[200px]'
                      : 'px-8 min-w-[160px]'
                }`}
              >
                <IconCheck className="h-4 w-4 mr-2" />
                Check In
              </Button>
            )}
          </div>
        </div>
      </div>
    
    {/* Loading Screen - Shows when checking out */}
    {isCheckingOut && (
      <div 
        className="fixed inset-0 z-[100000] flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-indigo-950 dark:to-purple-950"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-loading-title"
      >
        <div className="relative flex flex-col items-center gap-8 p-8">
          {/* Animated Plane Icon */}
          <div className="relative">
            {/* Outer ring - pulsing */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-32 w-32 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
            </div>
            
            {/* Middle ring - rotating */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
            
            {/* Plane icon */}
            <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-primary shadow-2xl">
              <IconPlane className="h-12 w-12 text-primary-foreground animate-bounce" style={{ animationDuration: '1.5s' }} />
            </div>
          </div>
          
          {/* Text */}
          <div className="text-center space-y-3">
            <h2 
              id="checkout-loading-title"
              className="text-3xl font-bold text-foreground animate-pulse"
            >
              Checking Flight Out
            </h2>
            <p className="text-lg text-muted-foreground">
              Preparing aircraft and updating flight records...
            </p>
          </div>
          
          {/* Progress dots */}
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-3 w-3 rounded-full bg-primary animate-bounce"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.6s'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
