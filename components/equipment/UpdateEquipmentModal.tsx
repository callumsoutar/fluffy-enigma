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
import type { EquipmentWithIssuance } from "@/lib/types/equipment"
import { ClipboardList, Calendar, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface UpdateEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentWithIssuance
  onSuccess?: () => void
}

const updateSchema = z.object({
  next_due_at: z.string().optional(),
  notes: z.string().min(1, "Please provide update notes"),
})

type FormValues = z.infer<typeof updateSchema>

export function UpdateEquipmentModal({ open, onOpenChange, equipment, onSuccess }: UpdateEquipmentModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      next_due_at: "",
      notes: "",
    },
  })

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        next_due_at: "",
        notes: "",
      })
    }
  }, [open, form])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/equipment-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipment.id,
          next_due_at: values.next_due_at ? new Date(values.next_due_at).toISOString() : null,
          notes: values.notes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to log equipment update")
      }

      toast.success("Equipment update logged successfully")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log equipment update")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[500px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[min(calc(100dvh-4rem),850px)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Log Update
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Log maintenance or update for {equipment.name}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              {/* Equipment Context */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Equipment Details</span>
                </div>
                <div className="rounded-2xl bg-slate-50/50 border border-slate-100 p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Equipment</span>
                    <span className="font-bold text-slate-900">{equipment.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Type</span>
                    <span className="font-bold text-slate-900 capitalize">{equipment.type}</span>
                  </div>
                  {equipment.serial_number && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Serial Number</span>
                      <span className="font-bold text-slate-900">{equipment.serial_number}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Maintenance Schedule */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Schedule</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Next Maintenance Due
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      type="date"
                      className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      {...form.register("next_due_at")}
                    />
                  </div>
                </div>
              </section>

              {/* Update Log */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Update Log</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Update Notes <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      placeholder="Describe the maintenance or update performed..."
                      className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[120px] resize-none"
                      {...form.register("notes")}
                    />
                  </div>
                  {form.formState.errors.notes && (
                    <p className="text-[10px] font-medium text-destructive">{form.formState.errors.notes.message}</p>
                  )}
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
                {isSubmitting ? "Logging..." : "Log Update"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
