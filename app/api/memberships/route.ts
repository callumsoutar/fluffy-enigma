import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { z } from 'zod'
import { calculateMembershipStatus } from '@/lib/utils/membership-utils'
import {
  calculateDefaultMembershipExpiry,
  calculateRenewalExpiry,
} from '@/lib/utils/membership-year-utils'
import { DEFAULT_MEMBERSHIP_YEAR_CONFIG } from '@/lib/utils/membership-defaults'
import type { MembershipWithRelations } from '@/lib/types/memberships'
import type { MembershipYearConfig } from '@/lib/types/settings'
import { getSchoolConfigServer } from '@/lib/utils/school-config'
import { getZonedYyyyMmDdAndHHmm } from '@/lib/utils/timezone'

const createMembershipSchema = z.object({
  action: z.literal("create"),
  user_id: z.string().uuid("Invalid user ID"),
  membership_type_id: z.string().uuid("Invalid membership type ID"),
  start_date: z.string().optional(),
  custom_expiry_date: z.string().optional(),
  auto_renew: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  create_invoice: z.boolean().default(false),
})

const renewMembershipSchema = z.object({
  action: z.literal("renew"),
  membership_id: z.string().uuid("Invalid membership ID"),
  membership_type_id: z.string().uuid().optional(),
  custom_expiry_date: z.string().optional(),
  auto_renew: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  create_invoice: z.boolean().default(false),
})

/**
 * GET /api/memberships
 * 
 * Fetch memberships for a user
 * Requires authentication and instructor/admin/owner role
 * 
 * Query parameters:
 * - user_id: string (required) - The user ID to fetch memberships for
 * - summary: boolean - if true, return summary format with current membership and status
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

  // Check authorization - only instructors, admins, and owners can view memberships
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('user_id')
  const summary = searchParams.get('summary') === 'true'

  if (!userId) {
    return NextResponse.json(
      { error: 'user_id query parameter is required' },
      { status: 400 }
    )
  }

  // Build query with joins
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select(`
      *,
      membership_types:membership_types (
        id,
        name,
        code,
        description,
        duration_months,
        benefits,
        chargeable_id,
        chargeables:chargeables (
          id,
          name,
          rate,
          is_taxable
        )
      ),
      invoices:invoices (
        id,
        status,
        invoice_number
      )
    `)
    .eq('user_id', userId)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error fetching memberships:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memberships' },
      { status: 500 }
    )
  }

  if (summary) {
    // Find current membership (active, grace, or unpaid)
    const currentMembership = (memberships || []).find((m) => {
      const status = calculateMembershipStatus(m as MembershipWithRelations)
      return status === "active" || status === "grace" || status === "unpaid"
    }) as MembershipWithRelations | undefined

    const status = currentMembership
      ? calculateMembershipStatus(currentMembership)
      : "none"

    let days_until_expiry = null
    let grace_period_remaining = null

    if (currentMembership) {
      const now = new Date()
      const expiryDate = new Date(currentMembership.expiry_date)
      const gracePeriodEnd = new Date(
        expiryDate.getTime() + currentMembership.grace_period_days * 24 * 60 * 60 * 1000
      )

      if (status === "active") {
        days_until_expiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      } else if (status === "grace") {
        grace_period_remaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      }
    }

    const can_renew = currentMembership && (status === "active" || status === "grace" || status === "unpaid")

    return NextResponse.json({
      summary: {
        current_membership: currentMembership || null,
        status,
        days_until_expiry,
        grace_period_remaining,
        can_renew: !!can_renew,
        membership_history: (memberships || []) as MembershipWithRelations[],
      },
    })
  }

  return NextResponse.json({
    memberships: memberships || [],
  })
}

/**
 * POST /api/memberships
 * 
 * Create or renew a membership
 * Requires authentication and instructor/admin/owner role
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Check authorization - only instructors, admins, and owners can create/renew memberships
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Parse and validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }

  const action = body.action
  // Canonical strategy: date-only fields must be computed in the *school timezone* (DST-safe).
  const { timeZone } = await getSchoolConfigServer()

  if (action === "renew") {
    const validationResult = renewMembershipSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { membership_id, membership_type_id, custom_expiry_date, auto_renew, notes } = validationResult.data

    // Get the current membership
    const { data: currentMembership, error: fetchError } = await supabase
      .from('memberships')
      .select('*, membership_types:membership_types(*)')
      .eq('id', membership_id)
      .single()

    if (fetchError || !currentMembership) {
      return NextResponse.json(
        { error: 'Membership not found' },
        { status: 404 }
      )
    }

    // Get the new membership type (or use current one)
    const membershipTypeId = membership_type_id || currentMembership.membership_type_id
    const { data: membershipType, error: typeError } = await supabase
      .from('membership_types')
      .select(`
        *,
        chargeables:chargeables (
          id,
          name,
          rate,
          is_taxable
        )
      `)
      .eq('id', membershipTypeId)
      .single()

    if (typeError || !membershipType) {
      return NextResponse.json(
        { error: 'Membership type not found' },
        { status: 404 }
      )
    }

    // Get membership year configuration from settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('category', 'memberships')
      .eq('setting_key', 'membership_year')
      .single()

    const membershipYearConfig: MembershipYearConfig = settingsData?.setting_value as MembershipYearConfig || DEFAULT_MEMBERSHIP_YEAR_CONFIG

    // Calculate new dates using membership year configuration or custom override
    // For renewals, calculate expiry based on the current membership's expiry date
    // to ensure we get the NEXT membership year, not the current one
    const startDate = new Date()
    const expiryDate = custom_expiry_date
      ? new Date(custom_expiry_date)
      : calculateRenewalExpiry(
          membershipYearConfig,
          new Date(currentMembership.expiry_date)
        )

    // Create new membership record
    const newMembershipData = {
      user_id: currentMembership.user_id,
      membership_type_id: membershipTypeId,
      start_date: startDate.toISOString(),
      expiry_date: getZonedYyyyMmDdAndHHmm(expiryDate, timeZone).yyyyMmDd, // Date only (school-local)
      purchased_date: startDate.toISOString(),
      auto_renew: auto_renew ?? currentMembership.auto_renew,
      grace_period_days: currentMembership.grace_period_days || 30,
      notes: notes || null,
      updated_by: user.id,
    }

    const { data: newMembership, error: createError } = await supabase
      .from('memberships')
      .insert([newMembershipData])
      .select()
      .single()

    if (createError) {
      console.error('Error creating membership:', createError)
      return NextResponse.json(
        { error: 'Failed to create membership' },
        { status: 500 }
      )
    }

    // Deactivate old membership
    await supabase
      .from('memberships')
      .update({ is_active: false })
      .eq('id', currentMembership.id)

    // TODO: Create invoice if requested (invoice creation logic can be added later)

    return NextResponse.json({ membership: newMembership }, { status: 201 })

  } else if (action === "create") {
    const validationResult = createMembershipSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { user_id, membership_type_id, start_date, custom_expiry_date, auto_renew, notes } = validationResult.data

    // Get membership type
    const { data: membershipType, error: typeError } = await supabase
      .from('membership_types')
      .select(`
        *,
        chargeables:chargeables (
          id,
          name,
          rate,
          is_taxable
        )
      `)
      .eq('id', membership_type_id)
      .single()

    if (typeError || !membershipType) {
      return NextResponse.json(
        { error: 'Membership type not found' },
        { status: 404 }
      )
    }

    // Get membership year configuration from settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('category', 'memberships')
      .eq('setting_key', 'membership_year')
      .single()

    const membershipYearConfig: MembershipYearConfig = settingsData?.setting_value as MembershipYearConfig || DEFAULT_MEMBERSHIP_YEAR_CONFIG

    // Calculate dates using membership year configuration or custom override
    const startDate = start_date ? new Date(start_date) : new Date()
    const expiryDate = custom_expiry_date
      ? new Date(custom_expiry_date)
      : calculateDefaultMembershipExpiry(membershipYearConfig, startDate)

    const membershipData = {
      user_id,
      membership_type_id,
      start_date: startDate.toISOString(),
      expiry_date: getZonedYyyyMmDdAndHHmm(expiryDate, timeZone).yyyyMmDd, // Date only (school-local)
      purchased_date: new Date().toISOString(),
      auto_renew: auto_renew || false,
      grace_period_days: 30, // Default grace period
      notes: notes || null,
      updated_by: user.id,
    }

    const { data: newMembership, error: createError } = await supabase
      .from('memberships')
      .insert([membershipData])
      .select()
      .single()

    if (createError) {
      console.error('Error creating membership:', createError)
      return NextResponse.json(
        { error: 'Failed to create membership' },
        { status: 500 }
      )
    }

    // TODO: Create invoice if requested (invoice creation logic can be added later)

    return NextResponse.json({ membership: newMembership }, { status: 201 })
  } else {
    return NextResponse.json(
      { error: 'Invalid action. Must be "create" or "renew"' },
      { status: 400 }
    )
  }
}
