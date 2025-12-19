"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function InvoicingRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/invoices")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-muted-foreground">Redirecting to invoices...</div>
    </div>
  )
}
