"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
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
} from "lucide-react"
import { roundToTwoDecimals } from "@/lib/invoice-calculations"

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
}

export default function RecordPaymentModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  totalAmount,
  totalPaid,
  balanceDue,
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
      }, 1600)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record payment.")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xl flex flex-col justify-between rounded-2xl p-0 overflow-visible">
        <DialogHeader className="px-6 pt-6 pb-3 border-b flex flex-row items-center gap-3">
          <span className="bg-green-100 text-green-700 rounded-full p-2 ring-1 ring-green-200">
            <BadgeCheck className="w-6 h-6" />
          </span>
          <div className="flex-1">
            <DialogTitle className="text-xl font-bold">Record Payment</DialogTitle>
            <DialogDescription className="text-sm mt-1">
              Apply a payment to this invoice (saved atomically with a ledger transaction).
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Invoice summary */}
        <div className="px-6 py-4 bg-muted/30 border-b">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs text-muted-foreground">Invoice</div>
              <div className="text-base font-semibold tracking-tight">
                {invoiceNumber || `#${invoiceId.slice(0, 8)}`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Remaining balance</div>
              <div className="text-lg font-bold text-green-700">{formatCurrency(computedRemaining)}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-medium">{formatCurrency(totalAmount ?? null)}</div>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="font-medium">{formatCurrency(totalPaid ?? 0)}</div>
            </div>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="bg-green-100 text-green-700 rounded-full p-4 mb-4 ring-1 ring-green-200">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-green-700 mb-2">Payment recorded</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {formatCurrency(amount)} has been applied to this invoice.
            </p>
            {receiptId && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-green-200 rounded-lg">
                <Receipt className="w-4 h-4 text-green-700" />
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">Receipt</div>
                  <div className="font-mono font-semibold text-green-800">{receiptId}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form className="flex flex-col gap-4 px-6 py-5" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Payment Amount <span className="text-destructive">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="pointer-events-none select-none absolute left-3 text-muted-foreground text-lg">$</span>
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
                    className="pl-8 pr-3 py-2 text-lg font-semibold h-11"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Max: {formatCurrency(computedRemaining)}</span>
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-foreground"
                    onClick={() => setAmount(roundToTwoDecimals(computedRemaining))}
                    disabled={loading}
                  >
                    Use full balance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Payment Method <span className="text-destructive">*</span>
                </label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} disabled={loading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method..." />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>
                        <span className="flex items-center gap-2">
                          <pm.icon className="h-4 w-4" />
                          <span>{pm.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Reference Number</label>
                <Input
                  placeholder="Transaction ID, check #, etc."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Date</label>
                <Input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Textarea
                placeholder="Optional notes about this payment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                className="min-h-[90px]"
              />
            </div>

            {error && (
              <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md border border-destructive/20">
                {error}
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Payment amount</div>
                <div className="text-lg font-bold text-foreground">{formatCurrency(amount)}</div>
              </div>
              <div className="text-sm text-muted-foreground">
                {willFullyPay ? (
                  <span className="text-green-700 font-medium">This will mark the invoice as paid</span>
                ) : (
                  <span>Remaining after payment: {formatCurrency(roundToTwoDecimals(computedRemaining - Math.max(0, amount)))}</span>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <DialogClose asChild>
                <Button variant="outline" type="button" className="flex-1" disabled={loading}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                disabled={loading || !method || amount <= 0}
              >
                {loading ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
