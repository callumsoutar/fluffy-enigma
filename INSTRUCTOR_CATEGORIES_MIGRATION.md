# Instructor Categories Migration Summary

## Overview
The `instructor_categories` table has been converted from tenant-scoped to global. This change reflects the reality that instructor categories (A-Cat, B-Cat, C-Cat) are standardized in New Zealand and should be available to all tenants without duplication.

## Changes Made

### 1. Database Migration (`021_make_instructor_categories_global.sql`)

#### Removed:
- `tenant_id` column from `instructor_categories` table
- `idx_instructor_categories_tenant_id` index
- Tenant-specific RLS policies:
  - `instructor_categories_tenant_select`
  - `instructor_categories_tenant_insert`
  - `instructor_categories_tenant_update`
  - `instructor_categories_tenant_delete`

#### Added:
- **Global RLS Policies:**
  - `instructor_categories_global_select`: Any authenticated user can read all categories
  - `instructor_categories_global_insert`: Only admin/owner users can insert new categories
  - `instructor_categories_global_update`: Only admin/owner users can update categories
  - `instructor_categories_global_delete`: Only owner users can delete categories (very restrictive)

### 2. Code Analysis

#### No Changes Required:
The following files were reviewed and **require no modifications**:

1. **`/lib/types/instructor-categories.ts`**
   - Already defined without `tenant_id`
   - ✅ No changes needed

2. **`/app/api/instructor-categories/route.ts`**
   - Already fetches all categories without tenant filtering
   - ✅ No changes needed

3. **`/app/api/instructors/route.ts`**
   - Uses join to fetch rating categories
   - ✅ No changes needed

4. **`/app/api/instructors/[id]/route.ts`**
   - Fetches rating category by ID only (no tenant filter)
   - ✅ No changes needed

5. **`/app/api/members/[id]/instructor-profile/route.ts`**
   - References categories by UUID only
   - ✅ No changes needed

6. **`/components/members/CreateInstructorProfileDialog.tsx`**
   - Fetches from API endpoint
   - ✅ No changes needed

7. **`/app/staff/instructors/[id]/page.tsx`**
   - Fetches from API endpoint
   - ✅ No changes needed

## Data Integrity

The migration preserved all existing data:
- ✅ A-Cat (Category A Flight Instructor Rating)
- ✅ B-Cat (Category B Flight Instructor Rating)
- ✅ C-Cat (Category C Flight Instructor Rating)

All categories are now globally accessible to all tenants.

## Security Model

### Before (Tenant-Scoped):
- Each tenant could potentially create their own instructor categories
- Categories were isolated per tenant
- Duplicated standardized data across tenants

### After (Global):
- All instructor categories are shared across tenants
- Any authenticated user can view categories
- Only admin/owner users can manage categories
- No data duplication
- Reflects the standardized nature of NZ instructor categories

## Migration Applied

The migration was successfully applied to Supabase project `fergmobsjyucucxeumvb` on **January 21, 2026**.

### Verification Results:
```
✅ Column count: 6 (id, name, description, country, created_at, updated_at)
✅ tenant_id column removed: Confirmed
✅ RLS enabled: Yes
✅ Policy count: 4 (global select, insert, update, delete)
✅ Data integrity: 3 categories preserved
```

## Usage

### For Users:
When creating or editing instructor profiles, users can now select from standardized instructor categories without needing to create their own.

### For Administrators:
Instructor categories are managed at the system level. To add new categories, an admin/owner from any tenant can access the data, but modification requires elevated permissions.

## Future Considerations

If instructor categories need to vary by country in the future, consider:
1. Adding a `country` filter field (already exists in the table)
2. Filtering categories by the tenant's configured country
3. Maintaining the global nature while providing country-specific views

## Rollback

If rollback is needed, see the rollback script at the end of migration `020_add_multi_tenant_support.sql`. However, this would require:
1. Re-adding `tenant_id` column
2. Assigning all existing categories to a specific tenant
3. Restoring tenant-scoped RLS policies
4. Potentially duplicating categories for other tenants

**Note:** Rollback is not recommended as it would reintroduce data duplication and complexity.
