import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { userHasAnyRole } from '@/lib/auth/roles'
import { memberCreateSchema, membersQuerySchema } from '@/lib/validation/members'
import type { PersonType, MembershipStatus, MembersFilter, MemberWithRelations } from '@/lib/types/members'

/**
 * GET /api/members
 * 
 * Fetch members/people with optional filters
 * Requires authentication and instructor/admin/owner role
 * 
 * Security:
 * - Only instructors, admins, and owners can access
 * - RLS policies enforce final data access
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Check authorization
  // - Staff (owner, admin, instructor) can view all members
  // - Members can only view instructors (needed for booking)
  const isStaff = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  
  // Get query params early to check if this is an instructor-only request
  const searchParams = request.nextUrl.searchParams
  const personType = searchParams.get('person_type')
  const isInstructorOnlyRequest = personType === 'instructor'
  
  // If not staff and not requesting instructors only, deny access
  if (!isStaff && !isInstructorOnlyRequest) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Validate query parameters (searchParams already retrieved above)
  
  // Build query object from URL params
  const queryParams: Record<string, string | undefined> = {}
  for (const [key, value] of searchParams.entries()) {
    queryParams[key] = value
  }

  // Validate query parameters
  const validationResult = membersQuerySchema.safeParse(queryParams)
  
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validationResult.error.issues },
      { status: 400 }
    )
  }

  const filters: MembersFilter = {
    person_type: validationResult.data.person_type as PersonType | undefined,
    membership_status: validationResult.data.membership_status as MembershipStatus | undefined,
    search: validationResult.data.search,
    is_active: validationResult.data.is_active,
    membership_type_id: validationResult.data.membership_type_id,
  }

  // Additional security check: members can only request instructors
  if (!isStaff && filters.person_type !== 'instructor') {
    return NextResponse.json(
      { error: 'Forbidden: Members can only view instructors' },
      { status: 403 }
    )
  }

  // Build base query - select users with related data
  // Note: We'll fetch related data separately to avoid complex joins
  let query = supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  // Apply filters
  
  // Filter by is_active
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  // Execute query (RLS will filter based on user permissions)
  const { data: users, error } = await query

  if (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }

  if (!users || users.length === 0) {
    return NextResponse.json({
      members: [],
      total: 0,
    })
  }

  // Fetch related data for all users
  const userIds = users.map(u => u.id)
  
  // Fetch memberships
  let membershipsQuery = supabase
    .from('memberships')
    .select(`
      *,
      membership_type:membership_types (
        id,
        name,
        code
      )
    `)
    .in('user_id', userIds)
  
  // Filter by membership type if specified
  if (filters.membership_type_id) {
    membershipsQuery = membershipsQuery.eq('membership_type_id', filters.membership_type_id)
  }
  
  const { data: memberships } = await membershipsQuery

  // Fetch instructors
  const { data: instructors } = await supabase
    .from('instructors')
    .select('*')
    .in('user_id', userIds)

  // Fetch user roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      role_id,
      roles!inner (
        name
      )
    `)
    .in('user_id', userIds)
    .eq('is_active', true)

  // Create lookup maps
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
    } | null
  }
  
  const membershipsByUserId = new Map<string, MembershipWithType[]>()
  memberships?.forEach((m) => {
    if (!membershipsByUserId.has(m.user_id)) {
      membershipsByUserId.set(m.user_id, [])
    }
    membershipsByUserId.get(m.user_id)!.push(m as MembershipWithType)
  })

  interface InstructorData {
    id: string
    user_id: string
    status: string
    is_actively_instructing: boolean
    employment_type: string | null
  }
  
  const instructorsByUserId = new Map<string, InstructorData>()
  instructors?.forEach((i) => {
    instructorsByUserId.set(i.user_id, i as InstructorData)
  })

  interface UserRoleWithRole {
    user_id: string
    role_id: string
    roles: { name: string } | { name: string }[]
  }

  const rolesByUserId = new Map<string, string>()
  userRoles?.forEach((ur) => {
    const typedUr = ur as UserRoleWithRole
    let roleName: string | null = null
    if (Array.isArray(typedUr.roles)) {
      roleName = typedUr.roles[0]?.name || null
    } else if (typedUr.roles && typeof typedUr.roles === 'object' && 'name' in typedUr.roles) {
      roleName = typedUr.roles.name
    }
    if (roleName) {
      rolesByUserId.set(typedUr.user_id, roleName)
    }
  })

  // Transform and filter results
  let filteredMembers = users.map((user): MemberWithRelations => {
    const userMemberships = membershipsByUserId.get(user.id) || []
    const activeMembership = userMemberships.find((m) => m.is_active) || userMemberships[0] || null
    const instructor = instructorsByUserId.get(user.id) || null
    const roleName = rolesByUserId.get(user.id) || null

    return {
      ...user,
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
  })

  // Filter by person_type
  if (filters.person_type && filters.person_type !== 'all') {
    filteredMembers = filteredMembers.filter((user) => {
      // Check for valid membership: has membership record with non-expired expiry_date
      const hasValidMembership = user.membership && 
        new Date(user.membership.expiry_date) >= new Date()
      const hasInstructorRecord = !!user.instructor
      const roleName = user.role?.role
      const isStaff = roleName === 'owner' || roleName === 'admin'

      switch (filters.person_type) {
        case 'member':
          return hasValidMembership
        case 'instructor':
          return hasInstructorRecord
        case 'staff':
          return isStaff
        case 'contact':
          return !hasValidMembership && !hasInstructorRecord && !isStaff
        default:
          return true
      }
    })
  }

  // Filter by membership_status
  if (filters.membership_status && filters.membership_status !== 'all') {
    filteredMembers = filteredMembers.filter((user) => {
      const membership = user.membership
      if (!membership) return false

      switch (filters.membership_status) {
        case 'active':
          return membership.is_active && new Date(membership.expiry_date) >= new Date()
        case 'expired':
          return new Date(membership.expiry_date) < new Date()
        case 'inactive':
          return !membership.is_active
        default:
          return true
      }
    })
  }

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredMembers = filteredMembers.filter((user) => {
      const nameMatch = 
        user.first_name?.toLowerCase().includes(searchLower) ||
        user.last_name?.toLowerCase().includes(searchLower) ||
        `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(searchLower)
      
      const emailMatch = user.email?.toLowerCase().includes(searchLower)
      const phoneMatch = user.phone?.toLowerCase().includes(searchLower)

      return nameMatch || emailMatch || phoneMatch
    })
  }

  const normalizedMembers = filteredMembers

  return NextResponse.json({
    members: normalizedMembers,
    total: normalizedMembers.length,
  })
}

/**
 * POST /api/members
 *
 * Create a basic member/contact record (users table).
 * Requires authentication and instructor/admin/owner role.
 *
 * Notes:
 * - This creates a row in public.users only. Memberships and instructor profiles are created separately.
 * - Auth user creation/invites are not handled here (no service-role in this app layer).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const parsed = memberCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { email, first_name, last_name, phone, street_address, send_invitation } = parsed.data

  let authUserId: string | null = null

  // Handle invitation if requested
  if (send_invitation) {
    let adminSupabase
    try {
      adminSupabase = createAdminClient()
    } catch (e) {
      console.error('Admin client creation failed:', e)
      return NextResponse.json(
        { error: 'Server configuration error: Missing admin privileges for invitations.' },
        { status: 500 }
      )
    }
    
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: first_name ?? '',
        last_name: last_name ?? '',
      }
    })

    if (inviteError) {
      // If user already exists, we might get an error or the user.
      // Supabase's inviteUserByEmail behavior can vary by configuration.
      // Let's explicitly check for "user already exists" if needed, 
      // but usually it just returns the user or a specific error code.
      console.error('Error inviting user:', inviteError)
      return NextResponse.json({ error: inviteError.message || 'Failed to send invitation' }, { status: 500 })
    }
    
    authUserId = inviteData.user.id
  }

  const insertPayload: Record<string, string | boolean | null> = {
    email,
    first_name: first_name ?? null,
    last_name: last_name ?? null,
    phone: phone ?? null,
    street_address: street_address ?? null,
    is_active: true,
  }

  // If we have an auth user ID (either from a new invite or existing auth user),
  // use it as the primary key for the public.users record to maintain 1:1 relationship.
  if (authUserId) {
    insertPayload.id = authUserId
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error) {
    // Unique violation, commonly on email or id
    if ((error as { code?: string })?.code === '23505') {
      const isIdConflict = error.message?.includes('id')
      return NextResponse.json(
        { error: isIdConflict ? 'A member with this account already exists.' : 'A member with that email already exists.' },
        { status: 409 }
      )
    }

    console.error('Error creating member:', error)
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }

  // If we invited them, also create their initial role
  if (send_invitation && authUserId) {
    await supabase
      .from('user_roles')
      .insert({
        user_id: authUserId,
        role: 'member'
      })
  }

  return NextResponse.json({ member: created }, { status: 201 })
}
