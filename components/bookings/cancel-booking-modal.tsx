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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
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
      <DialogContent className="p-0 sm:max-w-[32rem] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:w-full overflow-hidden">
        <div className="p-6 sm:p-7 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel Booking
            </DialogTitle>
            <DialogDescription className="text-sm">
              Please provide a reason for cancelling this booking. Required fields are marked with{" "}
              <span className="text-destructive">*</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-6 pb-6 sm:px-7">
          <div className="space-y-6">
            {/* Booking Info */}
            {booking && (
              <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
                <div className="text-xs font-semibold tracking-wide text-muted-foreground mb-2">
                  BOOKING DETAILS
                </div>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Aircraft:</span>{" "}
                    {booking.aircraft?.registration || "—"}
                  </div>
                  {booking.student && (
                    <div>
                      <span className="font-medium">Student:</span>{" "}
                      {[booking.student.first_name, booking.student.last_name]
                        .filter(Boolean)
                        .join(" ") || booking.student.email}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Date:</span>{" "}
                    {new Date(booking.start_time).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Time:</span>{" "}
                    {new Date(booking.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {new Date(booking.end_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Cancellation Category */}
            <div className="space-y-2">
              <Field data-invalid={!!errors.cancellation_category_id}>
                <FieldLabel className="text-sm font-medium">
                  Cancellation Category <span className="text-destructive">*</span>
                </FieldLabel>
                {categoriesLoading ? (
                  <div className="px-3 py-2 border rounded-md bg-muted/20 text-sm text-muted-foreground">
                    Loading categories...
                  </div>
                ) : (
                  <Select
                    value={form.watch("cancellation_category_id")}
                    onValueChange={(value) =>
                      form.setValue("cancellation_category_id", value, { shouldValidate: true })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full h-11 sm:h-10">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex flex-col">
                            <span>{category.name}</span>
                            {category.description && (
                              <span className="text-xs text-muted-foreground">
                                {category.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FieldError errors={errors.cancellation_category_id ? [{ message: errors.cancellation_category_id.message }] : undefined} />
              </Field>
            </div>

            {/* Cancellation Reason */}
            <div className="space-y-2">
              <Field data-invalid={!!errors.cancellation_reason}>
                <FieldLabel className="text-sm font-medium">
                  Cancellation Reason <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  placeholder="Please provide a reason for cancelling this booking..."
                  {...form.register("cancellation_reason")}
                  disabled={isSubmitting}
                  className="h-11 sm:h-10"
                />
                <FieldError errors={errors.cancellation_reason ? [{ message: errors.cancellation_reason.message }] : undefined} />
              </Field>
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Field data-invalid={!!errors.cancelled_notes}>
                <FieldLabel className="text-sm font-medium">
                  Additional Notes (Optional)
                </FieldLabel>
                <Textarea
                  rows={3}
                  placeholder="Any additional notes or comments..."
                  {...form.register("cancelled_notes")}
                  disabled={isSubmitting}
                  className="resize-none"
                />
                <FieldError errors={errors.cancelled_notes ? [{ message: errors.cancelled_notes.message }] : undefined} />
              </Field>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 -mx-6 border-t bg-background/95 px-6 py-4 backdrop-blur sm:-mx-7 sm:px-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isSubmitting || categoriesLoading}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? "Cancelling..." : "Cancel Booking"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

