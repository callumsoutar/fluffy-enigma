import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * GET /api/members/[id]/audit
 * 
 * Fetch audit logs for a specific member
 * Requires authentication
 */
export async function GET(
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

  const { userId: currentUserId, userRole } = tenantContext
  const { id: memberId } = await params

  // First, verify user has access to this member's audit log
  // Admins, owners, and instructors can view member history
  // Members can view their own history
  const isAdminOrInstructor = ['owner', 'admin', 'instructor'].includes(userRole)
  const isOwnProfile = currentUserId === memberId
  
  if (!isAdminOrInstructor && !isOwnProfile) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  // Fetch audit logs for this member
  // In our system, members are stored in the 'users' table
  const { data: auditLogs, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      action,
      old_data,
      new_data,
      column_changes,
      user_id,
      created_at
    `)
    .eq('table_name', 'users')
    .eq('record_id', memberId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }

  // Fetch user details for the 'changed by' column
  const userIds = [...new Set((auditLogs || [])
    .map(log => log.user_id)
    .filter((id): id is string => id !== null))]
  
  let usersMap: Record<string, { id: string; first_name: string | null; last_name: string | null; email: string }> = {}
  
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', userIds)
    
    if (users) {
      usersMap = users.reduce((acc, user) => {
        acc[user.id] = user
        return acc
      }, {} as typeof usersMap)
    }
  }

  // Combine audit logs with user data
  const auditLogsWithUsers = (auditLogs || []).map(log => ({
    ...log,
    user: log.user_id ? usersMap[log.user_id] || null : null,
  }))

  return NextResponse.json({ auditLogs: auditLogsWithUsers })
}

