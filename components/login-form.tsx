"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Plane, Eye, EyeOff, ArrowRight, Mail, AlertCircle, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

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

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [isLoading, setIsLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [currentSlide, setCurrentSlide] = React.useState(0)
  
  // Get URL params for messages
  const message = searchParams.get('message')
  const error = searchParams.get('error')

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
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  })

  const rememberMeValue = watch("rememberMe")

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        toast.error(error.message || "Failed to sign in")
        return
      }

      toast.success("Successfully signed in!")
      router.push("/")
      router.refresh()
    } catch (error) {
      toast.error("An unexpected error occurred")
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        toast.error(error.message || "Failed to sign in with Google")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
      console.error("Google sign in error:", error)
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

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Header */}
            <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
              <Plane className="h-7 w-7 text-cyan-400 fill-cyan-400/20" />
              <span className="text-xl font-bold text-white tracking-tight">Flight Desk Pro</span>
            </div>

            {/* Form Header */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Welcome back
              </h1>
              <p className="text-slate-400">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                  Sign up
                </Link>
              </p>
            </div>

            {/* Success Message Banner */}
            {message === 'check-email' && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-400">Check your email</p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">
                    We&apos;ve sent you a verification link. Please check your inbox and spam folder.
                  </p>
                </div>
              </div>
            )}

            {message === 'email-verified' && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-400">Email verified!</p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">
                    Your account is ready. Sign in below to get started.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message Banner */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-400">Authentication error</p>
                  <p className="text-xs text-red-400/70 mt-0.5">
                    {decodeURIComponent(error)}
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className={cn(
                    "w-full h-12 px-4 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white placeholder:text-slate-500",
                    "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50",
                    "transition-all duration-200",
                    errors.email && "border-red-500/50 focus:ring-red-500/50"
                  )}
                  {...register("email")}
                  aria-invalid={errors.email ? "true" : "false"}
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
                    placeholder="Enter your password"
                    className={cn(
                      "w-full h-12 px-4 pr-12 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white placeholder:text-slate-500",
                      "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50",
                      "transition-all duration-200",
                      errors.password && "border-red-500/50 focus:ring-red-500/50"
                    )}
                    {...register("password")}
                    aria-invalid={errors.password ? "true" : "false"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-400 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="rememberMe" 
                    checked={rememberMeValue}
                    onCheckedChange={(checked) => setValue("rememberMe", !!checked)}
                    className="border-[#2a3f5f] data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm text-slate-400 cursor-pointer select-none"
                  >
                    Remember me
                  </label>
                </div>
                <Link
                  href="/forgot-password"
                  className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
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
                    Signing in...
                  </div>
                ) : (
                  "Sign in"
                )}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#2a3f5f]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#0B1527] text-slate-500">Or continue with</span>
                </div>
              </div>

              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex items-center justify-center gap-2 h-12 px-4 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white font-medium hover:bg-[#243552] hover:border-[#3a5070] transition-all duration-200"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 h-12 px-4 rounded-xl bg-[#1a2942] border border-[#2a3f5f] text-white font-medium hover:bg-[#243552] hover:border-[#3a5070] transition-all duration-200"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Apple
                </button>
              </div>
            </form>

            {/* Footer */}
            <p className="mt-8 text-center text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
