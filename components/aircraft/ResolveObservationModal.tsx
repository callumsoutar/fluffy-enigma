"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { format } from "date-fns"
import { CheckCircle2, Calendar, FileText, Info } from "lucide-react"
import { cn } from "@/lib/utils"
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
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[700px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Resolve Observation
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Mark this observation as resolved. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingObs ? (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <div className="space-y-4">
                <Skeleton className="w-full h-20 rounded-xl" />
                <Skeleton className="w-full h-32 rounded-xl" />
              </div>
            </div>
          ) : observation ? (
            <form onSubmit={handleResolve} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <div className="space-y-6">
                {/* Observation Details */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Observation Details</span>
                  </div>
                  <div className="rounded-2xl bg-slate-50/50 border border-slate-100 p-4 space-y-3">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Title</div>
                      <div className="text-base font-semibold text-slate-900">{observation.name}</div>
                    </div>
                    {observation.description && (
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description</div>
                        <div className="text-sm text-slate-600 leading-relaxed">{observation.description}</div>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Created {format(new Date(observation.created_at), "dd MMM yyyy")}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Resolution Comments */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Resolution Details</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Resolution Comments <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Textarea
                        value={resolutionComments}
                        onChange={(e) => setResolutionComments(e.target.value)}
                        placeholder="Describe how this observation was resolved..."
                        rows={6}
                        required
                        autoFocus
                        className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 resize-none"
                      />
                    </div>
                  </div>
                </section>

                {error && (
                  <div className="rounded-xl bg-destructive/5 p-3 flex items-center gap-3 text-destructive border border-destructive/10">
                    <Info className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}
              </div>
            </form>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
              <div className="bg-red-50 text-red-600 rounded-full p-4 mb-4 ring-1 ring-red-200">
                <Info className="h-8 w-8" />
              </div>
              <div className="text-lg font-bold text-red-600 mb-2">Observation not found</div>
              <div className="text-sm text-slate-500 text-center">
                The requested observation could not be loaded.
              </div>
            </div>
          )}

          {!loadingObs && observation && (
            <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  onClick={handleResolve}
                  disabled={loading || !resolutionComments.trim()}
                  className="h-10 flex-[1.4] rounded-xl bg-green-600 text-sm font-bold text-white shadow-lg shadow-green-600/10 hover:bg-green-700"
                >
                  {loading ? "Resolving..." : "Resolve Observation"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
