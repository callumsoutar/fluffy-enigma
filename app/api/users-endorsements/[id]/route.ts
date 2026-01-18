import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * DELETE /api/users-endorsements/[id]
 * 
 * Soft delete a user endorsement (set voided_at)
 * Requires authentication and instructor/admin/owner role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Check authorization - only instructors, admins, and owners can delete user endorsements
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  const { id } = await params

  // Validate ID format
  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { error: 'Invalid endorsement ID' },
      { status: 400 }
    )
  }

  // Check if user endorsement exists
  const { data: existing, error: fetchError } = await supabase
    .from('users_endorsements')
    .select('id, voided_at')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'User endorsement not found' },
      { status: 404 }
    )
  }

  // Check if already voided
  if (existing.voided_at) {
    return NextResponse.json(
      { error: 'User endorsement is already voided' },
      { status: 400 }
    )
  }

  // Soft delete by setting voided_at
  const { error } = await supabase
    .from('users_endorsements')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error voiding user endorsement:', error)
    return NextResponse.json(
      { error: 'Failed to remove endorsement' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
