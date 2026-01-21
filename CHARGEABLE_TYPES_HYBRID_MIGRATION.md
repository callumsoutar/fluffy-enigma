# Chargeable Types Hybrid Migration Summary

## Overview
The `chargeable_types` table has been converted from a purely tenant-scoped model to a **hybrid model** that supports both:
- **Global types**: System-wide chargeable types available to all tenants (e.g., landing fees, instruction, aircraft hire)
- **Tenant-specific types**: Custom chargeable types that individual tenants can create for their unique needs

This change provides maximum flexibility while avoiding data duplication for common chargeable types.

## Hybrid Model Benefits

### Before (Tenant-Scoped Only):
- Each tenant had to create their own chargeable types
- Standard types were duplicated across all tenants
- No way to provide pre-configured standard types
- Inconsistent naming and categorization across tenants

### After (Hybrid Global + Tenant-Specific):
- ✅ Global default types available to all tenants out of the box
- ✅ No duplication of standard chargeable types
- ✅ Tenants can still create custom types for their specific needs
- ✅ Consistent standard types across all flight schools
- ✅ Flexibility for unique business requirements

## Changes Made

### 1. Database Migration (`022_make_chargeable_types_hybrid.sql`)

#### Added:
- **`is_global` column**: Boolean flag to distinguish global from tenant-specific types
  - `true` = Global type available to all tenants
  - `false` = Tenant-specific custom type

#### Modified:
- **`tenant_id` column**: Changed from `NOT NULL` to nullable
  - `NULL` for global types
  - Set to tenant UUID for tenant-specific types

#### Constraints Added:
- **Data integrity constraint**: Ensures global types have `NULL` tenant_id and tenant-specific types have a valid tenant_id
- **Unique indexes**:
  - `idx_chargeable_types_code_per_tenant`: Ensures code uniqueness within each tenant
  - `idx_chargeable_types_code_global`: Ensures code uniqueness for global types

#### RLS Policies (Replaced):
Dropped old tenant-scoped policies:
- `chargeable_types_tenant_select`
- `chargeable_types_tenant_insert`
- `chargeable_types_tenant_update`
- `chargeable_types_tenant_delete`

Created new hybrid policies:
- **`chargeable_types_hybrid_select`**: Users can see global types AND their tenant's custom types
- **`chargeable_types_hybrid_insert`**: 
  - Admin/Owner can create tenant-specific types for their tenant
  - Only system owners can create global types
- **`chargeable_types_hybrid_update`**: 
  - Admin/Owner can update tenant-specific types in their tenant
  - Only system owners can update global types
- **`chargeable_types_hybrid_delete`**: 
  - Owners can delete tenant-specific types in their tenant
  - Only system owners can delete global types

#### Global Types Seeded:
The following standard chargeable types are available to all tenants:
- `landing_fee` - Landing Fee
- `instruction` - Flight Instruction
- `aircraft_hire` - Aircraft Hire
- `membership_fee` - Membership Fee
- `fuel_surcharge` - Fuel Surcharge
- `cancellation_fee` - Cancellation Fee
- `admin_fee` - Administration Fee
- `exam_fee` - Examination Fee

### 2. TypeScript Types Updated

**File: `/lib/types/chargeables.ts`**

Added fields to `ChargeableType` interface:
```typescript
interface ChargeableType {
  // ... existing fields
  is_global?: boolean        // NEW: Indicates if this is a global type
  tenant_id?: string | null  // MODIFIED: Now nullable
}
```

### 3. API Routes Enhanced

**File: `/app/api/chargeable_types/route.ts`**

#### GET Endpoint Enhanced:
- Added `scope` query parameter: `"all"` | `"global"` | `"tenant"`
- RLS automatically returns global types + tenant-specific types
- Updated ordering: Global types appear first

#### POST Endpoint Added:
- Allows admin/owner users to create tenant-specific chargeable types
- Validates code format (lowercase, alphanumeric, underscores only)
- Automatically sets `is_global=false` and assigns to user's tenant
- Returns 409 if code already exists for that tenant

#### PUT Endpoint Added:
- Allows admin/owner users to update tenant-specific types
- Cannot update global types (unless system owner)
- Supports updating name, description, and is_active fields

#### DELETE Endpoint Added:
- Allows owner users to delete tenant-specific types
- Cannot delete global types (unless system owner)
- Prevents deletion if type is in use by any chargeables

### 4. UI Components Updated

**File: `/components/settings/ChargeablesConfig.tsx`**

- Added visual badges to identify global types in dropdown selects
- Global types show a blue "Global" badge in the type selector
- Users can see which types are standard (global) vs custom (tenant-specific)

## Data Model

### Global Chargeable Type Example:
```sql
{
  "id": "uuid-here",
  "code": "landing_fee",
  "name": "Landing Fee",
  "description": "Fee charged for landing at the aerodrome",
  "is_global": true,
  "tenant_id": null,
  "is_active": true
}
```

### Tenant-Specific Chargeable Type Example:
```sql
{
  "id": "uuid-here",
  "code": "hangar_rental",
  "name": "Hangar Rental",
  "description": "Monthly hangar rental fee",
  "is_global": false,
  "tenant_id": "tenant-uuid-here",
  "is_active": true
}
```

## Security Model

### Access Control via RLS:

| Action | Global Types | Tenant-Specific Types |
|--------|-------------|----------------------|
| **View** | All authenticated users | Users in that tenant |
| **Create** | System owners only | Admin/Owner in tenant |
| **Update** | System owners only | Admin/Owner in tenant |
| **Delete** | System owners only | Owner in tenant |

### Important Notes:
- **Global types are read-only** for normal users (even admins/owners)
- **Tenants cannot modify or delete global types** - they're managed at the system level
- **Tenant-specific types** can be fully managed by that tenant's admin/owner users
- **Code uniqueness** is enforced per scope (global codes are globally unique, tenant codes are unique within each tenant)

## Usage

### For Flight Schools (Tenants):

#### Using Global Types:
1. Global chargeable types are automatically available
2. Simply select them when creating chargeables
3. No setup required - works out of the box

#### Creating Custom Types:
1. Navigate to Settings → Financial → Additional Charges
2. Admin/Owner users can create new chargeable types via API
3. Custom types are only visible to your organization
4. Can use custom codes like `hangar_rental`, `towing_fee`, `club_event`, etc.

### For System Administrators:

#### Managing Global Types:
- Global types should be carefully managed as they affect all tenants
- Use database migrations or SQL to add new global types
- Only owners should have permission to modify global types
- Consider tenant impact before changing/removing global types

#### Adding New Global Types:
```sql
INSERT INTO public.chargeable_types (code, name, description, is_global, is_active)
VALUES ('new_code', 'New Type Name', 'Description', true, true);
```

## Files Modified

### Database:
- ✅ `/supabase/migrations/022_make_chargeable_types_hybrid.sql` - Migration script

### TypeScript Types:
- ✅ `/lib/types/chargeables.ts` - Added `is_global` and updated `tenant_id`

### API Routes:
- ✅ `/app/api/chargeable_types/route.ts` - Enhanced GET, added POST/PUT/DELETE

### UI Components:
- ✅ `/components/settings/ChargeablesConfig.tsx` - Added global type badges

### Documentation:
- ✅ `/CHARGEABLE_TYPES_HYBRID_MIGRATION.md` - This file

## Files Analyzed (No Changes Required)

The following files were reviewed and work correctly with the hybrid model:

1. **`/components/settings/LandingFeesConfig.tsx`** 
   - Uses chargeable_types API ✅
   - RLS handles access control automatically ✅

2. **`/components/invoices/InvoiceLineItemAddRow.tsx`**
   - Fetches and displays chargeable types ✅
   - No changes needed ✅

3. **`/lib/utils/membership-invoice-utils.ts`**
   - References chargeable types by code ✅
   - Works with both global and tenant types ✅

## Migration Steps

### Applying the Migration:

```bash
# The migration is automatically applied via Supabase
# It's located at: supabase/migrations/022_make_chargeable_types_hybrid.sql
```

### Testing After Migration:

1. **Verify global types are visible to all users:**
   ```sql
   SELECT * FROM chargeable_types WHERE is_global = true;
   ```

2. **Test creating a tenant-specific type:**
   ```bash
   curl -X POST /api/chargeable_types \
     -H "Content-Type: application/json" \
     -d '{
       "code": "test_custom_fee",
       "name": "Test Custom Fee",
       "description": "A custom fee for testing"
     }'
   ```

3. **Verify RLS is working:**
   - Users should see global types + their tenant's types only
   - Users should NOT see other tenants' custom types

## Rollback

If rollback is needed (not recommended):

1. Convert global types back to tenant-specific
2. Duplicate global types for each tenant
3. Remove `is_global` column
4. Make `tenant_id` NOT NULL again
5. Restore original tenant-scoped RLS policies

**Note**: Rollback would require careful handling of any tenant-specific types created after the migration.

## Future Enhancements

Potential improvements for the future:

1. **Admin UI for Global Types**: Create a system admin panel to manage global types
2. **Type Categories**: Group types into categories (fees, rentals, services, etc.)
3. **Type Templates**: Allow tenants to "clone" global types to create customized versions
4. **Usage Analytics**: Track which types are most commonly used across tenants
5. **Type Deprecation**: Soft-delete mechanism for phasing out old global types

## Questions?

If you have questions about this migration or encounter issues:
1. Check the RLS policies are correctly applied
2. Verify the `is_global` column exists and is populated correctly
3. Ensure existing code isn't making assumptions about tenant_id being NOT NULL
4. Review the API route changes for query parameter compatibility
