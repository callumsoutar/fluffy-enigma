"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { 
  Activity, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Trophy, 
  User, 
  Cloud
} from "lucide-react"

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
import { DatePicker } from "@/components/ui/date-picker"
import { logFlightExperienceSchema } from "@/lib/validation/training"
import { cn } from "@/lib/utils"
import type { z } from "zod"
import type { ExperienceType } from "@/lib/types/experience-types"
import type { InstructorWithUser } from "@/lib/types/instructors"

type FormData = z.infer<typeof logFlightExperienceSchema>

interface AddFlightExperienceModalProps {
  memberId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddFlightExperienceModal({
  memberId,
  open,
  onOpenChange,
}: AddFlightExperienceModalProps) {
  const queryClient = useQueryClient()
  const today = new Date()
  const todayKey = today.toISOString()

  const form = useForm<FormData>({
    resolver: zodResolver(logFlightExperienceSchema),
    defaultValues: {
      experience_type_id: "",
      value: 0,
      unit: "hours",
      occurred_at: todayKey,
      notes: "",
      conditions: "",
      instructor_id: null,
    },
  })

  const { data: experienceTypes = [] } = useQuery({
    queryKey: ["experience-types"],
    queryFn: async () => {
      const res = await fetch("/api/experience-types")
      if (!res.ok) throw new Error("Failed to fetch experience types")
      const data = await res.json()
      return (data.experience_types || []) as ExperienceType[]
    },
  })

  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors"],
    queryFn: async () => {
      const res = await fetch("/api/instructors")
      if (!res.ok) throw new Error("Failed to fetch instructors")
      const data = await res.json()
      return data.instructors || []
    },
  })

  const logMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const res = await fetch(`/api/members/${memberId}/training/flight-experience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to log flight experience")
      }

      return res.json()
    },
    onSuccess: () => {
      toast.success("Flight experience logged successfully")
      queryClient.invalidateQueries({ queryKey: ["member-training", memberId] })
      queryClient.invalidateQueries({ queryKey: ["training", memberId] })
      onOpenChange(false)
      form.reset()
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to log flight experience")
    },
  })

  const isSubmitting = logMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[520px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-4rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex flex-1 min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">Add Flight Experience</DialogTitle>
                <DialogDescription className="text-sm font-medium text-slate-500 mt-0.5">
                  Manually record flight experience for this member.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((values) => logMutation.mutate(values))}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900 uppercase">Experience Details</span>
                </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <Trophy className="w-2.5 h-2.5" />
                    EXPERIENCE TYPE <span className="text-destructive font-bold ml-0.5">*</span>
                  </label>
                  <Select
                    value={form.watch("experience_type_id")}
                    onValueChange={(val) => form.setValue("experience_type_id", val, { shouldValidate: true })}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                      {experienceTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-base font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.experience_type_id && (
                    <p className="mt-1 text-[10px] text-destructive font-medium">{form.formState.errors.experience_type_id.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <Clock className="w-2.5 h-2.5" />
                      VALUE <span className="text-destructive font-bold ml-0.5">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      {...form.register("value", { valueAsNumber: true })}
                      disabled={isSubmitting}
                      className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all"
                    />
                    {form.formState.errors.value && (
                      <p className="mt-1 text-[10px] text-destructive font-medium">{form.formState.errors.value.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      UNIT <span className="text-destructive font-bold ml-0.5">*</span>
                    </label>
                    <Select
                      value={form.watch("unit")}
                      onValueChange={(val) => form.setValue("unit", val as "hours" | "count" | "landings", { shouldValidate: true })}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        <SelectItem value="hours" className="text-base font-medium rounded-lg mx-1">Hours</SelectItem>
                        <SelectItem value="count" className="text-base font-medium rounded-lg mx-1">Count</SelectItem>
                        <SelectItem value="landings" className="text-base font-medium rounded-lg mx-1">Landings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mt-5">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <Calendar className="w-2.5 h-2.5" />
                    DATE <span className="text-destructive font-bold ml-0.5">*</span>
                  </label>
                  <DatePicker
                    date={form.watch("occurred_at")}
                    onChange={(date) => form.setValue("occurred_at", date || "", { shouldValidate: true })}
                    disabled={isSubmitting}
                    className="h-10 w-full"
                  />
                  {form.formState.errors.occurred_at && (
                    <p className="mt-1 text-[10px] text-destructive font-medium">{form.formState.errors.occurred_at.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <User className="w-2.5 h-2.5" />
                    INSTRUCTOR (OPTIONAL)
                  </label>
                  <Select
                    value={form.watch("instructor_id") || "none"}
                    onValueChange={(val) => form.setValue("instructor_id", val === "none" ? null : val)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                      <SelectValue placeholder="Select instructor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                      <SelectItem value="none" className="text-base font-medium rounded-lg mx-1">None</SelectItem>
                      {instructors.map((i: InstructorWithUser) => (
                        <SelectItem key={i.id} value={i.id} className="text-base font-medium rounded-lg mx-1">
                          {i.user?.first_name} {i.user?.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span className="text-xs font-semibold tracking-tight text-slate-900 uppercase">Additional Info</span>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <Cloud className="w-2.5 h-2.5" />
                    CONDITIONS (OPTIONAL)
                  </label>
                  <Input
                    {...form.register("conditions")}
                    disabled={isSubmitting}
                    placeholder="e.g. Day, Night, IFR, VFR"
                    className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <MessageSquare className="w-2.5 h-2.5" />
                    NOTES (OPTIONAL)
                  </label>
                  <Textarea
                    {...form.register("notes")}
                    disabled={isSubmitting}
                    placeholder="Any additional context..."
                    className="min-h-[100px] rounded-xl border-slate-200 bg-white px-3 py-2.5 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all resize-none"
                  />
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
                disabled={isSubmitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                onClick={form.handleSubmit((values) => logMutation.mutate(values))}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {isSubmitting ? "Logging..." : "Log Experience"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
