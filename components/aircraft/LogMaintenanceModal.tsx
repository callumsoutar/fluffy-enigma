"use client"

import React, { useEffect, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import type { AircraftComponent } from "@/lib/types/aircraft_components"
import type { VisitType } from "@/lib/types/maintenance_visits"

interface LogMaintenanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  aircraft_id: string
  component_id?: string | null
  onSuccess?: () => void
}

const VISIT_TYPE_OPTIONS: VisitType[] = [
  "Scheduled",
  "Unscheduled",
  "Inspection",
  "Repair",
  "Modification"
]

const LogMaintenanceModal: React.FC<LogMaintenanceModalProps> = ({
  open,
  onOpenChange,
  aircraft_id,
  component_id,
  onSuccess,
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [visitDate, setVisitDate] = useState<Date | null>(null)
  const [visitType, setVisitType] = useState<VisitType | "">("")
  const [description, setDescription] = useState("")
  const [totalCost, setTotalCost] = useState("")
  const [hoursAtVisit, setHoursAtVisit] = useState("")
  const [notes, setNotes] = useState("")
  const [dateOutOfMaintenance, setDateOutOfMaintenance] = useState<Date | null>(null)
  
  // Component due tracking
  const [componentDueHours, setComponentDueHours] = useState<string>("")
  const [componentDueDate, setComponentDueDate] = useState<Date | null>(null)
  
  // Next due values (calculated, but user can override)
  const [nextDueHours, setNextDueHours] = useState<string>("")
  const [nextDueDate, setNextDueDate] = useState<Date | null>(null)
  
  // Store component data for calculations
  const [componentData, setComponentData] = useState<AircraftComponent | null>(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      // Reset form
      setVisitDate(null)
      setVisitType("")
      setDescription("")
      setTotalCost("")
      setHoursAtVisit("")
      setNotes("")
      setDateOutOfMaintenance(null)
      setComponentDueHours("")
      setComponentDueDate(null)
      setNextDueHours("")
      setNextDueDate(null)
      setComponentData(null)
      setError(null)
    }
  }, [open])

  // Fetch aircraft data when modal opens
  useEffect(() => {
    if (open && aircraft_id) {
      (async () => {
        try {
          const res = await fetch(`/api/aircraft/${aircraft_id}`)
          if (res.ok) {
            const { aircraft } = await res.json()

            // Set initial hours at visit to aircraft's current total hours
            if (aircraft.total_hours) {
              setHoursAtVisit(String(aircraft.total_hours))
            }
          }
        } catch (err) {
          console.error('Failed to fetch aircraft details:', err)
        }
      })()
    }
  }, [open, aircraft_id])

  // Fetch component details and set due values when component_id is provided
  useEffect(() => {
    if (open && component_id) {
      (async () => {
        try {
          const res = await fetch(`/api/aircraft-components?id=${component_id}`)
          if (res.ok) {
            const component: AircraftComponent = await res.json()
            setComponentData(component)
            
            // Display the effective due hours (WITH extension if applied)
            // This is for reporting purposes - to show how early/late maintenance was performed
            // relative to the extended deadline
            if (component.current_due_hours !== null && component.current_due_hours !== undefined) {
              let effectiveDueHours = Number(component.current_due_hours)
              
              // Add extension if applicable
              if (component.extension_limit_hours && component.interval_hours) {
                const extensionHours = (Number(component.interval_hours) * Number(component.extension_limit_hours)) / 100
                effectiveDueHours = effectiveDueHours + extensionHours
              }
              
              setComponentDueHours(String(effectiveDueHours))
            }
            
            // Store the due date
            if (component.current_due_date) {
              setComponentDueDate(new Date(component.current_due_date))
            }
          }
        } catch (err) {
          console.error('Failed to fetch component details:', err)
        }
      })()
    }
  }, [open, component_id])
  
  // Calculate next due hours from component's base due (without extension) + interval
  // This ensures extensions never become cumulative
  useEffect(() => {
    if (componentData && componentData.interval_hours && componentData.current_due_hours !== null) {
      // Next due = component's BASE due (without extension) + interval
      // Example: Due at 17715.5 (extended to 17725.5), done at 17717.4
      // Next due = 17715.5 + 100 = 17815.5 (NOT 17717.4 + 100 = 17817.4)
      const baseDueHours = Number(componentData.current_due_hours)
      const nextDue = baseDueHours + Number(componentData.interval_hours)
      setNextDueHours(String(nextDue))
    }
  }, [componentData])
  
  // Calculate next due date when visitDate changes
  useEffect(() => {
    if (componentData && visitDate && componentData.interval_days) {
      const intervalType = componentData.interval_type
      if (intervalType === 'CALENDAR' || intervalType === 'BOTH') {
        const nextDue = new Date(visitDate.getTime() + Number(componentData.interval_days) * 24 * 60 * 60 * 1000)
        setNextDueDate(nextDue)
      }
    }
  }, [visitDate, componentData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    
    if (!visitDate || !visitType || !description || !user) {
      setError("Visit date, type, description, and user are required.")
      toast.error("Visit date, type, description, and user are required.")
      return
    }
    
    setLoading(true)
    const payload = {
      aircraft_id,
      component_id: component_id || null,
      visit_date: visitDate.toISOString(),
      visit_type: visitType,
      description: description.trim(),
      total_cost: totalCost ? parseFloat(totalCost) : null,
      hours_at_visit: hoursAtVisit ? parseFloat(hoursAtVisit) : null,
      notes: notes.trim() || null,
      date_out_of_maintenance: dateOutOfMaintenance ? dateOutOfMaintenance.toISOString() : null,
      performed_by: user.id,
      component_due_hours: componentDueHours ? parseFloat(componentDueHours) : null,
      component_due_date: componentDueDate ? componentDueDate.toISOString().split('T')[0] : null,
      next_due_hours: nextDueHours ? parseFloat(nextDueHours) : null,
      next_due_date: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
    }
    
    try {
      const res = await fetch("/api/maintenance-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (res.ok) {
        toast.success("Maintenance visit logged successfully.")
        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        }
      } else {
        const data = await res.json()
        setError(data.error || "Failed to log maintenance visit")
        toast.error(data.error || "Failed to log maintenance visit")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to log maintenance visit"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[700px] max-w-[98vw] mx-auto p-8 bg-white rounded-2xl shadow-xl border border-muted overflow-y-auto max-h-[90vh]">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-2xl font-bold mb-1 tracking-tight">Log Maintenance Visit</DialogTitle>
          <DialogDescription className="mb-2 text-base text-muted-foreground font-normal">
            Record a completed maintenance visit for this aircraft.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Visit Date <span className="text-red-500">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={
                      "w-full justify-start text-left font-normal " +
                      (!visitDate ? "text-muted-foreground" : "")
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {visitDate ? format(visitDate, "dd MMM yyyy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={visitDate ?? undefined}
                    onSelect={date => setVisitDate(date ?? null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Visit Type <span className="text-red-500">*</span>
              </label>
              <Select value={visitType} onValueChange={v => setVisitType(v as VisitType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select visit type" />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Description <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the maintenance work performed..."
              className="min-h-[60px]"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Total Cost</label>
              <Input
                type="number"
                step="0.01"
                value={totalCost}
                onChange={e => setTotalCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hours at Visit</label>
              <Input
                type="number"
                step="0.1"
                value={hoursAtVisit}
                onChange={e => setHoursAtVisit(e.target.value)}
                placeholder="0.0"
              />
            </div>
          </div>
          
          {/* Component Due Tracking - Only show if logging maintenance for a component */}
          {component_id && (
            <>
              <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Component Due At Maintenance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Component Due Hours</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={componentDueHours}
                      onChange={e => setComponentDueHours(e.target.value)}
                      placeholder="Component due hours"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Hours component was due (including extension)</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Component Due Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={
                            "w-full justify-start text-left font-normal " +
                            (!componentDueDate ? "text-muted-foreground" : "")
                          }
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {componentDueDate ? format(componentDueDate, "dd MMM yyyy") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={componentDueDate ?? undefined}
                          onSelect={date => setComponentDueDate(date ?? null)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-1">Date component was due</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold mb-3 text-green-600">Next Due Values (After This Maintenance)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Next Due Hours</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={nextDueHours}
                      onChange={e => setNextDueHours(e.target.value)}
                      placeholder="Next due hours"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Calculated: base due + interval (extensions not cumulative)</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Next Due Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={
                            "w-full justify-start text-left font-normal " +
                            (!nextDueDate ? "text-muted-foreground" : "")
                          }
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {nextDueDate ? format(nextDueDate, "dd MMM yyyy") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={nextDueDate ?? undefined}
                          onSelect={date => setNextDueDate(date ?? null)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-1">Calculated: visit date + interval (editable)</p>
                  </div>
                </div>
              </div>
            </>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">Date Out of Maintenance</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={
                    "w-full justify-start text-left font-normal " +
                    (!dateOutOfMaintenance ? "text-muted-foreground" : "")
                  }
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateOutOfMaintenance ? format(dateOutOfMaintenance, "dd MMM yyyy") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateOutOfMaintenance ?? undefined}
                  onSelect={date => setDateOutOfMaintenance(date ?? null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="min-h-[60px]"
            />
          </div>
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
            <DialogClose asChild>
              <Button 
                variant="outline" 
                type="button" 
                className="w-full sm:w-auto border border-muted hover:border-[#89d2dc]" 
                disabled={loading}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button 
              type="submit" 
              className="w-full sm:w-auto bg-[#6564db] hover:bg-[#232ed1] text-white font-semibold shadow-md" 
              disabled={loading}
            >
              {loading ? "Logging..." : "Log Visit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default LogMaintenanceModal
