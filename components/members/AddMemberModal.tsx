"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  first_name: z.string().trim().max(100, "First name too long").optional(),
  last_name: z.string().trim().max(100, "Last name too long").optional(),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  phone: z.string().trim().max(20, "Phone number too long").optional(),
  street_address: z.string().trim().max(200, "Street address too long").optional(),
})

type FormValues = z.infer<typeof formSchema>

export function AddMemberModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { open, onOpenChange } = props
  const router = useRouter()
  const queryClient = useQueryClient()

  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      street_address: "",
    },
    mode: "onSubmit",
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      street_address: "",
    })
    setSubmitting(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const errors = form.formState.errors

  async function submit(values: FormValues) {
    setSubmitting(true)
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          first_name: values.first_name || null,
          last_name: values.last_name || null,
          phone: values.phone || null,
          street_address: values.street_address || null,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof json?.error === "string"
            ? json.error
            : res.status === 409
              ? "A member with that email already exists."
              : "Failed to create member"
        toast.error(msg)
        return
      }

      const member = json?.member as { id?: string } | undefined
      if (!member?.id) {
        toast.error("Member created, but response was unexpected.")
        return
      }

      toast.success("Member created")
      queryClient.invalidateQueries({ queryKey: ["members"] })
      onOpenChange(false)
      router.push(`/members/${member.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[720px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Add Member
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Create a new contact/member record. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(submit)}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              {/* Contact details */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Contact Details</span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      FIRST NAME
                    </label>
                    <Input
                      autoFocus
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="First name"
                      {...form.register("first_name")}
                    />
                    {errors.first_name ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.first_name.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      LAST NAME
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="Last name"
                      {...form.register("last_name")}
                    />
                    {errors.last_name ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.last_name.message}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      EMAIL <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="name@example.com"
                      {...form.register("email")}
                    />
                    {errors.email ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.email.message}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      PHONE
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="Optional"
                      {...form.register("phone")}
                    />
                    {errors.phone ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.phone.message}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      STREET ADDRESS
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="Optional"
                      {...form.register("street_address")}
                    />
                    {errors.street_address ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.street_address.message}</p>
                    ) : null}
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
                disabled={submitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                onClick={form.handleSubmit(submit)}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {submitting ? "Saving..." : "Save Member"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


