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
import MemberSelect, { type UserResult } from "@/components/invoices/MemberSelect"
import { LogOut, User, Calendar, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface IssueEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentWithIssuance
  onSuccess?: () => void
}

const issueSchema = z.object({
  user_id: z.string().uuid("Please select a user"),
  expected_return: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof issueSchema>

export function IssueEquipmentModal({ open, onOpenChange, equipment, onSuccess }: IssueEquipmentModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<UserResult | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      user_id: "",
      expected_return: "",
      notes: "",
    },
  })

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        user_id: "",
        expected_return: "",
        notes: "",
      })
      setSelectedUser(null)
    }
  }, [open, form])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/equipment-issuance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipment.id,
          user_id: values.user_id,
          expected_return: values.expected_return || null,
          notes: values.notes || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to issue equipment")
      }

      toast.success("Equipment issued successfully")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to issue equipment")
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
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Issue Equipment
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Issue {equipment.name} to a user. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              {/* Recipient */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Recipient</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Issue To <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400 z-10" />
                    <MemberSelect
                      value={selectedUser}
                      onSelect={(user) => {
                        setSelectedUser(user)
                        form.setValue("user_id", user?.id || "")
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                  {form.formState.errors.user_id && (
                    <p className="text-[10px] font-medium text-destructive">{form.formState.errors.user_id.message}</p>
                  )}
                </div>
              </section>

              {/* Timeline */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Timeline</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Expected Return Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      type="date"
                      className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      {...form.register("expected_return")}
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
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      placeholder="Additional notes..."
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
                {isSubmitting ? "Issuing..." : "Issue Equipment"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
