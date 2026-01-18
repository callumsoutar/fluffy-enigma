"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { 
  Plane, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  Check, 
  Building2,
  User,
  Sparkles,
  Shield,
  Zap
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

// Multi-step form schema
const signupSchema = z.object({
  // Step 1: Organization
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
  organizationSlug: z.string()
    .min(3, "URL must be at least 3 characters")
    .max(50, "URL must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "URL can only contain lowercase letters, numbers, and hyphens")
    .optional()
    .or(z.literal('')),
  
  // Step 2: Personal details
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions",
  }),
})

type SignupFormData = z.infer<typeof signupSchema>

const carouselSlides = [
  {
    image: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?q=80&w=2073&auto=format&fit=crop",
    title: "Elevate Your Training,",
    subtitle: "Master the Skies",
  },
  {
    image: "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?q=80&w=2070&auto=format&fit=crop",
    title: "Track Every Flight,",
    subtitle: "Achieve Every Goal",
  },
  {
    image: "https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=2070&auto=format&fit=crop",
    title: "Professional Tools,",
    subtitle: "Professional Results",
  },
]

const passwordRequirements = [
  { regex: /.{8,}/, label: "8+ characters" },
  { regex: /[A-Z]/, label: "Uppercase" },
  { regex: /[a-z]/, label: "Lowercase" },
  { regex: /[0-9]/, label: "Number" },
]

const features = [
  { icon: Zap, label: "Lightning fast booking" },
  { icon: Shield, label: "Enterprise security" },
  { icon: Sparkles, label: "AI-powered insights" },
]

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [currentSlide, setCurrentSlide] = React.useState(0)
  const [step, setStep] = React.useState(1)
  const [autoSlug, setAutoSlug] = React.useState('')

  // Auto-advance carousel
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      agreeToTerms: false,
      organizationSlug: '',
    },
    mode: 'onChange',
  })

  const password = watch("password") || ""
  const agreeToTerms = watch("agreeToTerms")
  const organizationName = watch("organizationName") || ""
  const organizationSlug = watch("organizationSlug") || ""

  // Auto-generate slug from organization name
  React.useEffect(() => {
    if (organizationName && !organizationSlug) {
      setAutoSlug(generateSlug(organizationName))
    }
  }, [organizationName, organizationSlug])

  const handleNextStep = async () => {
    // Validate step 1 fields
    const isValid = await trigger(['organizationName'])
    if (isValid) {
      setStep(2)
    }
  }

  const handlePrevStep = () => {
    setStep(1)
  }

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationName: data.organizationName,
          organizationSlug: data.organizationSlug || autoSlug,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || "Failed to create account")
        return
      }

      toast.success("Account created! Check your email to verify.")
      router.push("/login?message=check-email")
    } catch (error) {
      toast.error("An unexpected error occurred")
      console.error("Signup error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("min-h-screen w-full", className)} {...props}>
      <div className="flex min-h-screen">
        {/* Left Panel - Image Carousel */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden rounded-3xl m-4">
          {/* Background Images */}
          {carouselSlides.map((slide, index) => (
            <div
              key={index}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000",
                currentSlide === index ? "opacity-100" : "opacity-0"
              )}
            >
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                className="object-cover"
                priority={index === 0}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1527]/90 via-[#0B1527]/40 to-[#0B1527]/20" />
            </div>
          ))}

          {/* Header */}
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <Plane className="h-7 w-7 text-white fill-white/20" />
              <span className="text-xl font-bold text-white tracking-tight">Flight Desk Pro</span>
            </div>
            <Link 
              href="/" 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all"
            >
              Back to website
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Features Badge */}
          <div className="absolute top-1/2 -translate-y-1/2 left-6 right-6 z-10">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-white font-semibold mb-4">Why choose Flight Desk Pro?</h3>
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 text-white/80">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <feature.icon className="h-4 w-4 text-cyan-400" />
                    </div>
                    <span className="text-sm">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="absolute bottom-20 left-6 right-6 z-10">
            {carouselSlides.map((slide, index) => (
              <div
                key={index}
                className={cn(
                  "transition-all duration-700 absolute bottom-0 left-0",
                  currentSlide === index 
                    ? "opacity-100 translate-y-0" 
                    : "opacity-0 translate-y-4"
                )}
              >
                <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                  {slide.title}
                  <br />
                  <span className="text-cyan-400">{slide.subtitle}</span>
                </h2>
              </div>
            ))}
          </div>

          {/* Carousel Indicators */}
          <div className="absolute bottom-8 left-6 flex gap-2 z-10">
            {carouselSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  currentSlide === index
                    ? "w-8 bg-white"
                    : "w-2 bg-white/40 hover:bg-white/60"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Right Panel - Signup Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 overflow-y-auto">
          <div className="w-full max-w-md">
            {/* Mobile Header */}
            <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
              <Plane className="h-7 w-7 text-cyan-400 fill-cyan-400/20" />
              <span className="text-xl font-bold text-white tracking-tight">Flight Desk Pro</span>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                step >= 1 
                  ? "bg-cyan-500 border-cyan-500 text-[#0B1527]" 
                  : "border-[#2a3f5f] text-slate-500"
              )}>
                {step > 1 ? <Check className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
              </div>
              <div className={cn(
                "w-12 h-0.5 rounded-full transition-all duration-300",
                step > 1 ? "bg-cyan-500" : "bg-[#2a3f5f]"
              )} />
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                step >= 2 
                  ? "bg-cyan-500 border-cyan-500 text-[#0B1527]" 
                  : "border-[#2a3f5f] text-slate-500"
              )}>
                <User className="h-5 w-5" />
              </div>
            </div>

            {/* Form Header */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                {step === 1 ? "Create your organization" : "Create your account"}
              </h1>
              <p className="text-slate-400">
                {step === 1 
                  ? "Set up your aero club or flight school" 
                  : "Almost there! Complete your profile"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Step 1: Organization Details */}
              <div className={cn(
                "space-y-5 transition-all duration-300",
                step === 1 ? "opacity-100" : "opacity-0 hidden"
              )}>
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
                  <p className="text-xs text-slate-500">
                    This will be your unique URL to access your organization
                  </p>
                </div>

                {/* Next Button */}
                <Button 
                  type="button"
                  onClick={handleNextStep}
                  className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-[#0B1527] font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/25"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Step 2: Personal Details */}
              <div className={cn(
                "space-y-5 transition-all duration-300",
                step === 2 ? "opacity-100" : "opacity-0 hidden"
              )}>
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-sm font-medium text-slate-300">
                      First name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      className={cn(
                        "w-full h-12 px-4 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white placeholder:text-slate-500",
                        "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50",
                        "transition-all duration-200",
                        errors.firstName && "border-red-500/50 focus:ring-red-500/50"
                      )}
                      {...register("firstName")}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-red-400 mt-1">
                        {errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-sm font-medium text-slate-300">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      className={cn(
                        "w-full h-12 px-4 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white placeholder:text-slate-500",
                        "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50",
                        "transition-all duration-200",
                        errors.lastName && "border-red-500/50 focus:ring-red-500/50"
                      )}
                      {...register("lastName")}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-red-400 mt-1">
                        {errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-300">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="john@yourcompany.com"
                    className={cn(
                      "w-full h-12 px-4 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white placeholder:text-slate-500",
                      "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50",
                      "transition-all duration-200",
                      errors.email && "border-red-500/50 focus:ring-red-500/50"
                    )}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-400 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      className={cn(
                        "w-full h-12 px-4 pr-12 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white placeholder:text-slate-500",
                        "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50",
                        "transition-all duration-200",
                        errors.password && "border-red-500/50 focus:ring-red-500/50"
                      )}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  
                  {/* Password Requirements */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {passwordRequirements.map((req, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all duration-200",
                          req.regex.test(password) 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-slate-800 text-slate-500"
                        )}
                      >
                        {req.regex.test(password) && <Check className="h-3 w-3" />}
                        {req.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Terms Checkbox */}
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="agreeToTerms" 
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setValue("agreeToTerms", !!checked)}
                    className="mt-0.5 border-[#2a3f5f] data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                  />
                  <label
                    htmlFor="agreeToTerms"
                    className="text-sm text-slate-400 cursor-pointer select-none leading-relaxed"
                  >
                    I agree to the{" "}
                    <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 underline transition-colors">
                      Terms & Conditions
                    </Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 underline transition-colors">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                {errors.agreeToTerms && (
                  <p className="text-sm text-red-400 -mt-3">
                    {errors.agreeToTerms.message}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button 
                    type="button"
                    onClick={handlePrevStep}
                    variant="outline"
                    className="h-12 px-4 bg-transparent border-[#2a3f5f] text-white hover:bg-[#1a2942] hover:text-white rounded-xl"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="flex-1 h-12 bg-cyan-500 hover:bg-cyan-400 text-[#0B1527] font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/25"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#0B1527]/30 border-t-[#0B1527] rounded-full animate-spin" />
                        Creating account...
                      </div>
                    ) : (
                      <>
                        Create account
                        <Sparkles className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {/* Footer */}
            <p className="mt-8 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>

            {/* Trust indicators */}
            <div className="mt-8 pt-8 border-t border-[#2a3f5f]">
              <div className="flex items-center justify-center gap-6 text-slate-500 text-xs">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  <span>256-bit SSL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  <span>SOC 2 Compliant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  <span>99.9% Uptime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
