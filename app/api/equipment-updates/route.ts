import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/auth/tenant';
import { equipmentUpdateLogSchema } from '@/lib/validation/equipment';

/**
 * POST /api/equipment-updates
 *
 * Log an equipment update/maintenance record.
 * Requires authentication and instructor/admin/owner role.
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

  const { userId: currentUserId, userRole } = tenantContext;
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parsed = equipmentUpdateLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const v = parsed.data;

  // Create update record
  const updateToInsert = {
    equipment_id: v.equipment_id,
    updated_by: currentUserId,
    next_due_at: v.next_due_at || null,
    notes: v.notes && v.notes.trim() ? v.notes.trim() : null,
  };

  const { data: update, error } = await supabase
    .from('equipment_updates')
    .insert(updateToInsert)
    .select()
    .single();

  if (error) {
    console.error('Error logging equipment update:', error);
    return NextResponse.json({ error: 'Failed to log equipment update' }, { status: 500 });
  }

  return NextResponse.json({ update }, { status: 201 });
}

/**
 * GET /api/equipment-updates
 *
 * Fetch equipment update history.
 * Requires authentication and instructor/admin/owner role.
 */
export async function GET(request: NextRequest) {
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
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  // Get equipment_id from query params
  const searchParams = request.nextUrl.searchParams;
  const equipmentId = searchParams.get('equipment_id');

  if (!equipmentId) {
    return NextResponse.json({ error: 'equipment_id is required' }, { status: 400 });
  }

  // Fetch updates for the equipment
  const { data: updates, error } = await supabase
    .from('equipment_updates')
    .select(`
      *,
      updated_by_user:users!equipment_updates_updated_by_fkey(
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('equipment_id', equipmentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching equipment updates:', error);
    return NextResponse.json({ error: 'Failed to fetch equipment updates' }, { status: 500 });
  }

  return NextResponse.json({ updates: updates || [] }, { status: 200 });
}

