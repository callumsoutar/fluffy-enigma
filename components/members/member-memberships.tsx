"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, CalendarCheck2, Users, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import type { MembershipSummary, MembershipTypeWithChargeable } from "@/lib/types/memberships"
import {
  calculateMembershipStatus,
  getDaysUntilExpiry,
  getGracePeriodRemaining,
  getStatusBadgeClasses,
  getStatusText,
  isMembershipExpiringSoon,
  getMembershipCardBorderClass,
  calculateMembershipFee,
} from "@/lib/utils/membership-utils"
import { RenewMembershipModal } from "./renew-membership-modal"
import { CreateMembershipModal } from "./create-membership-modal"

interface MemberMembershipsProps {
  memberId: string
}

export function MemberMemberships({ memberId }: MemberMembershipsProps) {
  const [membershipSummary, setMembershipSummary] = useState<MembershipSummary | null>(null)
  const [membershipTypes, setMembershipTypes] = useState<MembershipTypeWithChargeable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRenewing, setIsRenewing] = useState(false)
  const [showRenewalModal, setShowRenewalModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadMembershipData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/memberships?user_id=${memberId}&summary=true`)
      const data = await response.json()

      if (response.ok) {
        setMembershipSummary(data.summary)
      } else {
        setError(data.error || "Failed to load membership data")
        toast.error(data.error || "Failed to load membership data")
      }
    } catch (err) {
      console.error("Error loading membership data:", err)
      setError("Failed to load membership data")
      toast.error("Failed to load membership data")
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    loadMembershipData()
    loadMembershipTypes()
  }, [loadMembershipData])

  const loadMembershipTypes = async () => {
    try {
      const response = await fetch("/api/membership-types?active_only=true")
      const data = await response.json()

      if (response.ok) {
        setMembershipTypes(data.membership_types || [])
      }
    } catch (err) {
      console.error("Failed to load membership types:", err)
    }
  }

  const handleOpenRenewalModal = () => {
    setShowRenewalModal(true)
  }

  const handleRenewMembership = async (renewalData: {
    membership_type_id?: string
    notes?: string
    create_invoice: boolean
  }) => {
    if (!membershipSummary?.current_membership) return

    setIsRenewing(true)

    if (!membershipSummary.current_membership?.id) {
      setError("No active membership to renew")
      setIsRenewing(false)
      return
    }

    try {
      const response = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renew",
          membership_id: membershipSummary.current_membership.id,
          ...renewalData,
        }),
      })

      if (response.ok) {
        toast.success("Membership renewed successfully")
        await loadMembershipData()
        setShowRenewalModal(false)
      } else {
        const data = await response.json()
        setError(data.error || "Failed to renew membership")
        toast.error(data.error || "Failed to renew membership")
      }
    } catch (err) {
      console.error("Error renewing membership:", err)
      setError("Failed to renew membership")
      toast.error("Failed to renew membership")
    } finally {
      setIsRenewing(false)
    }
  }

  const handleCreateMembership = async (membershipData: {
    user_id: string
    membership_type_id: string
    custom_expiry_date?: string
    notes?: string
    create_invoice: boolean
  }) => {
    setIsRenewing(true)
    try {
      const response = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...membershipData,
        }),
      })

      if (response.ok) {
        toast.success("Membership created successfully")
        await loadMembershipData()
        setShowCreateModal(false)
      } else {
        const data = await response.json()
        setError(data.error || "Failed to create membership")
        toast.error(data.error || "Failed to create membership")
      }
    } catch (err) {
      console.error("Error creating membership:", err)
      setError("Failed to create membership")
      toast.error("Failed to create membership")
    } finally {
      setIsRenewing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading membership data...</div>
      </div>
    )
  }

  if (error && !membershipSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadMembershipData} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  const status = membershipSummary?.status || "none"
  const currentMembership = membershipSummary?.current_membership
  const borderClass = getMembershipCardBorderClass(status)
  const IconComponent = status === "active" ? CheckCircle : status === "expired" ? XCircle : AlertTriangle
  const iconColor = status === "active" ? "text-green-600" : status === "expired" ? "text-red-600" : "text-yellow-600"

  return (
    <div className="w-full space-y-6">
      {/* Current Membership or Create New */}
      {currentMembership ? (
        <Card className={`border-l-4 ${borderClass} rounded-lg shadow-sm`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconComponent className={`h-5 w-5 ${iconColor}`} />
                <h3 className="text-lg font-semibold text-gray-900">Current Membership</h3>
              </div>
              <Badge className={getStatusBadgeClasses(status)}>
                {getStatusText(status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
              <div className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Type</p>
                <p className="text-sm font-semibold text-gray-900">
                  {currentMembership.membership_types?.name || "Unknown"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Annual Fee</p>
                <p className="text-sm font-semibold text-gray-900">
                  {calculateMembershipFee(
                    currentMembership.membership_types?.chargeables?.rate,
                    currentMembership.membership_types?.chargeables?.is_taxable
                  )}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Started</p>
                <p className="text-sm font-semibold text-gray-900">
                  {format(new Date(currentMembership.start_date), "MMM dd, yyyy")}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Expires</p>
                <p
                  className={
                    isMembershipExpiringSoon(currentMembership)
                      ? "text-orange-600 text-sm font-semibold"
                      : "text-sm font-semibold text-gray-900"
                  }
                >
                  {format(new Date(currentMembership.expiry_date), "MMM dd, yyyy")}
                </p>
                {status === "active" && (
                  <p className="text-xs text-gray-500">
                    {getDaysUntilExpiry(currentMembership)} days remaining
                  </p>
                )}
                {status === "grace" && (
                  <p className="text-xs text-orange-600">
                    Grace period: {getGracePeriodRemaining(currentMembership)} days left
                  </p>
                )}
              </div>
            </div>

            {status === "unpaid" && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-800">
                    Payment required! Membership benefits are suspended until payment is received.
                  </span>
                </div>
              </div>
            )}

            {status !== "unpaid" && isMembershipExpiringSoon(currentMembership) && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-800">
                    Membership expires soon! Consider renewing to maintain benefits.
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-100">
              <Button
                onClick={handleOpenRenewalModal}
                disabled={isRenewing}
                className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white w-full sm:w-auto"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${isRenewing ? "animate-spin" : ""}`} />
                {isRenewing
                  ? "Processing..."
                  : status === "unpaid"
                    ? "Pay / Renew Membership"
                    : "Renew Membership"}
              </Button>
              {currentMembership.invoice_id && (
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(`/dashboard/invoices/edit/${currentMembership.invoice_id}`, "_blank")
                  }
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  View Invoice
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-lg shadow-sm border border-gray-200">
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Membership</h3>
            <p className="text-gray-600 mb-6">This member doesn&apos;t have an active membership.</p>
            <Button onClick={() => setShowCreateModal(true)} className="bg-gray-900 hover:bg-gray-800 text-white">
              Create Membership
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Membership History */}
      {membershipSummary?.membership_history && membershipSummary.membership_history.length > 0 && (
        <Card className="rounded-lg shadow-sm border border-gray-200">
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
              <CalendarCheck2 className="w-5 h-5 text-gray-500" />
              Membership History
            </h3>
          </CardHeader>
          <CardContent>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 pr-4 font-medium text-gray-900">Type</th>
                    <th className="text-left py-3 pr-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 pr-4 font-medium text-gray-900">Period</th>
                    <th className="text-left py-3 pr-4 font-medium text-gray-900">Fee</th>
                    <th className="text-left py-3 pr-4 font-medium text-gray-900">Payment</th>
                    <th className="text-left py-3 font-medium text-gray-900">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {membershipSummary.membership_history.map((membership) => {
                    const membershipStatus = calculateMembershipStatus(membership)
                    const statusClasses = getStatusBadgeClasses(membershipStatus)

                    return (
                      <tr
                        key={membership.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 pr-4 font-medium text-gray-900">
                          {membership.membership_types?.name || "Unknown"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={statusClasses}>{getStatusText(membershipStatus)}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-600">
                          <div className="flex flex-col">
                            <span>{format(new Date(membership.start_date), "MMM dd, yyyy")}</span>
                            <span className="text-xs text-gray-500">
                              to {format(new Date(membership.expiry_date), "MMM dd, yyyy")}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-medium text-gray-900">
                          {calculateMembershipFee(
                            membership.membership_types?.chargeables?.rate,
                            membership.membership_types?.chargeables?.is_taxable
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={membership.invoices?.status === "paid" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {membership.invoices?.status === "paid" ? "Paid" : "Unpaid"}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm text-gray-600 max-w-xs">
                          {membership.notes ? (
                            <span className="truncate block" title={membership.notes}>
                              {membership.notes}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {membershipSummary.membership_history.map((membership) => {
                const membershipStatus = calculateMembershipStatus(membership)
                const statusClasses = getStatusBadgeClasses(membershipStatus)

                return (
                  <div
                    key={membership.id}
                    className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {membership.membership_types?.name || "Unknown"}
                        </h4>
                        <Badge className={`${statusClasses} mt-1`}>
                          {getStatusText(membershipStatus)}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 text-sm">
                          {calculateMembershipFee(
                            membership.membership_types?.chargeables?.rate,
                            membership.membership_types?.chargeables?.is_taxable
                          )}
                        </p>
                        <Badge
                          variant={membership.invoices?.status === "paid" ? "default" : "secondary"}
                          className="text-xs mt-1"
                        >
                          {membership.invoices?.status === "paid" ? "Paid" : "Unpaid"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Period:</span>
                        <span className="text-gray-900 font-medium">
                          {format(new Date(membership.start_date), "MMM dd, yyyy")} -{" "}
                          {format(new Date(membership.expiry_date), "MMM dd, yyyy")}
                        </span>
                      </div>
                      {membership.notes && (
                        <div className="pt-2 border-t border-gray-100">
                          <span className="text-gray-500 text-xs">Notes: </span>
                          <span className="text-gray-700 text-xs">{membership.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Renewal Modal */}
      {currentMembership && (
        <RenewMembershipModal
          open={showRenewalModal}
          onClose={() => setShowRenewalModal(false)}
          currentMembership={currentMembership}
          membershipTypes={membershipTypes}
          onRenew={handleRenewMembership}
        />
      )}

      {/* Create Membership Modal */}
      {membershipTypes.length > 0 && (
        <CreateMembershipModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          memberId={memberId}
          membershipTypes={membershipTypes}
          onCreateMembership={handleCreateMembership}
        />
      )}
    </div>
  )
}
