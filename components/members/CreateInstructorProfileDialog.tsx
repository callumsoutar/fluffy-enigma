"use client"

import * as React from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useQuery } from "@tanstack/react-query"
import { Plus, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { InstructorCategory } from "@/lib/types/instructor-categories"
import { DatePicker } from "@/components/ui/date-picker"

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "casual", label: "Casual" },
  { value: "contractor", label: "Contractor" },
] as const

type InstructorCategoriesResponse = { categories: InstructorCategory[] }

async function fetchInstructorCategories(): Promise<InstructorCategoriesResponse> {
  const res = await fetch("/api/instructor-categories")
  if (!res.ok) throw new Error("Failed to load instructor categories")
  return (await res.json()) as InstructorCategoriesResponse
}

const formSchema = z.object({
  employment_type: z.enum(["full_time", "part_time", "casual", "contractor"]).nullable(),
  hire_date: z.string().nullable(), // YYYY-MM-DD
  is_actively_instructing: z.boolean(),
  rating: z.string().uuid().nullable(),
  notes: z.string().max(5000).nullable(),
})

type FormValues = z.infer<typeof formSchema>

interface CreateInstructorProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onCreated?: () => void
}

export function CreateInstructorProfileDialog({
  open,
  onOpenChange,
  userId,
  onCreated,
}: CreateInstructorProfileDialogProps) {
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const { data: categoriesData, isLoading: categoriesLoading, isError: categoriesError } = useQuery({
    queryKey: ["instructor-categories"],
    queryFn: fetchInstructorCategories,
    enabled: open,
    staleTime: 60_000,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employment_type: null,
      hire_date: null,
      is_actively_instructing: false,
      rating: null,
      notes: null,
    },
  })

  const isSubmitting = form.formState.isSubmitting

  React.useEffect(() => {
    if (!open) return
    setSubmitError(null)
    form.reset({
      employment_type: null,
      hire_date: null,
      is_actively_instructing: false,
      rating: null,
      notes: null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    setSubmitError(null)

    const res = await fetch(`/api/members/${userId}/instructor-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        // Backend expects undefined/nullable; keep payload minimal.
        hire_date: values.hire_date || null,
      }),
    })

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      setSubmitError(payload?.error || "Failed to create instructor profile")
      return
    }

    onOpenChange(false)
    form.reset()
    onCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[680px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Create Instructor Profile
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Creates the instructor domain record only (no role changes, no side effects).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="space-y-6">
              {/* Employment */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Employment & Status
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      EMPLOYMENT TYPE
                    </label>
                    <Select
                      value={form.watch("employment_type") ?? "none"}
                      onValueChange={(value) =>
                        form.setValue(
                          "employment_type",
                          value === "none" ? null : (value as FormValues["employment_type"]),
                          { shouldDirty: true }
                        )
                      }
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl"
                      >
                        <SelectItem value="none" className="rounded-lg py-2 text-xs">
                          Not set
                        </SelectItem>
                        {EMPLOYMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="rounded-lg py-2 text-xs">
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      HIRE DATE
                    </label>
                    <DatePicker
                      date={form.watch("hire_date")}
                      onChange={(date) => form.setValue("hire_date", date, { shouldDirty: true })}
                      placeholder="Select hire date"
                      className="h-10 w-full"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-900">Actively instructing</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Turn on when the instructor is actively rostered/available.
                      </p>
                    </div>
                    <Switch
                      checked={form.watch("is_actively_instructing")}
                      onCheckedChange={(checked) =>
                        form.setValue("is_actively_instructing", Boolean(checked), { shouldDirty: true })
                      }
                      aria-label="Actively instructing"
                    />
                  </div>
                </div>
              </section>

              {/* Rating */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Instructor Rating
                  </span>
                </div>

                {categoriesError ? (
                  <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2 text-[10px] font-medium text-destructive">
                    Could not load instructor categories. Please refresh and try again.
                  </div>
                ) : null}

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      RATING CATEGORY
                    </label>
                    <Select
                      disabled={categoriesLoading}
                      value={form.watch("rating") ?? "none"}
                      onValueChange={(value) =>
                        form.setValue("rating", value === "none" ? null : value, { shouldDirty: true })
                      }
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue placeholder={categoriesLoading ? "Loading..." : "Not set"} />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl"
                      >
                        <SelectItem value="none" className="rounded-lg py-2 text-xs">
                          Not set
                        </SelectItem>
                        {(categoriesData?.categories ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id} className="rounded-lg py-2 text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="hidden sm:block" />
                </div>
              </section>

              {/* Notes */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Notes
                  </span>
                </div>

                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    INTERNAL NOTES (OPTIONAL)
                  </label>
                  <Textarea
                    id="notes"
                    rows={4}
                    placeholder="Anything helpful for rostering, training, availability…"
                    className="rounded-xl border-slate-200 focus:ring-slate-900 text-xs"
                    value={form.watch("notes") ?? ""}
                    onChange={(e) => form.setValue("notes", e.target.value || null, { shouldDirty: true })}
                  />
                </div>

                {submitError ? (
                  <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2 text-[10px] font-medium text-destructive">
                    {submitError}
                  </div>
                ) : null}
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
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                onClick={form.handleSubmit(onSubmit)}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {isSubmitting ? "Creating..." : "Create Instructor Profile"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


