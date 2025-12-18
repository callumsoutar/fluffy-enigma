"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User as UserIcon, Building, Users } from "lucide-react"
import { IconRotateClockwise, IconDeviceFloppy } from "@tabler/icons-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { MemberWithRelations } from "@/lib/types/members"

const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(20).optional().nullable(),
  street_address: z.string().max(200).optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  next_of_kin_name: z.string().max(200).optional().nullable(),
  next_of_kin_phone: z.string().max(20).optional().nullable(),
  company_name: z.string().max(100).optional().nullable(),
  occupation: z.string().max(100).optional().nullable(),
  employer: z.string().max(100).optional().nullable(),
})

type ContactFormValues = z.infer<typeof contactSchema>

interface MemberContactDetailsProps {
  memberId: string
  member: MemberWithRelations | null
}

export function MemberContactDetails({ memberId, member }: MemberContactDetailsProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors },
    watch,
    setValue,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: null,
      street_address: null,
      gender: null,
      date_of_birth: null,
      notes: null,
      next_of_kin_name: null,
      next_of_kin_phone: null,
      company_name: null,
      occupation: null,
      employer: null,
    },
  })

  const genderValue = watch("gender")

  // Update form when member data loads
  useEffect(() => {
    if (member) {
      reset({
        first_name: member.first_name || "",
        last_name: member.last_name || "",
        email: member.email || "",
        phone: member.phone || null,
        street_address: member.street_address || null,
        gender: (member.gender === "male" || member.gender === "female") ? member.gender : null,
        date_of_birth: member.date_of_birth || null,
        notes: member.notes || null,
        next_of_kin_name: member.next_of_kin_name || null,
        next_of_kin_phone: member.next_of_kin_phone || null,
        company_name: member.company_name || null,
        occupation: member.occupation || null,
        employer: member.employer || null,
      })
    }
  }, [member, reset])

  const onSubmit = async (data: ContactFormValues) => {
    setIsSaving(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || `Failed to update member (${res.status})`)
        toast.error(err.error || "Failed to update member")
      } else {
        const result = await res.json()
        // Invalidate and refetch member data
        queryClient.setQueryData(["member", memberId], result.member)
        queryClient.invalidateQueries({ queryKey: ["member", memberId] })
        queryClient.invalidateQueries({ queryKey: ["members"] })
        reset(data) // reset dirty state
        toast.success("Contact information saved!")
      }
    } catch (err) {
      console.error('Network error:', err)
      setError("Failed to update member - network error")
      toast.error("Failed to update member - network error")
    } finally {
      setIsSaving(false)
    }
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading contact information...</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-row items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
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

      {/* Personal Details Section */}
      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
        <h4 className="flex items-center gap-2 text-base font-semibold mb-4 text-gray-900 tracking-tight">
          <UserIcon className="w-5 h-5 text-indigo-500" />
          Personal Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">First Name</label>
            <Input 
              {...register("first_name")}
              className="bg-white"
            />
            {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>}
          </div>
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Last Name</label>
            <Input 
              {...register("last_name")}
              className="bg-white"
            />
            {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name.message}</p>}
          </div>
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
            <Input 
              {...register("email")}
              type="email"
              className="bg-white"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Phone</label>
            <Input 
              {...register("phone")}
              type="tel"
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Street Address</label>
            <Input 
              {...register("street_address")}
              className="bg-white"
            />
          </div>
            <div className="max-w-md flex gap-4">
            <div className="w-1/2 min-w-0">
              <label className="block text-sm font-medium mb-1 text-gray-700">Gender</label>
              <Select
                key={`gender-select-${memberId}-${genderValue || "empty"}`}
                value={genderValue === "male" || genderValue === "female" ? genderValue : undefined}
                onValueChange={(val) => {
                  const value = val === "" ? null : (val as "male" | "female")
                  setValue("gender", value, { shouldDirty: true })
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender.message}</p>}
            </div>
            <div className="w-1/2 min-w-0">
              <label className="block text-sm font-medium mb-1 text-gray-700">Date of Birth</label>
              <Input
                type="date"
                className="w-full bg-white"
                {...register("date_of_birth")}
                value={watch("date_of_birth") || ""}
                onChange={(e) => setValue("date_of_birth", e.target.value || null, { shouldDirty: true })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Company Details Section */}
      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
        <h4 className="flex items-center gap-2 text-base font-semibold mb-4 text-gray-900 tracking-tight">
          <Building className="w-5 h-5 text-indigo-500" />
          Company Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Company</label>
            <Input 
              {...register("company_name")}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Occupation</label>
            <Input 
              {...register("occupation")}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Employer</label>
            <Input 
              {...register("employer")}
              className="bg-white"
            />
          </div>
        </div>
      </div>

      {/* Next of Kin Section */}
      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
        <h4 className="flex items-center gap-2 text-base font-semibold mb-4 text-gray-900 tracking-tight">
          <Users className="w-5 h-5 text-indigo-500" />
          Next of Kin
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Next of Kin Name</label>
            <Input 
              {...register("next_of_kin_name")}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="block text-sm font-medium mb-1 text-gray-700">Next of Kin Phone</label>
            <Input 
              {...register("next_of_kin_phone")}
              type="tel"
              className="bg-white"
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="mb-2 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
        <h4 className="text-base font-semibold mb-4 text-gray-900 tracking-tight">Notes</h4>
        <div className="max-w-md">
          <Input 
            {...register("notes")}
            className="bg-white"
            placeholder="Additional notes..."
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </form>
  )
}
