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
import React, { useState } from "react"
import { AircraftComponent, ComponentType, IntervalType, ComponentStatus } from "@/lib/types/aircraft_components"
import { IconInfoCircle, IconRepeat, IconCalendar, IconSettings, IconNote, IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { toast } from "sonner"

interface ComponentNewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (newComponent: Partial<AircraftComponent>) => void
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

const ComponentNewModal: React.FC<ComponentNewModalProps> = ({ open, onOpenChange, onSave }) => {
  // All fields (no prefill)
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
  const [notes, setNotes] = useState("")
  const [notesExpanded, setNotesExpanded] = useState(false)

  // Reset fields when modal opens - use a ref to track if we've reset
  const hasResetRef = React.useRef(false)
  
  React.useEffect(() => {
    if (open && !hasResetRef.current) {
      // Use a small timeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setName("")
        setDescription("")
        setComponentType("inspection")
        setIntervalType("HOURS")
        setIntervalHours(null)
        setIntervalDays(null)
        setCurrentDueDate(null)
        setCurrentDueHours(null)
        setLastCompletedDate(null)
        setLastCompletedHours(null)
        setStatus("active")
        setPriority("MEDIUM")
        setNotes("")
        setNotesExpanded(false)
        hasResetRef.current = true
      }, 0)
      
      return () => clearTimeout(timeoutId)
    } else if (!open) {
      hasResetRef.current = false
    }
  }, [open])

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
      await onSave(payload)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save component:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[700px] max-w-[98vw] mx-auto p-6 bg-white rounded-2xl shadow-xl border border-muted overflow-y-auto max-h-[90vh]">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-xl font-bold tracking-tight">Create Component</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-normal">
            Enter details for the new aircraft component.
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
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3">
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
            >
              Create Component
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ComponentNewModal
