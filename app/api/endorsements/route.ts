import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { z } from 'zod'

const endorsementSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
})

/**
 * GET /api/endorsements
 * 
 * Fetch endorsements from the endorsements table
 * Requires authentication and instructor/admin/owner role
 * 
 * Query parameters:
 * - active_only: boolean - if true, only return active endorsements
 * - exclude_voided: boolean - if true, exclude voided endorsements (default: true)
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

  // Check authorization - only instructors, admins, and owners can view endorsements
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams
  const activeOnly = searchParams.get('active_only') === 'true'
  const excludeVoided = searchParams.get('exclude_voided') !== 'false' // default to true

  // Build query
  let query = supabase
    .from('endorsements')
    .select('*')
    .order('name', { ascending: true })

  // Filter by active status if requested
  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  // Exclude voided endorsements by default
  if (excludeVoided) {
    query = query.is('voided_at', null)
  }

  // Execute query
  const { data: endorsements, error } = await query

  if (error) {
    console.error('Error fetching endorsements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch endorsements' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    endorsements: endorsements || [],
  })
}

/**
 * POST /api/endorsements
 * 
 * Create a new endorsement
 * Requires authentication and admin/owner role
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

  // Check authorization - only admins and owners can create endorsements
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
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

  const validationResult = endorsementSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: validationResult.error.issues },
      { status: 400 }
    )
  }

  // Insert endorsement
  const { data: endorsement, error } = await supabase
    .from('endorsements')
    .insert([validationResult.data])
    .select()
    .single()

  if (error) {
    console.error('Error creating endorsement:', error)
    return NextResponse.json(
      { error: 'Failed to create endorsement' },
      { status: 500 }
    )
  }

  return NextResponse.json({ endorsement })
}
