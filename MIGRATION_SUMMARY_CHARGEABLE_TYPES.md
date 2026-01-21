# Migration Summary: Chargeable Types Hybrid Model

## Executive Summary

The `chargeable_types` table has been successfully refactored from a tenant-scoped model to a **hybrid model** that supports both:
- **Global types**: Available to all tenants (e.g., landing fees, instruction, aircraft hire)
- **Tenant-specific types**: Custom types that individual organizations can create

This provides the best of both worlds: standardization where needed, flexibility where desired.

## What Was Changed

### 1. Database Migration
**File**: `supabase/migrations/022_make_chargeable_types_hybrid.sql`

- Added `is_global` boolean column
- Made `tenant_id` nullable (NULL for global types)
- Added data integrity constraints
- Created unique indexes for code uniqueness (per-tenant and global)
- Updated RLS policies for hybrid access control
- Seeded 8 standard global chargeable types

### 2. TypeScript Types
**File**: `lib/types/chargeables.ts`

- Added `is_global?: boolean` field
- Updated `tenant_id` to be nullable

### 3. API Routes
**File**: `app/api/chargeable_types/route.ts`

- **Enhanced GET**: Added `scope` query parameter, improved ordering
- **Added POST**: Create tenant-specific chargeable types
- **Added PUT**: Update existing chargeable types
- **Added DELETE**: Delete tenant-specific types (with validation)

### 4. UI Components
**File**: `components/settings/ChargeablesConfig.tsx`

- Added visual badges to identify global vs tenant-specific types
- Blue "Global" badge shows in type selector dropdowns

### 5. Documentation
**Files**: 
- `CHARGEABLE_TYPES_HYBRID_MIGRATION.md` - Comprehensive migration documentation
- `MIGRATION_SUMMARY_CHARGEABLE_TYPES.md` - This summary

## Global Chargeable Types Seeded

The migration automatically seeds these global types:

| Code | Name | Description |
|------|------|-------------|
| `landing_fee` | Landing Fee | Fee charged for landing at the aerodrome |
| `instruction` | Flight Instruction | Fee for flight instruction/training |
| `aircraft_hire` | Aircraft Hire | Fee for aircraft rental/hire |
| `membership_fee` | Membership Fee | Club membership fee |
| `fuel_surcharge` | Fuel Surcharge | Additional fuel cost surcharge |
| `cancellation_fee` | Cancellation Fee | Fee for late booking cancellation |
| `admin_fee` | Administration Fee | General administrative fee |
| `exam_fee` | Examination Fee | Fee for examinations and tests |

## Benefits of Hybrid Model

### Before (Tenant-Only):
- ❌ Each tenant had to create standard types manually
- ❌ Duplication of common types across all tenants
- ❌ Inconsistent naming and categorization
- ❌ No out-of-the-box types for new tenants

### After (Hybrid):
- ✅ Standard types available immediately to all tenants
- ✅ No duplication of common types
- ✅ Consistent naming across flight schools
- ✅ Tenants can still create custom types for unique needs
- ✅ Reduced onboarding time for new organizations

## Security Model

### Access Control via RLS:

| User Type | Global Types | Tenant-Specific Types |
|-----------|-------------|----------------------|
| All Users | ✅ Read | ✅ Read (own tenant only) |
| Admin | ❌ Read-only | ✅ Create, Update (own tenant) |
| Owner | ❌ Read-only* | ✅ Full CRUD (own tenant) |

*System owners (owners in any tenant) can manage global types, but this should be rare

## Testing Checklist

### Before Applying Migration:
- [ ] Backup database
- [ ] Review migration file for correctness
- [ ] Ensure no custom modifications to `chargeable_types` table

### After Applying Migration:
- [ ] Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'chargeable_types';`
- [ ] Check global types exist: `SELECT * FROM chargeable_types WHERE is_global = true;`
- [ ] Verify RLS policies: `SELECT policyname FROM pg_policies WHERE tablename = 'chargeable_types';`
- [ ] Test API endpoints:
  - [ ] `GET /api/chargeable_types` returns global + tenant types
  - [ ] `GET /api/chargeable_types?scope=global` returns only global types
  - [ ] `GET /api/chargeable_types?scope=tenant` returns only tenant types
  - [ ] `POST /api/chargeable_types` creates tenant-specific type (admin/owner only)
  - [ ] `PUT /api/chargeable_types` updates tenant type
  - [ ] `DELETE /api/chargeable_types` deletes tenant type (owner only)
- [ ] Test UI:
  - [ ] Global types show "Global" badge in dropdowns
  - [ ] Can create chargeables using global types
  - [ ] Can create custom tenant-specific types (if admin/owner)
- [ ] Test with existing chargeables:
  - [ ] Existing chargeables still reference their types correctly
  - [ ] Invoice creation works with membership_fee type
  - [ ] Landing fees config works correctly

### API Testing Examples:

```bash
# Get all chargeable types (global + tenant-specific)
curl -H "Authorization: Bearer $TOKEN" \
  https://your-project.supabase.co/rest/v1/chargeable_types

# Get only global types
curl -H "Authorization: Bearer $TOKEN" \
  https://your-project.supabase.co/rest/v1/chargeable_types?scope=global

# Create a tenant-specific type (via your API route)
curl -X POST http://localhost:3000/api/chargeable_types \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "code": "hangar_rental",
    "name": "Hangar Rental",
    "description": "Monthly hangar rental fee"
  }'

# Update a tenant-specific type
curl -X PUT http://localhost:3000/api/chargeable_types \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "id": "type-uuid-here",
    "name": "Updated Name",
    "is_active": false
  }'

# Delete a tenant-specific type
curl -X DELETE "http://localhost:3000/api/chargeable_types?id=type-uuid-here" \
  -H "Cookie: your-session-cookie"
```

### SQL Verification Queries:

```sql
-- Check table structure
\d chargeable_types

-- Verify global types exist
SELECT id, code, name, is_global, tenant_id 
FROM chargeable_types 
WHERE is_global = true
ORDER BY code;

-- Check RLS policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd 
FROM pg_policies 
WHERE tablename = 'chargeable_types';

-- Verify constraints
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.chargeable_types'::regclass;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'chargeable_types';

-- Test a user can see global types + their tenant's types
-- (Run as specific user)
SELECT code, name, is_global, tenant_id 
FROM chargeable_types 
ORDER BY is_global DESC, code;
```

## Migration Instructions

### Local Development:

1. **Review the migration file**:
   ```bash
   cat supabase/migrations/022_make_chargeable_types_hybrid.sql
   ```

2. **Apply via Supabase CLI** (if using local dev):
   ```bash
   supabase db reset  # This will apply all migrations
   # OR
   supabase migration up  # Apply pending migrations only
   ```

3. **Test locally**:
   ```bash
   npm run dev
   # Navigate to Settings > Financial > Additional Charges
   # Verify global types are visible
   ```

### Production Deployment:

1. **Backup database first**:
   ```bash
   supabase db dump -f backup-before-chargeable-types-migration.sql
   ```

2. **Apply migration**:
   - Via Supabase Dashboard: Database > Migrations > Upload and run
   - Via CLI: `supabase db push`

3. **Verify deployment**:
   - Run SQL verification queries (see above)
   - Test API endpoints
   - Check UI functionality

4. **Monitor for issues**:
   - Check Supabase logs for errors
   - Monitor API route logs
   - Test with real users

## Rollback Plan

If issues arise, rollback steps:

1. **Stop using tenant-specific types** (if any were created)
2. **Restore from backup**:
   ```bash
   supabase db restore backup-before-chargeable-types-migration.sql
   ```

**Note**: Rollback is not recommended as it would lose any tenant-specific types created after migration. Instead, fix forward if possible.

## Common Issues & Solutions

### Issue: RLS policies blocking access
**Solution**: Verify user has active tenant membership and correct role

### Issue: Cannot create global types
**Expected**: Only system owners can create global types. Use migration or direct SQL.

### Issue: Duplicate code error when creating tenant type
**Solution**: Code already exists for your tenant. Choose a different code.

### Issue: Cannot delete chargeable type
**Cause**: Type is in use by chargeables
**Solution**: Remove or reassign chargeables first, or set type to inactive instead

## Future Enhancements

Potential improvements:
1. Admin UI for managing global types
2. Type categories/grouping
3. Ability to "clone" global types to create customized versions
4. Usage analytics for types
5. Soft-delete mechanism for deprecating types

## Files Modified Summary

| File | Type | Status |
|------|------|--------|
| `supabase/migrations/022_make_chargeable_types_hybrid.sql` | Migration | ✅ Created |
| `lib/types/chargeables.ts` | Types | ✅ Updated |
| `app/api/chargeable_types/route.ts` | API | ✅ Enhanced |
| `components/settings/ChargeablesConfig.tsx` | UI | ✅ Updated |
| `CHARGEABLE_TYPES_HYBRID_MIGRATION.md` | Docs | ✅ Created |
| `MIGRATION_SUMMARY_CHARGEABLE_TYPES.md` | Docs | ✅ Created |

## Files Analyzed (No Changes Needed)

| File | Reason |
|------|--------|
| `components/settings/LandingFeesConfig.tsx` | Uses API, RLS handles access |
| `components/invoices/InvoiceLineItemAddRow.tsx` | Fetches types, works with hybrid |
| `lib/utils/membership-invoice-utils.ts` | References by code, works with hybrid |

## Questions?

For questions or issues:
1. Review `CHARGEABLE_TYPES_HYBRID_MIGRATION.md` for detailed documentation
2. Check RLS policies are applied correctly
3. Verify `is_global` column exists and is populated
4. Test API endpoints with proper authentication
5. Check browser console and server logs for errors

---

**Migration Date**: January 21, 2026
**Migration Version**: 022
**Author**: Aero Safety Development Team
