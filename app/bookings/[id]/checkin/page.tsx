"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconArrowLeft,
  IconClock,
  IconPlane,
  IconSchool,
  IconFileText,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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
import { useOrganizationTaxRate } from "@/hooks/use-tax-rate"
import { InvoiceCalculations, roundToTwoDecimals } from "@/lib/invoice-calculations"

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

// Calculate flight hours from meter readings
function calculateFlightHours(start: number | null | undefined, end: number | null | undefined): number {
  if (start == null || end == null || end < start) return 0
  return parseFloat((end - start).toFixed(1))
}

type ChargeBasis = 'hobbs' | 'tacho' | 'airswitch'

type ChargeRate = {
  id: string
  rate_per_hour: number | string
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
}

type GeneratedInvoiceItem = {
  chargeable_id: string | null
  description: string
  quantity: number
  unit_price: number // tax-exclusive
  tax_rate: number | null
  notes?: string | null
}

type CalculatedInvoiceLine = GeneratedInvoiceItem & {
  amount: number
  tax_amount: number
  rate_inclusive: number
  line_total: number
}

function deriveChargeBasisFromFlags(rate: ChargeRate | null | undefined): ChargeBasis | null {
  if (!rate) return null
  // Prefer the canonical single-flag case, but tolerate bad data.
  if (rate.charge_hobbs && !rate.charge_tacho && !rate.charge_airswitch) return 'hobbs'
  if (rate.charge_tacho && !rate.charge_hobbs && !rate.charge_airswitch) return 'tacho'
  if (rate.charge_airswitch && !rate.charge_hobbs && !rate.charge_tacho) return 'airswitch'

  // Multiple flags (data issue): choose deterministic priority.
  if (rate.charge_hobbs) return 'hobbs'
  if (rate.charge_tacho) return 'tacho'
  if (rate.charge_airswitch) return 'airswitch'
  return null
}

export default function BookingCheckinPage() {
  const params = useParams()
  const router = useRouter()
  const { role } = useAuth()
  const bookingId = params.id as string
  const isMobile = useIsMobile()

  const queryClient = useQueryClient()

  const { taxRate: organizationTaxRate } = useOrganizationTaxRate()
  const taxRate = organizationTaxRate ?? 0.15
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FlightLogCheckinFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(bookingUpdateSchema) as any,
    mode: 'onChange',
    defaultValues: {},
  })

  // Watch key check-in fields (used for live calculations + rate fetching)
  const hobbsStart = watch("hobbs_start")
  const hobbsEnd = watch("hobbs_end")
  const tachStart = watch("tach_start")
  const tachEnd = watch("tach_end")
  const soloEndHobbs = watch("solo_end_hobbs")
  const soloEndTach = watch("solo_end_tach")

  // Local state
  
  // Use a ref to track if we're currently initializing
  const isInitializingRef = React.useRef(false)

  // We keep this for future UX (e.g. warning before leaving), but there is no "sticky save" UI.

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

  // Approval is the immutable/locked state. A draft invoice may exist before approval.
  const isApproved = !!booking?.checkin_approved_at
  const checkinInvoiceId = booking?.checkin_invoice_id ?? null

  const [draftCalculation, setDraftCalculation] = React.useState<null | {
    signature: string
    calculated_at: string
    billing_basis: ChargeBasis
    billing_hours: number
    dual_time: number
    solo_time: number
    items: GeneratedInvoiceItem[]
    lines: CalculatedInvoiceLine[]
    totals: { subtotal: number; tax_total: number; total_amount: number }
  }>(null)

  const selectedAircraftId =
    watch("checked_out_aircraft_id") ||
    booking?.checked_out_aircraft_id ||
    booking?.aircraft_id ||
    null

  const selectedInstructorId =
    watch("checked_out_instructor_id") ||
    booking?.checked_out_instructor_id ||
    booking?.instructor_id ||
    null

  const selectedFlightTypeId = watch("flight_type_id") || booking?.flight_type_id || null

  const selectedFlightType = React.useMemo(() => {
    if (!selectedFlightTypeId) return null
    const fromOptions = options?.flightTypes?.find((ft) => ft.id === selectedFlightTypeId) ?? null
    return fromOptions ?? (booking?.flight_type ?? null)
  }, [selectedFlightTypeId, options?.flightTypes, booking?.flight_type])

  const instructionType = (selectedFlightType as { instruction_type?: 'trial' | 'dual' | 'solo' | null } | null)?.instruction_type ?? null

  const [hasSoloAtEnd, setHasSoloAtEnd] = React.useState(false)
  const lastSoloInitKey = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!booking) return
    const key = `${booking.id}:${booking.solo_end_hobbs ?? '—'}:${booking.solo_end_tach ?? '—'}`
    if (lastSoloInitKey.current === key) return
    lastSoloInitKey.current = key
    setHasSoloAtEnd(!!booking.solo_end_hobbs || !!booking.solo_end_tach)
  }, [booking])

  // Solo bookings never need a solo-end input; clear any legacy values.
  React.useEffect(() => {
    if (isInitializingRef.current) return
    if (instructionType !== 'solo') return
    if (hasSoloAtEnd) setHasSoloAtEnd(false)
    if (soloEndHobbs != null) setValue("solo_end_hobbs", null, { shouldDirty: true })
    if (soloEndTach != null) setValue("solo_end_tach", null, { shouldDirty: true })
  }, [instructionType, hasSoloAtEnd, soloEndHobbs, soloEndTach, setValue])

  const aircraftChargeRateQuery = useQuery({
    queryKey: ["aircraftChargeRate", selectedAircraftId, selectedFlightTypeId],
    enabled: !!selectedAircraftId && !!selectedFlightTypeId,
    queryFn: async () =>
      fetchJson<{ charge_rate: ChargeRate }>(
        `/api/aircraft-charge-rates?aircraft_id=${selectedAircraftId}&flight_type_id=${selectedFlightTypeId}`
      ),
    staleTime: 5 * 60_000,
  })

  const instructorChargeRateQuery = useQuery({
    queryKey: ["instructorChargeRate", selectedInstructorId, selectedFlightTypeId],
    enabled: !!selectedInstructorId && !!selectedFlightTypeId,
    queryFn: async () =>
      fetchJson<{ charge_rate: ChargeRate }>(
        `/api/instructor-charge-rates?instructor_id=${selectedInstructorId}&flight_type_id=${selectedFlightTypeId}`
      ),
    staleTime: 5 * 60_000,
  })

  const aircraftChargeRate = aircraftChargeRateQuery.data?.charge_rate ?? null
  const instructorChargeRate = instructorChargeRateQuery.data?.charge_rate ?? null

  const aircraftBillingBasis = React.useMemo(
    () => deriveChargeBasisFromFlags(aircraftChargeRate),
    [aircraftChargeRate]
  )

  // Enforce "no irrelevant solo-end inputs" based on billing basis
  React.useEffect(() => {
    if (isInitializingRef.current) return
    if (!aircraftBillingBasis) return
    if (aircraftBillingBasis === 'hobbs') {
      if (soloEndTach != null) setValue("solo_end_tach", null, { shouldDirty: true })
      return
    }
    if (aircraftBillingBasis === 'tacho') {
      if (soloEndHobbs != null) setValue("solo_end_hobbs", null, { shouldDirty: true })
      return
    }
  }, [aircraftBillingBasis, soloEndHobbs, soloEndTach, setValue])

  // Total time uses the solo-end meter reading when a dual/trial flight ends with a solo portion.
  const hobbsTotalHours = React.useMemo(() => {
    const effectiveEnd =
      instructionType !== 'solo' && hasSoloAtEnd && aircraftBillingBasis === 'hobbs'
        ? soloEndHobbs
        : hobbsEnd
    return calculateFlightHours(hobbsStart, effectiveEnd)
  }, [hobbsStart, hobbsEnd, soloEndHobbs, hasSoloAtEnd, aircraftBillingBasis, instructionType])

  const tachTotalHours = React.useMemo(() => {
    const effectiveEnd =
      instructionType !== 'solo' && hasSoloAtEnd && aircraftBillingBasis === 'tacho'
        ? soloEndTach
        : tachEnd
    return calculateFlightHours(tachStart, effectiveEnd)
  }, [tachStart, tachEnd, soloEndTach, hasSoloAtEnd, aircraftBillingBasis, instructionType])

  const splitTimes = React.useMemo(() => {
    if (!aircraftBillingBasis || aircraftBillingBasis === 'airswitch') {
      return { total: 0, dual: 0, solo: 0, error: null as string | null }
    }

    if (instructionType === 'solo') {
      const total = aircraftBillingBasis === 'hobbs' ? hobbsTotalHours : tachTotalHours
      return { total, dual: 0, solo: total, error: null }
    }

    const basisStart = aircraftBillingBasis === 'hobbs' ? hobbsStart : tachStart
    const dualEnd = aircraftBillingBasis === 'hobbs' ? hobbsEnd : tachEnd
    const finalEnd = aircraftBillingBasis === 'hobbs'
      ? (hasSoloAtEnd ? soloEndHobbs : hobbsEnd)
      : (hasSoloAtEnd ? soloEndTach : tachEnd)

    if (hasSoloAtEnd) {
      if (basisStart == null || dualEnd == null || finalEnd == null) {
        return { total: 0, dual: 0, solo: 0, error: 'Solo split requires start, dual end, and solo end.' }
      }
      if (dualEnd < basisStart) return { total: 0, dual: 0, solo: 0, error: 'Dual end cannot be less than start.' }
      if (finalEnd < dualEnd) return { total: 0, dual: 0, solo: 0, error: 'Solo end cannot be less than dual end.' }

      const roundToTenth = (v: number) => parseFloat(v.toFixed(1))
      const dual = roundToTenth(dualEnd - basisStart)
      const solo = roundToTenth(finalEnd - dualEnd)
      const total = roundToTenth(dual + solo)
      return { total, dual, solo, error: null }
    }

    const total = aircraftBillingBasis === 'hobbs' ? hobbsTotalHours : tachTotalHours
    return { total, dual: total, solo: 0, error: null }
  }, [
    aircraftBillingBasis,
    instructionType,
    hasSoloAtEnd,
    hobbsStart,
    hobbsEnd,
    tachStart,
    tachEnd,
    soloEndHobbs,
    soloEndTach,
    hobbsTotalHours,
    tachTotalHours,
  ])

  const billingHours = React.useMemo(() => {
    if (!aircraftBillingBasis) return 0
    if (aircraftBillingBasis === 'hobbs') return hobbsTotalHours
    if (aircraftBillingBasis === 'tacho') return tachTotalHours
    // UI does not support airswitch inputs; treat as unsupported configuration.
    return 0
  }, [aircraftBillingBasis, hobbsTotalHours, tachTotalHours])

  const isAirswitchBillingUnsupported = aircraftBillingBasis === 'airswitch'

  const aircraftRatePerHourExclTax = React.useMemo(() => {
    if (!aircraftChargeRate) return null
    const v = typeof aircraftChargeRate.rate_per_hour === 'string'
      ? parseFloat(aircraftChargeRate.rate_per_hour)
      : aircraftChargeRate.rate_per_hour
    return Number.isFinite(v) ? v : null
  }, [aircraftChargeRate])

  const aircraftRatePerHourInclTax = React.useMemo(() => {
    if (aircraftRatePerHourExclTax == null) return null
    return roundToTwoDecimals(aircraftRatePerHourExclTax * (1 + taxRate))
  }, [aircraftRatePerHourExclTax, taxRate])

  const instructorRatePerHourExclTax = React.useMemo(() => {
    if (!instructorChargeRate) return null
    const v = typeof instructorChargeRate.rate_per_hour === 'string'
      ? parseFloat(instructorChargeRate.rate_per_hour)
      : instructorChargeRate.rate_per_hour
    return Number.isFinite(v) ? v : null
  }, [instructorChargeRate])

  const instructorRatePerHourInclTax = React.useMemo(() => {
    if (instructorRatePerHourExclTax == null) return null
    return roundToTwoDecimals(instructorRatePerHourExclTax * (1 + taxRate))
  }, [instructorRatePerHourExclTax, taxRate])

  // Build invoice items on-demand (called on Save Draft Check-In / Approve),
  // rather than dynamically recalculating totals while typing.
  const buildDraftInvoiceItems = React.useCallback((): GeneratedInvoiceItem[] => {
    if (!booking) return []
    if (!aircraftChargeRate) return []
    if (!aircraftBillingBasis) return []
    if (aircraftBillingBasis === 'airswitch') return []
    if (billingHours <= 0) return []

    const aircraftRate = typeof aircraftChargeRate.rate_per_hour === 'string'
      ? parseFloat(aircraftChargeRate.rate_per_hour)
      : aircraftChargeRate.rate_per_hour

    if (!Number.isFinite(aircraftRate) || aircraftRate <= 0) return []

    const aircraftReg =
      options?.aircraft?.find((a) => a.id === selectedAircraftId)?.registration ||
      booking.aircraft?.registration ||
      'Aircraft'

    const items: GeneratedInvoiceItem[] = [
      {
        chargeable_id: null,
        description: `Aircraft Hire (${aircraftReg})`,
        quantity: billingHours,
        unit_price: aircraftRate,
        tax_rate: taxRate,
        notes: `Booking ${booking.id}; basis=${aircraftBillingBasis}; total=${billingHours.toFixed(1)}h; dual=${splitTimes.dual.toFixed(1)}h; solo=${splitTimes.solo.toFixed(1)}h; hobbs=${hobbsStart ?? '—'}→${hobbsEnd ?? '—'}${soloEndHobbs != null ? `→${soloEndHobbs}` : ''}; tacho=${tachStart ?? '—'}→${tachEnd ?? '—'}${soloEndTach != null ? `→${soloEndTach}` : ''}`,
      },
    ]

    if (selectedInstructorId && instructorChargeRate) {
      const instructorBasis = deriveChargeBasisFromFlags(instructorChargeRate) || aircraftBillingBasis
      const instructorHours = (() => {
        if (instructionType === 'solo') return 0
        // Deterministic rule: when splitting dual+solo, avoid mixed time sources.
        // If bases differ, we cannot compute instructor dual time safely.
        if (hasSoloAtEnd && instructorBasis !== aircraftBillingBasis) return 0
        return splitTimes.dual
      })()

      if (instructorHours > 0) {
        const instructorRate = typeof instructorChargeRate.rate_per_hour === 'string'
          ? parseFloat(instructorChargeRate.rate_per_hour)
          : instructorChargeRate.rate_per_hour

        if (Number.isFinite(instructorRate) && instructorRate > 0) {
          const instructorFromOptions = options?.instructors?.find((i) => i.id === selectedInstructorId) ?? null
          const instructorDisplayName =
            (instructorFromOptions
              ? [instructorFromOptions.first_name, instructorFromOptions.last_name].filter(Boolean).join(" ") ||
                instructorFromOptions.user?.email ||
                "Instructor"
              : booking.checked_out_instructor?.user?.email || booking.instructor?.user?.email || "Instructor")

          items.push({
            chargeable_id: null,
            description: `Instructor Rate - (${instructorDisplayName})`,
            quantity: instructorHours,
            unit_price: instructorRate,
            tax_rate: taxRate,
            notes: `Booking ${booking.id}; basis=${instructorBasis}; instructor_id=${selectedInstructorId}; dual_time=${splitTimes.dual.toFixed(1)}h`,
          })
        }
      }
    }

    return items
  }, [
    booking,
    aircraftChargeRate,
    aircraftBillingBasis,
    billingHours,
    taxRate,
    hobbsStart,
    hobbsEnd,
    tachStart,
    tachEnd,
    soloEndHobbs,
    soloEndTach,
    splitTimes.dual,
    splitTimes.solo,
    instructionType,
    hasSoloAtEnd,
    selectedInstructorId,
    instructorChargeRate,
    selectedAircraftId,
    options?.aircraft,
    options?.instructors,
  ])

  const instructorBasisConflictForSoloSplit = React.useMemo(() => {
    if (!selectedInstructorId || !instructorChargeRate) return false
    if (!hasSoloAtEnd) return false
    if (!aircraftBillingBasis || aircraftBillingBasis === 'airswitch') return false
    const instructorBasis = deriveChargeBasisFromFlags(instructorChargeRate) || aircraftBillingBasis
    return instructorBasis !== aircraftBillingBasis
  }, [selectedInstructorId, instructorChargeRate, hasSoloAtEnd, aircraftBillingBasis])

  const draftSignature = React.useMemo(() => {
    return JSON.stringify({
      booking_id: booking?.id ?? null,
      checked_out_aircraft_id: selectedAircraftId,
      checked_out_instructor_id: selectedInstructorId,
      flight_type_id: selectedFlightTypeId,

      hobbs_start: hobbsStart ?? null,
      hobbs_end: hobbsEnd ?? null,
      tach_start: tachStart ?? null,
      tach_end: tachEnd ?? null,
      solo_end_hobbs: hasSoloAtEnd ? (soloEndHobbs ?? null) : null,
      solo_end_tach: hasSoloAtEnd ? (soloEndTach ?? null) : null,
      hasSoloAtEnd,
      instructionType,

      aircraft_charge_rate: aircraftChargeRate ? {
        id: aircraftChargeRate.id,
        rate_per_hour: aircraftChargeRate.rate_per_hour,
        charge_hobbs: aircraftChargeRate.charge_hobbs,
        charge_tacho: aircraftChargeRate.charge_tacho,
        charge_airswitch: aircraftChargeRate.charge_airswitch,
      } : null,
      instructor_charge_rate: instructorChargeRate ? {
        id: instructorChargeRate.id,
        rate_per_hour: instructorChargeRate.rate_per_hour,
        charge_hobbs: instructorChargeRate.charge_hobbs,
        charge_tacho: instructorChargeRate.charge_tacho,
        charge_airswitch: instructorChargeRate.charge_airswitch,
      } : null,

      taxRate,
    })
  }, [
    booking?.id,
    selectedAircraftId,
    selectedInstructorId,
    selectedFlightTypeId,
    hobbsStart,
    hobbsEnd,
    tachStart,
    tachEnd,
    soloEndHobbs,
    soloEndTach,
    hasSoloAtEnd,
    instructionType,
    aircraftChargeRate,
    instructorChargeRate,
    taxRate,
  ])

  const isDraftCalculated = !!draftCalculation
  const isDraftStale = !!draftCalculation && draftCalculation.signature !== draftSignature

  const updateDraftLine = React.useCallback((idx: number, patch: Partial<Pick<GeneratedInvoiceItem, "quantity" | "unit_price">>) => {
    setDraftCalculation((prev) => {
      if (!prev) return prev
      if (idx < 0 || idx >= prev.items.length) return prev

      const nextItems = prev.items.map((it, i) => {
        if (i !== idx) return it
        return {
          ...it,
          ...patch,
        }
      })

      const nextLines: CalculatedInvoiceLine[] = nextItems.map((item) => {
        const calculated = InvoiceCalculations.calculateItemAmounts({
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate ?? taxRate,
        })
        return {
          ...item,
          amount: calculated.amount,
          tax_amount: calculated.tax_amount,
          rate_inclusive: calculated.rate_inclusive,
          line_total: calculated.line_total,
        }
      })

      const subtotal = roundToTwoDecimals(nextLines.reduce((sum, l) => sum + l.amount, 0))
      const tax_total = roundToTwoDecimals(nextLines.reduce((sum, l) => sum + l.tax_amount, 0))
      const total_amount = roundToTwoDecimals(nextLines.reduce((sum, l) => sum + l.line_total, 0))

      return {
        ...prev,
        calculated_at: new Date().toISOString(),
        items: nextItems,
        lines: nextLines,
        totals: { subtotal, tax_total, total_amount },
      }
    })
  }, [taxRate])

  const isDraftValidForApproval = React.useMemo(() => {
    if (!draftCalculation) return false
    if (draftCalculation.signature !== draftSignature) return false
    if (draftCalculation.items.length === 0) return false
    if (draftCalculation.items.some((i) => !Number.isFinite(i.quantity) || i.quantity <= 0)) return false
    if (draftCalculation.items.some((i) => !Number.isFinite(i.unit_price) || i.unit_price < 0)) return false
    if (!Number.isFinite(draftCalculation.totals.total_amount) || draftCalculation.totals.total_amount <= 0) return false
    return true
  }, [draftCalculation, draftSignature])

  const calculateDraft = handleSubmit(() => {
    if (!booking) throw new Error("Booking not loaded")
    if (isApproved) throw new Error("Check-in already approved")

    if (!selectedAircraftId) throw new Error("Aircraft is required")
    if (!selectedFlightTypeId) throw new Error("Flight type is required")
    if (!aircraftChargeRate) throw new Error("Aircraft rate not configured for this aircraft + flight type.")
    if (!aircraftBillingBasis) throw new Error("No aircraft charge basis configured")
    if (aircraftBillingBasis === 'airswitch') throw new Error("Aircraft is configured for airswitch billing; Hobbs/Tacho only in this UI.")
    if (billingHours <= 0) throw new Error("Billing hours must be greater than zero")
    if (splitTimes.error) throw new Error(splitTimes.error)
    if (instructorBasisConflictForSoloSplit) throw new Error("Instructor charge basis conflicts with aircraft charge basis for a dual+solo split.")

    const items = buildDraftInvoiceItems()
    if (items.length === 0) throw new Error("No invoice items to calculate")

    const lines: CalculatedInvoiceLine[] = items.map((item) => {
      const calculated = InvoiceCalculations.calculateItemAmounts({
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate ?? taxRate,
      })
      return {
        ...item,
        amount: calculated.amount,
        tax_amount: calculated.tax_amount,
        rate_inclusive: calculated.rate_inclusive,
        line_total: calculated.line_total,
      }
    })

    const subtotal = roundToTwoDecimals(lines.reduce((sum, l) => sum + l.amount, 0))
    const tax_total = roundToTwoDecimals(lines.reduce((sum, l) => sum + l.tax_amount, 0))
    const total_amount = roundToTwoDecimals(lines.reduce((sum, l) => sum + l.line_total, 0))

    // Store derived billing fields in the form (browser only; no DB writes).
    setValue("billing_basis", aircraftBillingBasis, { shouldDirty: false })
    setValue("billing_hours", billingHours, { shouldDirty: false })
    setValue("flight_time", billingHours, { shouldDirty: false })
    if (splitTimes.total > 0 && !splitTimes.error) {
      setValue("dual_time", splitTimes.dual, { shouldDirty: false })
      setValue("solo_time", splitTimes.solo, { shouldDirty: false })
    }

    setDraftCalculation({
      signature: draftSignature,
      calculated_at: new Date().toISOString(),
      billing_basis: aircraftBillingBasis,
      billing_hours: billingHours,
      dual_time: splitTimes.dual,
      solo_time: splitTimes.solo,
      items,
      lines,
      totals: { subtotal, tax_total, total_amount },
    })

    toast.success("Draft calculated (not saved)")
  })

  // Calculate flight hours from meter readings
  React.useEffect(() => {
    if (isInitializingRef.current) return

    // Persist the deterministic split times (no manual overrides)
    if (splitTimes.total > 0 && !splitTimes.error) {
      setValue("dual_time", splitTimes.dual, { shouldDirty: false })
      setValue("solo_time", splitTimes.solo, { shouldDirty: false })
    }
  }, [hobbsTotalHours, tachTotalHours, splitTimes.total, splitTimes.dual, splitTimes.solo, splitTimes.error, setValue])

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
      airswitch_start: booking.airswitch_start || null,
      airswitch_end: booking.airswitch_end || null,
      flight_time_hobbs: booking.flight_time_hobbs || null,
      flight_time_tach: booking.flight_time_tach || null,
      flight_time_airswitch: booking.flight_time_airswitch || null,
      flight_time: booking.flight_time || null,
      billing_basis: booking.billing_basis || null,
      billing_hours: booking.billing_hours || null,
      checked_out_aircraft_id: booking.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: booking.checked_out_instructor_id || booking.instructor_id || null,
      flight_type_id: booking.flight_type_id || null,
      lesson_id: booking.lesson_id || null,
      remarks: null,
      fuel_on_board: null,
      passengers: null,
      route: null,
      flight_remarks: null,
      solo_end_hobbs: booking.solo_end_hobbs || null,
      solo_end_tach: booking.solo_end_tach || null,
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
        isInitializingRef.current = false
        // No sticky "dirty" banner; keep initialization lightweight.
      }, 300)
    })
  }, [booking, bookingId, reset])

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error('Booking not loaded')
      if (isApproved) throw new Error('Check-in already approved')

      if (!selectedAircraftId) throw new Error('Aircraft is required')
      if (!selectedFlightTypeId) throw new Error('Flight type is required')
      if (!aircraftBillingBasis) throw new Error('No aircraft charge basis configured')
      if (billingHours <= 0) throw new Error('Billing hours must be greater than zero')
      if (splitTimes.error) throw new Error(splitTimes.error)
      if (instructorBasisConflictForSoloSplit) throw new Error('Instructor charge basis conflicts with aircraft charge basis for a dual+solo split.')
      if (!draftCalculation) throw new Error('Please calculate flight charges before approving.')
      if (draftCalculation.signature !== draftSignature) throw new Error('Flight charges are out of date. Recalculate before approving.')
      if (draftCalculation.items.length === 0) throw new Error('No invoice items to approve')

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)

      const payload = {
        checked_out_aircraft_id: selectedAircraftId,
        checked_out_instructor_id: selectedInstructorId,
        flight_type_id: selectedFlightTypeId,

        hobbs_start: hobbsStart ?? null,
        hobbs_end: hobbsEnd ?? null,
        tach_start: tachStart ?? null,
        tach_end: tachEnd ?? null,
        airswitch_start: null,
        airswitch_end: null,

        solo_end_hobbs: aircraftBillingBasis === 'hobbs' && hasSoloAtEnd ? (soloEndHobbs ?? null) : null,
        solo_end_tach: aircraftBillingBasis === 'tacho' && hasSoloAtEnd ? (soloEndTach ?? null) : null,
        dual_time: draftCalculation.dual_time > 0 ? draftCalculation.dual_time : null,
        solo_time: draftCalculation.solo_time > 0 ? draftCalculation.solo_time : null,

        billing_basis: draftCalculation.billing_basis,
        billing_hours: draftCalculation.billing_hours,

        tax_rate: taxRate,
        due_date: dueDate.toISOString(),
        reference: `Booking ${booking.id} check-in`,
        notes: `Auto-generated from booking check-in.`,
        items: draftCalculation.items.map((i) => ({
          chargeable_id: i.chargeable_id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_rate: i.tax_rate,
          notes: i.notes ?? null,
        })),
      }

      return fetchJson<{ invoice: { id: string } }>(`/api/bookings/${bookingId}/checkin/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
      await queryClient.invalidateQueries({ queryKey: ["bookings"] })
      await queryClient.invalidateQueries({ queryKey: ["invoices"] })
      toast.success("Check-in approved and invoice created")
      router.replace(`/invoices/${data.invoice.id}`)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  // "Save Draft Check-In" is intentionally browser-only. It calculates and stores
  // invoice data locally; nothing is persisted until approval.

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

  const aircraftRateMissing = !!selectedAircraftId && !!selectedFlightTypeId && aircraftChargeRateQuery.isFetched && !aircraftChargeRate
  const instructorRateMissing = !!selectedInstructorId && !!selectedFlightTypeId && instructorChargeRateQuery.isFetched && !instructorChargeRate

  const canApprove =
    !isApproved &&
    !!aircraftChargeRate &&
    !!aircraftBillingBasis &&
    !isAirswitchBillingUnsupported &&
    billingHours > 0 &&
    isDraftValidForApproval &&
    !instructorRateMissing &&
    !splitTimes.error &&
    !instructorBasisConflictForSoloSplit &&
    !approveMutation.isPending

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
                      <form onSubmit={(e) => e.preventDefault()}>
                        <FieldSet className="w-full max-w-full">
                          <FieldGroup className="w-full max-w-full">
                            {/* Meter Readings Section */}
                            <FieldSet className="p-4 sm:p-3 gap-4 sm:gap-3 rounded-lg w-full max-w-full box-border bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
                              <FieldGroup className="gap-4 sm:gap-3">
                                {/* Charging basis indicator */}
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold">
                                    Charging basis:{' '}
                                    <span className={aircraftBillingBasis === 'hobbs' || aircraftBillingBasis === 'tacho' ? 'text-primary' : 'text-destructive'}>
                                      {aircraftBillingBasis ?? '—'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    Hours used: {billingHours > 0 ? `${billingHours.toFixed(1)}h` : '—'}
                                  </div>
                                </div>

                                {/* Meter inputs: show active charging basis first */}
                                {aircraftBillingBasis === 'hobbs' ? (
                                  <>
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
                                            disabled={isApproved}
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
                                            disabled={isApproved}
                                            {...register("hobbs_end", { valueAsNumber: true })}
                                            className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                            placeholder="8754.5"
                                            aria-invalid={!!errors.hobbs_end}
                                          />
                                          <FieldError errors={errors.hobbs_end ? [{ message: errors.hobbs_end.message }] : undefined} />
                                        </Field>
                                      </FieldGroup>

                                      {/* Solo at end option - only for dual/trial flights */}
                                      {(instructionType === 'dual' || instructionType === 'trial') && (
                                        <div className="mt-3 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <FieldLabel className="text-sm font-medium">Solo at end</FieldLabel>
                                            <Switch
                                              checked={hasSoloAtEnd}
                                              disabled={isApproved}
                                              onCheckedChange={(next) => {
                                                setHasSoloAtEnd(next)
                                                if (!next) {
                                                  setValue("solo_end_hobbs", null, { shouldDirty: true })
                                                  setValue("solo_end_tach", null, { shouldDirty: true })
                                                }
                                              }}
                                            />
                                          </div>

                                          {hasSoloAtEnd && (
                                            <Field data-invalid={!!splitTimes.error} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="solo_end_hobbs" className="text-sm sm:text-xs font-medium">Solo End Hobbs</FieldLabel>
                                              <Input
                                                id="solo_end_hobbs"
                                                type="number"
                                                step="0.1"
                                                disabled={isApproved}
                                                {...register("solo_end_hobbs", { valueAsNumber: true })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                placeholder="e.g. 8755.0"
                                              />
                                            </Field>
                                          )}

                                          {splitTimes.error && (
                                            <div className="text-sm text-destructive">{splitTimes.error}</div>
                                          )}

                                          {instructorBasisConflictForSoloSplit && (
                                            <div className="text-sm text-destructive">
                                              Instructor charge basis differs from aircraft basis. Dual+solo split requires matching bases to stay auditable.
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </FieldSet>

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
                                            disabled={isApproved}
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
                                            disabled={isApproved}
                                            {...register("tach_end", { valueAsNumber: true })}
                                            className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                            placeholder="8754.5"
                                            aria-invalid={!!errors.tach_end}
                                          />
                                          <FieldError errors={errors.tach_end ? [{ message: errors.tach_end.message }] : undefined} />
                                        </Field>
                                      </FieldGroup>
                                    </FieldSet>
                                  </>
                                ) : (
                                  <>
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
                                            disabled={isApproved}
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
                                            disabled={isApproved}
                                            {...register("tach_end", { valueAsNumber: true })}
                                            className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                            placeholder="8754.5"
                                            aria-invalid={!!errors.tach_end}
                                          />
                                          <FieldError errors={errors.tach_end ? [{ message: errors.tach_end.message }] : undefined} />
                                        </Field>
                                      </FieldGroup>

                                      {/* Solo at end option - only for dual/trial flights */}
                                      {(instructionType === 'dual' || instructionType === 'trial') && (
                                        <div className="mt-3 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <FieldLabel className="text-sm font-medium">Solo at end</FieldLabel>
                                            <Switch
                                              checked={hasSoloAtEnd}
                                              disabled={isApproved}
                                              onCheckedChange={(next) => {
                                                setHasSoloAtEnd(next)
                                                if (!next) {
                                                  setValue("solo_end_hobbs", null, { shouldDirty: true })
                                                  setValue("solo_end_tach", null, { shouldDirty: true })
                                                }
                                              }}
                                            />
                                          </div>

                                          {hasSoloAtEnd && (
                                            <Field data-invalid={!!splitTimes.error} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="solo_end_tach" className="text-sm sm:text-xs font-medium">Solo End Tacho</FieldLabel>
                                              <Input
                                                id="solo_end_tach"
                                                type="number"
                                                step="0.1"
                                                disabled={isApproved}
                                                {...register("solo_end_tach", { valueAsNumber: true })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                placeholder="e.g. 8755.0"
                                              />
                                            </Field>
                                          )}

                                          {splitTimes.error && (
                                            <div className="text-sm text-destructive">{splitTimes.error}</div>
                                          )}

                                          {instructorBasisConflictForSoloSplit && (
                                            <div className="text-sm text-destructive">
                                              Instructor charge basis differs from aircraft basis. Dual+solo split requires matching bases to stay auditable.
                                            </div>
                                          )}
                                        </div>
                                      )}
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
                                            disabled={isApproved}
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
                                            disabled={isApproved}
                                            {...register("hobbs_end", { valueAsNumber: true })}
                                            className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                            placeholder="8754.5"
                                            aria-invalid={!!errors.hobbs_end}
                                          />
                                          <FieldError errors={errors.hobbs_end ? [{ message: errors.hobbs_end.message }] : undefined} />
                                        </Field>
                                      </FieldGroup>
                                    </FieldSet>
                                  </>
                                )}

                                {/* Calculate Button */}
                                <div className="pt-2">
                                  <Button
                                    type="button"
                                    size="lg"
                                    onClick={() => {
                                      void calculateDraft().catch((err) => toast.error(getErrorMessage(err)))
                                    }}
                                    disabled={isApproved}
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-12 sm:h-11 text-base sm:text-sm font-semibold"
                                  >
                                    <IconFileText className="h-5 w-5 mr-2" />
                                    {isDraftCalculated ? "Recalculate Flight Charges" : "Calculate Flight Charges"}
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
                                      disabled={isApproved}
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
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {aircraftChargeRateQuery.isLoading ? (
                                      <span>Loading aircraft rate…</span>
                                    ) : aircraftRatePerHourInclTax != null ? (
                                      <span className="tabular-nums">
                                        Aircraft rate: <span className="font-medium text-foreground">${aircraftRatePerHourInclTax.toFixed(2)}</span>/hr (inc. tax)
                                      </span>
                                    ) : (
                                      <span className="text-destructive">Aircraft rate not configured for this aircraft + flight type.</span>
                                    )}
                                  </div>
                                </Field>

                                <Field className="gap-2 sm:gap-1.5">
                                  <FieldLabel htmlFor="checked_out_instructor_id" className="flex items-center gap-2 text-base sm:text-sm font-medium text-foreground">
                                    <IconSchool className="h-5 w-5 sm:h-4 sm:w-4 text-foreground" />
                                    Instructor
                                  </FieldLabel>
                                  {isAdminOrInstructor && options ? (
                                    <Select
                                      disabled={isApproved}
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
                                  {!!selectedInstructorId && (
                                    <div className="mt-1 text-xs">
                                      {instructorChargeRateQuery.isLoading ? (
                                        <span className="text-muted-foreground">Loading instructor rate…</span>
                                      ) : instructorRatePerHourInclTax != null ? (
                                        <span className="text-muted-foreground tabular-nums">
                                          Instructor rate: <span className="font-medium text-foreground">${instructorRatePerHourInclTax.toFixed(2)}</span>/hr (inc. tax)
                                        </span>
                                      ) : (
                                        <span className="text-destructive">
                                          Instructor rate not configured for this flight type.
                                        </span>
                                      )}
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
                      <div className="space-y-6">
                        {isApproved ? (
                          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                            <div className="font-semibold text-green-800">Check-in approved</div>
                            <div className="mt-1 text-sm text-green-800/90">
                              This check-in is locked and has been invoiced.
                              {checkinInvoiceId && (
                                <>
                                  {' '}View invoice:{' '}
                                  <Link className="underline font-medium" href={`/invoices/${checkinInvoiceId}`}>
                                    {checkinInvoiceId}
                                  </Link>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {(aircraftChargeRateQuery.isLoading || instructorChargeRateQuery.isLoading) && (
                              <div className="text-sm text-muted-foreground">Loading charge rates…</div>
                            )}

                            {isAirswitchBillingUnsupported && (
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                This aircraft charge rate is configured to bill by <span className="font-semibold">airswitch</span>, but the check-in UI only supports Hobbs/Tacho.
                                Update the rate configuration to Hobbs or Tacho to proceed.
                              </div>
                            )}

                            {aircraftRateMissing && (
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                No aircraft charge rate configured for this aircraft + flight type.
                              </div>
                            )}

                            {instructorRateMissing && (
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                An instructor is assigned, but no instructor charge rate is configured for this flight type.
                                Approval is blocked to prevent underbilling.
                              </div>
                            )}

                            {!isDraftCalculated ? null : isDraftStale ? (
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                Draft is out of date. Recalculate flight charges before approving.
                              </div>
                            ) : (
                              <div className="rounded-lg border border-border/60 p-4">
                                <div className="text-sm font-semibold mb-3">Invoice items</div>

                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right w-[110px]">Qty (hrs)</TableHead>
                                        <TableHead className="text-right w-[160px]">Rate (inc. tax)</TableHead>
                                        <TableHead className="text-right w-[120px]">Line total</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {draftCalculation!.lines.map((line, idx) => (
                                        <TableRow key={`${line.description}-${idx}`}>
                                          <TableCell className="font-medium">
                                            <div className="min-w-0 truncate">{line.description}</div>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Input
                                              type="number"
                                              step="0.1"
                                              inputMode="decimal"
                                              value={Number.isFinite(line.quantity) ? String(line.quantity) : ""}
                                              onChange={(e) => {
                                                const v = e.target.value === "" ? NaN : Number(e.target.value)
                                                updateDraftLine(idx, { quantity: v })
                                              }}
                                              className="h-9 text-right tabular-nums"
                                            />
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <div className="relative">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                inputMode="decimal"
                                                value={(() => {
                                                  const effectiveTaxRate = (line.tax_rate ?? taxRate) || 0
                                                  if (!Number.isFinite(line.unit_price)) return ""
                                                  if (!Number.isFinite(effectiveTaxRate) || effectiveTaxRate <= 0) return String(line.unit_price)
                                                  return String(roundToTwoDecimals(line.unit_price * (1 + effectiveTaxRate)))
                                                })()}
                                                onChange={(e) => {
                                                  const effectiveTaxRate = (line.tax_rate ?? taxRate) || 0
                                                  const vInc = e.target.value === "" ? NaN : Number(e.target.value)
                                                  if (!Number.isFinite(vInc)) {
                                                    updateDraftLine(idx, { unit_price: NaN })
                                                    return
                                                  }
                                                  const divisor = 1 + (Number.isFinite(effectiveTaxRate) ? effectiveTaxRate : 0)
                                                  const vEx = divisor <= 0 ? vInc : (vInc / divisor)
                                                  updateDraftLine(idx, { unit_price: roundToTwoDecimals(vEx) })
                                                }}
                                                className="h-9 pl-7 text-right tabular-nums"
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums font-medium">
                                            ${Number(line.line_total ?? 0).toFixed(2)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                <div className="mt-4 border-t pt-4 space-y-2 text-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="text-muted-foreground">Subtotal</div>
                                    <div className="tabular-nums font-medium">${draftCalculation!.totals.subtotal.toFixed(2)}</div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-muted-foreground">Tax</div>
                                    <div className="tabular-nums font-medium">${draftCalculation!.totals.tax_total.toFixed(2)}</div>
                                  </div>
                                  <div className="flex items-center justify-between border-t pt-2">
                                    <div className="text-base font-semibold">Total</div>
                                    <div className="text-lg font-semibold tabular-nums text-primary">
                                      ${draftCalculation!.totals.total_amount.toFixed(2)}
                                    </div>
                                  </div>
                                </div>


                              </div>
                            )}

                            <div className="flex justify-end">
                              <Button
                                size="lg"
                                onClick={() => approveMutation.mutate()}
                                disabled={!canApprove}
                                className="h-12 px-6 font-semibold"
                              >
                                {approveMutation.isPending ? "Approving..." : "Approve Check-In & Create Invoice"}
                              </Button>
                            </div>
                          </>
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
    </>
  )
}
