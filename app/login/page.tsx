import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

function LoginFormFallback() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="bg-[#0B1527] min-h-screen">
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
