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
import { Textarea } from "@/components/ui/textarea"
import type { EquipmentWithIssuance } from "@/lib/types/equipment"
import { LogIn, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReturnEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentWithIssuance
  onSuccess?: () => void
}

const returnSchema = z.object({
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof returnSchema>

export function ReturnEquipmentModal({ open, onOpenChange, equipment, onSuccess }: ReturnEquipmentModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      notes: "",
    },
  })

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        notes: "",
      })
    }
  }, [open, form])

  const onSubmit = async (values: FormValues) => {
    if (!equipment.current_issuance) {
      toast.error("No active issuance found")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/equipment-issuance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuance_id: equipment.current_issuance.id,
          notes: values.notes || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to return equipment")
      }

      toast.success("Equipment returned successfully")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to return equipment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const issuedToName = equipment.issued_to_user
    ? `${equipment.issued_to_user.first_name || ''} ${equipment.issued_to_user.last_name || ''}`.trim() || equipment.issued_to_user.email
    : "Unknown"

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
                <LogIn className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Return Equipment
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Mark {equipment.name} as returned from {issuedToName}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              {/* Issuance Details */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Issuance Details</span>
                </div>
                <div className="rounded-2xl bg-slate-50/50 border border-slate-100 p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Equipment</span>
                    <span className="font-bold text-slate-900">{equipment.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Issued To</span>
                    <span className="font-bold text-slate-900">{issuedToName}</span>
                  </div>
                  {equipment.current_issuance?.issued_at && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Issued On</span>
                      <span className="font-bold text-slate-900">
                        {new Date(equipment.current_issuance.issued_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Notes */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Return Notes</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Notes & Condition</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      placeholder="Condition, issues, or other notes..."
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
                {isSubmitting ? "Processing..." : "Return Equipment"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
