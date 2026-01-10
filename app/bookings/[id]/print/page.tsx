"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { pdf } from "@react-pdf/renderer"
import { toast } from "sonner"
import CheckOutSheet from "@/components/bookings/checkout-sheet-pdf"
import type { BookingWithRelations } from "@/lib/types/bookings"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = "Request failed"
    try {
      const data = await res.json()
      if (typeof data?.error === "string") message = data.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export default function BookingPrintPage() {
  const params = useParams()
  const router = useRouter()
  const bookingId = params.id as string
  const [isGenerating, setIsGenerating] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pdfOpened, setPdfOpened] = React.useState(false)

  // Fetch booking
  const bookingQuery = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!bookingId,
    queryFn: () => fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`),
    staleTime: 30_000,
  })

  const booking = bookingQuery.data?.booking ?? null

  // Generate PDF and trigger print when booking is loaded
  React.useEffect(() => {
    if (!booking || bookingQuery.isLoading) return

    const generateAndPrint = async () => {
      try {
        setIsGenerating(true)
        setError(null)

        // Generate PDF blob
        const doc = <CheckOutSheet booking={booking} />
        const blob = await pdf(doc).toBlob()

        // Create object URL and open in new window
        const url = URL.createObjectURL(blob)
        const printWindow = window.open(url, "_blank")

        if (!printWindow) {
          throw new Error("Failed to open print window. Please allow popups for this site.")
        }

        // Wait for PDF to load, then trigger print
        const handlePrint = () => {
          setTimeout(() => {
            try {
              printWindow.print()
              // Clean up object URL after a delay
              setTimeout(() => {
                URL.revokeObjectURL(url)
              }, 1000)
            } catch (err) {
              console.error("Error triggering print:", err)
            }
          }, 500)
        }

        // Try multiple approaches to detect when PDF is loaded
        printWindow.addEventListener("load", handlePrint, { once: true })
        
        // Fallback: if load event doesn't fire, try printing after a delay
        const fallbackTimeout = setTimeout(() => {
          if (printWindow && !printWindow.closed) {
            try {
              printWindow.print()
              URL.revokeObjectURL(url)
            } catch (err) {
              console.error("Error triggering print:", err)
            }
          }
        }, 2000)

        // Clean up timeout if print was triggered by load event
        printWindow.addEventListener("load", () => {
          clearTimeout(fallbackTimeout)
        }, { once: true })

        setIsGenerating(false)
        setPdfOpened(true)
        
        // Redirect back to booking page after opening PDF
        // This closes/replaces the print page tab
        setTimeout(() => {
          router.replace(`/bookings/${bookingId}`)
        }, 500)
      } catch (err) {
        console.error("Error generating PDF:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to generate PDF"
        setError(errorMessage)
        setIsGenerating(false)
        toast.error(errorMessage)
      }
    }

    generateAndPrint()
  }, [booking, bookingQuery.isLoading, bookingId, router])

  // Show loading state
  if (bookingQuery.isLoading || isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Generating checkout sheet...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || bookingQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-xl font-semibold text-destructive">Error</h2>
          <p className="text-muted-foreground">
            {error || "Failed to load booking data"}
          </p>
        </div>
      </div>
    )
  }

  // Show not found state
  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Booking not found</h2>
          <p className="text-muted-foreground">
            The booking you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    )
  }

  // If PDF has been opened, don't show anything (window should close or redirect)
  if (pdfOpened) {
    return null
  }

  // This should not be visible as PDF should open in new window
  return null
}
