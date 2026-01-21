"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { IconAlertTriangle, IconInfoCircle, IconPlane } from "@tabler/icons-react"
import type { BookingWithRelations } from "@/lib/types/bookings"

const correctionSchema = z.object({
  hobbs_end: z.coerce.number().min(0).optional().nullable(),
  tach_end: z.coerce.number().min(0).optional().nullable(),
  airswitch_end: z.coerce.number().min(0).optional().nullable(),
  correction_reason: z.string().min(10, "Correction reason must be at least 10 characters").max(1000),
})

type CorrectionFormData = z.infer<typeof correctionSchema>

interface FlightCorrectionDialogProps {
  booking: BookingWithRelations
  open: boolean
  onOpenChange: (open: boolean) => void
  onCorrect: (data: CorrectionFormData) => Promise<void>
  isSubmitting?: boolean
}

export function FlightCorrectionDialog({
  booking,
  open,
  onOpenChange,
  onCorrect,
  isSubmitting = false,
}: FlightCorrectionDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<CorrectionFormData>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      hobbs_end: booking.hobbs_end ?? undefined,
      tach_end: booking.tach_end ?? undefined,
      airswitch_end: booking.airswitch_end ?? undefined,
      correction_reason: "",
    },
  })

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      reset({
        hobbs_end: booking.hobbs_end ?? undefined,
        tach_end: booking.tach_end ?? undefined,
        airswitch_end: booking.airswitch_end ?? undefined,
        correction_reason: "",
      })
    }
  }, [open, booking, reset])

  // Watch for changes to calculate deltas
  const newHobbsEnd = watch("hobbs_end")
  const newTachEnd = watch("tach_end")
  const newAirswitchEnd = watch("airswitch_end")

  // Calculate delta changes
  const hobbsDeltaChange = React.useMemo(() => {
    if (booking.hobbs_start == null || newHobbsEnd == null) return null
    const oldDelta = booking.hobbs_end != null ? booking.hobbs_end - booking.hobbs_start : 0
    const newDelta = newHobbsEnd - booking.hobbs_start
    return newDelta - oldDelta
  }, [booking.hobbs_start, booking.hobbs_end, newHobbsEnd])

  const tachDeltaChange = React.useMemo(() => {
    if (booking.tach_start == null || newTachEnd == null) return null
    const oldDelta = booking.tach_end != null ? booking.tach_end - booking.tach_start : 0
    const newDelta = newTachEnd - booking.tach_start
    return newDelta - oldDelta
  }, [booking.tach_start, booking.tach_end, newTachEnd])

  const airswitchDeltaChange = React.useMemo(() => {
    if (booking.airswitch_start == null || newAirswitchEnd == null) return null
    const oldDelta = booking.airswitch_end != null ? booking.airswitch_end - booking.airswitch_start : 0
    const newDelta = newAirswitchEnd - booking.airswitch_start
    return newDelta - oldDelta
  }, [booking.airswitch_start, booking.airswitch_end, newAirswitchEnd])

  // Determine which meter is used for aircraft TTIS
  const appliedMethod = booking.applied_total_time_method
  const appliedDeltaChange = React.useMemo(() => {
    if (!appliedMethod) return null
    if (appliedMethod === "hobbs" || appliedMethod.includes("hobbs")) return hobbsDeltaChange
    if (appliedMethod === "tacho" || appliedMethod.includes("tacho")) return tachDeltaChange
    if (appliedMethod === "airswitch") return airswitchDeltaChange
    return null
  }, [appliedMethod, hobbsDeltaChange, tachDeltaChange, airswitchDeltaChange])

  const hasChanges = hobbsDeltaChange !== null || tachDeltaChange !== null || airswitchDeltaChange !== null

  const onSubmit = async (data: CorrectionFormData) => {
    await onCorrect(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPlane className="h-5 w-5 text-primary" />
            Correct Flight Meter Readings
          </DialogTitle>
          <DialogDescription>
            Adjust the end meter readings for this approved flight. The correction will recalculate deltas and update aircraft total time accordingly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Warning Alert */}
          <Alert variant="destructive" className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
            <IconAlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <strong>Warning:</strong> Correcting meter readings will adjust the aircraft&apos;s total time in service. Ensure accuracy before proceeding.
            </AlertDescription>
          </Alert>

          {/* Current Values Summary */}
          <div className="rounded-lg border border-border bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <IconInfoCircle className="h-4 w-4" />
              Current Flight Details
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Applied Method:</span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {appliedMethod || "Unknown"}
                </Badge>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Applied Delta:</span>
                <span className="ml-2 font-mono font-semibold">
                  {booking.applied_aircraft_delta?.toFixed(2) || "N/A"}h
                </span>
              </div>
            </div>

            {booking.corrected_at && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Previously corrected on {new Date(booking.corrected_at).toLocaleString()}
                </div>
                {booking.correction_reason && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Reason: {booking.correction_reason}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Meter Readings */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Meter Readings
            </h4>

            {/* Hobbs */}
            {booking.hobbs_start != null && (
              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <Label htmlFor="hobbs_start" className="text-xs text-slate-500">
                    Hobbs Start (Locked)
                  </Label>
                  <Input
                    id="hobbs_start"
                    type="number"
                    value={booking.hobbs_start}
                    disabled
                    className="mt-1 bg-slate-100 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <Label htmlFor="hobbs_end" className="text-xs">
                    Hobbs End
                  </Label>
                  <Input
                    id="hobbs_end"
                    type="number"
                    step="0.1"
                    {...register("hobbs_end", { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {errors.hobbs_end && (
                    <p className="text-xs text-destructive mt-1">{errors.hobbs_end.message}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Delta Change</Label>
                  <div className={`mt-1 h-10 rounded-md border border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-center font-mono text-sm font-semibold ${
                    hobbsDeltaChange != null && Math.abs(hobbsDeltaChange) > 0.01
                      ? hobbsDeltaChange > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                      : "text-slate-500"
                  }`}>
                    {hobbsDeltaChange != null
                      ? `${hobbsDeltaChange > 0 ? "+" : ""}${hobbsDeltaChange.toFixed(2)}h`
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Tach */}
            {booking.tach_start != null && (
              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <Label htmlFor="tach_start" className="text-xs text-slate-500">
                    Tach Start (Locked)
                  </Label>
                  <Input
                    id="tach_start"
                    type="number"
                    value={booking.tach_start}
                    disabled
                    className="mt-1 bg-slate-100 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <Label htmlFor="tach_end" className="text-xs">
                    Tach End
                  </Label>
                  <Input
                    id="tach_end"
                    type="number"
                    step="0.1"
                    {...register("tach_end", { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {errors.tach_end && (
                    <p className="text-xs text-destructive mt-1">{errors.tach_end.message}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Delta Change</Label>
                  <div className={`mt-1 h-10 rounded-md border border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-center font-mono text-sm font-semibold ${
                    tachDeltaChange != null && Math.abs(tachDeltaChange) > 0.01
                      ? tachDeltaChange > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                      : "text-slate-500"
                  }`}>
                    {tachDeltaChange != null
                      ? `${tachDeltaChange > 0 ? "+" : ""}${tachDeltaChange.toFixed(2)}h`
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Airswitch */}
            {booking.airswitch_start != null && (
              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <Label htmlFor="airswitch_start" className="text-xs text-slate-500">
                    Airswitch Start (Locked)
                  </Label>
                  <Input
                    id="airswitch_start"
                    type="number"
                    value={booking.airswitch_start}
                    disabled
                    className="mt-1 bg-slate-100 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <Label htmlFor="airswitch_end" className="text-xs">
                    Airswitch End
                  </Label>
                  <Input
                    id="airswitch_end"
                    type="number"
                    step="0.1"
                    {...register("airswitch_end", { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {errors.airswitch_end && (
                    <p className="text-xs text-destructive mt-1">{errors.airswitch_end.message}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Delta Change</Label>
                  <div className={`mt-1 h-10 rounded-md border border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-center font-mono text-sm font-semibold ${
                    airswitchDeltaChange != null && Math.abs(airswitchDeltaChange) > 0.01
                      ? airswitchDeltaChange > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                      : "text-slate-500"
                  }`}>
                    {airswitchDeltaChange != null
                      ? `${airswitchDeltaChange > 0 ? "+" : ""}${airswitchDeltaChange.toFixed(2)}h`
                      : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Aircraft TTIS Impact */}
          {appliedDeltaChange != null && Math.abs(appliedDeltaChange) > 0.01 && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
              <IconInfoCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>Aircraft TTIS Impact:</strong> {appliedDeltaChange > 0 ? "+" : ""}
                {appliedDeltaChange.toFixed(2)} hours will be applied to the aircraft&apos;s total time in service.
              </AlertDescription>
            </Alert>
          )}

          {/* Correction Reason */}
          <div>
            <Label htmlFor="correction_reason">
              Correction Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="correction_reason"
              {...register("correction_reason")}
              placeholder="Explain why this correction is needed (minimum 10 characters)"
              className="mt-2 h-24 resize-none"
            />
            {errors.correction_reason && (
              <p className="text-xs text-destructive mt-1">{errors.correction_reason.message}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              This reason will be permanently logged with the correction for audit purposes.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !hasChanges}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? "Applying Correction..." : "Apply Correction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
