"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Landmark,
  Receipt,
  Wallet,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { roundToTwoDecimals } from "@/lib/invoice-calculations"
import { cn } from "@/lib/utils"

type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "check"
  | "online_payment"
  | "other"

const paymentMethods: Array<{ value: PaymentMethod; label: string; icon: React.ElementType }> = [
  { value: "cash", label: "Cash", icon: DollarSign },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "debit_card", label: "Debit Card", icon: CreditCard },
  { value: "bank_transfer", label: "Bank Transfer", icon: Landmark },
  { value: "check", label: "Check", icon: Receipt },
  { value: "online_payment", label: "Online Payment", icon: Wallet },
  { value: "other", label: "Other", icon: Wallet },
]

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export type RecordPaymentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber?: string | null
  totalAmount?: number | null
  totalPaid?: number | null
  balanceDue?: number | null
  onSuccess?: () => void
}

export default function RecordPaymentModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  totalAmount,
  totalPaid,
  balanceDue,
  onSuccess,
}: RecordPaymentModalProps) {
  const router = useRouter()

  const computedRemaining = React.useMemo(() => {
    const ta = typeof totalAmount === "number" ? totalAmount : 0
    const tp = typeof totalPaid === "number" ? totalPaid : 0
    const byCalc = Math.max(0, roundToTwoDecimals(ta - tp))
    const byField = typeof balanceDue === "number" ? Math.max(0, roundToTwoDecimals(balanceDue)) : null
    return byField ?? byCalc
  }, [totalAmount, totalPaid, balanceDue])

  const [amount, setAmount] = React.useState<number>(roundToTwoDecimals(computedRemaining || 0))
  const [method, setMethod] = React.useState<PaymentMethod | "">("")
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [paidDate, setPaidDate] = React.useState<string>("") // YYYY-MM-DD

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [receiptId, setReceiptId] = React.useState<string | null>(null)
  const [showAdditionalInfo, setShowAdditionalInfo] = React.useState(false)

  const willFullyPay = amount > 0 && computedRemaining > 0 && roundToTwoDecimals(amount) === roundToTwoDecimals(computedRemaining)

  const reset = React.useCallback(() => {
    setAmount(roundToTwoDecimals(computedRemaining || 0))
    setMethod("")
    setReference("")
    setNotes("")
    setPaidDate("")
    setLoading(false)
    setError(null)
    setSuccess(false)
    setReceiptId(null)
    setShowAdditionalInfo(false)
  }, [computedRemaining])

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => reset(), 200)
      return () => clearTimeout(t)
    }
    // When opening, initialize amount to remaining
    setAmount(roundToTwoDecimals(computedRemaining || 0))
  }, [open, reset, computedRemaining])

  function validate(): string | null {
    if (!invoiceId) return "Missing invoice ID."
    if (!method) return "Payment method is required."
    if (!amount || amount <= 0) return "Payment amount must be greater than zero."
    if (computedRemaining >= 0 && amount > computedRemaining) {
      return `Payment amount cannot exceed remaining balance (${formatCurrency(computedRemaining)}).`
    }
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: roundToTwoDecimals(amount),
          payment_method: method,
          payment_reference: reference || null,
          notes: notes || null,
          paid_at: paidDate || null,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload?.error || "Failed to record payment.")
        setLoading(false)
        return
      }

      const txId = payload?.result?.transaction_id as string | undefined
      const payId = payload?.result?.payment_id as string | undefined
      setReceiptId(txId || payId || null)
      setSuccess(true)
      setLoading(false)

      setTimeout(() => {
        reset()
        onOpenChange(false)
        router.refresh()
        onSuccess?.()
      }, 1600)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record payment.")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[720px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-fit sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex flex-1 min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Record Payment
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Apply a payment to this invoice. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {success ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
              <div className="bg-green-100 text-green-700 rounded-full p-4 mb-4 ring-1 ring-green-200">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-bold text-green-700 mb-2">Payment recorded</h3>
              <p className="text-sm text-slate-500 text-center mb-4">
                {formatCurrency(amount)} has been applied to this invoice.
              </p>
              {receiptId && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-green-200 rounded-xl">
                  <Receipt className="w-4 h-4 text-green-700" />
                  <div className="text-left">
                    <div className="text-xs text-slate-500">Receipt</div>
                    <div className="font-mono font-semibold text-green-800">{receiptId}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <div className="space-y-6">
                {/* Invoice Summary */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Invoice Summary</span>
                  </div>
                  <div className="rounded-2xl bg-slate-50/50 border border-slate-100 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
                      <div className="flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Invoice</div>
                        <div className="text-base font-semibold tracking-tight text-slate-900">
                          {invoiceNumber || `#${invoiceId.slice(0, 8)}`}
                        </div>
                      </div>
                      <div className="flex-1 sm:text-right">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Remaining Balance</div>
                        <div className="text-xl sm:text-lg font-bold text-green-700">{formatCurrency(computedRemaining)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total</div>
                        <div className="text-sm sm:text-base font-medium text-slate-900">{formatCurrency(totalAmount ?? null)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Paid</div>
                        <div className="text-sm sm:text-base font-medium text-slate-900">{formatCurrency(totalPaid ?? 0)}</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Payment Details */}
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Payment Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Payment Amount <span className="text-destructive">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <DollarSign className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={amount === 0 ? "" : String(amount)}
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === "" || value === ".") {
                              setAmount(0)
                              return
                            }
                            const numValue = parseFloat(value)
                            setAmount(Number.isFinite(numValue) ? numValue : 0)
                          }}
                          className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          required
                          disabled={loading}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Max: {formatCurrency(computedRemaining)}</span>
                        <button
                          type="button"
                          className="underline underline-offset-4 hover:text-slate-900 transition-colors"
                          onClick={() => setAmount(roundToTwoDecimals(computedRemaining))}
                          disabled={loading}
                        >
                          Use full balance
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Payment Method <span className="text-destructive">*</span>
                      </label>
                      <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} disabled={loading}>
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                          {paymentMethods.map((pm) => (
                            <SelectItem key={pm.value} value={pm.value} className="rounded-lg py-2 text-base">
                              <span className="flex items-center gap-2">
                                <pm.icon className="h-3.5 w-3.5" />
                                <span>{pm.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                {/* Additional Information */}
                <section className="border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                    className="flex items-center justify-between w-full text-left py-2 px-3 -mx-3 rounded-xl hover:bg-slate-50 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full transition-colors",
                        showAdditionalInfo ? "bg-blue-500" : "bg-slate-300 group-hover:bg-slate-400"
                      )} />
                      <span className={cn(
                        "text-xs font-semibold tracking-tight transition-colors",
                        showAdditionalInfo ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"
                      )}>
                        Additional Information
                      </span>
                    </div>
                    {showAdditionalInfo ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  {showAdditionalInfo && (
                    <div className="mt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Reference Number</label>
                          <div className="relative">
                            <Receipt className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                            <Input
                              placeholder="Transaction ID, check #, etc."
                              value={reference}
                              onChange={(e) => setReference(e.target.value)}
                              disabled={loading}
                              className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Payment Date</label>
                          <div className="relative">
                            <CalendarIcon className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                            <Input
                              type="date"
                              value={paidDate}
                              onChange={(e) => setPaidDate(e.target.value)}
                              disabled={loading}
                              className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Notes (Optional)</label>
                        <Textarea
                          placeholder="Optional notes about this payment..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          disabled={loading}
                          className="rounded-xl border-slate-200 bg-white text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[100px] resize-none"
                        />
                      </div>
                    </div>
                  )}
                </section>

                {error && (
                  <div className="rounded-xl bg-destructive/5 p-3 flex items-center gap-3 text-destructive border border-destructive/10">
                    <Receipt className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                {/* Payment Summary */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Payment Amount</div>
                    <div className="text-lg font-bold text-slate-900">{formatCurrency(amount)}</div>
                  </div>
                  <div className="text-sm text-slate-600">
                    {willFullyPay ? (
                      <span className="text-green-700 font-medium">✓ This will mark the invoice as paid</span>
                    ) : (
                      <span>Remaining: {formatCurrency(roundToTwoDecimals(computedRemaining - Math.max(0, amount)))}</span>
                    )}
                  </div>
                </div>
              </div>
            </form>
          )}

          {!success && (
            <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  onClick={onSubmit}
                  disabled={loading || !method || amount <= 0}
                  className="h-10 flex-[1.4] rounded-xl bg-green-600 text-sm font-bold text-white shadow-lg shadow-green-600/10 hover:bg-green-700"
                >
                  {loading ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
