"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { IconAlertCircle } from "@tabler/icons-react"
import { ViewObservationModal } from "@/components/aircraft/ViewObservationModal"
import type { ObservationWithUser } from "@/lib/types/observations"

interface CheckoutObservationsProps {
  aircraftId?: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.statusText}`)
  }
  return res.json()
}

export function CheckoutObservations({ aircraftId }: CheckoutObservationsProps) {
  const [selectedObservationId, setSelectedObservationId] = React.useState<string | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)

  // Fetch observations for the aircraft
  const observationsQuery = useQuery({
    queryKey: ["observations", aircraftId],
    queryFn: () => fetchJson<ObservationWithUser[]>(`/api/observations?aircraft_id=${aircraftId}`),
    enabled: !!aircraftId,
  })

  // Filter for non-closed observations
  const openObservations = React.useMemo(() => {
    if (!observationsQuery.data) return []
    return observationsQuery.data.filter((obs) => obs.stage !== "closed")
  }, [observationsQuery.data])

  const handleObservationClick = (observationId: string) => {
    setSelectedObservationId(observationId)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedObservationId(null)
    // Refetch observations after modal closes in case it was updated
    observationsQuery.refetch()
  }

  if (!aircraftId || openObservations.length === 0) return null

  return (
    <>
      <div className="rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-2 shadow-sm">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold mb-2">
          <IconAlertCircle className="h-5 w-5" />
          <span>Open Observations</span>
        </div>
        <div className="space-y-1">
          {openObservations.map((observation) => (
            <button
              key={observation.id}
              onClick={() => handleObservationClick(observation.id)}
              className="text-left text-sm text-amber-600 dark:text-amber-400 leading-relaxed font-medium hover:text-amber-700 dark:hover:text-amber-300 hover:underline transition-colors w-full"
            >
              • {observation.name}
            </button>
          ))}
        </div>
      </div>

      {selectedObservationId && (
        <ViewObservationModal
          open={modalOpen}
          onClose={handleModalClose}
          observationId={selectedObservationId}
          refresh={observationsQuery.refetch}
        />
      )}
    </>
  )
}

