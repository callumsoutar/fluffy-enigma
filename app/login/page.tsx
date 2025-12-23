import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="bg-[#0B1527] flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-5xl">
        <LoginForm />
      </div>
    </div>
  )
}
