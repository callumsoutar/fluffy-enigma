"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import React, { useState, useEffect } from "react"
import { AircraftComponent, ComponentType, IntervalType, ComponentStatus } from "@/lib/types/aircraft_components"
import { IconInfoCircle, IconRepeat, IconCalendar, IconSettings, IconNote, IconChevronDown, IconChevronUp, IconArrowUpRight, IconLoader } from "@tabler/icons-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

interface ComponentEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  component: AircraftComponent | null
  onSave: (updated: Partial<AircraftComponent>) => void
}

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"]
const STATUS_OPTIONS: ComponentStatus[] = ["active", "inactive", "removed"]
const COMPONENT_TYPE_OPTIONS: ComponentType[] = [
  "battery",
  "inspection",
  "service",
  "engine",
  "fuselage",
  "avionics",
  "elt",
  "propeller",
  "landing_gear",
  "other"
]
const INTERVAL_TYPE_OPTIONS: IntervalType[] = ["HOURS", "CALENDAR", "BOTH"]

const ComponentEditModal: React.FC<ComponentEditModalProps> = ({ open, onOpenChange, component, onSave }) => {
  // All fields
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [componentType, setComponentType] = useState<ComponentType>("inspection")
  const [intervalType, setIntervalType] = useState<IntervalType>("HOURS")
  const [intervalHours, setIntervalHours] = useState<number | null>(null)
  const [intervalDays, setIntervalDays] = useState<number | null>(null)
  const [currentDueDate, setCurrentDueDate] = useState<Date | null>(null)
  const [currentDueHours, setCurrentDueHours] = useState<number | null>(null)
  const [lastCompletedDate, setLastCompletedDate] = useState<Date | null>(null)
  const [lastCompletedHours, setLastCompletedHours] = useState<number | null>(null)
  const [status, setStatus] = useState<ComponentStatus>("active")
  const [priority, setPriority] = useState<string | null>("MEDIUM")
  const [notes, setNotes] = useState<string>("")
  const [loadingExtend, setLoadingExtend] = useState(false)
  const [revertLoading, setRevertLoading] = useState(false)
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)

  useEffect(() => {
    if (component && open) {
      setName(component.name || "")
      setDescription(component.description || "")
      setComponentType((component.component_type as ComponentType) || "inspection")
      setIntervalType((component.interval_type as IntervalType) || "HOURS")
      setIntervalHours(component.interval_hours ?? null)
      setIntervalDays(component.interval_days ?? null)
      setCurrentDueDate(component.current_due_date ? new Date(component.current_due_date) : null)
      setCurrentDueHours(component.current_due_hours ?? null)
      setLastCompletedDate(component.last_completed_date ? new Date(component.last_completed_date) : null)
      setLastCompletedHours(component.last_completed_hours ?? null)
      setStatus((component.status as ComponentStatus) || "active")
      setPriority(component.priority || "MEDIUM")
      setNotes(component.notes || "")
      setNotesExpanded(false)
      setShowRevertConfirm(false)
    }
  }, [component, open])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate required fields based on interval type
    if (intervalType === "HOURS" && (intervalHours === null || intervalHours === undefined)) {
      toast.error("Interval Hours is required when Interval Type is HOURS")
      return
    }
    if (intervalType === "CALENDAR" && (intervalDays === null || intervalDays === undefined)) {
      toast.error("Interval Days is required when Interval Type is CALENDAR")
      return
    }
    if (intervalType === "BOTH") {
      if (intervalHours === null || intervalHours === undefined) {
        toast.error("Interval Hours is required when Interval Type is BOTH")
        return
      }
      if (intervalDays === null || intervalDays === undefined) {
        toast.error("Interval Days is required when Interval Type is BOTH")
        return
      }
    }
    
    const payload = {
      name,
      description,
      component_type: componentType,
      interval_type: intervalType,
      interval_hours: intervalHours,
      interval_days: intervalDays,
      current_due_date: currentDueDate ? currentDueDate.toISOString().split('T')[0] : null,
      current_due_hours: currentDueHours,
      last_completed_date: lastCompletedDate ? lastCompletedDate.toISOString().split('T')[0] : null,
      last_completed_hours: lastCompletedHours,
      status: status as ComponentStatus,
      priority,
      notes,
    }
    try {
      await Promise.resolve(onSave(payload))
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save component:', error)
    }
  }

  async function handleExtend() {
    if (!component) return
    setLoadingExtend(true)
    try {
      const res = await fetch("/api/aircraft-components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: component.id, extension_limit_hours: 10 }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        toast.error(errorData.error || "Failed to extend component")
        setLoadingExtend(false)
        return
      }
      toast.success("Component extension applied!", { 
        description: "Extension limit set to 10%" 
      })
      // Refresh the page after a short delay to show the toast
      setTimeout(() => {
        if (typeof window !== 'undefined') window.location.reload()
      }, 1200)
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to extend component")
      } else {
        toast.error("Failed to extend component")
      }
    } finally {
      setLoadingExtend(false)
    }
  }

  async function handleRevertExtension() {
    if (!component) return
    setRevertLoading(true)
    try {
      const res = await fetch("/api/aircraft-components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: component.id, extension_limit_hours: null }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        toast.error(errorData.error || "Failed to revert extension")
        setRevertLoading(false)
        return
      }
      toast.success("Extension reverted. Component is now back to original due logic.")
      setTimeout(() => {
        if (typeof window !== 'undefined') window.location.reload()
      }, 1200)
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message || "Failed to revert extension")
      } else {
        toast.error("Failed to revert extension")
      }
    } finally {
      setRevertLoading(false)
      setShowRevertConfirm(false)
    }
  }

  if (!component) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[700px] max-w-[98vw] mx-auto p-6 bg-white rounded-2xl shadow-xl border border-muted overflow-y-auto max-h-[90vh]">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-xl font-bold tracking-tight">Edit Component</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-normal">
            Update all details for this aircraft component.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5 w-full" onSubmit={handleSave}>
          {/* Component Info */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <IconInfoCircle className="w-4 h-4 text-indigo-600" />
              <h3 className="text-base font-semibold">Component Info</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. 100 Hour Inspection" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Component Type <span className="text-red-500">*</span>
                </label>
                <Select value={componentType} onValueChange={v => setComponentType(v as ComponentType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Add any notes or details..." 
                className="resize-none h-16" 
              />
            </div>
          </div>
          <hr className="border-muted" />
          {/* Dates & Hours */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <IconCalendar className="w-4 h-4 text-green-600" />
              <h3 className="text-base font-semibold">Dates & Hours</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Last Completed Hours</label>
                <Input 
                  type="number" 
                  value={lastCompletedHours ?? ""} 
                  onChange={e => setLastCompletedHours(e.target.value ? Number(e.target.value) : null)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Completed Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={
                        "w-full justify-start text-left font-normal " +
                        (!lastCompletedDate ? "text-muted-foreground" : "")
                      }
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {lastCompletedDate ? format(lastCompletedDate, "dd MMM yyyy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={lastCompletedDate ?? undefined}
                      onSelect={date => setLastCompletedDate(date ?? null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Current Due Hours</label>
                  <Input 
                    type="number" 
                    value={currentDueHours ?? ""} 
                    onChange={e => setCurrentDueHours(e.target.value ? Number(e.target.value) : null)} 
                    className="bg-white" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Current Due Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={
                          "w-full justify-start text-left font-normal bg-white " +
                          (!currentDueDate ? "text-muted-foreground" : "")
                        }
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {currentDueDate ? format(currentDueDate, "dd MMM yyyy") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={currentDueDate ?? undefined}
                        onSelect={date => setCurrentDueDate(date ?? null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  onClick={handleExtend}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 text-sm"
                  disabled={loadingExtend || !component || component.extension_limit_hours !== null}
                >
                  {loadingExtend ? (
                    <IconLoader className="w-4 h-4 animate-spin" />
                  ) : (
                    <IconArrowUpRight className="w-4 h-4" />
                  )}
                  {loadingExtend ? "Extending..." : "Extend by 10%"}
                </Button>
                {component && component.extension_limit_hours !== null && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full sm:w-auto font-semibold flex items-center gap-2 text-sm"
                    disabled={revertLoading}
                    onClick={() => setShowRevertConfirm(true)}
                  >
                    {revertLoading ? (
                      <IconLoader className="w-4 h-4 animate-spin" />
                    ) : (
                      <IconArrowUpRight className="w-4 h-4 rotate-180" />
                    )}
                    {revertLoading ? "Reverting..." : "Revert Extension"}
                  </Button>
                )}
              </div>
              {/* Confirmation Dialog */}
              {showRevertConfirm && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-2">
                  <div className="text-xs text-red-700 font-medium">
                    Are you sure you want to revert the extension? This will remove the current extension limit and restore the original due logic.
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={handleRevertExtension} 
                      disabled={revertLoading}
                    >
                      Yes, Revert
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowRevertConfirm(false)} 
                      disabled={revertLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <hr className="border-muted" />
          {/* Intervals */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <IconRepeat className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-semibold">Intervals</h3>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Interval Type <span className="text-red-500">*</span>
              </label>
              <Select value={intervalType} onValueChange={v => setIntervalType(v as IntervalType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(intervalType === "HOURS" || intervalType === "BOTH") && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Interval Hours <span className="text-red-500">*</span>
                  </label>
                  <Input 
                    type="number" 
                    value={intervalHours ?? ""} 
                    onChange={e => setIntervalHours(e.target.value ? Number(e.target.value) : null)} 
                    placeholder="e.g. 100" 
                    required={intervalType === "HOURS" || intervalType === "BOTH"}
                  />
                </div>
              )}
              {(intervalType === "CALENDAR" || intervalType === "BOTH") && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Interval Days <span className="text-red-500">*</span>
                  </label>
                  <Input 
                    type="number" 
                    value={intervalDays ?? ""} 
                    onChange={e => setIntervalDays(e.target.value ? Number(e.target.value) : null)} 
                    placeholder="e.g. 365" 
                    required={intervalType === "CALENDAR" || intervalType === "BOTH"}
                  />
                </div>
              )}
            </div>
          </div>
          <hr className="border-muted" />
          {/* Status & Priority */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <IconSettings className="w-4 h-4 text-orange-600" />
              <h3 className="text-base font-semibold">Status & Priority</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <Select value={status} onValueChange={v => setStatus(v as ComponentStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((statusOption) => (
                      <SelectItem key={statusOption} value={statusOption}>
                        {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <Select value={priority || ""} onValueChange={v => setPriority(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <hr className="border-muted" />
          {/* Notes Section */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <IconNote className="w-4 h-4 text-purple-600" />
              <h3 className="text-base font-semibold">Notes</h3>
              {notesExpanded ? (
                <IconChevronUp className="w-4 h-4" />
              ) : (
                <IconChevronDown className="w-4 h-4" />
              )}
            </button>
            {notesExpanded && (
              <Textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Any additional notes..." 
                className="resize-none h-20" 
              />
            )}
          </div>
          <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
            <DialogClose asChild>
              <Button variant="outline" type="button" className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogClose>
            <Button 
              type="submit" 
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" 
              disabled={!component}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ComponentEditModal
