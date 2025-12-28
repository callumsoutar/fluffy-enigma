import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { userHasAnyRole } from '@/lib/auth/roles';
import { equipmentUpdateSchema } from '@/lib/validation/equipment';

/**
 * PATCH /api/equipment/[id]
 *
 * Update an equipment record.
 * Requires authentication and instructor/admin/owner role.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor']);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parsed = equipmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const v = parsed.data;

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {};
  
  if (v.name !== undefined) updateData.name = v.name.trim();
  if (v.label !== undefined) updateData.label = v.label && v.label.trim() ? v.label.trim() : null;
  if (v.type !== undefined) updateData.type = v.type;
  if (v.status !== undefined) updateData.status = v.status;
  if (v.serial_number !== undefined) updateData.serial_number = v.serial_number && v.serial_number.trim() ? v.serial_number.trim() : null;
  if (v.location !== undefined) updateData.location = v.location && v.location.trim() ? v.location.trim() : null;
  if (v.notes !== undefined) updateData.notes = v.notes && v.notes.trim() ? v.notes.trim() : null;
  if (v.year_purchased !== undefined) updateData.year_purchased = v.year_purchased ?? null;

  const { data: equipment, error } = await supabase
    .from('equipment')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating equipment:', error);
    return NextResponse.json({ error: 'Failed to update equipment' }, { status: 500 });
  }

  return NextResponse.json({ equipment }, { status: 200 });
}

/**
 * GET /api/equipment/[id]
 *
 * Get a single equipment record with its issuance history.
 * Requires authentication and instructor/admin/owner role.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor']);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;

  const { data: equipment, error } = await supabase
    .from('equipment')
    .select(`
      *,
      issuances:equipment_issuance!equipment_issuance_equipment_id_fkey(
        id,
        equipment_id,
        user_id,
        issued_at,
        returned_at,
        issued_by,
        notes,
        expected_return,
        created_at,
        updated_at,
        user:users!equipment_issuance_user_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      ),
      updates:equipment_updates!equipment_updates_equipment_id_fkey(
        id,
        equipment_id,
        next_due_at,
        updated_by,
        notes,
        created_at,
        updated_at,
        updated_by_user:users!equipment_updates_updated_by_fkey(
          id,
          first_name,
          last_name,
          email
        )
      )
    `)
    .eq('id', id)
    .is('voided_at', null)
    .single();

  if (error) {
    console.error('Error fetching equipment:', error);
    return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
  }

  return NextResponse.json({ equipment }, { status: 200 });
}

/**
 * DELETE /api/equipment/[id]
 *
 * Delete an equipment record (soft delete by setting voided_at).
 * Requires authentication and admin/owner role.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin']);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;

  // Check if equipment has any open issuances
  const { data: openIssuances } = await supabase
    .from('equipment_issuance')
    .select('id')
    .eq('equipment_id', id)
    .is('returned_at', null);

  if (openIssuances && openIssuances.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete equipment with open issuances. Please return all issued items first.' },
      { status: 409 }
    );
  }

  // Soft delete by setting voided_at
  const { error } = await supabase
    .from('equipment')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting equipment:', error);
    return NextResponse.json({ error: 'Failed to delete equipment' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

