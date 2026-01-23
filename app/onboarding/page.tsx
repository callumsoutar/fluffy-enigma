"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import { Plane, Building2, Sparkles, ArrowRight, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const onboardingSchema = z.object({
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
  organizationSlug: z.string()
    .min(3, "URL must be at least 3 characters")
    .max(50, "URL must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "URL can only contain lowercase letters, numbers, and hyphens")
    .optional()
    .or(z.literal('')),
})

type OnboardingFormData = z.infer<typeof onboardingSchema>

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = React.useState(false)
  const [autoSlug, setAutoSlug] = React.useState('')
  const [user, setUser] = React.useState<{ id: string; email: string; user_metadata: Record<string, unknown> } | null>(null)

  // Check if user is authenticated
  React.useEffect(() => {
    const checkAuth = async () => {
      // On the client, prefer getSession() for faster, local reads.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) {
        router.push('/login')
        return
      }
      setUser({
        id: user.id,
        email: user.email || '',
        user_metadata: user.user_metadata || {},
      })
      
      // Check if user already has a tenant
      const { data: tenantMembership } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      
      if (tenantMembership) {
        // User already has a tenant, redirect to dashboard
        router.push('/')
      }
    }
    checkAuth()
  }, [supabase, router])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      organizationSlug: '',
    },
    mode: 'onChange',
  })

  const organizationName = watch("organizationName") || ""
  const organizationSlug = watch("organizationSlug") || ""

  // Auto-generate slug from organization name
  React.useEffect(() => {
    if (organizationName && !organizationSlug) {
      setAutoSlug(generateSlug(organizationName))
    }
  }, [organizationName, organizationSlug])

  const onSubmit = async (data: OnboardingFormData) => {
    if (!user) return
    
    setIsLoading(true)
    try {
      // Create organization via API
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationName: data.organizationName,
          organizationSlug: data.organizationSlug || autoSlug,
          userId: user.id,
          firstName: user.user_metadata?.first_name || '',
          lastName: user.user_metadata?.last_name || '',
          email: user.email,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || "Failed to create organization")
        return
      }

      toast.success("Organization created! Welcome aboard!")
      router.push("/")
      router.refresh()
    } catch (error) {
      toast.error("An unexpected error occurred")
      console.error("Onboarding error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1527] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1527] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <Plane className="h-8 w-8 text-cyan-400 fill-cyan-400/20" />
          <span className="text-2xl font-bold text-white tracking-tight">Flight Desk Pro</span>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500 text-[#0B1527]">
            <Check className="h-5 w-5" />
          </div>
          <div className="w-12 h-0.5 rounded-full bg-cyan-500" />
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500 text-[#0B1527]">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="w-12 h-0.5 rounded-full bg-[#2a3f5f]" />
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#2a3f5f] text-slate-500">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#111d32] rounded-2xl border border-[#1e2d47] p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Set up your organization
            </h1>
            <p className="text-slate-400">
              One last step! Create your aero club or flight school to get started.
            </p>
          </div>

          {/* Welcome message for OAuth users */}
          <div className="mb-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-sm text-cyan-400">
              Welcome, {String(user.user_metadata?.first_name || user.email)}! You&apos;ve signed in successfully. Now let&apos;s set up your organization.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Organization Name */}
            <div className="space-y-2">
              <label htmlFor="organizationName" className="text-sm font-medium text-slate-300">
                Organization name
              </label>
              <input
                id="organizationName"
                type="text"
                placeholder="e.g., Auckland Flight Training"
                className={cn(
                  "w-full h-12 px-4 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white placeholder:text-slate-500",
                  "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50",
                  "transition-all duration-200",
                  errors.organizationName && "border-red-500/50 focus:ring-red-500/50"
                )}
                {...register("organizationName")}
              />
              {errors.organizationName && (
                <p className="text-sm text-red-400 mt-1">
                  {errors.organizationName.message}
                </p>
              )}
            </div>

            {/* Organization URL Slug */}
            <div className="space-y-2">
              <label htmlFor="organizationSlug" className="text-sm font-medium text-slate-300">
                Your URL <span className="text-slate-500">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  flightdeskpro.com/
                </span>
                <input
                  id="organizationSlug"
                  type="text"
                  placeholder={autoSlug || "your-organization"}
                  className={cn(
                    "w-full h-12 pl-[155px] pr-4 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white placeholder:text-slate-500",
                    "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50",
                    "transition-all duration-200",
                    errors.organizationSlug && "border-red-500/50 focus:ring-red-500/50"
                  )}
                  {...register("organizationSlug")}
                />
              </div>
              {errors.organizationSlug && (
                <p className="text-sm text-red-400 mt-1">
                  {errors.organizationSlug.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-[#0B1527] font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/25"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-[#0B1527]/30 border-t-[#0B1527] rounded-full animate-spin" />
                  Creating organization...
                </div>
              ) : (
                <>
                  Continue to dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Need help? <a href="mailto:support@flightdeskpro.com" className="text-cyan-400 hover:text-cyan-300">Contact support</a>
        </p>
      </div>
    </div>
  )
}
