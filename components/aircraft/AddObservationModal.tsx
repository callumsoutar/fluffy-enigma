"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Observation</DialogTitle>
          <DialogDescription>
            Create a new observation for this aircraft
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Landing light U/S"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional details about this observation..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">
                Priority <span className="text-red-500">*</span>
              </Label>
              <Select value={priority} onValueChange={(val) => setPriority(val as ObservationPriority)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBSERVATION_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
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
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">
                Stage <span className="text-red-500">*</span>
              </Label>
              <Select value={stage} onValueChange={(val) => setStage(val as ObservationStage)}>
                <SelectTrigger id="stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBSERVATION_STAGES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Observation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
