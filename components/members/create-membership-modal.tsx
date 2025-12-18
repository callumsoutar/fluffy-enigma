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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  UserPlus,
  CreditCard,
  Calendar as CalendarIcon,
  Gift,
  CheckCircle,
  FileText,
  Settings,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { MembershipTypeWithChargeable } from "@/lib/types/memberships"
import { calculateDefaultMembershipExpiry } from "@/lib/utils/membership-year-utils"
import { DEFAULT_MEMBERSHIP_YEAR_CONFIG } from "@/lib/utils/membership-defaults"
import type { MembershipYearConfig } from "@/lib/types/settings"
import { calculateMembershipFee } from "@/lib/utils/membership-utils"

interface CreateMembershipModalProps {
  open: boolean
  onClose: () => void
  memberId: string
  membershipTypes: MembershipTypeWithChargeable[]
  onCreateMembership: (data: {
    user_id: string
    membership_type_id: string
    custom_expiry_date?: string
    notes?: string
    create_invoice: boolean
  }) => Promise<void>
}

export function CreateMembershipModal({
  open,
  onClose,
  memberId,
  membershipTypes,
  onCreateMembership,
}: CreateMembershipModalProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [showNotes, setShowNotes] = useState(false)
  const [createInvoice, setCreateInvoice] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [membershipYearConfig, setMembershipYearConfig] = useState<MembershipYearConfig>(
    DEFAULT_MEMBERSHIP_YEAR_CONFIG
  )
  const [useCustomExpiry, setUseCustomExpiry] = useState(false)
  const [customExpiryDate, setCustomExpiryDate] = useState<Date | undefined>(undefined)

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
      setSelectedTypeId("")
      setNotes("")
      setShowNotes(false)
      setCreateInvoice(true)
      setUseCustomExpiry(false)
      setCustomExpiryDate(undefined)
    }
  }, [open])

  const selectedType = membershipTypes.find((t) => t.id === selectedTypeId)

  // Calculate expiry date using membership year configuration or custom override
  const calculatedExpiryDate = selectedType
    ? calculateDefaultMembershipExpiry(membershipYearConfig, new Date())
    : null

  const expiryDate =
    useCustomExpiry && customExpiryDate ? customExpiryDate : calculatedExpiryDate

  const handleSubmit = async () => {
    if (!selectedType) return

    setIsSubmitting(true)
    try {
      await onCreateMembership({
        user_id: memberId,
        membership_type_id: selectedTypeId,
        notes: notes.trim() || undefined,
        create_invoice: createInvoice,
        custom_expiry_date:
          useCustomExpiry && customExpiryDate
            ? customExpiryDate.toISOString().split("T")[0]
            : undefined,
      })
      onClose()
    } catch (error) {
      console.error("Membership creation failed:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[675px] h-[700px] max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Create New Membership
          </DialogTitle>
          <p className="text-gray-600 text-sm">Set up a new membership for this member</p>
        </DialogHeader>

        <div className="space-y-5 flex-1 overflow-y-auto">
          {/* Membership Type Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium flex items-center gap-2">
              <Gift className="h-4 w-4 text-[#6564db]" />
              Membership Type
            </label>

            {membershipTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Info className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">No membership types available</p>
              </div>
            ) : (
              <>
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
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{type.name}</span>
                              <span className="text-sm text-gray-500">
                                {type.duration_months} months
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 ml-4">
                              {calculateMembershipFee(
                                type.chargeables?.rate,
                                type.chargeables?.is_taxable
                              )}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {/* Membership Preview - Always visible */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
                  {selectedType ? (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-lg text-gray-900">
                              {selectedType.name}
                            </h4>
                            <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
                              <CheckCircle className="h-3 w-3 text-white" />
                            </div>
                          </div>
                          {selectedType.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {selectedType.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Gift className="h-4 w-4" />
                              {selectedType.duration_months} months
                            </span>
                            {expiryDate && (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-4 w-4" />
                                Expires {format(expiryDate, "MMM dd, yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-gray-900">
                            {calculateMembershipFee(
                              selectedType.chargeables?.rate,
                              selectedType.chargeables?.is_taxable
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Benefits */}
                      {selectedType.benefits && Array.isArray(selectedType.benefits) && selectedType.benefits.length > 0 && (
                        <div className="pt-3 border-t border-blue-200">
                          <h5 className="text-sm font-medium text-blue-900 mb-2">
                            Membership Benefits
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                            {selectedType.benefits.map((benefit, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{String(benefit)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Gift className="h-12 w-12 text-gray-400 mb-3" />
                      <h4 className="font-medium text-gray-900 mb-1">
                        Select a Membership Type
                      </h4>
                      <p className="text-sm text-gray-600">
                        Choose a membership type above to see details and benefits
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Configuration Options */}
          {selectedType && (
            <div className="space-y-4 pt-3 border-t">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4 text-green-600" />
                Configuration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Invoice creation */}
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

                {/* Custom Expiry Date */}
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label
                        htmlFor="use-custom-expiry"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Custom expiry date
                      </label>
                      <p className="text-xs text-gray-600">Override default calculation</p>
                    </div>
                    <Switch
                      id="use-custom-expiry"
                      checked={useCustomExpiry}
                      onCheckedChange={(checked) => {
                        setUseCustomExpiry(checked)
                        if (!checked) setCustomExpiryDate(undefined)
                      }}
                    />
                  </div>

                  {useCustomExpiry && (
                    <div className="pt-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-9 text-sm",
                              !customExpiryDate && "text-muted-foreground"
                            )}
                            type="button"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customExpiryDate
                              ? format(customExpiryDate, "dd MMM yyyy")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={customExpiryDate}
                            onSelect={setCustomExpiryDate}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {calculatedExpiryDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Default: {format(calculatedExpiryDate, "MMM dd, yyyy")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
                placeholder="Add any notes about this membership..."
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
                  <UserPlus className="h-4 w-4 animate-spin" />
                  Creating Membership...
                </>
              ) : (
                <>
                  {createInvoice ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Create Membership
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
