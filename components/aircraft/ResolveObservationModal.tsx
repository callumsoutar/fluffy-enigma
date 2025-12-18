"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { format } from "date-fns"
import { IconCheck, IconCalendar } from "@tabler/icons-react"
import type { ObservationWithUser } from "@/lib/types/observations"

interface ResolveObservationModalProps {
  open: boolean
  onClose: () => void
  observationId: string
  refresh: () => void
}

export function ResolveObservationModal({
  open,
  onClose,
  observationId,
  refresh,
}: ResolveObservationModalProps) {
  const [observation, setObservation] = useState<ObservationWithUser | null>(null)
  const [loadingObs, setLoadingObs] = useState(false)
  const [resolutionComments, setResolutionComments] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch observation details
  useEffect(() => {
    if (!open || !observationId) return
    setLoadingObs(true)
    fetch(`/api/observations?id=${observationId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed to fetch observation")))
      .then((data) => {
        setObservation(data)
        setResolutionComments(data.resolution_comments || "")
      })
      .catch(() => setObservation(null))
      .finally(() => setLoadingObs(false))
  }, [open, observationId])

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!resolutionComments.trim()) {
      setError("Resolution comments are required")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/observations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: observationId,
          stage: "closed",
          resolution_comments: resolutionComments.trim(),
          resolved_at: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to resolve observation")
      }

      toast.success("Observation resolved successfully")
      setResolutionComments("")
      onClose()
      refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resolve observation"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCheck className="w-5 h-5 text-green-600" />
            Resolve Observation
          </DialogTitle>
          <DialogDescription>
            Mark this observation as resolved and provide resolution details
          </DialogDescription>
        </DialogHeader>

        {loadingObs ? (
          <div className="space-y-4">
            <Skeleton className="w-full h-20" />
            <Skeleton className="w-full h-32" />
          </div>
        ) : observation ? (
          <form onSubmit={handleResolve} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium text-slate-900">{observation.name}</div>
              {observation.description && (
                <div className="text-sm text-slate-600">{observation.description}</div>
              )}
              <div className="flex items-center gap-1 text-xs text-slate-500 pt-1">
                <IconCalendar className="w-3 h-3" />
                Created {format(new Date(observation.created_at), "dd MMM yyyy")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolutionComments">
                Resolution Comments <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="resolutionComments"
                value={resolutionComments}
                onChange={(e) => setResolutionComments(e.target.value)}
                placeholder="Describe how this observation was resolved..."
                rows={6}
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !resolutionComments.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? "Resolving..." : "Resolve Observation"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="text-center py-8">
            <div className="text-red-600 font-medium">Observation not found</div>
            <div className="text-slate-500 text-sm mt-1">
              The requested observation could not be loaded.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
