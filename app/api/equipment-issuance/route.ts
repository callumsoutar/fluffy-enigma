import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { userHasAnyRole } from '@/lib/auth/roles';
import { equipmentIssuanceSchema, equipmentReturnSchema } from '@/lib/validation/equipment';

/**
 * POST /api/equipment-issuance
 *
 * Issue equipment to a user.
 * Requires authentication and instructor/admin/owner role.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor']);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parsed = equipmentIssuanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const v = parsed.data;

  // Check if equipment has an open issuance
  const { data: existingIssuance } = await supabase
    .from('equipment_issuance')
    .select('id')
    .eq('equipment_id', v.equipment_id)
    .is('returned_at', null)
    .single();

  if (existingIssuance) {
    return NextResponse.json(
      { error: 'Equipment is already issued to another user' },
      { status: 409 }
    );
  }

  // Create issuance record
  const issuanceToInsert = {
    equipment_id: v.equipment_id,
    user_id: v.user_id,
    issued_by: user.id,
    expected_return: v.expected_return || null,
    notes: v.notes && v.notes.trim() ? v.notes.trim() : null,
  };

  const { data: issuance, error } = await supabase
    .from('equipment_issuance')
    .insert(issuanceToInsert)
    .select()
    .single();

  if (error) {
    console.error('Error issuing equipment:', error);
    return NextResponse.json({ error: 'Failed to issue equipment' }, { status: 500 });
  }

  // Update equipment status to 'active' if it was in maintenance or other status
  await supabase
    .from('equipment')
    .update({ status: 'active' })
    .eq('id', v.equipment_id);

  return NextResponse.json({ issuance }, { status: 201 });
}

/**
 * PATCH /api/equipment-issuance
 *
 * Return equipment (mark issuance as returned).
 * Requires authentication and instructor/admin/owner role.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor']);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parsed = equipmentReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const v = parsed.data;

  // Update issuance record to mark as returned
  const { data: issuance, error } = await supabase
    .from('equipment_issuance')
    .update({
      returned_at: new Date().toISOString(),
      notes: v.notes && v.notes.trim() ? v.notes.trim() : null,
    })
    .eq('id', v.issuance_id)
    .select()
    .single();

  if (error) {
    console.error('Error returning equipment:', error);
    return NextResponse.json({ error: 'Failed to return equipment' }, { status: 500 });
  }

  return NextResponse.json({ issuance }, { status: 200 });
}

