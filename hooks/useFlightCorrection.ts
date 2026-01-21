"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

interface CorrectionData {
  hobbs_end?: number | null
  tach_end?: number | null
  airswitch_end?: number | null
  correction_reason: string
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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "Request failed"
}

interface UseFlightCorrectionOptions {
  bookingId: string
  onSuccess?: () => void
}

/**
 * Hook to manage flight correction state and mutations
 * 
 * @example
 * ```tsx
 * const { isCorrectionDialogOpen, openCorrectionDialog, closeCorrectionDialog, correctFlight, isSubmitting } = useFlightCorrection({
 *   bookingId,
 *   onSuccess: () => console.log('Correction applied!')
 * })
 * 
 * // In your component:
 * <Button onClick={openCorrectionDialog}>Correct Flight</Button>
 * 
 * <FlightCorrectionDialog
 *   booking={booking}
 *   open={isCorrectionDialogOpen}
 *   onOpenChange={closeCorrectionDialog}
 *   onCorrect={correctFlight}
 *   isSubmitting={isSubmitting}
 * />
 * ```
 */
export function useFlightCorrection({ bookingId, onSuccess }: UseFlightCorrectionOptions) {
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = React.useState(false)
  const queryClient = useQueryClient()

  const correctionMutation = useMutation({
    mutationFn: async (data: CorrectionData) => {
      return fetchJson(`/api/bookings/${bookingId}/checkin/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
      await queryClient.invalidateQueries({ queryKey: ["bookings"] })
      await queryClient.invalidateQueries({ queryKey: ["aircraft"] })
      toast.success("Flight correction applied successfully")
      setIsCorrectionDialogOpen(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const openCorrectionDialog = React.useCallback(() => {
    setIsCorrectionDialogOpen(true)
  }, [])

  const closeCorrectionDialog = React.useCallback(() => {
    setIsCorrectionDialogOpen(false)
  }, [])

  const correctFlight = React.useCallback(
    async (data: CorrectionData) => {
      await correctionMutation.mutateAsync(data)
    },
    [correctionMutation]
  )

  return {
    isCorrectionDialogOpen,
    openCorrectionDialog,
    closeCorrectionDialog,
    correctFlight,
    isSubmitting: correctionMutation.isPending,
  }
}
