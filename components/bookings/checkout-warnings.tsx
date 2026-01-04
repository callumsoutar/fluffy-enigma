"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { IconAlertTriangle } from "@tabler/icons-react"
import { format, isBefore, addDays } from "date-fns"

interface CheckoutWarningsProps {
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
  total_time_in_service?: number | string | null
}

export function CheckoutWarnings({ memberId, instructorId, aircraftId }: CheckoutWarningsProps) {
  // Fetch Member Details
  const memberQuery = useQuery({
    queryKey: ["member", memberId],
    queryFn: () => fetchJson<{ member: Member }>(`/api/members/${memberId}`),
    enabled: !!memberId,
  })

  // Fetch Instructor Details
  const instructorQuery = useQuery({
    queryKey: ["instructor", instructorId],
    queryFn: () => fetchJson<{ instructor: Instructor }>(`/api/instructors/${instructorId}`),
    enabled: !!instructorId,
  })

  // Fetch Aircraft Details (including components)
  const aircraftQuery = useQuery({
    queryKey: ["aircraft", aircraftId],
    queryFn: () => fetchJson<{ aircraft: Aircraft; components: AircraftComponent[] }>(`/api/aircraft/${aircraftId}`),
    enabled: !!aircraftId,
  })

  const warnings: string[] = []
  const today = new Date()
  const thirtyDaysFromNow = addDays(today, 30)

  // 1. Member Medical Expiry
  if (memberQuery.data?.member) {
    const m = memberQuery.data.member
    const medicalExpiry = m.medical_certificate_expiry ? new Date(m.medical_certificate_expiry) : null
    const class1Due = m.class_1_medical_due ? new Date(m.class_1_medical_due) : null
    const class2Due = m.class_2_medical_due ? new Date(m.class_2_medical_due) : null
    const dl9Due = m.DL9_due ? new Date(m.DL9_due) : null

    if (medicalExpiry && isBefore(medicalExpiry, today)) {
      warnings.push(`Member medical certificate expired on ${format(medicalExpiry, "dd MMM yyyy")}`)
    } else if (medicalExpiry && isBefore(medicalExpiry, thirtyDaysFromNow)) {
      warnings.push(`Member medical certificate expires soon (${format(medicalExpiry, "dd MMM yyyy")})`)
    }

    if (class1Due && isBefore(class1Due, today)) {
      warnings.push(`Member Class 1 Medical expired on ${format(class1Due, "dd MMM yyyy")}`)
    }
    if (class2Due && isBefore(class2Due, today)) {
      warnings.push(`Member Class 2 Medical expired on ${format(class2Due, "dd MMM yyyy")}`)
    }
    if (dl9Due && isBefore(dl9Due, today)) {
      warnings.push(`Member DL9 expired on ${format(dl9Due, "dd MMM yyyy")}`)
    }
  }

  // 2. Instructor Medical Expiry
  if (instructorQuery.data?.instructor) {
    const i = instructorQuery.data.instructor
    const class1Due = i.class_1_medical_due_date ? new Date(i.class_1_medical_due_date) : null

    if (class1Due && isBefore(class1Due, today)) {
      warnings.push(`Instructor Class 1 Medical expired on ${format(class1Due, "dd MMM yyyy")}`)
    } else if (class1Due && isBefore(class1Due, thirtyDaysFromNow)) {
      warnings.push(`Instructor Class 1 Medical expires soon (${format(class1Due, "dd MMM yyyy")})`)
    }
  }

  // 3. Instructor Check Expiry
  if (instructorQuery.data?.instructor) {
    const i = instructorQuery.data.instructor
    const checkDue = i.instructor_check_due_date ? new Date(i.instructor_check_due_date) : null

    if (checkDue && isBefore(checkDue, today)) {
      warnings.push(`Instructor check expired on ${format(checkDue, "dd MMM yyyy")}`)
    } else if (checkDue && isBefore(checkDue, thirtyDaysFromNow)) {
      warnings.push(`Instructor check expires soon (${format(checkDue, "dd MMM yyyy")})`)
    }
  }

  // 4. Aircraft Components (due within next 10 hours)
  if (aircraftQuery.data?.aircraft && aircraftQuery.data?.components) {
    const aircraft = aircraftQuery.data.aircraft
    const components = aircraftQuery.data.components
    const currentTTIS = Number(aircraft.total_time_in_service || 0)

    components.forEach((comp: AircraftComponent) => {
      if (comp.status === 'active' && comp.current_due_hours) {
        const dueHours = Number(comp.current_due_hours)
        const hoursRemaining = dueHours - currentTTIS
        
        if (hoursRemaining <= 0) {
          warnings.push(`Aircraft component "${comp.name}" is OVERDUE (${Math.abs(hoursRemaining).toFixed(1)} hours ago)`)
        } else if (hoursRemaining <= 10) {
          warnings.push(`Aircraft component "${comp.name}" is due within ${hoursRemaining.toFixed(1)} hours`)
        }
      }
    })
  }

  if (warnings.length === 0) return null

  return (
    <div className="rounded-xl p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 space-y-2 shadow-sm">
      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold mb-2">
        <IconAlertTriangle className="h-5 w-5" />
        <span>Checkout Warnings</span>
      </div>
      <div className="space-y-1">
        {warnings.map((warning, idx) => (
          <p key={idx} className="text-sm text-red-600 dark:text-red-400 leading-relaxed font-medium">
            • {warning}
          </p>
        ))}
      </div>
    </div>
  )
}

