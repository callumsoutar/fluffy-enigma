import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantContext } from '@/lib/auth/tenant'
import { memberIdSchema } from '@/lib/validation/members'

/**
 * POST /api/members/[id]/confirm
 * 
 * Manually confirms a user's email using the Supabase Auth Admin API.
 * This bypasses the need for the user to click a confirmation link.
 */
export async function POST(
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
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: memberId } = await params
  const idValidation = memberIdSchema.safeParse(memberId)
  if (!idValidation.success) {
    return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 })
  }

  // Fetch the member to get their auth user ID (which is the memberId if they are an auth user)
  const { data: member, error: memberError } = await supabase
    .from('users')
    .select('id, is_auth_user')
    .eq('id', memberId)
    .single()

  if (memberError || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  if (!member.is_auth_user) {
    return NextResponse.json({ error: 'Member does not have an auth account yet. Invite them first.' }, { status: 400 })
  }

  let adminSupabase
  try {
    adminSupabase = createAdminClient()
  } catch (e) {
    console.error('Admin client creation failed:', e)
    return NextResponse.json(
      { error: 'Server configuration error: Missing admin privileges.' },
      { status: 500 }
    )
  }

  // Confirm the user
  const { error: confirmError } = await adminSupabase.auth.admin.updateUserById(memberId, {
    email_confirm: true
  })

  if (confirmError) {
    console.error('Error confirming user:', confirmError)
    return NextResponse.json({ error: confirmError.message || 'Failed to confirm user' }, { status: 500 })
  }

  return NextResponse.json({ 
    message: 'User confirmed successfully'
  })
}
