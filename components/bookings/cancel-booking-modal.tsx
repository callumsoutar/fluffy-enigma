"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle } from "lucide-react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BookingWithRelations } from "@/lib/types/bookings"

type CancellationCategory = {
  id: string
  name: string
  description: string | null
}

const cancellationFormSchema = z.object({
  cancellation_category_id: z.string().uuid("Please select a cancellation category"),
  cancellation_reason: z.string().min(1, "Cancellation reason is required").max(500, "Reason too long"),
  cancelled_notes: z.string().max(2000, "Notes too long").optional().nullable(),
})

type CancellationFormValues = z.infer<typeof cancellationFormSchema>

async function fetchCancellationCategories(): Promise<CancellationCategory[]> {
  const res = await fetch("/api/cancellation-categories")
  if (!res.ok) throw new Error("Failed to load cancellation categories")
  const data = await res.json()
  return data.categories ?? []
}

export function CancelBookingModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: BookingWithRelations | null
  onCancelled?: () => void
}) {
  const { open, onOpenChange, booking, onCancelled } = props
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["cancellation-categories"],
    queryFn: fetchCancellationCategories,
    enabled: open,
    staleTime: 5 * 60_000, // 5 minutes
  })

  const form = useForm<CancellationFormValues>({
    resolver: zodResolver(cancellationFormSchema),
    defaultValues: {
      cancellation_category_id: "",
      cancellation_reason: "",
      cancelled_notes: "",
    },
    mode: "onSubmit",
  })

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      form.reset({
        cancellation_category_id: "",
        cancellation_reason: "",
        cancelled_notes: "",
      })
    }
  }, [open, form])

  const cancelBookingMutation = useMutation({
    mutationFn: async (values: CancellationFormValues) => {
      if (!booking) throw new Error("No booking selected")
      if (!user) throw new Error("You must be signed in to cancel a booking")

      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellation_category_id: values.cancellation_category_id,
          cancellation_reason: values.cancellation_reason,
          cancelled_notes: values.cancelled_notes || null,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof json?.error === "string" ? json.error : "Failed to cancel booking"
        throw new Error(msg)
      }

      return json.booking as BookingWithRelations
    },
    onSuccess: () => {
      toast.success("Booking cancelled successfully")
      queryClient.invalidateQueries({ queryKey: ["booking", booking?.id] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({ queryKey: ["scheduler", "bookings"] })
      onCancelled?.()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to cancel booking")
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    cancelBookingMutation.mutate(values)
  })

  const errors = form.formState.errors
  const isSubmitting = cancelBookingMutation.isPending

  // Don't show modal if booking is already cancelled
  if (booking?.cancelled_at) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        showCloseButton={false}
        className="p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[500px] h-[calc(100dvh-2rem)] sm:h-fit sm:max-h-[90vh]"
      >
        <div className="flex flex-1 flex-col min-h-0 bg-white overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 text-left shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Cancel Booking
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Please provide a reason for cancelling this booking.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="space-y-8">
                {/* Booking Info */}
                {booking && (
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span className="text-xs font-semibold tracking-tight text-slate-900">Booking Summary</span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Aircraft:</span>
                        <span className="text-slate-900 font-semibold">{booking.aircraft?.registration || "—"}</span>
                      </div>
                      {booking.student && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Student:</span>
                          <span className="text-slate-900 font-semibold">
                            {[booking.student.first_name, booking.student.last_name]
                              .filter(Boolean)
                              .join(" ") || booking.student.email}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Date & Time:</span>
                        <span className="text-slate-900 font-semibold">
                          {new Date(booking.start_time).toLocaleDateString()} @ {new Date(booking.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </section>
                )}

                {/* Cancellation Reason */}
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Cancellation Details</span>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        CANCELLATION REASON <span className="text-destructive">*</span>
                      </label>
                      {categoriesLoading ? (
                        <div className="h-10 px-3 flex items-center border rounded-xl bg-slate-50/50 text-sm text-slate-400">
                          Loading reasons...
                        </div>
                      ) : (
                        <Select
                          value={form.watch("cancellation_category_id")}
                          onValueChange={(value) => {
                            form.setValue("cancellation_category_id", value, { shouldValidate: true })
                            const selectedCategory = categories?.find(c => c.id === value)
                            if (selectedCategory) {
                              form.setValue("cancellation_reason", selectedCategory.name, { shouldValidate: true })
                            }
                          }}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {categories?.map((category) => (
                              <SelectItem key={category.id} value={category.id} className="rounded-lg py-2">
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {errors.cancellation_category_id && (
                        <p className="text-[10px] text-destructive font-medium mt-1">
                          {errors.cancellation_category_id.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        ADDITIONAL NOTES (OPTIONAL)
                      </label>
                      <Textarea
                        rows={3}
                        placeholder="Any additional notes or comments..."
                        {...form.register("cancelled_notes")}
                        disabled={isSubmitting}
                        className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 resize-none"
                      />
                      {errors.cancelled_notes && (
                        <p className="text-[10px] text-destructive font-medium mt-1">
                          {errors.cancelled_notes.message}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="border-t bg-slate-50/80 px-8 py-6 backdrop-blur-md flex items-center justify-end gap-3 shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-12 rounded-xl px-6 font-semibold transition-all hover:bg-slate-100 active:scale-95"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting || categoriesLoading}
                className="h-12 rounded-xl px-8 font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 hover:shadow-red-500/30"
              >
                {isSubmitting ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

