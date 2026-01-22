"use client"

import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { format } from "date-fns"
import { Eye, Calendar, AlertTriangle, Tag, FileText, Info, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ObservationStage, ObservationPriority, ObservationWithUser } from "@/lib/types/observations"

const OBSERVATION_PRIORITIES: ObservationPriority[] = ["low", "medium", "high"]
const OBSERVATION_STAGES: ObservationStage[] = ["open", "investigation", "resolution", "closed"]

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case "low":
      return "bg-green-100 text-green-800 border-green-200"
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "high":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getStageColor = (stage: ObservationStage): string => {
  switch (stage) {
    case "open":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "investigation":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "resolution":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "closed":
      return "bg-gray-100 text-gray-800 border-gray-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

interface ViewObservationModalProps {
  open: boolean
  onClose: () => void
  observationId: string
  refresh?: () => void
}

export function ViewObservationModal({
  open,
  onClose,
  observationId,
  refresh,
}: ViewObservationModalProps) {
  const [observation, setObservation] = useState<ObservationWithUser | null>(null)
  const [loadingObs, setLoadingObs] = useState(false)

  // Editable observation fields
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPriority, setEditPriority] = useState<ObservationPriority>("medium")
  const [editStage, setEditStage] = useState<ObservationStage>("open")
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Populate edit fields when observation loads
  useEffect(() => {
    if (observation) {
      setEditName(observation.name)
      setEditDescription(observation.description || "")
      const normalizedPriority = (observation.priority || "medium").toLowerCase().trim() as ObservationPriority
      const validPriority = OBSERVATION_PRIORITIES.includes(normalizedPriority) ? normalizedPriority : "medium"
      setEditPriority(validPriority)
      const normalizedStage = (observation.stage || "open").toLowerCase().trim() as ObservationStage
      const validStage = OBSERVATION_STAGES.includes(normalizedStage) ? normalizedStage : "open"
      setEditStage(validStage)
    }
  }, [observation])

  // Fetch observation details
  useEffect(() => {
    if (!open || !observationId) return
    setLoadingObs(true)
    fetch(`/api/observations?id=${observationId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed to fetch observation")))
      .then(setObservation)
      .catch(() => setObservation(null))
      .finally(() => setLoadingObs(false))
  }, [open, observationId])

  // Save handler
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditError(null)
    if (!editName || !editStage) {
      setEditError("Name and Stage are required.")
      return
    }
    setEditLoading(true)
    const payload = {
      id: observationId,
      name: editName,
      description: editDescription || null,
      priority: editPriority,
      stage: editStage,
    }
    try {
      const res = await fetch("/api/observations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        // Refresh observation details
        const updated = await fetch(`/api/observations?id=${observationId}`).then((res) =>
          res.ok ? res.json() : null
        )
        setObservation(updated)
        toast.success("Observation changes saved.")
        refresh?.()
      } else {
        const data = await res.json()
        const errorMsg =
          typeof data.error === "string"
            ? data.error
            : data.error?.formErrors?.[0] || JSON.stringify(data.error) || "Failed to update observation"
        setEditError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update observation"
      setEditError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setEditLoading(false)
    }
  }

  interface UserData {
    first_name: string | null
    last_name: string | null
    email: string
  }
  
  const getUserName = (user: UserData | null | undefined) => {
    if (!user) return "Unknown"
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
    return name || user.email || "Unknown"
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[750px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-[min(calc(100dvh-4rem),800px)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                <Eye className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Observation Details
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  View and manage observation information. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
              {observation && (
                <div className="hidden sm:flex items-center gap-2">
                  <Badge className={cn(getStageColor(observation.stage), "border text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider")}>
                    {observation.stage}
                  </Badge>
                  <Badge className={cn(getPriorityColor(observation.priority || "medium"), "border text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider")}>
                    {observation.priority || "medium"}
                  </Badge>
                </div>
              )}
            </div>
            {observation && (
              <div className="flex items-center gap-4 mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Created {format(new Date(observation.created_at), "dd MMM yyyy")}
                </div>
                {observation.reported_by_user && (
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Reported by {getUserName(observation.reported_by_user)}
                  </div>
                )}
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            {loadingObs ? (
              <div className="space-y-6">
                <section>
                  <Skeleton className="h-4 w-24 mb-3" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                </section>
                <section>
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </section>
              </div>
            ) : observation ? (
              <form id="observation-form" onSubmit={handleSaveEdit} className="space-y-6">
                {/* Basic Info */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Observation Info</span>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Name <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                          placeholder="Enter observation name..."
                          className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Priority Level <span className="text-destructive">*</span>
                        </label>
                        <Select
                          value={editPriority || "medium"}
                          onValueChange={(val) => setEditPriority(val as ObservationPriority)}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {OBSERVATION_PRIORITIES.map((s) => (
                              <SelectItem key={s} value={s} className="rounded-lg py-2 text-base capitalize">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      "w-2 h-2 rounded-full",
                                      s === "low" ? "bg-green-500" : s === "medium" ? "bg-yellow-500" : "bg-red-500"
                                    )}
                                  />
                                  {s}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Stage <span className="text-destructive">*</span>
                        </label>
                        <Select
                          value={editStage || "open"}
                          onValueChange={(val) => setEditStage(val as ObservationStage)}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <div className="flex items-center gap-2">
                              <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {OBSERVATION_STAGES.map((t) => (
                              <SelectItem key={t} value={t} className="rounded-lg py-2 text-base capitalize">
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Provide additional details about this observation..."
                          className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[120px] resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {editError && (
                  <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-red-800 text-sm font-medium">{editError}</div>
                  </div>
                )}
              </form>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-[24px] border border-dashed border-slate-200">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-4">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="text-slate-900 font-bold">Observation not found</div>
                <div className="text-slate-500 text-sm mt-1">
                  The requested observation could not be loaded.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
              >
                Close
              </Button>
              {observation && (
                <Button
                  form="observation-form"
                  type="submit"
                  disabled={editLoading || !editName || !editStage}
                  className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
