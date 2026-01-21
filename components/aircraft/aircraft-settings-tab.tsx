"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState, useEffect } from "react"
import * as React from "react"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { AircraftType } from "@/lib/types/aircraft"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { IconInfoCircle, IconSettings, IconCurrencyDollar, IconPlus, IconRotateClockwise, IconDeviceFloppy } from "@tabler/icons-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import AircraftChargeRatesTable from "./AircraftChargeRatesTable"

const aircraftSchema = z.object({
  manufacturer: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year_manufactured: z.coerce.number().min(1900, "Invalid year").max(2100, "Invalid year").nullable().optional(),
  registration: z.string().min(1, "Required"),
  status: z.string().optional(),
  capacity: z.coerce.number().min(1).nullable().optional(),
  on_line: z.boolean().optional(),
  for_ato: z.boolean().optional(),
  prioritise_scheduling: z.boolean().optional(),
  aircraft_image_url: z.string().url("Invalid url").or(z.literal("")).or(z.null()).optional(),
  current_tach: z.coerce.number().nullable().optional(),
  current_hobbs: z.coerce.number().nullable().optional(),
  record_tacho: z.boolean().optional(),
  record_hobbs: z.boolean().optional(),
  record_airswitch: z.boolean().optional(),
  fuel_consumption: z.coerce.number().nullable().optional(),
  total_time_method: z.string().optional().nullable(),
  aircraft_type_id: z.string().optional().nullable(),
})

type AircraftFormValues = {
  manufacturer?: string | null
  type?: string | null
  model?: string | null
  year_manufactured?: number | null
  registration: string
  status?: string
  capacity?: number | null
  on_line?: boolean
  for_ato?: boolean
  prioritise_scheduling?: boolean
  aircraft_image_url?: string | null
  // total_hours deprecated - now using server-managed total_time_in_service
  current_tach?: number | null
  current_hobbs?: number | null
  record_tacho?: boolean
  record_hobbs?: boolean
  record_airswitch?: boolean
  fuel_consumption?: number | null
  total_time_method?: string | null
  aircraft_type_id?: string | null
}

const fetchAircraftTypes = async (): Promise<AircraftType[]> => {
  const response = await fetch("/api/aircraft-types")
  if (!response.ok) {
    throw new Error("Failed to fetch aircraft types")
  }
  const data = await response.json()
  return data.aircraft_types || []
}

interface SettingsTabProps {
  aircraft: AircraftWithType
}

export function AircraftSettingsTab({ aircraft }: SettingsTabProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aircraftTypes, setAircraftTypes] = useState<AircraftType[]>([])
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = useState(false)
  const [newTypeName, setNewTypeName] = useState("")
  const [newTypeCategory, setNewTypeCategory] = useState("")
  const [newTypeDescription, setNewTypeDescription] = useState("")
  const [isCreatingType, setIsCreatingType] = useState(false)
  const isMobile = useIsMobile()
  
  // Track sidebar state for banner positioning
  const [sidebarLeft, setSidebarLeft] = React.useState(0)
  
  React.useEffect(() => {
    if (isMobile) {
      setSidebarLeft(0)
      return
    }

    const updateSidebarPosition = () => {
      // Find the sidebar gap element which shows the actual sidebar width
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]')
      if (sidebarGap) {
        const computedWidth = window.getComputedStyle(sidebarGap).width
        const width = parseFloat(computedWidth) || 0
        setSidebarLeft(width)
        return
      }

      // Fallback: Check sidebar state from data attributes
      const sidebar = document.querySelector('[data-slot="sidebar"]')
      if (!sidebar) {
        setSidebarLeft(0)
        return
      }

      const state = sidebar.getAttribute('data-state')
      const collapsible = sidebar.getAttribute('data-collapsible')
      
      // Calculate left offset based on sidebar state
      if (state === 'collapsed') {
        if (collapsible === 'icon') {
          // Icon mode: use icon width (3rem = 48px)
          setSidebarLeft(48)
        } else {
          setSidebarLeft(0)
        }
      } else {
        // Expanded: use CSS variable or default width
        const root = document.documentElement
        const sidebarWidth = root.style.getPropertyValue('--sidebar-width')
        if (sidebarWidth) {
          // Parse CSS calc() value like "calc(var(--spacing) * 72)"
          const match = sidebarWidth.match(/calc\(var\(--spacing\)\s*\*\s*(\d+)\)/)
          if (match) {
            const multiplier = parseInt(match[1], 10)
            // Assuming --spacing is 4px (0.25rem)
            setSidebarLeft(multiplier * 4)
          } else {
            // Fallback to default expanded width
            setSidebarLeft(288) // 72 * 4 = 288px
          }
        } else {
          setSidebarLeft(288) // Default expanded width
        }
      }
    }

    updateSidebarPosition()
    
    // Update on resize and sidebar state changes
    window.addEventListener('resize', updateSidebarPosition)
    const observer = new MutationObserver(updateSidebarPosition)
    const sidebar = document.querySelector('[data-slot="sidebar"]')
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['data-state'] })
    }

    return () => {
      window.removeEventListener('resize', updateSidebarPosition)
      observer.disconnect()
    }
  }, [isMobile])

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors },
    watch,
    setValue,
  } = useForm<AircraftFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(aircraftSchema) as any, // Type inference issue with zodResolver and z.coerce.number()
    defaultValues: {
      manufacturer: aircraft.manufacturer || "",
      type: aircraft.type || "",
      model: aircraft.model || "",
      year_manufactured: aircraft.year_manufactured ?? undefined,
      registration: aircraft.registration,
      status: aircraft.status || "active",
      capacity: aircraft.capacity ?? undefined,
      on_line: aircraft.on_line ?? true,
      for_ato: aircraft.for_ato ?? false,
      prioritise_scheduling: aircraft.prioritise_scheduling ?? false,
      aircraft_image_url: aircraft.aircraft_image_url || "",
      current_tach: aircraft.current_tach ?? undefined,
      current_hobbs: aircraft.current_hobbs ?? undefined,
      record_tacho: aircraft.record_tacho ?? false,
      record_hobbs: aircraft.record_hobbs ?? false,
      record_airswitch: aircraft.record_airswitch ?? false,
      fuel_consumption: aircraft.fuel_consumption ?? undefined,
      total_time_method: aircraft.total_time_method ?? undefined,
      aircraft_type_id: aircraft.aircraft_type_id ?? undefined,
    },
  })

  useEffect(() => {
    const loadAircraftTypes = async () => {
      try {
        const types = await fetchAircraftTypes()
        setAircraftTypes(types)
      } catch {
        toast.error("Failed to load aircraft types")
      }
    }

    loadAircraftTypes()
  }, [])

  const handleCreateAircraftType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Aircraft type name is required")
      return
    }

    setIsCreatingType(true)
    try {
      const res = await fetch("/api/aircraft-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTypeName.trim(),
          category: newTypeCategory.trim() || null,
          description: newTypeDescription.trim() || null,
        }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        toast.error(result.error || "Failed to create aircraft type")
      } else {
        toast.success("Aircraft type created!")
        setAircraftTypes([...aircraftTypes, result.aircraft_type])
        setValue("aircraft_type_id", result.aircraft_type.id, { shouldDirty: true })
        setIsAddTypeDialogOpen(false)
        setNewTypeName("")
        setNewTypeCategory("")
        setNewTypeDescription("")
      }
    } catch {
      toast.error("Failed to create aircraft type")
    } finally {
      setIsCreatingType(false)
    }
  }

  const onSubmit = async (data: AircraftFormValues) => {
    setIsSaving(true)
    setError(null)

    // Clean data: convert "" to null for nullable fields, remove undefined
    const cleanData: Record<string, string | number | boolean | null> = { id: aircraft.id }
    Object.entries(data).forEach(([key, value]) => {
      if (value === "") {
        cleanData[key] = null
      } else if (value !== undefined) {
        cleanData[key] = value
      }
    })

    try {
      const res = await fetch(`/api/aircraft/${aircraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        setError(result.error || "Failed to update aircraft")
        toast.error(result.error || "Failed to update aircraft")
      } else {
        reset(data) // reset dirty state
        toast.success("Aircraft details saved!")
        // Refresh the page data would be handled by parent component
        window.location.reload() // Simple refresh for now
      }
    } catch {
      setError("Failed to update aircraft")
      toast.error("Failed to update aircraft")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUndo = () => {
    reset()
  }

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Aircraft Information</h3>
      </div>
      {/* General Info Section */}
      <Card className="mb-8 bg-white border border-gray-200 rounded-2xl p-4 sm:p-8 shadow-sm">
        <h4 className="flex items-center gap-2 text-base font-semibold mb-6 text-gray-900 tracking-tight border-b pb-2">
          <IconInfoCircle className="w-5 h-5 text-indigo-500" />
          General Info
        </h4>
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left column: Inputs */}
          <div className="flex-1 min-w-0 lg:basis-3/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <Label className="block text-sm font-medium mb-1 text-gray-800">Manufacturer</Label>
                <Input {...register("manufacturer")} className="bg-white w-full" />
                {errors.manufacturer && <p className="text-xs text-red-500 mt-1">{errors.manufacturer.message}</p>}
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1 text-gray-800">Aircraft Type</Label>
                <Select
                  value={watch("aircraft_type_id") || undefined}
                  onValueChange={v => setValue("aircraft_type_id", v ?? null, { shouldDirty: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select aircraft type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {aircraftTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                    <div className="border-t mt-1 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        onClick={() => setIsAddTypeDialogOpen(true)}
                      >
                        <IconPlus className="w-4 h-4 mr-2" />
                        Add Aircraft Type
                      </Button>
                    </div>
                  </SelectContent>
                </Select>
                {errors.aircraft_type_id && <p className="text-xs text-red-500 mt-1">{errors.aircraft_type_id.message}</p>}
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1 text-gray-800">Model</Label>
                <Input {...register("model")} className="bg-white w-full" />
                {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model.message}</p>}
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1 text-gray-800">Year Manufactured</Label>
                <Input type="number" {...register("year_manufactured")} className="bg-white w-full" />
                {errors.year_manufactured && <p className="text-xs text-red-500 mt-1">{errors.year_manufactured.message}</p>}
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1 text-gray-800">Registration</Label>
                <Input {...register("registration")} className="bg-white w-full" />
                {errors.registration && <p className="text-xs text-red-500 mt-1">{errors.registration.message}</p>}
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1 text-gray-800">Capacity</Label>
                <Input type="number" {...register("capacity")} className="bg-white w-full" />
                {errors.capacity && <p className="text-xs text-red-500 mt-1">{errors.capacity.message}</p>}
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1 text-gray-800">Fuel Consumption (L/hr)</Label>
                <Input type="number" step="0.1" {...register("fuel_consumption")} className="bg-white w-full" />
                {errors.fuel_consumption && <p className="text-xs text-red-500 mt-1">{errors.fuel_consumption.message}</p>}
              </div>
              <div className="md:col-span-2">
                <Label className="block text-sm font-medium mb-1 text-gray-800">Total Time Method</Label>
                <Select
                  value={watch("total_time_method") || undefined}
                  onValueChange={v => setValue("total_time_method", v ?? null, { shouldDirty: true })}
                >
                  <SelectTrigger className="w-full md:max-w-[16rem]">
                    <SelectValue placeholder="Select a method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="airswitch">Airswitch</SelectItem>
                    <SelectItem value="hobbs">Hobbs</SelectItem>
                    <SelectItem value="hobbs less 5%">Hobbs less 5%</SelectItem>
                    <SelectItem value="hobbs less 10%">Hobbs less 10%</SelectItem>
                    <SelectItem value="tacho">Tacho</SelectItem>
                    <SelectItem value="tacho less 5%">Tacho less 5%</SelectItem>
                    <SelectItem value="tacho less 10%">Tacho less 10%</SelectItem>
                  </SelectContent>
                </Select>
                {errors.total_time_method && <p className="text-xs text-red-500 mt-1">{errors.total_time_method.message}</p>}
              </div>
            </div>
          </div>
          {/* Right column: Toggles */}
          <div className="flex-1 min-w-0 lg:basis-2/5 lg:max-w-md">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
                <Checkbox
                  id="on_line"
                  className="mt-0.5"
                  checked={!!watch("on_line")}
                  onCheckedChange={v => setValue("on_line", !!v, { shouldDirty: true })}
                />
                <div className="min-w-0">
                  <Label htmlFor="on_line" className="font-medium text-sm text-gray-900 leading-none">
                    Available for Bookings
                  </Label>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">
                    This aircraft can be booked and is available for operations.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
                <Checkbox
                  id="prioritise_scheduling"
                  className="mt-0.5"
                  checked={!!watch("prioritise_scheduling")}
                  onCheckedChange={v => setValue("prioritise_scheduling", !!v, { shouldDirty: true })}
                />
                <div className="min-w-0">
                  <Label htmlFor="prioritise_scheduling" className="font-medium text-sm text-gray-900 leading-none">
                    Prioritise Scheduling
                  </Label>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">
                    Give this aircraft priority in scheduling algorithms.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
                <Checkbox
                  id="record_tacho"
                  className="mt-0.5"
                  checked={!!watch("record_tacho")}
                  onCheckedChange={v => setValue("record_tacho", !!v, { shouldDirty: true })}
                />
                <div className="min-w-0">
                  <Label htmlFor="record_tacho" className="font-medium text-sm text-gray-900 leading-none">
                    Record Tacho
                  </Label>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">
                    Track tacho readings for this aircraft.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
                <Checkbox
                  id="record_hobbs"
                  className="mt-0.5"
                  checked={!!watch("record_hobbs")}
                  onCheckedChange={v => setValue("record_hobbs", !!v, { shouldDirty: true })}
                />
                <div className="min-w-0">
                  <Label htmlFor="record_hobbs" className="font-medium text-sm text-gray-900 leading-none">
                    Record Hobbs
                  </Label>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">
                    Track Hobbs meter readings for this aircraft.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
                <Checkbox
                  id="record_airswitch"
                  className="mt-0.5"
                  checked={!!watch("record_airswitch")}
                  onCheckedChange={v => setValue("record_airswitch", !!v, { shouldDirty: true })}
                />
                <div className="min-w-0">
                  <Label htmlFor="record_airswitch" className="font-medium text-sm text-gray-900 leading-none">
                    Record Airswitch
                  </Label>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">
                    Track airswitch events for this aircraft.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Separator */}
        <div className="my-8 border-t border-gray-200" />
        {/* Operational Section (now below General Info) */}
        <div>
          <h4 className="flex items-center gap-2 text-base font-semibold mb-6 text-gray-900 tracking-tight">
            <IconSettings className="w-5 h-5 text-indigo-500" />
            Operational
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <Label className="block text-sm font-medium mb-1 text-gray-800">
                Total Time in Service (TTIS)
                <span className="ml-2 text-xs text-gray-500">(Server-managed)</span>
              </Label>
              <Input 
                type="number" 
                step="0.1" 
                value={aircraft.total_time_in_service?.toFixed(1) || "0.0"} 
                disabled 
                className="bg-gray-50 w-full cursor-not-allowed" 
              />
              <p className="text-xs text-gray-500 mt-1">Updated automatically via flight check-ins</p>
            </div>
            <div>
              <Label className="block text-sm font-medium mb-1 text-gray-800">Current Tach</Label>
              <Input type="number" step="0.1" {...register("current_tach")} className="bg-white w-full" />
              {errors.current_tach && <p className="text-xs text-red-500 mt-1">{errors.current_tach.message}</p>}
            </div>
            <div>
              <Label className="block text-sm font-medium mb-1 text-gray-800">Current Hobbs</Label>
              <Input type="number" step="0.1" {...register("current_hobbs")} className="bg-white w-full" />
              {errors.current_hobbs && <p className="text-xs text-red-500 mt-1">{errors.current_hobbs.message}</p>}
            </div>
          </div>
        </div>
      </Card>

      {/* Charge Rates Section */}
      <Card className="mb-8 bg-white border border-gray-200 rounded-2xl p-4 sm:p-8 shadow-sm">
        <h4 className="flex items-center gap-2 text-base font-semibold mb-6 text-gray-900 tracking-tight border-b pb-2">
          <IconCurrencyDollar className="w-5 h-5 text-indigo-500" />
          Charge Rates
        </h4>
        <AircraftChargeRatesTable aircraftId={aircraft.id} />
      </Card>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      
      {/* Add bottom padding when banner is visible to prevent content overlap */}
      {isDirty && <div className="h-24" />}
    </form>
    
    {/* Sticky Bottom Bar - Save Changes */}
    {isDirty && (
      <div 
        className="fixed bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl"
        style={{ 
          position: 'fixed',
          bottom: 0,
          // On mobile: full width, on desktop: start after sidebar (adjusts dynamically)
          left: isMobile ? 0 : `${sidebarLeft}px`,
          right: 0,
          zIndex: 50
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-end gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handleUndo}
              disabled={isSaving}
              className={`h-12 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"}`}
            >
              <IconRotateClockwise className="h-4 w-4 mr-2" />
              Undo Changes
            </Button>
            <Button
              size="lg"
              onClick={handleSubmit(onSubmit)}
              disabled={isSaving}
              className={`h-12 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all ${isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"}`}
            >
              <IconDeviceFloppy className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    )}

    <Dialog open={isAddTypeDialogOpen} onOpenChange={setIsAddTypeDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Aircraft Type</DialogTitle>
          <DialogDescription>
            Create a new aircraft type to categorize your aircraft fleet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="block text-sm font-medium mb-1">Name *</Label>
            <Input
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="e.g., Cessna 172"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium mb-1">Category</Label>
            <Input
              value={newTypeCategory}
              onChange={(e) => setNewTypeCategory(e.target.value)}
              placeholder="e.g., Single Engine"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium mb-1">Description</Label>
            <Input
              value={newTypeDescription}
              onChange={(e) => setNewTypeDescription(e.target.value)}
              placeholder="e.g., Four-seat, single-engine aircraft"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAddTypeDialogOpen(false)}
            disabled={isCreatingType}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreateAircraftType}
            disabled={isCreatingType || !newTypeName.trim()}
          >
            {isCreatingType ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

