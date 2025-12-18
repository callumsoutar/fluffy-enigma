/**
 * Example Protected API Route
 * 
 * This demonstrates how to protect API routes using role-based authorization.
 * Copy this pattern for all your protected API endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { userHasAnyRole } from '@/lib/auth/roles';

/**
 * GET /api/example-protected
 * 
 * Example endpoint that requires owner, admin, or instructor role
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check role authorization
  const hasAccess = await userHasAnyRole(user.id, [
    'owner',
    'admin',
    'instructor',
  ]);

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
      id: user.id,
      email: user.email,
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // More restrictive: only owners and admins
  const hasAccess = await userHasAnyRole(user.id, [
    'owner',
    'admin',
  ]);

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
