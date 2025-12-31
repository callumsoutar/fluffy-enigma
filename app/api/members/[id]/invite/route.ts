import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { userHasAnyRole } from '@/lib/auth/roles'
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
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
  // we update it. Thanks to ON UPDATE CASCADE, this will propagate to all other tables.
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
      // In this case, we might want to merge or just error.
      // For now, let's just use the existing one or tell the admin.
      return NextResponse.json({ 
        error: 'A member record already exists for this authenticated user. Manual merge required.',
        auth_user_id: authUserId 
      }, { status: 409 })
    }

    const { error: updateError } = await adminSupabase
      .from('users')
      .update({ id: authUserId })
      .eq('id', memberId)

    if (updateError) {
      console.error('Error syncing user ID:', updateError)
      return NextResponse.json({ error: 'Failed to sync member account: ' + updateError.message }, { status: 500 })
    }
  }

  // 4. Ensure they have a role
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', authUserId)
    .single()

  if (!existingRole) {
    await supabase.from('user_roles').insert({
      user_id: authUserId,
      role: 'member'
    })
  }

  return NextResponse.json({ 
    message: 'Invitation sent successfully',
    auth_user_id: authUserId 
  })
}

