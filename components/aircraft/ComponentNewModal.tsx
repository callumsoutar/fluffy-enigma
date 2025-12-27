"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import React, { useState } from "react"
import { AircraftComponent, ComponentType, IntervalType, ComponentStatus } from "@/lib/types/aircraft_components"
import { format } from "date-fns"
import { CalendarIcon, Plus, Info, Repeat, Settings, FileText, Tag, Clock, Calendar } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[700px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-[min(calc(100dvh-4rem),850px)]"
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
                  Create Component
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Enter details for the new aircraft component. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              {/* Component Info */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Component Info</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="e.g. 100 Hour Inspection" 
                        required 
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Component Type <span className="text-destructive">*</span>
                    </label>
                    <Select value={componentType} onValueChange={v => setComponentType(v as ComponentType)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select type" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {COMPONENT_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type} className="rounded-lg py-2 text-xs">
                            {type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                  <div className="relative">
                    <Info className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      placeholder="Add any notes or details..." 
                      className="rounded-xl border-slate-200 bg-white pl-9 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[80px] resize-none" 
                    />
                  </div>
                </div>
              </section>

              {/* Dates & Hours */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Dates & Hours</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Last Completed Hours</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input 
                        type="number" 
                        value={lastCompletedHours ?? ""} 
                        onChange={e => setLastCompletedHours(e.target.value ? Number(e.target.value) : null)} 
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Last Completed Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0",
                            !lastCompletedDate && "text-slate-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {lastCompletedDate ? format(lastCompletedDate, "dd MMM yyyy") : "Pick a date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl border-slate-200 shadow-xl" align="start">
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

                <div className="mt-5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Due Hours</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <Input 
                          type="number" 
                          value={currentDueHours ?? ""} 
                          onChange={e => setCurrentDueHours(e.target.value ? Number(e.target.value) : null)} 
                          className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Due Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0",
                              !currentDueDate && "text-slate-400"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {currentDueDate ? format(currentDueDate, "dd MMM yyyy") : "Pick a date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-xl border-slate-200 shadow-xl" align="start">
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
              </section>

              {/* Intervals */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Intervals</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Interval Type <span className="text-destructive">*</span>
                    </label>
                    <Select value={intervalType} onValueChange={v => setIntervalType(v as IntervalType)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Repeat className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select interval" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {INTERVAL_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type} className="rounded-lg py-2 text-xs">
                            {type.charAt(0) + type.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {(intervalType === "HOURS" || intervalType === "BOTH") && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Interval Hours <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                          <Input 
                            type="number" 
                            value={intervalHours ?? ""} 
                            onChange={e => setIntervalHours(e.target.value ? Number(e.target.value) : null)} 
                            placeholder="e.g. 100" 
                            required={intervalType === "HOURS" || intervalType === "BOTH"}
                            className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                      </div>
                    )}
                    {(intervalType === "CALENDAR" || intervalType === "BOTH") && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Interval Days <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                          <Input 
                            type="number" 
                            value={intervalDays ?? ""} 
                            onChange={e => setIntervalDays(e.target.value ? Number(e.target.value) : null)} 
                            placeholder="e.g. 365" 
                            required={intervalType === "CALENDAR" || intervalType === "BOTH"}
                            className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Status & Priority */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Status & Priority</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Status <span className="text-destructive">*</span>
                    </label>
                    <Select value={status} onValueChange={v => setStatus(v as ComponentStatus)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select status" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {STATUS_OPTIONS.map((statusOption) => (
                          <SelectItem key={statusOption} value={statusOption} className="rounded-lg py-2 text-xs">
                            {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Priority</label>
                    <Select value={priority || ""} onValueChange={v => setPriority(v)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select priority" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p} className="rounded-lg py-2 text-xs">
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Notes */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Notes & Remarks</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Internal Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea 
                      value={notes} 
                      onChange={e => setNotes(e.target.value)} 
                      placeholder="Any additional notes..." 
                      className="rounded-xl border-slate-200 bg-white pl-9 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[100px] resize-none" 
                    />
                  </div>
                </div>
              </section>
            </div>
          </form>

          {/* Footer */}
          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleSave}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                Create Component
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ComponentNewModal
