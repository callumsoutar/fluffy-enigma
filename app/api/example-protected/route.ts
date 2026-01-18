/**
 * Example Protected API Route
 * 
 * This demonstrates how to protect API routes using tenant-aware role-based authorization.
 * Copy this pattern for all your protected API endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/auth/tenant';

/**
 * GET /api/example-protected
 * 
 * Example endpoint that requires owner, admin, or instructor role
 */
export async function GET() {
  const supabase = await createClient();
  
  // Get tenant context (includes auth check)
  let tenantContext;
  try {
    tenantContext = await getTenantContext(supabase);
  } catch (err) {
    const error = err as { code?: string };
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: 'Forbidden: No tenant membership' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 });
  }

  const { userId, userRole } = tenantContext;

  // Check role authorization
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole);

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  // Proceed with authorized request
  // Your business logic here
  return NextResponse.json({
    message: 'Success! You have access to this endpoint.',
    user: {
      id: userId,
      role: userRole,
    },
  });
}

/**
 * POST /api/example-protected
 * 
 * Example endpoint that requires owner or admin role
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  // Get tenant context (includes auth check)
  let tenantContext;
  try {
    tenantContext = await getTenantContext(supabase);
  } catch (err) {
    const error = err as { code?: string };
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: 'Forbidden: No tenant membership' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 });
  }

  const { userRole } = tenantContext;

  // More restrictive: only owners and admins
  const hasAccess = ['owner', 'admin'].includes(userRole);

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Only owners and admins can perform this action' },
      { status: 403 }
    );
  }

  const body = await request.json();

  // Your business logic here
  return NextResponse.json({
    message: 'Action completed successfully',
    data: body,
  });
}
