import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { memberIdSchema } from '@/lib/validation/members'

/**
 * POST /api/members/[id]/reset-password
 * 
 * Sends a password reset email to the member.
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

  // Fetch the member to get their email
  const { data: member, error: memberError } = await supabase
    .from('users')
    .select('email, is_auth_user')
    .eq('id', memberId)
    .single()

  if (memberError || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  if (!member.is_auth_user) {
    return NextResponse.json({ error: 'Member does not have an auth account yet. Invite them first.' }, { status: 400 })
  }

  // Send password reset email
  // We use the regular supabase client for this as it's a standard auth operation
  // but we could also use admin client if we wanted more control.
  // Using admin.generateLink or admin.updateUserById might be better if we want to bypass things,
  // but usually a recovery email is preferred for security.
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(member.email, {
    redirectTo: `${new URL(request.url).origin}/auth/callback?next=/settings/password`
  })

  if (resetError) {
    console.error('Error sending reset email:', resetError)
    return NextResponse.json({ error: resetError.message || 'Failed to send reset email' }, { status: 500 })
  }

  return NextResponse.json({ 
    message: 'Password reset email sent successfully'
  })
}
