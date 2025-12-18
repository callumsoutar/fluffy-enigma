# Migration Plan: Consolidating flight_logs into bookings

## Overview
This plan consolidates the `flight_logs` table into the `bookings` table to simplify the data model. Flight logs will become part of the booking record, eliminating the need for a separate table.

## Current State Analysis

### Bookings Table Columns
- Core: `id`, `aircraft_id`, `user_id`, `instructor_id`, `flight_type_id`, `lesson_id`
- Scheduling: `start_time`, `end_time`, `status`, `booking_type`
- Content: `purpose`, `remarks`, `notes`
- Authorization: `authorization_override*` fields
- Cancellation: `cancellation_*` fields
- Metadata: `created_at`, `updated_at`, `voucher_number`

### Flight_logs Table Columns
- Reference: `id`, `booking_id` (FK)
- Checkout: `checked_out_aircraft_id`, `checked_out_instructor_id`
- Actual Times: `actual_start`, `actual_end`, `eta`
- Meter Readings: `hobbs_start`, `hobbs_end`, `tach_start`, `tach_end`
- Calculated Times: `flight_time_hobbs`, `flight_time_tach`, `flight_time`
- Flight Details: `fuel_on_board`, `passengers`, `route`, `equipment`
- Completion Flags: `briefing_completed`, `authorization_completed`
- Remarks: `flight_remarks`
- Time Tracking: `solo_end_hobbs`, `dual_time`, `solo_time`, `total_hours_start`, `total_hours_end`
- Duplicates: `flight_type_id`, `lesson_id`, `description`, `remarks`
- Metadata: `created_at`, `updated_at`

### Duplicate Fields Resolution
- `flight_type_id`: Keep in bookings (already exists)
- `lesson_id`: Keep in bookings (already exists)
- `description`: Add to bookings (currently only in flight_logs)
- `remarks`: Keep bookings.remarks as primary; merge flight_logs.remarks if different

## Migration Strategy

### Phase 1: Schema Changes (Database Migration)

#### Step 1.1: Add New Columns to Bookings Table
Add all flight_logs-specific columns that don't already exist:

```sql
-- Checkout fields (REQUIRED per user requirements)
ALTER TABLE bookings 
  ADD COLUMN checked_out_aircraft_id UUID REFERENCES aircraft(id),
  ADD COLUMN checked_out_instructor_id UUID REFERENCES instructors(id);

-- Actual flight times
ALTER TABLE bookings 
  ADD COLUMN actual_start TIMESTAMPTZ,
  ADD COLUMN actual_end TIMESTAMPTZ,
  ADD COLUMN eta TIMESTAMPTZ;

-- Meter readings
ALTER TABLE bookings 
  ADD COLUMN hobbs_start NUMERIC,
  ADD COLUMN hobbs_end NUMERIC,
  ADD COLUMN tach_start NUMERIC,
  ADD COLUMN tach_end NUMERIC;

-- Calculated flight times
ALTER TABLE bookings 
  ADD COLUMN flight_time_hobbs NUMERIC,
  ADD COLUMN flight_time_tach NUMERIC,
  ADD COLUMN flight_time NUMERIC;

-- Flight details
ALTER TABLE bookings 
  ADD COLUMN fuel_on_board INTEGER,
  ADD COLUMN passengers TEXT,
  ADD COLUMN route TEXT,
  ADD COLUMN equipment JSONB;

-- Completion flags
ALTER TABLE bookings 
  ADD COLUMN briefing_completed BOOLEAN DEFAULT false,
  ADD COLUMN authorization_completed BOOLEAN DEFAULT false;

-- Flight-specific remarks
ALTER TABLE bookings 
  ADD COLUMN flight_remarks TEXT;

-- Time tracking
ALTER TABLE bookings 
  ADD COLUMN solo_end_hobbs NUMERIC,
  ADD COLUMN dual_time NUMERIC,
  ADD COLUMN solo_time NUMERIC,
  ADD COLUMN total_hours_start NUMERIC,
  ADD COLUMN total_hours_end NUMERIC;

-- Description (from flight_logs, doesn't exist in bookings)
ALTER TABLE bookings 
  ADD COLUMN description TEXT;
```

#### Step 1.2: Data Migration
Copy flight_logs data to bookings:

```sql
-- Migrate flight_logs data to bookings
UPDATE bookings b
SET 
  -- Checkout fields
  checked_out_aircraft_id = fl.checked_out_aircraft_id,
  checked_out_instructor_id = fl.checked_out_instructor_id,
  
  -- Actual times (prefer flight_logs, fallback to booking times)
  actual_start = COALESCE(fl.actual_start, b.start_time),
  actual_end = COALESCE(fl.actual_end, b.end_time),
  eta = fl.eta,
  
  -- Meter readings
  hobbs_start = fl.hobbs_start,
  hobbs_end = fl.hobbs_end,
  tach_start = fl.tach_start,
  tach_end = fl.tach_end,
  
  -- Calculated times
  flight_time_hobbs = fl.flight_time_hobbs,
  flight_time_tach = fl.flight_time_tach,
  flight_time = fl.flight_time,
  
  -- Flight details
  fuel_on_board = fl.fuel_on_board,
  passengers = fl.passengers,
  route = fl.route,
  equipment = fl.equipment,
  
  -- Completion flags
  briefing_completed = COALESCE(fl.briefing_completed, false),
  authorization_completed = COALESCE(fl.authorization_completed, false),
  
  -- Remarks (merge: prefer flight_logs.remarks if exists, else keep bookings.remarks)
  flight_remarks = fl.flight_remarks,
  remarks = COALESCE(fl.remarks, b.remarks),
  
  -- Time tracking
  solo_end_hobbs = fl.solo_end_hobbs,
  dual_time = fl.dual_time,
  solo_time = fl.solo_time,
  total_hours_start = fl.total_hours_start,
  total_hours_end = fl.total_hours_end,
  
  -- Description (from flight_logs)
  description = fl.description,
  
  -- Duplicates: prefer flight_logs values if they exist (more recent/accurate)
  flight_type_id = COALESCE(fl.flight_type_id, b.flight_type_id),
  lesson_id = COALESCE(fl.lesson_id, b.lesson_id)
  
FROM flight_logs fl
WHERE fl.booking_id = b.id;
```

#### Step 1.3: Verify Data Migration
```sql
-- Check for any bookings that had flight_logs but migration failed
SELECT b.id, b.purpose, fl.id as flight_log_id
FROM bookings b
INNER JOIN flight_logs fl ON fl.booking_id = b.id
WHERE b.checked_out_aircraft_id IS NULL 
  AND fl.checked_out_aircraft_id IS NOT NULL;

-- Count migrated records
SELECT 
  COUNT(*) as total_bookings,
  COUNT(checked_out_aircraft_id) as bookings_with_checkout_data,
  COUNT(actual_start) as bookings_with_actual_times,
  COUNT(hobbs_start) as bookings_with_meter_readings
FROM bookings;
```

#### Step 1.4: Drop flight_logs Table
```sql
-- Drop foreign key constraints first
ALTER TABLE flight_logs DROP CONSTRAINT IF EXISTS flight_logs_booking_id_fkey;
ALTER TABLE flight_logs DROP CONSTRAINT IF EXISTS flight_logs_checked_out_aircraft_id_fkey;
ALTER TABLE flight_logs DROP CONSTRAINT IF EXISTS flight_logs_checked_out_instructor_id_fkey;
ALTER TABLE flight_logs DROP CONSTRAINT IF EXISTS flight_logs_flight_type_id_fkey;
ALTER TABLE flight_logs DROP CONSTRAINT IF EXISTS flight_logs_lesson_id_fkey;

-- Drop the table
DROP TABLE IF EXISTS flight_logs;
```

### Phase 2: API Route Updates

#### Step 2.1: Update Flight Logs API Route
**File:** `app/api/flight-logs/route.ts`

**Changes:**
- Change all operations to work with `bookings` table instead of `flight_logs`
- Update field references (remove `booking_id` from payload, use booking `id` directly)
- Update SELECT queries to use bookings table with proper joins
- Remove `booking_id` from ALLOWED_FIELDS (no longer needed)

**Key Changes:**
```typescript
// OLD: Check for existing flight log
const { data: existing } = await supabase
  .from("flight_logs")
  .select("id")
  .eq("booking_id", booking_id)
  .maybeSingle()

// NEW: Check booking directly
const { data: existingBooking } = await supabase
  .from("bookings")
  .select("id, checked_out_aircraft_id") // Check if already checked out
  .eq("id", booking_id)
  .single()

// OLD: Insert/Update flight_logs
// NEW: Update bookings table with flight log fields
```

#### Step 2.2: Update Bookings API Routes
**Files:** 
- `app/api/bookings/[id]/route.ts`
- `app/api/bookings/route.ts`

**Changes:**
- Add flight log fields to SELECT queries
- Add flight log fields to PATCH update logic
- Update validation schemas to include flight log fields

### Phase 3: Frontend Updates

#### Step 3.1: Update TypeScript Types
**Files:**
- `lib/types/bookings.ts`
- `lib/types/flight-logs.ts` (mark as deprecated, remove after migration)

**Changes:**
- Add all flight log fields to `Booking` interface
- Add `checked_out_aircraft` and `checked_out_instructor` to `BookingWithRelations`
- Update `FlightLog` type to extend `Booking` or mark as deprecated

#### Step 3.2: Update Checkout Page
**File:** `app/bookings/[id]/checkout/page.tsx`

**Changes:**
- Remove all `flight_logs` API calls
- Update form to work directly with booking data
- Change mutation to update booking instead of creating/updating flight log
- Update form initialization to read from booking fields directly
- Remove `existingFlightLog` logic, use `booking` only

**Key Changes:**
```typescript
// OLD: Fetch flight log separately
const flightLogQuery = useQuery({
  queryKey: ["flightLog", bookingId],
  queryFn: () => fetchJson(`/api/flight-logs?booking_id=${bookingId}`)
})

// NEW: Booking already contains all flight log data
// No separate query needed

// OLD: Create/update flight log
await fetchJson(`/api/flight-logs`, {
  method: "POST",
  body: JSON.stringify({ booking_id, ...flightLogData })
})

// NEW: Update booking directly
await fetchJson(`/api/bookings/${bookingId}`, {
  method: "PATCH",
  body: JSON.stringify({ ...flightLogData })
})
```

#### Step 3.3: Update Check-in Page
**File:** `app/bookings/[id]/checkin/page.tsx`

**Changes:**
- Remove `flight_logs` API calls
- Update to read/write directly to booking fields
- Simplify form initialization (no need to check flight_logs separately)

#### Step 3.4: Update Booking Detail Page
**File:** `app/bookings/[id]/page.tsx`

**Changes:**
- Remove any flight_logs references
- Display flight log data from booking fields
- Update any queries that reference flight_logs

#### Step 3.5: Update Other Components
**Files to check:**
- `components/aircraft/aircraft-flight-history-tab.tsx` - Update queries
- Any other components that query flight_logs

### Phase 4: Validation Schema Updates

#### Step 4.1: Update Booking Validation
**File:** `lib/validation/bookings.ts`

**Changes:**
- Add flight log fields to `bookingUpdateSchema`
- Make flight log fields optional (only populated for flight bookings)

#### Step 4.2: Deprecate Flight Log Validation
**File:** `lib/validation/flight-logs.ts`

**Changes:**
- Mark schemas as deprecated
- Add migration notes
- Can be removed after migration is complete

### Phase 5: RLS Policy Updates

#### Step 5.1: Review RLS Policies
- Ensure bookings RLS policies allow access to new flight log fields
- Remove any flight_logs-specific RLS policies
- Update policies if needed for checked_out_aircraft_id and checked_out_instructor_id

### Phase 6: Testing & Verification

#### Step 6.1: Data Integrity Checks
- Verify all flight_logs data migrated correctly
- Check for any orphaned or missing data
- Verify foreign key relationships

#### Step 6.2: Functional Testing
- Test checkout flow (create booking → checkout → verify data)
- Test check-in flow (checkout → check-in → verify meter readings)
- Test booking updates (edit booking → verify flight log fields preserved)
- Test queries (list bookings, filter by flight log fields)

#### Step 6.3: Edge Cases
- Bookings without flight_logs (should work fine, fields will be NULL)
- Bookings with partial flight_logs data
- Multiple flight_logs per booking (shouldn't exist, but verify)

## Migration Execution Order

1. **Backup Database** (CRITICAL - do this first!)
2. Create migration file with schema changes
3. Run Phase 1 (Schema + Data Migration) in a transaction
4. Update API routes (Phase 2)
5. Update frontend types (Phase 3.1)
6. Update frontend pages (Phase 3.2-3.5)
7. Update validation schemas (Phase 4)
8. Review RLS policies (Phase 5)
9. Test thoroughly (Phase 6)
10. Remove deprecated code (flight_logs types, API routes)

## Rollback Plan

If issues arise:
1. Restore database from backup
2. Revert code changes
3. Re-enable flight_logs table (if dropped)

## Risk Assessment

**High Risk:**
- Data migration (could lose data if not done correctly)
- Breaking existing functionality during transition

**Mitigation:**
- Comprehensive backup before migration
- Test migration on staging/dev first
- Gradual rollout (migrate code, then drop table after verification)
- Keep flight_logs table read-only during transition period

## Post-Migration Cleanup

After successful migration and verification:
1. Remove `app/api/flight-logs/route.ts`
2. Remove `lib/types/flight-logs.ts`
3. Remove `lib/validation/flight-logs.ts` (or mark as deprecated)
4. Update documentation
5. Remove any remaining flight_logs references in codebase

## Notes

- `checked_out_aircraft_id` and `checked_out_instructor_id` are REQUIRED fields per user requirements
- Flight log fields should only be populated for `booking_type = 'flight'`
- Consider adding a check constraint or trigger to ensure flight log fields are only set for flight bookings
- The `description` field from flight_logs will be added to bookings (doesn't currently exist)
