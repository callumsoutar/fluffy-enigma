"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plane } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AircraftType, TotalTimeMethod } from "@/lib/types/aircraft"

const formSchema = z.object({
  registration: z.string().trim().min(1, "Registration is required").max(20, "Registration too long"),
  type: z.string().trim().min(1, "Type is required").max(100, "Type too long"),
  model: z.string().trim().max(100, "Model too long").optional(),
  manufacturer: z.string().trim().max(100, "Manufacturer too long").optional(),
  year_manufactured: z.number().int().min(1900, "Invalid year").max(2100, "Invalid year").optional(),

  status: z.string().trim().max(50, "Status too long").optional(),
  aircraft_type_id: z.string().uuid("Invalid aircraft type").optional(),
  total_time_method: z.enum([
    "hobbs",
    "tacho",
    "airswitch",
    "hobbs less 5%",
    "hobbs less 10%",
    "tacho less 5%",
    "tacho less 10%",
  ], { message: "Total time method is required" }),

  current_hobbs: z.number({ message: "Current hobbs is required" }).min(0, "Must be >= 0"),
  current_tach: z.number({ message: "Current tacho is required" }).min(0, "Must be >= 0"),

  on_line: z.boolean().optional(),
  prioritise_scheduling: z.boolean().optional(),
  record_hobbs: z.boolean().optional(),
  record_tacho: z.boolean().optional(),
  record_airswitch: z.boolean().optional(),
})

type FormValues = z.infer<typeof formSchema>

async function fetchAircraftTypes(): Promise<AircraftType[]> {
  const res = await fetch("/api/aircraft-types")
  if (!res.ok) return []
  const json = await res.json().catch(() => ({}))
  return (json?.aircraft_types as AircraftType[]) || []
}

export function AddAircraftModal(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { open, onOpenChange } = props
  const router = useRouter()
  const queryClient = useQueryClient()

  const [submitting, setSubmitting] = React.useState(false)
  const [aircraftTypes, setAircraftTypes] = React.useState<AircraftType[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      registration: "",
      type: "",
      model: "",
      manufacturer: "",
      year_manufactured: undefined,
      status: "active",
      aircraft_type_id: undefined,
      total_time_method: "hobbs",
      current_hobbs: 0,
      current_tach: 0,
      on_line: true,
      prioritise_scheduling: false,
      record_hobbs: true,
      record_tacho: true,
      record_airswitch: false,
    },
    mode: "onSubmit",
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      registration: "",
      type: "",
      model: "",
      manufacturer: "",
      year_manufactured: undefined,
      status: "active",
      aircraft_type_id: undefined,
      total_time_method: "hobbs",
      current_hobbs: 0,
      current_tach: 0,
      on_line: true,
      prioritise_scheduling: false,
      record_hobbs: true,
      record_tacho: true,
      record_airswitch: false,
    })
    setSubmitting(false)
    void fetchAircraftTypes().then(setAircraftTypes).catch(() => setAircraftTypes([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const errors = form.formState.errors

  async function submit(values: FormValues) {
    setSubmitting(true)
    try {
      const res = await fetch("/api/aircraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: values.registration,
          type: values.type,
          model: values.model?.trim() ? values.model : null,
          manufacturer: values.manufacturer?.trim() ? values.manufacturer : null,
          year_manufactured: values.year_manufactured ?? null,
          status: values.status?.trim() ? values.status : "active",
          aircraft_type_id: values.aircraft_type_id ?? null,
          total_time_method: values.total_time_method as TotalTimeMethod,
          current_hobbs: values.current_hobbs,
          current_tach: values.current_tach,
          on_line: values.on_line ?? true,
          prioritise_scheduling: values.prioritise_scheduling ?? false,
          record_hobbs: values.record_hobbs ?? false,
          record_tacho: values.record_tacho ?? false,
          record_airswitch: values.record_airswitch ?? false,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof json?.error === "string"
            ? json.error
            : res.status === 409
              ? "An aircraft with that registration already exists."
              : "Failed to create aircraft"
        toast.error(msg)
        return
      }

      const aircraft = json?.aircraft as { id?: string } | undefined
      if (!aircraft?.id) {
        toast.error("Aircraft created, but response was unexpected.")
        return
      }

      toast.success("Aircraft created")
      queryClient.invalidateQueries({ queryKey: ["aircraft"] })
      onOpenChange(false)
      router.push(`/aircraft/${aircraft.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[720px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Add Aircraft
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Create a new aircraft. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(submit)}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Aircraft Details
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      REGISTRATION <span className="text-destructive">*</span>
                    </label>
                    <Input
                      autoFocus
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. ZK-ABC"
                      {...form.register("registration")}
                    />
                    {errors.registration ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.registration.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      TYPE <span className="text-destructive">*</span>
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. C172"
                      {...form.register("type")}
                    />
                    {errors.type ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.type.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      MODEL
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. 172S"
                      {...form.register("model")}
                    />
                    {errors.model ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.model.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      MANUFACTURER
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. Cessna"
                      {...form.register("manufacturer")}
                    />
                    {errors.manufacturer ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.manufacturer.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      YEAR MANUFACTURED
                    </label>
                    <Input
                      type="number"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. 2008"
                      {...form.register("year_manufactured", { valueAsNumber: true })}
                    />
                    {errors.year_manufactured ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.year_manufactured.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      STATUS
                    </label>
                    <Select
                      value={form.watch("status") || "active"}
                      onValueChange={(v) => form.setValue("status", v, { shouldDirty: true })}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.status ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.status.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      AIRCRAFT CATEGORY (OPTIONAL)
                    </label>
                    <Select
                      value={form.watch("aircraft_type_id") || undefined}
                      onValueChange={(v) => form.setValue("aircraft_type_id", v || undefined, { shouldDirty: true })}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue placeholder="Select aircraft type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {aircraftTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.aircraft_type_id ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.aircraft_type_id.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      TOTAL TIME METHOD <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={form.watch("total_time_method") || ""}
                      onValueChange={(v) =>
                        form.setValue("total_time_method", v as FormValues["total_time_method"], {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
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
                    {errors.total_time_method ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.total_time_method.message}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Operational
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      CURRENT HOBBS <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. 1234.5"
                      {...form.register("current_hobbs", { valueAsNumber: true })}
                    />
                    {errors.current_hobbs ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.current_hobbs.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      CURRENT TACH <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. 987.6"
                      {...form.register("current_tach", { valueAsNumber: true })}
                    />
                    {errors.current_tach ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.current_tach.message}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex h-full min-h-[92px] items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <Checkbox
                          id="on_line"
                          className="mt-0.5"
                          checked={!!form.watch("on_line")}
                          onCheckedChange={(v) => form.setValue("on_line", !!v, { shouldDirty: true })}
                        />
                        <div className="min-w-0">
                          <Label htmlFor="on_line" className="text-xs font-semibold text-slate-900 leading-none">
                            Available for bookings
                          </Label>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                            This aircraft can be booked and is available for operations.
                          </p>
                        </div>
                      </div>

                      <div className="flex h-full min-h-[92px] items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <Checkbox
                          id="prioritise_scheduling"
                          className="mt-0.5"
                          checked={!!form.watch("prioritise_scheduling")}
                          onCheckedChange={(v) => form.setValue("prioritise_scheduling", !!v, { shouldDirty: true })}
                        />
                        <div className="min-w-0">
                          <Label
                            htmlFor="prioritise_scheduling"
                            className="text-xs font-semibold text-slate-900 leading-none"
                          >
                            Prioritise scheduling
                          </Label>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                            Give this aircraft priority in scheduling.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        <Checkbox
                          id="record_hobbs"
                          checked={!!form.watch("record_hobbs")}
                          onCheckedChange={(v) => form.setValue("record_hobbs", !!v, { shouldDirty: true })}
                        />
                        <Label htmlFor="record_hobbs" className="text-xs font-semibold text-slate-900">
                          Record Hobbs
                        </Label>
                      </div>
                      <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        <Checkbox
                          id="record_tacho"
                          checked={!!form.watch("record_tacho")}
                          onCheckedChange={(v) => form.setValue("record_tacho", !!v, { shouldDirty: true })}
                        />
                        <Label htmlFor="record_tacho" className="text-xs font-semibold text-slate-900">
                          Record Tacho
                        </Label>
                      </div>
                      <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        <Checkbox
                          id="record_airswitch"
                          checked={!!form.watch("record_airswitch")}
                          onCheckedChange={(v) => form.setValue("record_airswitch", !!v, { shouldDirty: true })}
                        />
                        <Label htmlFor="record_airswitch" className="text-xs font-semibold text-slate-900">
                          Record Airswitch
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </form>

          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                onClick={form.handleSubmit(submit)}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {submitting ? "Saving..." : "Save Aircraft"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


