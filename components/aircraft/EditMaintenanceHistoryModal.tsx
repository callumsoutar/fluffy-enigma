"use client"

import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Wrench, Clock, FileText, Settings, DollarSign, Info } from "lucide-react"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useSchoolConfig } from "@/lib/hooks/use-school-config"
import { getZonedYyyyMmDdAndHHmm } from "@/lib/utils/timezone"
import type { VisitType } from "@/lib/types/maintenance_visits"

interface EditMaintenanceHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  maintenanceVisitId: string | null
  onSuccess?: () => void
}

function isValidDate(d: Date): boolean {
  return Number.isFinite(d.getTime())
}

/**
 * Date-only fields in `maintenance_visits` should behave like calendar dates.
 * We also have to tolerate legacy values (e.g. ISO timestamps) to avoid Invalid Date crashes.
 */
function parseDateOnlyFieldToLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null

  // Prefer the YYYY-MM-DD portion when present (works for ISO strings too).
  const ymd = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    // Local midnight, stable for date pickers.
    const local = new Date(`${ymd}T00:00:00`)
    return isValidDate(local) ? local : null
  }

  const fallback = new Date(value)
  return isValidDate(fallback) ? fallback : null
}

const VISIT_TYPE_OPTIONS: VisitType[] = [
  "Scheduled",
  "Unscheduled",
  "Inspection",
  "Repair",
  "Modification"
]

const EditMaintenanceHistoryModal: React.FC<EditMaintenanceHistoryModalProps> = ({
  open,
  onOpenChange,
  maintenanceVisitId,
  onSuccess,
}) => {
  const { data: schoolConfig } = useSchoolConfig()
  const timeZone = schoolConfig?.timeZone ?? "Pacific/Auckland"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialLoaded, setInitialLoaded] = useState(false)
  
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
  
  // Next due values
  const [nextDueHours, setNextDueHours] = useState<string>("")
  const [nextDueDate, setNextDueDate] = useState<Date | null>(null)
  
  // Component info
  const [componentName, setComponentName] = useState<string | null>(null)
  const [hasComponent, setHasComponent] = useState(false)

  // Fetch visit data when modal opens
  useEffect(() => {
    if (!open || !maintenanceVisitId) {
      setInitialLoaded(false)
      return
    }

    setLoading(true)
    setError(null)
    setInitialLoaded(false)

    fetch(`/api/maintenance-visits?maintenance_visit_id=${maintenanceVisitId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch maintenance visit")
        }
        const visit = await res.json()
        
        // Set form fields from visit data
        {
          const d = visit.visit_date ? parseISO(visit.visit_date) : null
          setVisitDate(d && isValidDate(d) ? d : null)
        }
        setVisitType(visit.visit_type || "")
        setDescription(visit.description || "")
        setTotalCost(visit.total_cost !== null && visit.total_cost !== undefined ? String(visit.total_cost) : "")
        setHoursAtVisit(visit.hours_at_visit !== null && visit.hours_at_visit !== undefined ? String(visit.hours_at_visit) : "")
        setNotes(visit.notes || "")
        {
          const d = visit.date_out_of_maintenance ? parseISO(visit.date_out_of_maintenance) : null
          setDateOutOfMaintenance(d && isValidDate(d) ? d : null)
        }
        
        // Component due tracking
        setComponentDueHours(visit.component_due_hours !== null && visit.component_due_hours !== undefined ? String(visit.component_due_hours) : "")
        setComponentDueDate(parseDateOnlyFieldToLocalDate(visit.component_due_date))
        
        // Next due values
        setNextDueHours(visit.next_due_hours !== null && visit.next_due_hours !== undefined ? String(visit.next_due_hours) : "")
        setNextDueDate(parseDateOnlyFieldToLocalDate(visit.next_due_date))
        
        // Component info
        if (visit.component_id) {
          setHasComponent(true)
          if (visit.component?.name) {
            setComponentName(visit.component.name)
          } else {
            // Fetch component name if not included
            fetch(`/api/aircraft-components?id=${visit.component_id}`)
              .then(res => res.json())
              .then(component => {
                if (component?.name) {
                  setComponentName(component.name)
                }
              })
              .catch(() => {
                // Silently fail - component name is not critical
              })
          }
        } else {
          setHasComponent(false)
          setComponentName(null)
        }
        
        setInitialLoaded(true)
      })
      .catch((err) => {
        const errorMessage = err instanceof Error ? err.message : "Failed to load maintenance visit"
        setError(errorMessage)
        toast.error(errorMessage)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, maintenanceVisitId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    
    if (!visitDate || !isValidDate(visitDate) || !visitType || !description) {
      setError("Visit date, type, and description are required.")
      toast.error("Visit date, type, and description are required.")
      return
    }
    
    if (!maintenanceVisitId) {
      setError("Missing maintenance visit ID.")
      return
    }
    
    setLoading(true)
    
    const componentDueDateYyyyMmDd =
      componentDueDate && isValidDate(componentDueDate)
        ? getZonedYyyyMmDdAndHHmm(componentDueDate, timeZone).yyyyMmDd
        : null

    const nextDueDateYyyyMmDd =
      nextDueDate && isValidDate(nextDueDate)
        ? getZonedYyyyMmDdAndHHmm(nextDueDate, timeZone).yyyyMmDd
        : null

    const dateOutIso =
      dateOutOfMaintenance && isValidDate(dateOutOfMaintenance) ? dateOutOfMaintenance.toISOString() : null

    const payload = {
      id: maintenanceVisitId,
      visit_date: visitDate.toISOString(),
      visit_type: visitType,
      description: description.trim(),
      total_cost: totalCost ? parseFloat(totalCost) : null,
      hours_at_visit: hoursAtVisit ? parseFloat(hoursAtVisit) : null,
      notes: notes.trim() || null,
      date_out_of_maintenance: dateOutIso,
      component_due_hours: componentDueHours ? parseFloat(componentDueHours) : null,
      component_due_date: componentDueDateYyyyMmDd,
      next_due_hours: nextDueHours ? parseFloat(nextDueHours) : null,
      next_due_date: nextDueDateYyyyMmDd,
    }
    
    try {
      const res = await fetch("/api/maintenance-visits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (res.ok) {
        toast.success("Maintenance visit updated successfully.")
        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        }
      } else {
        const data = await res.json()
        setError(data.error || "Failed to update maintenance visit")
        toast.error(data.error || "Failed to update maintenance visit")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update maintenance visit"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!initialLoaded && loading) {
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
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
              Edit Maintenance Visit
            </DialogTitle>
          </DialogHeader>
          <div className="flex h-full min-h-0 flex-col bg-white items-center justify-center">
            <div className="text-sm text-slate-500">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    )
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
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Edit Maintenance Visit
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Update the details of this recorded maintenance event.
                </DialogDescription>
              </div>
            </div>
            {hasComponent && componentName && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="text-xs font-semibold text-blue-800 mb-1">Component Maintenance</div>
                <div className="text-sm text-blue-700">{componentName}</div>
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              {/* Visit Details */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Visit Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Visit Date <span className="text-destructive">*</span>
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0",
                            !visitDate && "text-slate-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {visitDate ? format(visitDate, "dd MMM yyyy") : "Pick a date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl border-slate-200 shadow-xl" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={visitDate ?? undefined}
                          onSelect={date => setVisitDate(date ?? null)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Visit Type <span className="text-destructive">*</span>
                    </label>
                    <Select value={visitType} onValueChange={v => setVisitType(v as VisitType)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select type" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {VISIT_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type} className="rounded-lg py-2 text-base">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Description <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      placeholder="Describe the maintenance work performed..." 
                      required 
                      className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[80px] resize-none" 
                    />
                  </div>
                </div>
              </section>

              {/* Cost & Usage */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Cost & Usage</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Cost</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input 
                        type="number" 
                        step="0.01"
                        value={totalCost} 
                        onChange={e => setTotalCost(e.target.value)} 
                        placeholder="0.00" 
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Hours at Visit</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input 
                        type="number" 
                        step="0.1"
                        value={hoursAtVisit} 
                        onChange={e => setHoursAtVisit(e.target.value)} 
                        placeholder="0.0" 
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Component Due Tracking */}
              {hasComponent && (
                <>
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className="text-xs font-semibold tracking-tight text-slate-900">Component Due At Maintenance</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Due Hours</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                          <Input 
                            type="number" 
                            step="0.1"
                            value={componentDueHours} 
                            onChange={e => setComponentDueHours(e.target.value)} 
                            placeholder="Due hours" 
                            className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Including extension</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Due Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0",
                                !componentDueDate && "text-slate-400"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {componentDueDate ? format(componentDueDate, "dd MMM yyyy") : "Pick a date"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-xl border-slate-200 shadow-xl" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={componentDueDate ?? undefined}
                              onSelect={date => setComponentDueDate(date ?? null)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className="text-xs font-semibold tracking-tight text-slate-900">Next Due Values</span>
                    </div>
                    <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Next Due Hours</label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                            <Input 
                              type="number" 
                              step="0.1"
                              value={nextDueHours} 
                              onChange={e => setNextDueHours(e.target.value)} 
                              placeholder="Next due hours" 
                              className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Next Due Date</label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0",
                                  !nextDueDate && "text-slate-400"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {nextDueDate ? format(nextDueDate, "dd MMM yyyy") : "Pick a date"}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-xl border-slate-200 shadow-xl" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={nextDueDate ?? undefined}
                                onSelect={date => setNextDueDate(date ?? null)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 italic px-1">
                        Calculated: visit date/hours + interval
                      </p>
                    </div>
                  </section>
                </>
              )}

              {/* Return to Service */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Return to Service</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Date Out of Maintenance</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0",
                            !dateOutOfMaintenance && "text-slate-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {dateOutOfMaintenance ? format(dateOutOfMaintenance, "dd MMM yyyy") : "Pick a date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl border-slate-200 shadow-xl" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateOutOfMaintenance ?? undefined}
                          onSelect={date => setDateOutOfMaintenance(date ?? null)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Internal Notes</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Textarea 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        placeholder="Any additional notes..." 
                        className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[100px] resize-none" 
                      />
                    </div>
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

          {/* Footer */}
          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                disabled={loading}
                className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleSubmit}
                disabled={loading}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default EditMaintenanceHistoryModal
