import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/auth/tenant';
import type { EquipmentFilter, EquipmentWithIssuance } from '@/lib/types/equipment';
import { equipmentCreateSchema } from '@/lib/validation/equipment';

/**
 * GET /api/equipment
 * 
 * Fetch equipment with optional filters
 * Requires authentication and instructor/admin/owner role
 * 
 * Security:
 * - Only instructors, admins, and owners can access
 * - RLS policies enforce final data access
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

  // Check authorization - only instructors, admins, and owners can view equipment
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || undefined;
  const status = searchParams.get('status') || undefined;
  const type = searchParams.get('type') || undefined;
  const issued = searchParams.get('issued') === 'true' ? true : undefined;

  const filters: EquipmentFilter = {
    search,
    status: status as EquipmentFilter['status'],
    type: type as EquipmentFilter['type'],
    issued,
  };

  // Build base query - select equipment with open issuances and updates
  let query = supabase
    .from('equipment')
    .select(`
      *,
      current_issuance:equipment_issuance!equipment_issuance_equipment_id_fkey(
        id,
        equipment_id,
        user_id,
        issued_at,
        returned_at,
        issued_by,
        notes,
        expected_return,
        created_at,
        updated_at
      ),
      equipment_updates(
        id,
        equipment_id,
        next_due_at,
        updated_by,
        notes,
        created_at,
        updated_at
      )
    `)
    .is('voided_at', null)
    .order('name', { ascending: true });

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  // Execute query (RLS will filter based on user permissions)
  const { data: equipment, error } = await query;

  if (error) {
    console.error('Error fetching equipment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    );
  }

  if (!equipment || equipment.length === 0) {
    return NextResponse.json({
      equipment: [],
      total: 0,
    });
  }

  // Transform results and filter for open issuances only
  const equipmentWithIssuance: EquipmentWithIssuance[] = equipment.map((e) => {
    // Get all issuances
    const issuances = Array.isArray(e.current_issuance) ? e.current_issuance : (e.current_issuance ? [e.current_issuance] : []);
    
    // Find open issuance (returned_at is null)
    const openIssuance = issuances.find((i: { returned_at: string | null }) => i.returned_at === null);

    // Find most recent issuance (by issued_at descending)
    const mostRecentIssuance = [...issuances].sort((a, b) => 
      new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
    )[0] || null;

    // Find latest update (by created_at descending)
    const updates = Array.isArray(e.equipment_updates) ? e.equipment_updates : [];
    const latestUpdate = [...updates].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] || null;

    return {
      ...e,
      current_issuance: openIssuance || null,
      most_recent_issuance: mostRecentIssuance,
      latest_update: latestUpdate,
    };
  });

  // Apply issued filter if provided
  let filteredEquipment = equipmentWithIssuance;
  if (filters.issued !== undefined) {
    filteredEquipment = equipmentWithIssuance.filter((e) => {
      const hasOpenIssuance = e.current_issuance !== null;
      return filters.issued ? hasOpenIssuance : !hasOpenIssuance;
    });
  }

  // Apply search filter if provided
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredEquipment = filteredEquipment.filter((equipment) => {
      const nameMatch = equipment.name?.toLowerCase().includes(searchLower);
      const serialMatch = equipment.serial_number?.toLowerCase().includes(searchLower);
      const typeMatch = equipment.type?.toLowerCase().includes(searchLower);

      return nameMatch || serialMatch || typeMatch;
    });
  }

  // Fetch user details for issued equipment
  const userIds = filteredEquipment
    .filter((e) => e.current_issuance?.user_id)
    .map((e) => e.current_issuance!.user_id);

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', userIds);

    if (users) {
      filteredEquipment = filteredEquipment.map((e) => {
        if (e.current_issuance) {
          const user = users.find((u) => u.id === e.current_issuance!.user_id);
          return {
            ...e,
            issued_to_user: user || null,
          };
        }
        return e;
      });
    }
  }

  return NextResponse.json({
    equipment: filteredEquipment,
    total: filteredEquipment.length,
  });
}

/**
 * POST /api/equipment
 *
 * Create an equipment record.
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

  const { userRole } = tenantContext;
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

  const parsed = equipmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const v = parsed.data;

  // Normalize empty strings to null for nullable fields
  const equipmentToInsert = {
    name: v.name.trim(),
    label: v.label && v.label.trim() ? v.label.trim() : null,
    type: v.type,
    status: v.status || 'active',
    serial_number: v.serial_number && v.serial_number.trim() ? v.serial_number.trim() : null,
    purchase_date: v.purchase_date || null,
    warranty_expiry: v.warranty_expiry || null,
    notes: v.notes && v.notes.trim() ? v.notes.trim() : null,
    location: v.location && v.location.trim() ? v.location.trim() : null,
    year_purchased: v.year_purchased ?? null,
  };

  const { data: equipment, error } = await supabase
    .from('equipment')
    .insert(equipmentToInsert)
    .select()
    .single();

  if (error) {
    console.error('Error creating equipment:', error);
    return NextResponse.json({ error: 'Failed to create equipment' }, { status: 500 });
  }

  return NextResponse.json({ equipment }, { status: 201 });
}

