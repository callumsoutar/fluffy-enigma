import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { memberIdSchema } from '@/lib/validation/members'
import type { MemberWithRelations } from '@/lib/types/members'
import { z } from 'zod'

interface MembershipWithType {
  id: string
  user_id: string
  membership_type_id: string
  start_date: string
  end_date: string | null
  expiry_date: string
  is_active: boolean
  auto_renew: boolean
  membership_type?: {
    id: string
    name: string
    code: string
    description: string | null
    duration_months: number
  } | null
}

/**
 * GET /api/members/[id]
 * 
 * Fetch a single member by ID
 * Requires authentication and instructor/admin/owner role
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Check authorization - only instructors, admins, and owners can view members
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const { id: memberId } = await params

  // Validate member ID format
  const idValidation = memberIdSchema.safeParse(memberId)
  if (!idValidation.success) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    )
  }

  // Fetch user with related data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', memberId)
    .single()

  if (userError || !userData) {
    return NextResponse.json(
      { error: 'Member not found' },
      { status: 404 }
    )
  }

  // Fetch related data
  const userId = userData.id

  // Fetch memberships
  const { data: memberships } = await supabase
    .from('memberships')
    .select(`
      *,
      membership_type:membership_types (
        id,
        name,
        code,
        description,
        duration_months
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  // Fetch instructor record
  const { data: instructor } = await supabase
    .from('instructors')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Fetch user role (authoritative, tolerant of legacy multiple-active roles)
  const { data: roleNameFromRpc } = await supabase.rpc('get_user_role', {
    user_id: userId,
  })

  // Normalize the response
  const activeMembership = memberships?.find((m) => (m as MembershipWithType).is_active) || memberships?.[0] || null
  
  const roleName = typeof roleNameFromRpc === 'string' ? roleNameFromRpc : null

  // Check if they are an auth user via RPC (avoids needing Service Role key for every GET)
  const { data: isAuthUser } = await supabase.rpc('is_auth_user', { user_uuid: userId })
  const { data: authDetails } = await supabase.rpc('get_auth_user_details', { user_uuid: userId })
  const confirmedAt = authDetails && authDetails.length > 0 ? authDetails[0].confirmed_at : null

  const member: MemberWithRelations = {
    ...userData,
    is_auth_user: !!isAuthUser,
    auth_user_confirmed_at: confirmedAt,
    membership: activeMembership ? {
      id: activeMembership.id,
      membership_type: activeMembership.membership_type ? {
        id: activeMembership.membership_type.id,
        name: activeMembership.membership_type.name,
        code: activeMembership.membership_type.code,
      } : null,
      start_date: activeMembership.start_date,
      end_date: activeMembership.end_date,
      expiry_date: activeMembership.expiry_date,
      is_active: activeMembership.is_active,
      auto_renew: activeMembership.auto_renew,
    } : null,
    instructor: instructor ? {
      id: instructor.id,
      status: instructor.status,
      is_actively_instructing: instructor.is_actively_instructing,
      employment_type: instructor.employment_type,
    } : null,
    role: roleName ? { role: roleName } : null,
  }

  return NextResponse.json({ member })
}

/**
 * PATCH /api/members/[id]
 * 
 * Update a member
 * Requires authentication and instructor/admin/owner role
 */
const memberUpdateSchema = z.object({
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  street_address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  next_of_kin_name: z.string().max(200).optional().nullable(),
  next_of_kin_phone: z.string().max(20).optional().nullable(),
  company_name: z.string().max(100).optional().nullable(),
  occupation: z.string().max(100).optional().nullable(),
  employer: z.string().max(100).optional().nullable(),
  emergency_contact_relationship: z.string().max(100).optional().nullable(),
  medical_certificate_expiry: z.string().optional().nullable(),
  pilot_license_number: z.string().max(50).optional().nullable(),
  pilot_license_type: z.string().max(50).optional().nullable(),
  pilot_license_id: z.string().uuid().optional().nullable(),
  pilot_license_expiry: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  public_directory_opt_in: z.boolean().optional(),
  class_1_medical_due: z.string().optional().nullable(),
  class_2_medical_due: z.string().optional().nullable(),
  DL9_due: z.string().optional().nullable(),
  BFR_due: z.string().optional().nullable(),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Check authorization - only instructors, admins, and owners can update members
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const { id: memberId } = await params

  // Validate member ID format
  const idValidation = memberIdSchema.safeParse(memberId)
  if (!idValidation.success) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    )
  }

  // Validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }

  const bodyValidation = memberUpdateSchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  // Check if member exists
  const { data: existingMember, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('id', memberId)
    .single()

  if (fetchError || !existingMember) {
    return NextResponse.json(
      { error: 'Member not found' },
      { status: 404 }
    )
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {}
  const validatedData = bodyValidation.data

  Object.keys(validatedData).forEach((key) => {
    if (validatedData[key as keyof typeof validatedData] !== undefined) {
      updateData[key] = validatedData[key as keyof typeof validatedData]
    }
  })

  // Update member
  const { data: updatedMember, error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', memberId)
    .select('*')
    .single()

  if (updateError) {
    console.error('Error updating member:', updateError)
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    )
  }

  // Fetch updated member with relations (same as GET)
  const { data: memberships } = await supabase
    .from('memberships')
    .select(`
      *,
      membership_type:membership_types (
        id,
        name,
        code
      )
    `)
    .eq('user_id', memberId)
    .order('created_at', { ascending: false })

  const { data: instructor } = await supabase
    .from('instructors')
    .select('*')
    .eq('user_id', memberId)
    .single()

  const activeMembership = memberships?.find((m) => (m as MembershipWithType).is_active) || memberships?.[0] || null
  
  const { data: roleNameFromRpc } = await supabase.rpc('get_user_role', {
    user_id: memberId,
  })

  const roleName = typeof roleNameFromRpc === 'string' ? roleNameFromRpc : null

  const member: MemberWithRelations = {
    ...updatedMember,
    membership: activeMembership ? {
      id: activeMembership.id,
      membership_type: activeMembership.membership_type ? {
        id: activeMembership.membership_type.id,
        name: activeMembership.membership_type.name,
        code: activeMembership.membership_type.code,
      } : null,
      start_date: activeMembership.start_date,
      end_date: activeMembership.end_date,
      expiry_date: activeMembership.expiry_date,
      is_active: activeMembership.is_active,
      auto_renew: activeMembership.auto_renew,
    } : null,
    instructor: instructor ? {
      id: instructor.id,
      status: instructor.status,
      is_actively_instructing: instructor.is_actively_instructing,
      employment_type: instructor.employment_type,
    } : null,
    role: roleName ? { role: roleName } : null,
  }

  return NextResponse.json({ member })
}
