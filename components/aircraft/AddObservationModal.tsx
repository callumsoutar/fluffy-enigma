"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { ObservationStage, ObservationPriority } from "@/lib/types/observations"
import { Plus, AlertCircle, Info, Tag, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"

const OBSERVATION_PRIORITIES: ObservationPriority[] = ["low", "medium", "high"]
const OBSERVATION_STAGES: ObservationStage[] = ["open", "investigation", "resolution", "closed"]

interface AddObservationModalProps {
  open: boolean
  onClose: () => void
  aircraftId: string
  refresh: () => void
}

export function AddObservationModal({
  open,
  onClose,
  aircraftId,
  refresh,
}: AddObservationModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<ObservationPriority>("medium")
  const [stage, setStage] = useState<ObservationStage>("open")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Name is required")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/observations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aircraft_id: aircraftId,
          name: name.trim(),
          description: description.trim() || null,
          priority,
          stage,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create observation")
      }

      toast.success("Observation created successfully")
      // Reset form
      setName("")
      setDescription("")
      setPriority("medium")
      setStage("open")
      onClose()
      refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create observation"
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
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[600px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-[min(calc(100dvh-4rem),700px)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Add Observation
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Create a new observation for this aircraft. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              {/* Basic Information */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Identification</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Observation Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Landing light U/S"
                        required
                        autoFocus
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Priority & Stage */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Status & Priority</span>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="priority" className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Priority <span className="text-destructive">*</span>
                    </Label>
                    <Select value={priority} onValueChange={(val) => setPriority(val as ObservationPriority)}>
                      <SelectTrigger id="priority" className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {OBSERVATION_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize rounded-lg py-2 text-base">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  p === "low"
                                    ? "bg-green-500"
                                    : p === "medium"
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                              />
                              {p}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stage" className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Current Stage <span className="text-destructive">*</span>
                    </Label>
                    <Select value={stage} onValueChange={(val) => setStage(val as ObservationStage)}>
                      <SelectTrigger id="stage" className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {OBSERVATION_STAGES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize rounded-lg py-2 text-base">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Details */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Observation Details</span>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Detailed Description
                  </Label>
                  <div className="relative">
                    <Info className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide additional details about this observation..."
                      rows={4}
                      className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[120px]"
                    />
                  </div>
                </div>
              </section>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-800 text-sm font-medium">{error}</p>
                </div>
              )}
            </div>
          </form>

          {/* Footer */}
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
                disabled={loading || !name.trim()}
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e as React.FormEvent<HTMLButtonElement>);
                }}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {loading ? "Creating..." : "Create Observation"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
