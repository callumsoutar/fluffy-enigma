"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Plane } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = React.useState(false)

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
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      toast.error("An unexpected error occurred")
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 bg-white border-none shadow-xl">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit(onSubmit)} className="p-8 md:p-12">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-2">
                  <Plane className="h-6 w-6 text-cyan-500 fill-cyan-500/20" />
                  <span className="text-xl font-bold text-[#0B1527]">Flight Desk Pro</span>
                </div>
                <div className="flex flex-col gap-2 text-center">
                  <h1 className="text-3xl font-bold tracking-tight text-[#0B1527]">Sign in to your account</h1>
                  <p className="text-slate-500">
                    Welcome back! Please enter your details below.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <Field className="flex flex-col gap-2">
                  <FieldLabel htmlFor="email" className="font-semibold text-[#0B1527]">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="h-12 px-4 rounded-xl border-slate-200 focus-visible:ring-[#0B1527]"
                    {...register("email")}
                    aria-invalid={errors.email ? "true" : "false"}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </Field>

                <Field className="flex flex-col gap-2">
                  <FieldLabel htmlFor="password" title="Password" className="font-semibold text-[#0B1527]">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    className="h-12 px-4 rounded-xl border-slate-200 focus-visible:ring-[#0B1527]"
                    {...register("password")}
                    aria-invalid={errors.password ? "true" : "false"}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </Field>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="rememberMe" 
                      checked={rememberMeValue}
                      onCheckedChange={(checked) => setValue("rememberMe", !!checked)}
                      className="border-slate-300 data-[state=checked]:bg-[#0B1527] data-[state=checked]:border-[#0B1527]"
                    />
                    <label
                      htmlFor="rememberMe"
                      className="text-sm font-medium leading-none text-slate-600 cursor-pointer"
                    >
                      Remember me
                    </label>
                  </div>
                  <a
                    href="#"
                    className="text-sm font-bold text-[#0B1527] hover:underline"
                  >
                    Forgot Password?
                  </a>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="h-12 w-full bg-[#0B1527] hover:bg-[#1a2b4b] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#0B1527]/10"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <div className="text-center">
                <p className="text-sm text-slate-600">
                  Don&apos;t have an account?{" "}
                  <a href="#" className="font-bold text-[#0B1527] hover:underline">
                    Sign Up
                  </a>
                </p>
              </div>
            </div>
          </form>
          <div className="relative hidden md:block overflow-hidden">
            <Image
              src="https://images.squarespace-cdn.com/content/v1/658c950095afb106910c8574/7eb7a4ee-82ef-4dc5-8c65-dcffb16f0eb0/Cessna172_TheFlyingSchool_4.jpg"
              alt="Cessna 172"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-[#0B1527]/10" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
