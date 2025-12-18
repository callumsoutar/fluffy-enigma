"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format, isBefore, addDays } from "date-fns"
import { Plane, Heart, AlertTriangle, CalendarIcon, CheckCircle, XCircle, Award, Plus, X } from "lucide-react"
import { IconRotateClockwise, IconDeviceFloppy } from "@tabler/icons-react"
import { toast } from "sonner"
import type { License } from "@/lib/types/licenses"
import type { Endorsement, UserEndorsement } from "@/lib/types/database"

interface MemberPilotDetailsProps {
  memberId: string
}

// Type for user endorsement with endorsement relation
interface UserEndorsementWithRelation extends Omit<UserEndorsement, 'endorsement_id'> {
  endorsement: Endorsement | null
}

const pilotDetailsSchema = z.object({
  pilot_license_number: z.string().optional(),
  pilot_license_type: z.string().optional(), // Keep for backward compatibility
  pilot_license_id: z.string().optional(),
  pilot_license_expiry: z.string().optional(),
  medical_certificate_expiry: z.string().optional(),
})

type PilotDetailsFormValues = {
  pilot_license_number?: string
  pilot_license_type?: string
  pilot_license_id?: string
  pilot_license_expiry?: string
  medical_certificate_expiry?: string
}

export function MemberPilotDetails({ memberId }: MemberPilotDetailsProps) {
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // User endorsements state
  const [userEndorsements, setUserEndorsements] = useState<UserEndorsementWithRelation[]>([])
  const [availableEndorsements, setAvailableEndorsements] = useState<Endorsement[]>([])
  const [endorsementsLoading, setEndorsementsLoading] = useState(false)
  const [selectedEndorsement, setSelectedEndorsement] = useState<string>("")
  const [endorsementNotes, setEndorsementNotes] = useState("")
  const [endorsementExpiryDate, setEndorsementExpiryDate] = useState<Date | undefined>(undefined)
  const [showAddEndorsement, setShowAddEndorsement] = useState(false)

  // Licenses state
  const [availableLicenses, setAvailableLicenses] = useState<License[]>([])

  // Confirmation dialog state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [endorsementToDelete, setEndorsementToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors },
    watch,
    setValue,
  } = useForm<PilotDetailsFormValues>({
    resolver: zodResolver(pilotDetailsSchema),
  })

  // Fetch member data and endorsements
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Parallel fetch of all data
        const [memberResponse, userEndorsementsResponse, availableEndorsementsResponse, licensesResponse] = await Promise.all([
          fetch(`/api/members/${memberId}`),
          fetch(`/api/users-endorsements?user_id=${memberId}`),
          fetch('/api/endorsements'),
          fetch('/api/licenses?active_only=true')
        ])

        // Handle member data
        if (!memberResponse.ok) {
          throw new Error('Failed to fetch member data')
        }
        const memberData = await memberResponse.json()
        if (memberData.member) {
          const member = memberData.member

          // Reset form with fetched data
          reset({
            pilot_license_number: member.pilot_license_number || "",
            pilot_license_type: member.pilot_license_type || "",
            pilot_license_id: member.pilot_license_id || "",
            pilot_license_expiry: member.pilot_license_expiry || "",
            medical_certificate_expiry: member.medical_certificate_expiry || "",
          })
        }

        // Handle user endorsements
        if (userEndorsementsResponse.ok) {
          const data = await userEndorsementsResponse.json()
          setUserEndorsements(data.user_endorsements || [])
        }

        // Handle available endorsements
        if (availableEndorsementsResponse.ok) {
          const data = await availableEndorsementsResponse.json()
          setAvailableEndorsements(data.endorsements || [])
        }

        // Handle licenses
        if (licensesResponse.ok) {
          const data = await licensesResponse.json()
          setAvailableLicenses(data.licenses || [])
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    if (memberId) {
      fetchData()
    }
  }, [memberId, reset])

  // Refresh user endorsements after adding/removing
  const refreshUserEndorsements = async () => {
    try {
      const response = await fetch(`/api/users-endorsements?user_id=${memberId}`)
      if (response.ok) {
        const data = await response.json()
        setUserEndorsements(data.user_endorsements || [])
      }
    } catch (err) {
      console.error('Error fetching user endorsements:', err)
    }
  }

  // Add new endorsement
  const addEndorsement = async () => {
    if (!selectedEndorsement) {
      toast.error("Please select an endorsement")
      return
    }

    setEndorsementsLoading(true)
    try {
      const response = await fetch('/api/users-endorsements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: memberId,
          endorsement_id: selectedEndorsement,
          issued_date: new Date().toISOString(),
          expiry_date: endorsementExpiryDate ? endorsementExpiryDate.toISOString() : null,
          notes: endorsementNotes || null,
        }),
      })

      if (response.ok) {
        toast.success("Endorsement added successfully")
        setSelectedEndorsement("")
        setEndorsementNotes("")
        setEndorsementExpiryDate(undefined)
        setShowAddEndorsement(false) // Hide the form after successful addition
        await refreshUserEndorsements()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to add endorsement")
      }
    } catch (err) {
      console.error('Error adding endorsement:', err)
      toast.error("Failed to add endorsement")
    } finally {
      setEndorsementsLoading(false)
    }
  }

  // Reset form and close add endorsement section
  const resetAddEndorsementForm = () => {
    setSelectedEndorsement("")
    setEndorsementNotes("")
    setEndorsementExpiryDate(undefined)
    setShowAddEndorsement(false)
  }

  // Show confirmation dialog for endorsement removal
  const showDeleteConfirmationDialog = (endorsementId: string, endorsementName: string) => {
    setEndorsementToDelete({ id: endorsementId, name: endorsementName })
    setShowDeleteConfirmation(true)
  }

  // Void endorsement (soft delete) - called after confirmation
  const voidEndorsement = async () => {
    if (!endorsementToDelete) return

    try {
      const response = await fetch(`/api/users-endorsements/${endorsementToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success("Endorsement removed successfully")
        await refreshUserEndorsements()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to remove endorsement")
      }
    } catch (err) {
      console.error('Error removing endorsement:', err)
      toast.error("Failed to remove endorsement")
    } finally {
      setShowDeleteConfirmation(false)
      setEndorsementToDelete(null)
    }
  }

  const onSubmit = async (data: PilotDetailsFormValues) => {
    setIsSaving(true)
    setError(null)

    // Convert undefined to null for API compatibility
    const payload = {
      ...data,
      pilot_license_expiry: data.pilot_license_expiry || null,
      medical_certificate_expiry: data.medical_certificate_expiry || null,
    }

    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || `Failed to update pilot details (${res.status})`)
        toast.error(err.error || "Failed to update pilot details")
      } else {
        reset(data) // reset dirty state
        toast.success("Pilot details saved!")
      }
    } catch (err) {
      console.error('Network error:', err)
      setError("Failed to update pilot details - network error")
      toast.error("Failed to update pilot details - network error")
    } finally {
      setIsSaving(false)
    }
  }

  const getExpiryStatus = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return { status: 'unknown', color: 'bg-gray-100 text-gray-800', icon: CalendarIcon }
    
    const expiry = new Date(expiryDate)
    const today = new Date()
    const warningDate = addDays(today, 30) // 30 days warning
    
    if (isBefore(expiry, today)) {
      return { status: 'expired', color: 'bg-red-100 text-red-800', icon: XCircle }
    } else if (isBefore(expiry, warningDate)) {
      return { status: 'expiring', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle }
    } else {
      return { status: 'valid', color: 'bg-green-100 text-green-800', icon: CheckCircle }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading pilot details...</div>
      </div>
    )
  }

  if (error && !memberId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-row items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Pilot Details & Certifications</h3>
        {isDirty && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => reset()}
              disabled={isSaving}
              className="border-border/50 hover:bg-accent/80 h-10 px-5"
            >
              <IconRotateClockwise className="h-4 w-4 mr-2" />
              Undo Changes
            </Button>
            <Button
              type="submit"
              size="default"
              disabled={isSaving}
              className="bg-[#6564db] hover:bg-[#232ed1] text-white shadow-md hover:shadow-lg transition-all h-10 px-5"
            >
              <IconDeviceFloppy className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Pilot License Section */}
      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
        <h4 className="flex items-center gap-2 text-base font-semibold mb-4 text-gray-900 tracking-tight">
          <Plane className="w-5 h-5 text-indigo-500" />
          Pilot License Information
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">License Type</label>
              <Select 
                value={watch("pilot_license_id") || ""} 
                onValueChange={(value) => {
                  setValue("pilot_license_id", value, { shouldDirty: true })
                  // Also update the legacy field for backward compatibility
                  const selectedLicense = availableLicenses.find(license => license.id === value)
                  if (selectedLicense) {
                    setValue("pilot_license_type", selectedLicense.name, { shouldDirty: true })
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select license type" />
                </SelectTrigger>
                <SelectContent>
                  {availableLicenses.map((license) => (
                    <SelectItem key={license.id} value={license.id}>
                      {license.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.pilot_license_id && <p className="text-xs text-red-500 mt-1">{errors.pilot_license_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">License Number</label>
              <Input 
                {...register("pilot_license_number")}
                className="bg-white"
                placeholder="e.g., PPL-123456"
              />
              {errors.pilot_license_number && <p className="text-xs text-red-500 mt-1">{errors.pilot_license_number.message}</p>}
            </div>

          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">License Expiry Date</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={watch("pilot_license_expiry") || ""}
                  onChange={(e) => setValue("pilot_license_expiry", e.target.value, { shouldDirty: true })}
                  className="bg-white flex-1"
                  placeholder="yyyy-mm-dd"
                />
                {watch("pilot_license_expiry") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setValue("pilot_license_expiry", undefined as unknown as string, { shouldDirty: true })}
                    className="px-3"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {errors.pilot_license_expiry && <p className="text-xs text-red-500 mt-1">{errors.pilot_license_expiry.message}</p>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {watch("pilot_license_expiry") && (() => {
                const expiryStatus = getExpiryStatus(watch("pilot_license_expiry"))
                const Icon = expiryStatus.icon
                return (
                  <Badge className={`${expiryStatus.color} flex items-center gap-1 px-3 py-1`}>
                    <Icon className="w-3 h-3" />
                    {expiryStatus.status === 'expired' ? 'Expired' : 
                     expiryStatus.status === 'expiring' ? 'Expiring Soon' : 'Valid'}
                  </Badge>
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Medical Certificate Section */}
      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
        <h4 className="flex items-center gap-2 text-base font-semibold mb-4 text-gray-900 tracking-tight">
          <Heart className="w-5 h-5 text-indigo-500" />
          Medical Certificate Expiry
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Medical Certificate Expiry Date</label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={watch("medical_certificate_expiry") || ""}
                  onChange={(e) => setValue("medical_certificate_expiry", e.target.value, { shouldDirty: true })}
                  className="bg-white flex-1"
                  placeholder="yyyy-mm-dd"
                />
                {watch("medical_certificate_expiry") && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setValue("medical_certificate_expiry", undefined as unknown as string, { shouldDirty: true })}
                      className="px-3"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    {(() => {
                      const expiryStatus = getExpiryStatus(watch("medical_certificate_expiry"))
                      const Icon = expiryStatus.icon
                      return (
                        <Badge className={`${expiryStatus.color} flex items-center gap-1 px-3 py-1 flex-shrink-0`}>
                          <Icon className="w-3 h-3" />
                          {expiryStatus.status === 'expired' ? 'Expired' :
                           expiryStatus.status === 'expiring' ? 'Expiring Soon' : 'Valid'}
                        </Badge>
                      )
                    })()}
                  </>
                )}
              </div>
              {errors.medical_certificate_expiry && <p className="text-xs text-red-500 mt-1">{errors.medical_certificate_expiry.message}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* User Endorsements Section */}
      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-base font-semibold text-gray-900 tracking-tight">
            <Award className="w-5 h-5 text-indigo-500" />
            Endorsements & Ratings
          </h4>
          {!showAddEndorsement && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddEndorsement(true)}
              className="h-8 px-3"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          )}
        </div>

        <div className="p-4">
          {/* Add New Endorsement - Inline Form */}
          {showAddEndorsement && (
            <div className="mb-4 p-4 bg-white rounded-lg border border-gray-300 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-900">Add New Endorsement</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAddEndorsementForm}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Endorsement Type
                  </label>
                  <Select value={selectedEndorsement} onValueChange={setSelectedEndorsement}>
                    <SelectTrigger className="h-9 bg-white">
                      <SelectValue placeholder="Select endorsement" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEndorsements
                        .filter(e => {
                          // Only show active endorsements
                          if (!e.is_active) return false
                          // Exclude endorsements the user already has (not voided)
                          return !userEndorsements.some(ue => 
                            ue.endorsement?.id === e.id && !ue.voided_at
                          )
                        })
                        .map((endorsement) => (
                          <SelectItem key={endorsement.id} value={endorsement.id}>
                            {endorsement.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Expiry Date (Optional)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={endorsementExpiryDate ? format(endorsementExpiryDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setEndorsementExpiryDate(e.target.value ? new Date(e.target.value) : undefined)}
                      className="h-9 text-sm bg-white flex-1"
                      placeholder="yyyy-mm-dd"
                    />
                    {endorsementExpiryDate && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEndorsementExpiryDate(undefined)}
                        className="h-9 px-2"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Notes (Optional)
                  </label>
                  <Input
                    value={endorsementNotes}
                    onChange={(e) => setEndorsementNotes(e.target.value)}
                    placeholder="Additional notes..."
                    className="h-9 text-sm bg-white"
                  />
                </div>

                <div className="lg:col-span-2 flex gap-2">
                  <Button
                    type="button"
                    onClick={addEndorsement}
                    disabled={!selectedEndorsement || endorsementsLoading}
                    size="sm"
                    className="h-9 flex-1 font-semibold"
                  >
                    {endorsementsLoading ? "Adding..." : "Add"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetAddEndorsementForm}
                    className="h-9 px-3"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Current Endorsements */}
          {userEndorsements.length > 0 ? (
            <div className="space-y-2">
              {userEndorsements
                .filter(ue => ue.endorsement) // Only show endorsements with valid endorsement data
                .map((userEndorsement) => {
                  const expiryStatus = getExpiryStatus(userEndorsement.expiry_date)
                  const Icon = expiryStatus.icon
                  const endorsementName = userEndorsement.endorsement?.name || "Unknown"

                  return (
                    <div key={userEndorsement.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{endorsementName}</span>
                          <Badge className={`${expiryStatus.color} flex items-center gap-1 px-2 py-0.5 text-xs`}>
                            <Icon className="w-3 h-3" />
                            {expiryStatus.status === 'expired' ? 'Expired' :
                             expiryStatus.status === 'expiring' ? 'Soon' : 'Valid'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{format(new Date(userEndorsement.issued_date), 'MMM dd, yyyy')}</span>
                          {userEndorsement.expiry_date && (
                            <span>→ {format(new Date(userEndorsement.expiry_date), 'MMM dd, yyyy')}</span>
                          )}
                          {userEndorsement.notes && (
                            <span className="truncate">{userEndorsement.notes}</span>
                          )}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => showDeleteConfirmationDialog(userEndorsement.id, endorsementName)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 ml-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )
                })}
            </div>
          ) : !showAddEndorsement ? (
            <div className="text-center py-4 text-gray-500">
              <Award className="w-6 h-6 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No endorsements yet</p>
            </div>
          ) : null}
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      {/* Confirmation Dialog for Endorsement Removal */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Endorsement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the <strong>&quot;{endorsementToDelete?.name}&quot;</strong> endorsement? 
              This action can be undone by an administrator if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={voidEndorsement}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Remove Endorsement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
