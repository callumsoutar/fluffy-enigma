"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  RefreshCw,
  CreditCard,
  Calendar as CalendarIcon,
  Gift,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { format } from "date-fns"
import type { MembershipWithRelations, MembershipTypeWithChargeable } from "@/lib/types/memberships"
import {
  calculateRenewalExpiry,
} from "@/lib/utils/membership-year-utils"
import { DEFAULT_MEMBERSHIP_YEAR_CONFIG } from "@/lib/utils/membership-defaults"
import type { MembershipYearConfig } from "@/lib/types/settings"
import { calculateMembershipFee } from "@/lib/utils/membership-utils"

interface RenewMembershipModalProps {
  open: boolean
  onClose: () => void
  currentMembership: MembershipWithRelations
  membershipTypes: MembershipTypeWithChargeable[]
  onRenew: (data: {
    membership_type_id?: string
    notes?: string
    create_invoice: boolean
  }) => Promise<void>
}

export function RenewMembershipModal({
  open,
  onClose,
  currentMembership,
  membershipTypes,
  onRenew,
}: RenewMembershipModalProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [showNotes, setShowNotes] = useState(false)
  const [createInvoice, setCreateInvoice] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [membershipYearConfig, setMembershipYearConfig] = useState<MembershipYearConfig>(
    DEFAULT_MEMBERSHIP_YEAR_CONFIG
  )

  // Fetch membership year configuration
  useEffect(() => {
    async function fetchMembershipYearConfig() {
      try {
        const response = await fetch(
          "/api/settings?category=memberships&key=membership_year"
        )
        const data = await response.json()
        if (data.setting?.setting_value) {
          setMembershipYearConfig(data.setting.setting_value as MembershipYearConfig)
        }
      } catch (error) {
        console.error("Failed to fetch membership year config:", error)
        // Use default config on error
      }
    }
    fetchMembershipYearConfig()
  }, [])

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSelectedTypeId(currentMembership.membership_type_id || "")
      setNotes("")
      setShowNotes(false)
      setCreateInvoice(true)
    }
  }, [open, currentMembership])

  const selectedType = membershipTypes.find((t) => t.id === selectedTypeId)
  const isChangingType = selectedTypeId !== currentMembership.membership_type_id

  // Calculate new expiry date for renewal
  // Use the current membership's expiry date to calculate the NEXT membership year
  const expiryDate = selectedType
    ? calculateRenewalExpiry(membershipYearConfig, currentMembership.expiry_date)
    : null

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onRenew({
        membership_type_id: isChangingType ? selectedTypeId : undefined,
        notes: notes.trim() || undefined,
        create_invoice: createInvoice,
      })
      onClose()
    } catch (error) {
      console.error("Renewal failed:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[675px] h-[600px] max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Renew Membership
          </DialogTitle>
          <p className="text-gray-600 text-sm">Renew this member&apos;s membership</p>
        </DialogHeader>

        <div className="space-y-5 flex-1 overflow-y-auto">
          {/* Membership Type Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium flex items-center gap-2">
              <Gift className="h-4 w-4 text-[#6564db]" />
              Membership Type
            </label>

            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Choose a membership type" />
              </SelectTrigger>
              <SelectContent>
                {membershipTypes
                  .filter((type) => type.is_active)
                  .map((type) => (
                    <SelectItem key={type.id} value={type.id} className="py-3">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{type.name}</span>
                        <span className="text-sm font-semibold text-gray-900 ml-4">
                          {calculateMembershipFee(type.chargeables?.rate, type.chargeables?.is_taxable)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Renewal Details */}
            {selectedType && (
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-lg text-gray-900">{selectedType.name}</h4>
                    {selectedType.description && (
                      <p className="text-sm text-gray-600 mt-1">{selectedType.description}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {calculateMembershipFee(selectedType.chargeables?.rate, selectedType.chargeables?.is_taxable)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm pt-3 border-t border-blue-200">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-gray-600" />
                    <span className="text-gray-600">New Expiry:</span>
                    <span className="font-semibold text-gray-900">
                      {expiryDate ? format(expiryDate, "MMM dd, yyyy") : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Creation Option */}
          {selectedType && (
            <div className="space-y-4 pt-3 border-t">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <label htmlFor="create-invoice" className="text-sm font-medium cursor-pointer">
                    Create invoice
                  </label>
                  <p className="text-xs text-gray-600">Generate invoice for payment</p>
                </div>
                <Switch
                  id="create-invoice"
                  checked={createInvoice}
                  onCheckedChange={setCreateInvoice}
                />
              </div>
            </div>
          )}

          {/* Notes Section - Collapsible */}
          <div className="space-y-2 pt-3 border-t">
            <Button
              variant="ghost"
              onClick={() => setShowNotes(!showNotes)}
              className="w-full justify-between h-8 px-0 text-sm font-medium hover:bg-transparent"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Add Notes (optional)
              </span>
              {showNotes ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showNotes && (
              <Textarea
                id="notes"
                placeholder="Add any notes about this renewal..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-sm"
              />
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t flex-shrink-0">
          <div className="flex items-center gap-3 w-full justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedType}
              className="flex items-center gap-2 px-6 bg-gray-900 hover:bg-gray-800 text-white"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing Renewal...
                </>
              ) : (
                <>
                  {createInvoice ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Renew Membership
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
