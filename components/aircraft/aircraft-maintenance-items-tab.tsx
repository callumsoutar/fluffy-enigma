"use client"

import { useEffect, useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconDotsVertical, IconClipboard, IconEdit, IconInfoCircle, IconTrash, IconPlus, IconClock, IconCalendar } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import type { AircraftComponent } from "@/lib/types/aircraft_components"
import { format } from 'date-fns'
import { toast } from "sonner"
import type { AircraftWithType } from "@/lib/types/aircraft"
import { cn } from "@/lib/utils"
import ComponentNewModal from "./ComponentNewModal"
import ComponentEditModal from "./ComponentEditModal"
import LogMaintenanceModal from "./LogMaintenanceModal"

interface MaintenanceItemsTabProps {
  components: AircraftComponent[]
  aircraft: AircraftWithType
}

interface ComponentWithComputed extends AircraftComponent {
  _computed: {
    extendedHours: number | null
    extendedDate: Date | null
    effectiveDueHours: number | null
    effectiveDueDate: Date | null
    dueScore: number
    dueIn: string
  }
}

// Calculate extended due hours when extension_limit_hours is set
function getExtendedDueHours(comp: AircraftComponent): number | null {
  if (
    comp.extension_limit_hours !== null &&
    comp.extension_limit_hours !== undefined &&
    comp.current_due_hours !== null &&
    comp.current_due_hours !== undefined &&
    comp.interval_hours !== null &&
    comp.interval_hours !== undefined
  ) {
    const currentDue = Number(comp.current_due_hours)
    const intervalHours = Number(comp.interval_hours)
    const extensionPercent = Number(comp.extension_limit_hours)
    
    return currentDue + (intervalHours * (extensionPercent / 100))
  }
  return null
}

// Calculate extended due date when extension_limit_hours is set
function getExtendedDueDate(comp: AircraftComponent): Date | null {
  if (
    comp.extension_limit_hours !== null &&
    comp.extension_limit_hours !== undefined &&
    comp.current_due_date &&
    comp.interval_days !== null &&
    comp.interval_days !== undefined
  ) {
    const baseDate = new Date(comp.current_due_date)
    const intervalDays = Number(comp.interval_days)
    const extensionPercent = Number(comp.extension_limit_hours)
    const extensionDays = intervalDays * (extensionPercent / 100)
    
    return new Date(baseDate.getTime() + extensionDays * 24 * 60 * 60 * 1000)
  }
  return null
}

function getDueIn(comp: AircraftComponent, currentHours: number | null) {
  if (currentHours === null) return "N/A"
  
  const extendedHours = getExtendedDueHours(comp)
  const extendedDate = getExtendedDueDate(comp)
  
  // 1. Check Hours (Priority for "HOURS" or "BOTH" types)
  if (comp.current_due_hours !== null && comp.current_due_hours !== undefined) {
    const effectiveHours = extendedHours ?? Number(comp.current_due_hours)
    const hoursLeft = effectiveHours - currentHours
    if (hoursLeft <= 0) return "Overdue"
    return `${Number(hoursLeft.toFixed(1))}h`
  } 
  
  // 2. Check Date
  if (comp.current_due_date) {
    const now = new Date()
    const due = extendedDate ?? new Date(comp.current_due_date)
    const diffMs = due.getTime() - now.getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    
    if (daysLeft <= 0) return "Overdue"
    return `${daysLeft} days`
  }
  
  return "N/A"
}

export function AircraftMaintenanceItemsTab({ components: initialComponents, aircraft }: MaintenanceItemsTabProps) {
  const [components, setComponents] = useState<AircraftComponent[]>(initialComponents || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentHours, setCurrentHours] = useState<number | null>(aircraft.total_hours || null)
  
  // Modal state
  const [logMaintenanceModalOpen, setLogMaintenanceModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedComponent, setSelectedComponent] = useState<AircraftComponent | null>(null)
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [componentToDelete, setComponentToDelete] = useState<ComponentWithComputed | null>(null)

  useEffect(() => {
    if (!aircraft.id) return

    let cancelled = false

    // Set loading state asynchronously to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }
    })

    Promise.all([
      fetch(`/api/aircraft-components?aircraft_id=${aircraft.id}`).then(res => res.json()),
      fetch(`/api/aircraft/${aircraft.id}`).then(res => res.json())
    ])
      .then(([componentsData, aircraftData]) => {
        if (!cancelled) {
          setComponents(Array.isArray(componentsData) ? componentsData : [])
          if (aircraftData.aircraft && aircraftData.aircraft.total_hours) {
            setCurrentHours(Number(aircraftData.aircraft.total_hours))
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to fetch data")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [aircraft.id])

  const handleLogMaintenance = (componentId: string) => {
    setSelectedComponentId(componentId)
    setLogMaintenanceModalOpen(true)
  }

  const handleMaintenanceLogged = () => {
    // Refresh components and aircraft data after maintenance is logged
    if (aircraft.id) {
      setLoading(true)
      Promise.all([
        fetch(`/api/aircraft-components?aircraft_id=${aircraft.id}`).then(res => res.json()),
        fetch(`/api/aircraft/${aircraft.id}`).then(res => res.json())
      ])
        .then(([componentsData, aircraftData]) => {
          setComponents(Array.isArray(componentsData) ? componentsData : [])
          if (aircraftData.aircraft && aircraftData.aircraft.total_hours) {
            setCurrentHours(Number(aircraftData.aircraft.total_hours))
          }
        })
        .catch(() => {
          setError("Failed to refresh data")
        })
        .finally(() => setLoading(false))
    }
  }

  const handleViewDetails = (component: AircraftComponent) => {
    setSelectedComponent(component)
    setEditModalOpen(true)
  }

  const handleDeleteComponent = (component: ComponentWithComputed) => {
    setComponentToDelete(component)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteComponent = async () => {
    if (!componentToDelete) return

    try {
      const res = await fetch(`/api/aircraft-components`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: componentToDelete.id }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        toast.error(errorData.error || "Failed to delete component")
        return
      }

      setComponents(prev => prev.filter(c => c.id !== componentToDelete.id))
      toast.success("Component deleted successfully")
      setDeleteConfirmOpen(false)
      setComponentToDelete(null)
    } catch {
      toast.error("Failed to delete component")
    }
  }

  const handleEditSave = async (updated: Partial<AircraftComponent>) => {
    if (!selectedComponent) return
    const cleanUpdate = { ...updated }
    if (cleanUpdate.current_due_date === "") cleanUpdate.current_due_date = null
    if (cleanUpdate.last_completed_date === "") cleanUpdate.last_completed_date = null
    try {
      const res = await fetch(`/api/aircraft-components`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedComponent.id, ...cleanUpdate }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        toast.error(errorData.error || "Failed to update component")
        return
      }
      const updatedComponent = await res.json()
      setComponents((prev) => prev.map((c) => c.id === selectedComponent.id ? updatedComponent : c))
      setEditModalOpen(false)
      toast.success("Component updated successfully")
    } catch {
      toast.error("Failed to update component")
    }
  }

  const handleNewComponentSave = async (newComponent: Partial<AircraftComponent>) => {
    const newComp = {
      ...newComponent,
      aircraft_id: aircraft.id,
      current_due_date: newComponent.current_due_date === "" ? null : newComponent.current_due_date,
      last_completed_date: newComponent.last_completed_date === "" ? null : newComponent.last_completed_date,
    }
    try {
      const res = await fetch("/api/aircraft-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newComp),
      })
      if (!res.ok) {
        const errorData = await res.json()
        toast.error(errorData.error || "Failed to create component")
        return
      }
      const created = await res.json()
      setComponents(prev => [...prev, created])
      toast.success("Component created successfully")
      setNewModalOpen(false)
    } catch {
      toast.error("Failed to create component")
    }
  }

  // Pre-calculate extension data and sort - memoized for performance
  const sortedComponents = useMemo(() => {
    if (!components.length) return []

    const componentsWithExtensions = components.map(comp => {
      const extendedHours = getExtendedDueHours(comp)
      const extendedDate = getExtendedDueDate(comp)
      const effectiveDueHours = extendedHours ?? comp.current_due_hours
      const effectiveDueDate = extendedDate ?? (comp.current_due_date ? new Date(comp.current_due_date) : null)

      let dueScore = Infinity
      if (effectiveDueHours !== null && effectiveDueHours !== undefined && currentHours !== null) {
        dueScore = Number(effectiveDueHours) - currentHours
      } else if (effectiveDueDate) {
        // Use a stable reference to current time
        const currentTime = new Date().getTime()
        dueScore = effectiveDueDate.getTime() - currentTime
      }

      return {
        ...comp,
        _computed: {
          extendedHours,
          extendedDate,
          effectiveDueHours,
          effectiveDueDate,
          dueScore,
          dueIn: getDueIn(comp, currentHours)
        }
      }
    })

      return componentsWithExtensions.sort((a, b) => a._computed.dueScore - b._computed.dueScore) as ComponentWithComputed[]
  }, [components, currentHours])

  const getComponentStatus = (comp: ComponentWithComputed) => {
    const { extendedHours, extendedDate, effectiveDueHours, effectiveDueDate } = comp._computed
    const now = new Date()
    
    const baseDueDate = comp.current_due_date ? new Date(comp.current_due_date) : null
    const baseDueHours = comp.current_due_hours !== null ? Number(comp.current_due_hours) : null

    // 1. Check for Overdue (Past extension or past normal)
    const isOverdueHours = typeof effectiveDueHours === "number" && currentHours !== null && effectiveDueHours - currentHours <= 0
    const isOverdueDate = effectiveDueDate && effectiveDueDate.getTime() <= now.getTime()

    if (isOverdueHours || isOverdueDate) {
      return "Overdue"
    }

    // 2. Check for Within Extension (Past base but before extension)
    const isInExtensionHours = baseDueHours !== null && currentHours !== null && currentHours > baseDueHours && extendedHours !== null && currentHours <= extendedHours
    const isInExtensionDate = baseDueDate !== null && now.getTime() > baseDueDate.getTime() && extendedDate !== null && now.getTime() <= extendedDate.getTime()

    if (isInExtensionHours || isInExtensionDate) {
      return "Within Extension"
    }
    
    // 3. Check for Due Soon (Within 10 hours or 30 days of BASE due)
    const isSoonHours = baseDueHours !== null && currentHours !== null && (baseDueHours - currentHours <= 10)
    const isSoonDate = baseDueDate !== null && (baseDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 30
    
    if (isSoonHours || isSoonDate) {
      return "Due Soon"
    }
    
    return "Upcoming"
  }

  return (
    <div className="flex flex-col gap-6 mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Aircraft Components</h2>
          <p className="text-sm text-slate-500 mt-1">Manage maintenance schedules and track component health.</p>
        </div>
        <Button className="bg-slate-900 text-white font-bold rounded-xl h-10 shadow-lg shadow-slate-900/10 hover:bg-slate-800" onClick={() => setNewModalOpen(true)}>
          <IconPlus className="w-4 h-4 mr-2" />
          Add Component
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500">Component</th>
              <th className="px-4 py-3 text-center font-bold text-[10px] uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-3 text-center font-bold text-[10px] uppercase tracking-wider text-slate-500">Due At (hrs)</th>
              <th className="px-4 py-3 text-center font-bold text-[10px] uppercase tracking-wider text-slate-500">
                <div className="flex items-center justify-center gap-1">
                  Extension
                  <Popover>
                    <PopoverTrigger asChild>
                      <span className="cursor-pointer">
                        <IconInfoCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors" />
                      </span>
                    </PopoverTrigger>
                    <PopoverContent className="max-w-xs p-3 rounded-xl border-slate-200 shadow-xl text-xs leading-relaxed">
                      This is the maximum hours allowed with a regulatory extension (e.g., 10% over the normal interval).
                    </PopoverContent>
                  </Popover>
                </div>
              </th>
              <th className="px-4 py-3 text-center font-bold text-[10px] uppercase tracking-wider text-slate-500">Due Date</th>
              <th className="px-4 py-3 text-center font-bold text-[10px] uppercase tracking-wider text-slate-500">Remaining</th>
              <th className="px-4 py-3 text-right font-bold text-[10px] uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-medium">Loading components...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="text-center text-red-500 py-12 font-medium">{error}</td></tr>
            ) : sortedComponents.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-medium">No components tracked for this aircraft.</td></tr>
            ) : (
              sortedComponents.map((comp) => {
                const { extendedHours, dueIn } = comp._computed
                const status = getComponentStatus(comp)
                
                const now = new Date()
                const baseDueDate = comp.current_due_date ? new Date(comp.current_due_date) : null
                
                // Calculate days relative to BASE due date for a more intuitive display
                // since that's the date we show in the UI
                const daysDiff = baseDueDate 
                  ? Math.floor((baseDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) 
                  : null

                const rowClass = cn(
                  "group transition-colors",
                  status === "Due Soon" ? "bg-amber-50/30 hover:bg-amber-50/50" :
                  status === "Within Extension" ? "bg-orange-50/30 hover:bg-orange-50/50" :
                  status === "Overdue" ? "bg-red-50/30 hover:bg-red-50/50" :
                  "hover:bg-slate-50/50"
                )

                const borderClass = cn(
                  "w-1 absolute left-0 top-0 bottom-0",
                  status === "Due Soon" ? "bg-amber-400" :
                  status === "Within Extension" ? "bg-orange-400" :
                  status === "Overdue" ? "bg-red-500" :
                  "bg-transparent"
                )

                return (
                  <tr key={comp.id} className={rowClass}>
                    <td className="relative px-4 py-4 align-middle">
                      <div className={borderClass} />
                      <div className="pl-2">
                        <div className="font-bold text-slate-900">{comp.name}</div>
                        {comp.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{comp.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      {status === "Due Soon" && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-none">DUE SOON</Badge>
                      )}
                      {status === "Overdue" && (
                        <Badge variant="destructive" className="bg-red-500 text-white border-none text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-none">OVERDUE</Badge>
                      )}
                      {status === "Within Extension" && (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-none">EXTENSION</Badge>
                      )}
                      {status === "Upcoming" && (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-none">HEALTHY</Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center align-middle font-semibold text-slate-700">
                      {comp.current_due_hours !== null ? `${comp.current_due_hours}h` : "—"}
                    </td>
                    <td className="px-4 py-4 text-center align-middle font-medium text-slate-500">
                      {extendedHours !== null ? `${Number(extendedHours.toFixed(1))}h` : "—"}
                    </td>
                    <td className="px-4 py-4 text-center align-middle font-medium text-slate-600">
                      {comp.current_due_date ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-slate-700">
                            {format(new Date(comp.current_due_date), 'dd MMM yyyy')}
                          </span>
                          {daysDiff !== null && (status === "Overdue" || status === "Due Soon" || status === "Within Extension") && (
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-tight mt-0.5",
                              daysDiff < 0 ? "text-red-500" : "text-amber-500"
                            )}>
                              {daysDiff < 0 ? `${Math.abs(daysDiff)} days overdue` : `${daysDiff} days left`}
                            </span>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-slate-900">{dueIn}</span>
                        {extendedHours !== null && (
                          <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tight mt-0.5">Extended</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                            <IconDotsVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl p-1">
                          <DropdownMenuItem onClick={() => handleLogMaintenance(comp.id)} className="rounded-lg py-2 text-xs font-medium cursor-pointer">
                            <IconClipboard className="w-4 h-4 mr-2 text-slate-400" /> Log Maintenance
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-50" />
                          <DropdownMenuItem onClick={() => handleViewDetails(comp)} className="rounded-lg py-2 text-xs font-medium cursor-pointer">
                            <IconEdit className="w-4 h-4 mr-2 text-slate-400" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-50" />
                          <DropdownMenuItem
                            onClick={() => handleDeleteComponent(comp)}
                            className="rounded-lg py-2 text-xs font-bold text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                          >
                            <IconTrash className="w-4 h-4 mr-2" /> Delete Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400 font-medium">Loading components...</div>
        ) : error ? (
          <div className="text-center text-red-500 py-12 font-medium">{error}</div>
        ) : sortedComponents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-medium">No components tracked.</div>
        ) : (
          sortedComponents.map((comp) => {
            const { dueIn } = comp._computed
            const status = getComponentStatus(comp)
            
            const now = new Date()
            const baseDueDate = comp.current_due_date ? new Date(comp.current_due_date) : null
            
            // Calculate days relative to BASE due date
            const daysDiff = baseDueDate 
              ? Math.floor((baseDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) 
              : null

            const cardClass = cn(
              "relative overflow-hidden rounded-[20px] border bg-white p-4 shadow-sm",
              status === "Due Soon" ? "border-amber-100 bg-amber-50/10" :
              status === "Within Extension" ? "border-orange-100 bg-orange-50/10" :
              status === "Overdue" ? "border-red-100 bg-red-50/10" :
              "border-slate-100"
            )

            const borderClass = cn(
              "absolute left-0 top-0 bottom-0 w-1",
              status === "Due Soon" ? "bg-amber-400" :
              status === "Within Extension" ? "bg-orange-400" :
              status === "Overdue" ? "bg-red-500" :
              "bg-slate-100"
            )

            return (
              <div key={comp.id} className={cardClass}>
                <div className={borderClass} />
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="pr-2">
                    <h3 className="font-bold text-slate-900">{comp.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {status === "Due Soon" && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none">DUE SOON</Badge>
                      )}
                      {status === "Overdue" && (
                        <Badge variant="destructive" className="bg-red-500 text-white border-none text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none">OVERDUE</Badge>
                      )}
                      {status === "Within Extension" && (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none">EXTENSION</Badge>
                      )}
                      {status === "Upcoming" && (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none">HEALTHY</Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400">
                        <IconDotsVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl p-1 w-48">
                      <DropdownMenuItem onClick={() => handleLogMaintenance(comp.id)} className="rounded-lg py-2.5 text-xs font-semibold">
                        <IconClipboard className="w-4 h-4 mr-2" /> Log Maintenance
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewDetails(comp)} className="rounded-lg py-2.5 text-xs font-semibold">
                        <IconEdit className="w-4 h-4 mr-2" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem
                        onClick={() => handleDeleteComponent(comp)}
                        className="rounded-lg py-2.5 text-xs font-bold text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <IconTrash className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-2">
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconClock className="w-3 h-3" /> Due In
                    </div>
                    <div className="font-bold text-sm text-slate-900">{dueIn}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconCalendar className="w-3 h-3" /> Due At
                    </div>
                    <div className="flex flex-col">
                      <div className="font-bold text-sm text-slate-900">
                        {comp.current_due_hours ? `${comp.current_due_hours}h` : (comp.current_due_date ? format(new Date(comp.current_due_date), 'dd MMM') : "—")}
                      </div>
                      {daysDiff !== null && !comp.current_due_hours && (status === "Overdue" || status === "Due Soon" || status === "Within Extension") && (
                        <div className={cn(
                          "text-[9px] font-bold uppercase tracking-tight mt-0.5",
                          daysDiff < 0 ? "text-red-500" : "text-amber-500"
                        )}>
                          {daysDiff < 0 ? `${Math.abs(daysDiff)}d overdue` : `${daysDiff}d left`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {comp.description && (
                  <div className="mt-3 pt-3 border-t border-slate-50 pl-2">
                    <p className="text-[11px] text-slate-500 leading-relaxed italic line-clamp-2">
                      &quot;{comp.description}&quot;
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      
      {/* Edit Component Modal */}
      <ComponentEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        component={selectedComponent}
        onSave={handleEditSave}
      />

      {/* Log Maintenance Modal */}
      <LogMaintenanceModal
        open={logMaintenanceModalOpen}
        onOpenChange={setLogMaintenanceModalOpen}
        aircraft_id={aircraft.id}
        component_id={selectedComponentId}
        onSuccess={handleMaintenanceLogged}
      />

      <ComponentNewModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onSave={handleNewComponentSave}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the component &quot;{componentToDelete?.name}&quot;?
              This action cannot be undone and will remove the component from the aircraft&apos;s maintenance schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteComponent}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Component
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
