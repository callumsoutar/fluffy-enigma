import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantContext } from '@/lib/auth/tenant'
import { memberIdSchema } from '@/lib/validation/members'

/**
 * POST /api/members/[id]/invite
 * 
 * Invite an existing member to become an auth user.
 * 1. Checks if member exists.
 * 2. Checks if they already have an auth account.
 * 3. Sends invitation.
 * 4. Syncs the public.users.id with the new auth.users.id if they differ.
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

  // Fetch the member
  const { data: member, error: memberError } = await supabase
    .from('users')
    .select('*')
    .eq('id', memberId)
    .single()

  if (memberError || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

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

  // 1. Invite the user. Supabase handles existing users by resending the invite 
  // or just returning the user depending on the situation.
  const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(member.email, {
    data: {
      first_name: member.first_name || '',
      last_name: member.last_name || '',
    }
  })

  if (inviteError) {
    console.error('Error inviting user:', inviteError)
    return NextResponse.json({ error: inviteError.message || 'Failed to send invitation' }, { status: 500 })
  }

  const authUserId = inviteData.user.id

  // 2. Sync IDs if necessary
  // If the member's current ID in public.users doesn't match the auth ID,
  // we need to update it along with the tenant_users record.
  // Note: We can't rely on CASCADE as the FK doesn't have ON UPDATE CASCADE
  if (memberId !== authUserId) {
    // Check if the authUserId already exists in public.users to avoid conflict
    const { data: conflictUser } = await adminSupabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle()

    if (conflictUser) {
      // If a user with that ID already exists in public.users, we can't just update.
      // This might happen if they signed up themselves but weren't linked.
      return NextResponse.json({ 
        error: 'A member record already exists for this authenticated user. Manual merge required.',
        auth_user_id: authUserId 
      }, { status: 409 })
    }

    // Update tenant_users.user_id FIRST (before changing users.id)
    const { error: tenantUserUpdateError } = await adminSupabase
      .from('tenant_users')
      .update({ user_id: authUserId })
      .eq('user_id', memberId)
      .eq('tenant_id', tenantContext.tenantId)

    if (tenantUserUpdateError) {
      console.error('Error syncing tenant_users ID:', tenantUserUpdateError)
      return NextResponse.json({ error: 'Failed to sync member tenant association: ' + tenantUserUpdateError.message }, { status: 500 })
    }

    // Now update users.id
    const { error: updateError } = await adminSupabase
      .from('users')
      .update({ id: authUserId })
      .eq('id', memberId)

    if (updateError) {
      // Rollback tenant_users change
      await adminSupabase
        .from('tenant_users')
        .update({ user_id: memberId })
        .eq('user_id', authUserId)
        .eq('tenant_id', tenantContext.tenantId)
      
      console.error('Error syncing user ID:', updateError)
      return NextResponse.json({ error: 'Failed to sync member account: ' + updateError.message }, { status: 500 })
    }
  }

  // 3. Ensure they have a tenant_users role (may already exist from when they were added as contact)
  const { data: existingTenantRole } = await supabase
    .from('tenant_users')
    .select('id, role_id')
    .eq('user_id', authUserId)
    .eq('tenant_id', tenantContext.tenantId)
    .maybeSingle()

  if (!existingTenantRole) {
    // Create new tenant_users record with member role
    const { data: memberRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'member')
      .single()
    
    if (memberRole) {
      await supabase.from('tenant_users').insert({
        tenant_id: tenantContext.tenantId,
        user_id: authUserId,
        role_id: memberRole.id,
        granted_by: tenantContext.userId,
        is_active: true,
      })
    }
  } else {
    // User already has a tenant_users record (created when added as contact)
    // Optionally upgrade their role from 'student' to 'member' if they're being invited
    const { data: studentRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'student')
      .single()
    
    const { data: memberRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'member')
      .single()
    
    // If they're currently a student, upgrade to member
    if (studentRole && memberRole && existingTenantRole.role_id === studentRole.id) {
      await supabase
        .from('tenant_users')
        .update({ role_id: memberRole.id, granted_by: tenantContext.userId })
        .eq('id', existingTenantRole.id)
    }
  }

  return NextResponse.json({ 
    message: 'Invitation sent successfully',
    auth_user_id: authUserId 
  })
}

