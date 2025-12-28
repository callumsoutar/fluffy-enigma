"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EQUIPMENT_TYPE_OPTIONS, EQUIPMENT_STATUS_OPTIONS } from "@/lib/types/equipment"
import { equipmentCreateSchema } from "@/lib/validation/equipment"
import { Plus, Tag, Settings, Info, Hash, MapPin, Calendar, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type FormValues = z.infer<typeof equipmentCreateSchema>

export function AddEquipmentModal({ open, onOpenChange, onSuccess }: AddEquipmentModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(equipmentCreateSchema),
    defaultValues: {
      name: "",
      label: "",
      type: "Other",
      status: "active",
      serial_number: "",
      location: "",
      notes: "",
      year_purchased: undefined,
    },
  })

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        label: "",
        type: "Other",
        status: "active",
        serial_number: "",
        location: "",
        notes: "",
        year_purchased: undefined,
      })
    }
  }, [open, form])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add equipment")
      }

      toast.success("Equipment added successfully")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add equipment")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[600px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[min(calc(100dvh-4rem),850px)]"
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
                  Add Equipment
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Add a new equipment item to the inventory. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              {/* Basic Info */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Basic Info</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Equipment name"
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        {...form.register("name")}
                      />
                    </div>
                    {form.formState.errors.name && (
                      <p className="text-[10px] font-medium text-destructive">{form.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Label
                    </label>
                    <div className="relative">
                      <Info className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Optional label"
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        {...form.register("label")}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Classification */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Classification</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Type <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={form.watch("type")}
                      onValueChange={(value) => form.setValue("type", value as FormValues["type"])}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select type" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 text-base">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Status
                    </label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(value) => form.setValue("status", value as FormValues["status"])}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Plus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select status" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 text-base">
                            {option.label}
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
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Details & Location</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Serial Number
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Serial number"
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        {...form.register("serial_number")}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Storage location"
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        {...form.register("location")}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Year Purchased
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      type="number"
                      placeholder="2024"
                      className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      {...form.register("year_purchased", { valueAsNumber: true })}
                    />
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
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Additional Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      placeholder="Any additional notes..."
                      className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[100px] resize-none"
                      {...form.register("notes")}
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
                disabled={isSubmitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={form.handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {isSubmitting ? "Adding..." : "Add Equipment"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

