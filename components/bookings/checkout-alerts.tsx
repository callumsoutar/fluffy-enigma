"use client"

import * as React from "react"
import { useQueries } from "@tanstack/react-query"
import { IconAlertTriangle, IconAlertCircle, IconClock, IconPlane, IconSchool } from "@tabler/icons-react"
import { format, isBefore, addDays, subDays } from "date-fns"
import { ViewObservationModal } from "@/components/aircraft/ViewObservationModal"
import type { ObservationWithUser } from "@/lib/types/observations"
import { Skeleton } from "@/components/ui/skeleton"

interface CheckoutAlertsProps {
  memberId?: string
  instructorId?: string
  aircraftId?: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.statusText}`)
  }
  return res.json()
}

interface Member {
  id: string
  medical_certificate_expiry?: string | null
  class_1_medical_due?: string | null
  class_2_medical_due?: string | null
  DL9_due?: string | null
}

interface Instructor {
  id: string
  class_1_medical_due_date?: string | null
  instructor_check_due_date?: string | null
}

interface AircraftComponent {
  id: string
  name: string
  status: string
  current_due_hours?: number | string | null
}

interface Aircraft {
  id: string
  registration: string
  total_time_in_service?: number | string | null
}

interface TrainingData {
  flightExperience: Array<{
    unit: 'hours' | 'count' | 'landings'
    value: number
    occurred_at: string
  }>
}

type AlertType = 'warning' | 'observation' | 'info'

interface AlertItem {
  id: string
  type: AlertType
  message: string
  details?: string
  icon?: React.ReactNode
  onClick?: () => void
}

export function CheckoutAlerts({ memberId, instructorId, aircraftId }: CheckoutAlertsProps) {
  const [selectedObservationId, setSelectedObservationId] = React.useState<string | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)

  // Use useQueries to fetch everything in parallel
  const results = useQueries({
    queries: [
      {
        queryKey: ["member", memberId],
        queryFn: () => fetchJson<{ member: Member }>(`/api/members/${memberId}`),
        enabled: !!memberId,
      },
      {
        queryKey: ["instructor", instructorId],
        queryFn: () => fetchJson<{ instructor: Instructor }>(`/api/instructors/${instructorId}`),
        enabled: !!instructorId,
      },
      {
        queryKey: ["aircraft", aircraftId],
        queryFn: () => fetchJson<{ aircraft: Aircraft; components: AircraftComponent[] }>(`/api/aircraft/${aircraftId}`),
        enabled: !!aircraftId,
      },
      {
        queryKey: ["observations", aircraftId],
        queryFn: () => fetchJson<ObservationWithUser[]>(`/api/observations?aircraft_id=${aircraftId}`),
        enabled: !!aircraftId,
      },
      {
        queryKey: ["member-training", memberId],
        queryFn: () => fetchJson<{ training: TrainingData }>(`/api/members/${memberId}/training`),
        enabled: !!memberId,
      },
    ],
  })

  const [memberRes, instructorRes, aircraftRes, observationsRes, trainingRes] = results
  const isLoading = results.some(r => r.isLoading && r.isEnabled)

  // Memoize alert collection to prevent unnecessary re-renders
  const alerts = React.useMemo(() => {
    if (isLoading) return []

    const collectedAlerts: AlertItem[] = []
    const today = new Date()
    const thirtyDaysFromNow = addDays(today, 30)
    const ninetyDaysAgo = subDays(today, 90)

    // 1. Member Medical Expiry
    if (memberRes.data?.member) {
      const m = memberRes.data.member
      const medicalExpiry = m.medical_certificate_expiry ? new Date(m.medical_certificate_expiry) : null
      const class1Due = m.class_1_medical_due ? new Date(m.class_1_medical_due) : null
      const class2Due = m.class_2_medical_due ? new Date(m.class_2_medical_due) : null
      const dl9Due = m.DL9_due ? new Date(m.DL9_due) : null

      if (medicalExpiry && isBefore(medicalExpiry, today)) {
        collectedAlerts.push({
          id: 'member-medical-expired',
          type: 'warning',
          message: `Member medical certificate expired on ${format(medicalExpiry, "dd MMM yyyy")}`,
          icon: <IconAlertTriangle className="h-4 w-4" />
        })
      } else if (medicalExpiry && isBefore(medicalExpiry, thirtyDaysFromNow)) {
        collectedAlerts.push({
          id: 'member-medical-soon',
          type: 'warning',
          message: `Member medical certificate expires soon (${format(medicalExpiry, "dd MMM yyyy")})`,
          icon: <IconAlertTriangle className="h-4 w-4" />
        })
      }

      if (class1Due && isBefore(class1Due, today)) {
        collectedAlerts.push({ id: 'member-class1-expired', type: 'warning', message: `Member Class 1 Medical expired on ${format(class1Due, "dd MMM yyyy")}` })
      }
      if (class2Due && isBefore(class2Due, today)) {
        collectedAlerts.push({ id: 'member-class2-expired', type: 'warning', message: `Member Class 2 Medical expired on ${format(class2Due, "dd MMM yyyy")}` })
      }
      if (dl9Due && isBefore(dl9Due, today)) {
        collectedAlerts.push({ id: 'member-dl9-expired', type: 'warning', message: `Member DL9 expired on ${format(dl9Due, "dd MMM yyyy")}` })
      }
    }

    // 2. Instructor Warnings
    if (instructorRes.data?.instructor) {
      const i = instructorRes.data.instructor
      const class1Due = i.class_1_medical_due_date ? new Date(i.class_1_medical_due_date) : null
      const checkDue = i.instructor_check_due_date ? new Date(i.instructor_check_due_date) : null

      if (class1Due && isBefore(class1Due, today)) {
        collectedAlerts.push({
          id: 'instructor-medical-expired',
          type: 'warning',
          message: `Instructor Class 1 Medical expired on ${format(class1Due, "dd MMM yyyy")}`,
          icon: <IconSchool className="h-4 w-4" />
        })
      } else if (class1Due && isBefore(class1Due, thirtyDaysFromNow)) {
        collectedAlerts.push({
          id: 'instructor-medical-soon',
          type: 'warning',
          message: `Instructor Class 1 Medical expires soon (${format(class1Due, "dd MMM yyyy")})`,
          icon: <IconSchool className="h-4 w-4" />
        })
      }

      if (checkDue && isBefore(checkDue, today)) {
        collectedAlerts.push({
          id: 'instructor-check-expired',
          type: 'warning',
          message: `Instructor check expired on ${format(checkDue, "dd MMM yyyy")}`,
          icon: <IconSchool className="h-4 w-4" />
        })
      } else if (checkDue && isBefore(checkDue, thirtyDaysFromNow)) {
        collectedAlerts.push({
          id: 'instructor-check-soon',
          type: 'warning',
          message: `Instructor check expires soon (${format(checkDue, "dd MMM yyyy")})`,
          icon: <IconSchool className="h-4 w-4" />
        })
      }
    }

    // 3. Aircraft Components
    if (aircraftRes.data?.aircraft && aircraftRes.data?.components) {
      const aircraft = aircraftRes.data.aircraft
      const components = aircraftRes.data.components
      const currentTTIS = Number(aircraft.total_time_in_service || 0)

      components.forEach((comp) => {
        if (comp.status === 'active' && comp.current_due_hours) {
          const dueHours = Number(comp.current_due_hours)
          const hoursRemaining = dueHours - currentTTIS
          
          if (hoursRemaining <= 0) {
            collectedAlerts.push({
              id: `aircraft-comp-overdue-${comp.id}`,
              type: 'warning',
              message: `Aircraft component "${comp.name}" is OVERDUE (${Math.abs(hoursRemaining).toFixed(1)} hours ago)`,
              icon: <IconPlane className="h-4 w-4" />
            })
          } else if (hoursRemaining <= 10) {
            collectedAlerts.push({
              id: `aircraft-comp-soon-${comp.id}`,
              type: 'warning',
              message: `Aircraft component "${comp.name}" is due within ${hoursRemaining.toFixed(1)} hours`,
              icon: <IconPlane className="h-4 w-4" />
            })
          }
        }
      })
    }

    // 4. Currency Check (3 landings in 90 days)
    if (trainingRes.data?.training?.flightExperience) {
      const landingsIn90Days = trainingRes.data.training.flightExperience
        .filter(exp => exp.unit === 'landings' && isBefore(ninetyDaysAgo, new Date(exp.occurred_at)))
        .reduce((sum, exp) => sum + exp.value, 0)

      if (landingsIn90Days < 3) {
        collectedAlerts.push({
          id: 'member-currency-expired',
          type: 'warning',
          message: `Member currency expired: only ${landingsIn90Days} landings in the last 90 days (3 required)`,
          icon: <IconClock className="h-4 w-4" />
        })
      }
    }

    // 5. Open Observations
    if (observationsRes.data) {
      const openObservations = observationsRes.data.filter(obs => obs.stage !== 'closed')
      openObservations.forEach(obs => {
        collectedAlerts.push({
          id: `observation-${obs.id}`,
          type: 'observation',
          message: obs.name,
          details: 'Open aircraft observation',
          icon: <IconAlertCircle className="h-4 w-4" />,
          onClick: () => {
            setSelectedObservationId(obs.id)
            setModalOpen(true)
          }
        })
      })
    }

    return collectedAlerts
  }, [isLoading, memberRes.data, instructorRes.data, aircraftRes.data, observationsRes.data, trainingRes.data])

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedObservationId(null)
    observationsRes.refetch()
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[88px] w-full rounded-xl" />
      </div>
    )
  }

  if (alerts.length === 0) return null

  const warnings = alerts.filter(a => a.type === 'warning')
  const observations = alerts.filter(a => a.type === 'observation')

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {warnings.length > 0 && (
        <div className="rounded-xl p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-3">
            <IconAlertTriangle className="h-5 w-5" />
            <span>Checkout Warnings</span>
          </div>
          <div className="space-y-2">
            {warnings.map((alert) => (
              <div key={alert.id} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 leading-relaxed font-medium">
                <span className="mt-0.5 opacity-70">•</span>
                <div className="flex-1 flex items-center gap-2">
                  {alert.icon && <span className="opacity-70">{alert.icon}</span>}
                  <span>{alert.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {observations.length > 0 && (
        <div className="rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold mb-3">
            <IconAlertCircle className="h-5 w-5" />
            <span>Open Observations</span>
          </div>
          <div className="space-y-2">
            {observations.map((alert) => (
              <button
                key={alert.id}
                onClick={alert.onClick}
                className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400 leading-relaxed font-medium hover:text-amber-700 dark:hover:text-amber-300 hover:underline transition-all text-left w-full group"
              >
                <span className="mt-0.5 opacity-70 group-hover:no-underline">•</span>
                <div className="flex-1 flex items-center gap-2">
                  {alert.icon && <span className="opacity-70">{alert.icon}</span>}
                  <span>{alert.message}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedObservationId && (
        <ViewObservationModal
          open={modalOpen}
          onClose={handleModalClose}
          observationId={selectedObservationId}
          refresh={observationsRes.refetch}
        />
      )}
    </div>
  )
}
