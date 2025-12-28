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
import { toast } from "sonner"
import type { License } from "@/lib/types/licenses"
import type { Endorsement, UserEndorsement } from "@/lib/types/database"
import { DatePicker } from "@/components/ui/date-picker"

interface MemberPilotDetailsProps {
  memberId: string
  onDirtyChange?: (isDirty: boolean) => void
  onSavingChange?: (isSaving: boolean) => void
  onUndoRef?: React.MutableRefObject<(() => void) | null>
  formId?: string
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

export function MemberPilotDetails({ 
  memberId,
  onDirtyChange,
  onSavingChange,
  onUndoRef,
  formId
}: MemberPilotDetailsProps) {
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

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Notify parent of saving state changes
  useEffect(() => {
    onSavingChange?.(isSaving)
  }, [isSaving, onSavingChange])

  // Expose undo to parent
  useEffect(() => {
    if (onUndoRef) {
      onUndoRef.current = () => reset()
    }
  }, [onUndoRef, reset])

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

    // Convert empty strings or undefined to null for API compatibility
    const payload = {
      ...data,
      pilot_license_id: data.pilot_license_id || null,
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
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="pb-32">
      <div className="flex flex-row items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Pilot Details & Certifications</h3>
      </div>

      {/* Pilot License Section */}
      <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <h4 className="flex items-center gap-2 text-base font-semibold text-gray-900 tracking-tight">
            <div className="p-1.5 bg-indigo-50 rounded-md">
              <Plane className="w-4 h-4 text-indigo-500" />
            </div>
            Pilot License Information
          </h4>
          {watch("pilot_license_expiry") && (() => {
            const expiryStatus = getExpiryStatus(watch("pilot_license_expiry"))
            const Icon = expiryStatus.icon
            return (
              <Badge className={`${expiryStatus.color} flex items-center gap-1.5 px-3 py-1 border-none shadow-none`}>
                <Icon className="w-3.5 h-3.5" />
                {expiryStatus.status === 'expired' ? 'Expired' : 
                 expiryStatus.status === 'expiring' ? 'Expiring Soon' : 'Valid'}
              </Badge>
            )
          })()}
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600">License Type</label>
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
                  <SelectTrigger className="w-full bg-white h-11 border-gray-200 focus:ring-indigo-500 rounded-lg">
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
                {errors.pilot_license_id && <p className="text-xs text-red-500 mt-1.5">{errors.pilot_license_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600">License Number</label>
                <div className="relative">
                  <Input 
                    {...register("pilot_license_number")}
                    className="bg-white pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg"
                    placeholder="e.g., PPL-123456"
                  />
                  <Award className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {errors.pilot_license_number && <p className="text-xs text-red-500 mt-1.5">{errors.pilot_license_number.message}</p>}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-600">License Expiry Date</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1">
                    <DatePicker
                      date={watch("pilot_license_expiry")}
                      onChange={(date) => setValue("pilot_license_expiry", date || "", { shouldDirty: true })}
                      placeholder="Select expiry date"
                    />
                  </div>
                  {watch("pilot_license_expiry") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setValue("pilot_license_expiry", undefined as unknown as string, { shouldDirty: true })}
                      className="h-11 px-4 text-gray-500 hover:text-red-600 hover:bg-red-50 border-gray-200 rounded-lg shrink-0"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  )}
                </div>
                {errors.pilot_license_expiry && <p className="text-xs text-red-500 mt-1.5">{errors.pilot_license_expiry.message}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Medical Certificate Section */}
      <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <h4 className="flex items-center gap-2 text-base font-semibold text-gray-900 tracking-tight">
            <div className="p-1.5 bg-rose-50 rounded-md">
              <Heart className="w-4 h-4 text-rose-500" />
            </div>
            Medical Certificate Expiry
          </h4>
          {watch("medical_certificate_expiry") && (() => {
            const expiryStatus = getExpiryStatus(watch("medical_certificate_expiry"))
            const Icon = expiryStatus.icon
            return (
              <Badge className={`${expiryStatus.color} flex items-center gap-1.5 px-3 py-1 border-none shadow-none`}>
                <Icon className="w-3.5 h-3.5" />
                {expiryStatus.status === 'expired' ? 'Expired' :
                 expiryStatus.status === 'expiring' ? 'Expiring Soon' : 'Valid'}
              </Badge>
            )
          })()}
        </div>
        <div className="p-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-2 text-gray-600">Medical Certificate Expiry Date</label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1">
                <DatePicker
                  date={watch("medical_certificate_expiry")}
                  onChange={(date) => setValue("medical_certificate_expiry", date || "", { shouldDirty: true })}
                  placeholder="Select expiry date"
                />
              </div>
              {watch("medical_certificate_expiry") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue("medical_certificate_expiry", undefined as unknown as string, { shouldDirty: true })}
                  className="h-11 px-4 text-gray-500 hover:text-red-600 hover:bg-red-50 border-gray-200 rounded-lg shrink-0"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
            {errors.medical_certificate_expiry && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errors.medical_certificate_expiry.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* User Endorsements Section */}
      <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h4 className="flex items-center gap-2 text-base font-semibold text-gray-900 tracking-tight">
            <div className="p-1.5 bg-indigo-50 rounded-md">
              <Award className="w-4 h-4 text-indigo-500" />
            </div>
            Endorsements & Ratings
          </h4>
          {!showAddEndorsement && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddEndorsement(true)}
              className="h-9 px-4 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors rounded-lg font-medium"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add
            </Button>
          )}
        </div>

        <div className="p-5">
          {/* Add New Endorsement - Inline Form */}
          {showAddEndorsement && (
            <div className="mb-6 p-5 bg-indigo-50/30 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Add New Endorsement</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAddEndorsementForm}
                  className="h-8 w-8 p-0 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100/50 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                <div className="lg:col-span-4">
                  <label className="block text-xs font-bold text-indigo-700 mb-1.5 uppercase tracking-wide">
                    Endorsement Type
                  </label>
                  <Select value={selectedEndorsement} onValueChange={setSelectedEndorsement}>
                    <SelectTrigger className="h-10 bg-white border-indigo-100 focus:ring-indigo-500 rounded-lg shadow-sm">
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
                  <label className="block text-xs font-bold text-indigo-700 mb-1.5 uppercase tracking-wide">
                    Expiry Date (Optional)
                  </label>
                  <DatePicker
                    date={endorsementExpiryDate ? format(endorsementExpiryDate, 'yyyy-MM-dd') : null}
                    onChange={(date) => setEndorsementExpiryDate(date ? new Date(date) : undefined)}
                    placeholder="Select expiry date"
                    className="h-10 text-sm border-indigo-100 focus:ring-indigo-500 shadow-sm"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-xs font-bold text-indigo-700 mb-1.5 uppercase tracking-wide">
                    Notes (Optional)
                  </label>
                  <Input
                    value={endorsementNotes}
                    onChange={(e) => setEndorsementNotes(e.target.value)}
                    placeholder="Additional notes..."
                    className="h-10 text-sm bg-white border-indigo-100 focus:ring-indigo-500 rounded-lg shadow-sm"
                  />
                </div>

                <div className="lg:col-span-2 flex gap-2">
                  <Button
                    type="button"
                    onClick={addEndorsement}
                    disabled={!selectedEndorsement || endorsementsLoading}
                    size="sm"
                    className="h-10 flex-1 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 rounded-lg"
                  >
                    {endorsementsLoading ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Current Endorsements */}
          {userEndorsements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {userEndorsements
                .filter(ue => ue.endorsement) // Only show endorsements with valid endorsement data
                .map((userEndorsement) => {
                  const expiryStatus = getExpiryStatus(userEndorsement.expiry_date)
                  const Icon = expiryStatus.icon
                  const endorsementName = userEndorsement.endorsement?.name || "Unknown"

                  return (
                    <div 
                      key={userEndorsement.id} 
                      className="group flex items-start justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50/50 transition-all duration-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-semibold text-gray-900 text-sm leading-none">{endorsementName}</span>
                          <Badge className={`${expiryStatus.color} flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border-none shadow-none`}>
                            <Icon className="w-3 h-3" />
                            {expiryStatus.status === 'expired' ? 'Expired' :
                             expiryStatus.status === 'expiring' ? 'Soon' : 'Valid'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-gray-500 font-medium">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-gray-400" />
                            <span>Issued: {format(new Date(userEndorsement.issued_date), 'MMM dd, yyyy')}</span>
                          </div>
                          {userEndorsement.expiry_date && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <span className="text-gray-300">|</span>
                              <span>Expires: {format(new Date(userEndorsement.expiry_date), 'MMM dd, yyyy')}</span>
                            </div>
                          )}
                        </div>
                        
                        {userEndorsement.notes && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-[11px] text-gray-600 italic border-l-2 border-gray-200">
                            {userEndorsement.notes}
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => showDeleteConfirmationDialog(userEndorsement.id, endorsementName)}
                        className="h-8 w-8 p-0 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors shrink-0 ml-3"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })}
            </div>
          ) : !showAddEndorsement ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-sm border border-gray-100 mb-3 text-gray-300">
                <Award className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-gray-500">No endorsements or ratings found</p>
              <p className="text-xs text-gray-400 mt-1">Add them to track pilot qualifications</p>
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
