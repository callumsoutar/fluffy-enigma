import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { z } from 'zod'

const userEndorsementSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  endorsement_id: z.string().uuid("Invalid endorsement ID"),
  issued_date: z.string().optional(),
  expiry_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

/**
 * GET /api/users-endorsements
 * 
 * Fetch user endorsements
 * Requires authentication and instructor/admin/owner role
 * 
 * Query parameters:
 * - user_id: string (required) - The user ID to fetch endorsements for
 * - exclude_voided: boolean - if true, exclude voided endorsements (default: true)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: 'Forbidden: No tenant membership' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 })
  }

  const { userRole } = tenantContext

  // Check authorization - only instructors, admins, and owners can view user endorsements
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('user_id')
  const excludeVoided = searchParams.get('exclude_voided') !== 'false' // default to true

  if (!userId) {
    return NextResponse.json(
      { error: 'user_id query parameter is required' },
      { status: 400 }
    )
  }

  // Build query with join to get endorsement details
  let query = supabase
    .from('users_endorsements')
    .select(`
      *,
      endorsement:endorsements (
        id,
        name,
        description,
        is_active
      )
    `)
    .eq('user_id', userId)
    .order('issued_date', { ascending: false })

  // Exclude voided endorsements by default
  if (excludeVoided) {
    query = query.is('voided_at', null)
  }

  // Execute query
  const { data: userEndorsements, error } = await query

  if (error) {
    console.error('Error fetching user endorsements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user endorsements' },
      { status: 500 }
    )
  }

  interface UserEndorsementWithType {
    id: string
    user_id: string
    endorsement_id: string
    issued_date: string
    expiry_date: string | null
    notes: string | null
    voided_at: string | null
    endorsement?: {
      id: string
      name: string
      description: string | null
      is_active: boolean
    } | null
  }
  
  // Transform the data to match the expected format
  const transformedEndorsements = (userEndorsements || []).map((ue) => {
    const endorsement = ue as UserEndorsementWithType
    return {
    id: ue.id,
    user_id: ue.user_id,
    endorsement_id: ue.endorsement_id,
    issued_date: ue.issued_date,
    expiry_date: ue.expiry_date,
    notes: ue.notes,
    voided_at: ue.voided_at,
      endorsement: endorsement.endorsement ? {
        id: endorsement.endorsement.id,
        name: endorsement.endorsement.name,
        description: endorsement.endorsement.description,
        is_active: endorsement.endorsement.is_active,
      } : null,
    }
  })

  return NextResponse.json({
    user_endorsements: transformedEndorsements,
  })
}

/**
 * POST /api/users-endorsements
 * 
 * Create a new user endorsement
 * Requires authentication and instructor/admin/owner role
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: 'Forbidden: No tenant membership' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 })
  }

  const { userRole } = tenantContext

  // Check authorization - only instructors, admins, and owners can create user endorsements
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
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

  const validationResult = userEndorsementSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: validationResult.error.issues },
      { status: 400 }
    )
  }

  // Check if user endorsement already exists (not voided)
  const { data: existing } = await supabase
    .from('users_endorsements')
    .select('id')
    .eq('user_id', validationResult.data.user_id)
    .eq('endorsement_id', validationResult.data.endorsement_id)
    .is('voided_at', null)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'User already has this endorsement' },
      { status: 409 }
    )
  }

  // Prepare insert data
  const insertData = {
    user_id: validationResult.data.user_id,
    endorsement_id: validationResult.data.endorsement_id,
    issued_date: validationResult.data.issued_date || new Date().toISOString(),
    expiry_date: validationResult.data.expiry_date || null,
    notes: validationResult.data.notes || null,
  }

  // Insert user endorsement
  const { data: userEndorsement, error } = await supabase
    .from('users_endorsements')
    .insert([insertData])
    .select(`
      *,
      endorsement:endorsements (
        id,
        name,
        description,
        is_active
      )
    `)
    .single()

  if (error) {
    console.error('Error creating user endorsement:', error)
    return NextResponse.json(
      { error: 'Failed to create user endorsement' },
      { status: 500 }
    )
  }

  // Transform the response
  const transformed = {
    id: userEndorsement.id,
    user_id: userEndorsement.user_id,
    endorsement_id: userEndorsement.endorsement_id,
    issued_date: userEndorsement.issued_date,
    expiry_date: userEndorsement.expiry_date,
    notes: userEndorsement.notes,
    voided_at: userEndorsement.voided_at,
    endorsement: userEndorsement.endorsement ? {
      id: userEndorsement.endorsement.id,
      name: userEndorsement.endorsement.name,
      description: userEndorsement.endorsement.description,
      is_active: userEndorsement.endorsement.is_active,
    } : null,
  }

  return NextResponse.json({ user_endorsement: transformed })
}
