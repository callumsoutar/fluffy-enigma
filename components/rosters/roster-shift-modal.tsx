"use client"

import * as React from "react"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldError } from "@/components/ui/field"
import { toast } from "sonner"
import {
  Calendar,
  Pencil,
  Plus,
  Repeat,
  User,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

const optionalEffectiveDate = z
  .string()
  .optional()
  .transform((value) => {
    if (!value || value.trim() === "") {
      return null
    }
    return value
  })
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Invalid date",
  })

const rosterShiftSchema = z
  .object({
    instructor_id: z.string().uuid(),
    day_of_week: z.number().int().min(0).max(6),
    days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
    start_time: z.string().regex(timePattern),
    end_time: z.string().regex(timePattern),
    is_recurring: z.boolean(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effective_until: optionalEffectiveDate,
    notes: z
      .string()
      .max(1000)
      .optional()
      .nullable()
      .transform((value) => (value?.trim() ? value.trim() : null)),
  })
  .superRefine((values, ctx) => {
    if (values.is_recurring && (!values.days_of_week || values.days_of_week.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days_of_week"],
        message: "Select at least one day",
      })
    }

    if (values.end_time <= values.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "End time must be after start time",
      })
    }

    if (values.effective_until && values.effective_until < values.effective_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effective_until"],
        message: "End date must be on or after the start date",
      })
    }

    if (!values.is_recurring) {
      if (!values.effective_until) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["effective_until"],
          message: "One-off rosters must include the same end date",
        })
      } else if (values.effective_until !== values.effective_from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["effective_until"],
          message: "One-off rosters must end on the same day they start",
        })
      }
    }
  })

type RosterShiftFormInput = z.input<typeof rosterShiftSchema>
type RosterShiftFormOutput = z.output<typeof rosterShiftSchema>
type RosterShiftFormValues = RosterShiftFormInput

interface InstructorOption {
  id: string
  name: string
}

interface RosterShiftModalProps {
  open: boolean
  mode: "create" | "edit"
  instructors: InstructorOption[]
  initialValues: RosterShiftFormValues
  ruleId?: string
  onClose: () => void
  onSaved: () => void
}

const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = i % 2 === 0 ? "00" : "30"
  const value = `${hour.toString().padStart(2, "0")}:${minute}`
  return { value, label: value }
})

const overrideTypeOptions = [
  { value: "add_extra_shift", label: "Add Extra Shift" },
  { value: "leave", label: "Leave" },
  { value: "sick", label: "Sick" },
]

export function RosterShiftModal({
  open,
  mode,
  instructors,
  initialValues,
  ruleId,
  onClose,
  onSaved,
}: RosterShiftModalProps) {
  const form = useForm<RosterShiftFormInput>({
    resolver: zodResolver(rosterShiftSchema, undefined, { raw: true }),
    defaultValues: initialValues,
  })

  const [error, setError] = React.useState<string | null>(null)

  const watchedValues = form.watch([
    "is_recurring",
    "start_time",
    "end_time",
    "effective_from",
    "effective_until",
    "instructor_id",
    "days_of_week",
  ])

  React.useEffect(() => {
    if (open) {
      const values = {
        ...initialValues,
        days_of_week: initialValues.days_of_week ?? (initialValues.day_of_week !== undefined ? [initialValues.day_of_week] : []),
      }
      form.reset(values)
    }
  }, [open, initialValues, form])

  const isSubmitting = form.formState.isSubmitting

  const selectedInstructorId = watchedValues?.[5] ?? initialValues.instructor_id
  const selectedDays = (watchedValues?.[6] as number[]) ?? []
  const instructorLabel =
    instructors.find((inst) => inst.id === selectedInstructorId)?.name ?? "Instructor"
  
  const isRecurringNow = watchedValues?.[0] ?? initialValues.is_recurring
  const effectiveFromValue = watchedValues?.[3] ?? initialValues.effective_from
  const displayStart = watchedValues?.[1] ?? initialValues.start_time

  const formattedDate = React.useMemo(() => {
    if (!effectiveFromValue) return ""
    try {
      return format(parseISO(effectiveFromValue), "EEEE, MMMM d, yyyy")
    } catch {
      return effectiveFromValue
    }
  }, [effectiveFromValue])

  const shortDate = React.useMemo(() => {
    if (!effectiveFromValue) return ""
    try {
      return format(parseISO(effectiveFromValue), "MMM d, yyyy")
    } catch {
      return effectiveFromValue
    }
  }, [effectiveFromValue])

  React.useEffect(() => {
    if (!open) return
    if (!isRecurringNow) {
      form.setValue("effective_until", effectiveFromValue ?? "", {
        shouldDirty: true,
        shouldTouch: true,
      })
    }
  }, [effectiveFromValue, form, isRecurringNow, open])

  const handleClose = React.useCallback(() => {
    if (!isSubmitting) {
      form.reset(initialValues)
      setError(null)
      onClose()
    }
  }, [isSubmitting, form, initialValues, onClose])

  const handleDelete = async () => {
    if (!ruleId) return

    try {
      const response = await fetch(`/api/roster-rules/${ruleId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload?.error || "Failed to delete roster rule")
      }

      toast.success("Roster rule archived")
      onSaved()
      handleClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete roster rule"
      setError(message)
      toast.error(message)
    }
  }

  const onSubmit: SubmitHandler<RosterShiftFormInput> = React.useCallback(
    async (values) => {
      const parsed = rosterShiftSchema.parse(values) as RosterShiftFormOutput
      const payload = {
        instructor_id: parsed.instructor_id,
        day_of_week: parsed.is_recurring ? undefined : parsed.day_of_week,
        days_of_week: parsed.is_recurring ? parsed.days_of_week : undefined,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        effective_from: parsed.effective_from,
        effective_until: parsed.is_recurring ? parsed.effective_until : parsed.effective_from,
        notes: parsed.notes ?? null,
      }

      try {
        const response = await fetch(
          mode === "create" ? "/api/roster-rules" : `/api/roster-rules/${ruleId}`,
          {
            method: mode === "create" ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        )

        if (!response.ok) {
          const payload = await response.json()
          throw new Error(payload?.error || "Failed to save roster rule")
        }

        setError(null)
        toast.success(`Roster ${mode === "create" ? "created" : "updated"} successfully`)
        onSaved()
        handleClose()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save roster rule"
        setError(message)
        toast.error(message)
      }
    },
    [handleClose, mode, onSaved, ruleId]
  )

  const allTimeOptions = React.useMemo(() => {
    const options = [...timeOptions]
    const startTime = watchedValues?.[1] || initialValues.start_time
    const endTime = watchedValues?.[2] || initialValues.end_time
    if (startTime && !options.some((o) => o.value === startTime)) {
      options.push({ value: startTime, label: startTime })
    }
    if (endTime && !options.some((o) => o.value === endTime)) {
      options.push({ value: endTime, label: endTime })
    }
    return options.sort((a, b) => a.value.localeCompare(b.value))
  }, [watchedValues, initialValues.start_time, initialValues.end_time])

  return (
    <Dialog open={open} onOpenChange={(value) => value || handleClose()}>
      <DialogContent
        className={cn(
          // Mobile: top-aligned + fixed viewport height so content never clips, and becomes scrollable.
          // Desktop: use fixed height to ensure proper flex scrolling on smaller screens like 13" MacBook.
          "p-0 border-none shadow-2xl rounded-[28px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[600px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 sm:px-8 pt-[calc(2rem+env(safe-area-inset-top))] sm:pt-8 pb-6 text-left flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                {mode === "create" ? <Plus className="h-6 w-6" /> : <Pencil className="h-6 w-6" />}
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">
                  {mode === "create" ? "Create Roster Assignment" : "Edit Roster Assignment"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-base text-slate-500">
                  {mode === "create" ? "Creating" : "Editing"} assignment for <span className="font-bold text-slate-900">{instructorLabel}</span> on {formattedDate} starting at {displayStart}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 sm:px-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:pb-8">
            <div className="mb-6 flex items-center gap-4 rounded-[20px] bg-blue-50 p-4 text-blue-700 ring-1 ring-blue-100/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-blue-100">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">{isRecurringNow ? "Recurring Schedule" : "One-off Assignment"}</p>
                <p className="text-sm opacity-70 font-medium">{isRecurringNow ? "Repeats weekly" : shortDate}</p>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <input type="hidden" {...form.register("day_of_week")} />

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-sm font-semibold tracking-tight text-slate-900">Instructor</span>
                </div>
                
                <Select 
                  value={form.watch("instructor_id")} 
                  onValueChange={(val) => form.setValue("instructor_id", val, { shouldDirty: true, shouldTouch: true })}
                >
                  <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <SelectValue placeholder="Select instructor" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                    {instructors.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id} className="rounded-lg py-2.5">
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={form.formState.errors.instructor_id ? [form.formState.errors.instructor_id] : undefined} />
              </section>

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-semibold tracking-tight text-slate-900">Assignment Type</span>
                </div>
                
                <div className="flex gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-100">
                  <button
                    type="button"
                    onClick={() => form.setValue("is_recurring", false)}
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-xl px-4 py-3.5 transition-all",
                      !isRecurringNow
                        ? "bg-white shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:bg-slate-100/50"
                    )}
                  >
                    <div className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                      !isRecurringNow ? "border-blue-600 border-[5px]" : "border-slate-300 bg-white"
                    )} />
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-semibold">One-off Assignment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setValue("is_recurring", true)}
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-xl px-4 py-3.5 transition-all",
                      isRecurringNow
                        ? "bg-white shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:bg-slate-100/50"
                    )}
                  >
                    <div className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                      isRecurringNow ? "border-blue-600 border-[5px]" : "border-slate-300 bg-white"
                    )} />
                    <Repeat className="h-4 w-4" />
                    <span className="text-sm font-semibold">Recurring Schedule</span>
                  </button>
                </div>

                {isRecurringNow && (
                  <div className="mt-4">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      REPEAT ON
                    </label>
                    <div className="flex justify-between gap-1">
                      {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => {
                        const isSelected = selectedDays.includes(i)
                        return (
                          <button
                            key={`${day}-${i}`}
                            type="button"
                            onClick={() => {
                              const newDays = isSelected
                                ? selectedDays.filter((d) => d !== i)
                                : [...selectedDays, i].sort()
                              form.setValue("days_of_week", newDays, { shouldDirty: true, shouldTouch: true })
                            }}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all",
                              isSelected
                                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            )}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                    <FieldError errors={form.formState.errors.days_of_week ? [form.formState.errors.days_of_week] : undefined} />
                  </div>
                )}
              </section>

              {!isRecurringNow && (
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-semibold tracking-tight text-slate-900">Assignment Options</span>
                  </div>

                  <div className="grid gap-6">
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        OVERRIDE TYPE
                      </label>
                      <Select defaultValue="add_extra_shift">
                        <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                          {overrideTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="rounded-lg py-2.5">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>
              )}

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-semibold tracking-tight text-slate-900">Schedule Times</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      START TIME
                    </label>
                    <Select 
                      value={form.watch("start_time")} 
                      onValueChange={(val) => form.setValue("start_time", val)}
                    >
                      <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {allTimeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="rounded-lg py-2.5">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      END TIME
                    </label>
                    <Select 
                      value={form.watch("end_time")} 
                      onValueChange={(val) => form.setValue("end_time", val)}
                    >
                      <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {allTimeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="rounded-lg py-2.5">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {error && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-4 pb-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="h-12 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                {mode === "edit" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="h-12 px-4 rounded-xl text-sm font-bold text-destructive hover:bg-destructive/5 hover:text-destructive"
                  >
                    Archive
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 flex-[1.5] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  {mode === "create" && <Plus className="mr-2 h-4 w-4" />}
                  {mode === "create" ? "Create Assignment" : "Update Assignment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

